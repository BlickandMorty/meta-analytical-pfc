import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/api-middleware';
import { streamText } from 'ai';
import { logger } from '@/lib/debug-logger';
import { resolveProvider } from '@/lib/engine/llm/provider';
import type { InferenceConfig } from '@/lib/engine/llm/config';
import {
  createSSEWriter,
  isAbortLikeError,
  parseBodyWithLimit,
  sanitizeErrorMessage,
} from '@/lib/api-utils';

interface NotesAIRequestBody {
  pages?: unknown;
  blocks?: unknown;
  prompt?: unknown;
  targetBlockId?: unknown;
  inferenceConfig?: InferenceConfig;
}

interface NotesAIPageInput {
  id: string;
  title: string;
}

interface NotesAIBlockInput {
  id: string;
  pageId: string;
  order: string;
  indent: number;
  content: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizePages(raw: unknown): NotesAIPageInput[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;

  const pages: NotesAIPageInput[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (!id || !title) return null;
    pages.push({ id, title });
  }
  return pages;
}

function normalizeBlocks(raw: unknown): NotesAIBlockInput[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;

  const blocks: NotesAIBlockInput[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const pageId = typeof item.pageId === 'string' ? item.pageId.trim() : '';
    const order = typeof item.order === 'string' ? item.order : '';
    const content = typeof item.content === 'string' ? item.content : '';
    const indent =
      typeof item.indent === 'number' && Number.isFinite(item.indent)
        ? Math.max(0, Math.floor(item.indent))
        : 0;
    if (!id || !pageId || !order) return null;
    blocks.push({ id, pageId, order, indent, content });
  }
  return blocks;
}

// ── SSE helper ──
function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ── Build note content string ──
function buildNoteContent(pages: NotesAIPageInput[], blocks: NotesAIBlockInput[]): string {
  const sections: string[] = [];

  for (const page of pages) {
    const pageBlocks = blocks
      .filter((b) => b.pageId === page.id)
      .sort((a, b) => a.order.localeCompare(b.order));

    const blockContent = pageBlocks
      .map((b) => {
        const indent = '  '.repeat(b.indent || 0);
        const text = b.content.replace(/<[^>]*>/g, '');
        return text.trim() ? `${indent}${text}` : '';
      })
      .filter(Boolean)
      .join('\n');

    if (blockContent.trim()) {
      sections.push(`## ${page.title}\n${blockContent}`);
    }
  }

  return sections.join('\n\n');
}

// ── Build the system prompt for a given action ──
function buildSystemPrompt(action: string): string {
  return `You are an intelligent note-taking assistant embedded in a knowledge management app. Your role is to help users write, expand, and refine their notes.

Guidelines:
- Write in a natural, conversational tone that matches the user's existing style.
- Be concise and direct. Avoid filler words and unnecessary preamble.
- Do NOT wrap your response in markdown code fences or add metadata.
- Just output the text content directly.
- Match the formatting style of the existing notes (plain text, short paragraphs).

Action: ${action}`;
}

// ── Build the user prompt based on action type ──
function buildUserPrompt(
  action: string,
  prompt: string,
  noteContent: string,
  targetBlockContent: string | null,
): string {
  const contextSection = noteContent
    ? `Here are the current notes:\n\n${noteContent}\n\n`
    : '';

  const blockSection = targetBlockContent
    ? `The selected block reads:\n"${targetBlockContent}"\n\n`
    : '';

  switch (action) {
    case 'continue':
      return `${contextSection}Continue writing from where these notes left off. Match the tone and style. Write 2-4 paragraphs.`;
    case 'summarize':
      return `${contextSection}Summarize the key points of these notes concisely. Use bullet points if appropriate.`;
    case 'expand':
      return `${contextSection}${blockSection}Expand on this block with more detail and supporting points. Write 2-3 paragraphs.`;
    case 'rewrite':
      return `${contextSection}${blockSection}Rewrite this block to be clearer and more concise while preserving the core meaning.`;
    default:
      // Custom prompt
      return `${contextSection}${blockSection}${prompt}`;
  }
}

// ── Detect the action type from the prompt ──
function detectAction(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('continue writing')) return 'continue';
  if (lower.includes('summarize the key points')) return 'summarize';
  if (lower.includes('expand on this block')) return 'expand';
  if (lower.includes('rewrite this block')) return 'rewrite';
  return 'custom';
}

function getNotesAIGenerationBudget(action: string, mode: InferenceConfig['mode'] | undefined): {
  maxOutputTokens: number;
  temperature: number;
} {
  const isLocal = mode === 'local';
  if (isLocal) {
    switch (action) {
      case 'continue':
      case 'expand':
        return { maxOutputTokens: 900, temperature: 0.55 };
      case 'summarize':
      case 'rewrite':
        return { maxOutputTokens: 620, temperature: 0.45 };
      default:
        return { maxOutputTokens: 760, temperature: 0.5 };
    }
  }

  switch (action) {
    case 'continue':
    case 'expand':
      return { maxOutputTokens: 2048, temperature: 0.7 };
    case 'summarize':
    case 'rewrite':
      return { maxOutputTokens: 1400, temperature: 0.6 };
    default:
      return { maxOutputTokens: 1700, temperature: 0.68 };
  }
}

// ── POST handler ──
async function _POST(request: NextRequest) {
  let pages: NotesAIPageInput[];
  let blocks: NotesAIBlockInput[];
  let prompt: string;
  let targetBlockId: string | null;
  let inferenceConfig: InferenceConfig | undefined;

  try {
    const parsedBody = await parseBodyWithLimit<NotesAIRequestBody>(request, 10 * 1024 * 1024);
    if ('error' in parsedBody) {
      return parsedBody.error;
    }
    const body = parsedBody.data;

    const normalizedPages = normalizePages(body.pages);
    if (!normalizedPages) {
      return NextResponse.json({ error: 'Invalid pages payload' }, { status: 400 });
    }
    const normalizedBlocks = normalizeBlocks(body.blocks);
    if (!normalizedBlocks) {
      return NextResponse.json({ error: 'Invalid blocks payload' }, { status: 400 });
    }

    pages = normalizedPages;
    blocks = normalizedBlocks;
    prompt = typeof body.prompt === 'string' ? body.prompt : '';
    targetBlockId = typeof body.targetBlockId === 'string' ? body.targetBlockId : null;
    inferenceConfig = body.inferenceConfig;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    if (prompt.length > 50000) {
      return NextResponse.json({ error: 'Prompt too long (max 50,000 characters)' }, { status: 400 });
    }
  } catch (error) {
    logger.error('notes-ai', 'Request parsing error:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  if (!inferenceConfig) {
    return NextResponse.json(
      { error: 'No inference model configured. Set an API key or connect a local model.' },
      { status: 400 },
    );
  }

  const action = detectAction(prompt);

  // Build note content and target block content
  const noteContent = buildNoteContent(pages, blocks);
  const targetBlock = targetBlockId
    ? blocks.find((b) => b.id === targetBlockId)
    : null;
  const targetBlockContent = targetBlock
    ? targetBlock.content.replace(/<[^>]*>/g, '')
    : null;

  const encoder = new TextEncoder();

  // Use request.signal to detect client disconnect
  const clientSignal = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      const writer = createSSEWriter(controller, encoder);
      const emit = (data: Record<string, unknown>) => writer.raw(sseEvent(data));

      try {
        let model;
        try {
          model = resolveProvider(inferenceConfig);
        } catch (error) {
          emit({ type: 'error', message: error instanceof Error ? error.message : 'Failed to resolve provider' });
          writer.done();
          writer.close();
          return;
        }

        const systemPrompt = buildSystemPrompt(action);
        const userPrompt = buildUserPrompt(action, prompt, noteContent, targetBlockContent);
        const generationBudget = getNotesAIGenerationBudget(action, inferenceConfig.mode);

        const result = streamText({
          model,
          system: systemPrompt,
          prompt: userPrompt,
          maxOutputTokens: generationBudget.maxOutputTokens,
          temperature: generationBudget.temperature,
        });

        let emittedText = false;
        for await (const chunk of result.textStream) {
          // Stop if client disconnected
          if (clientSignal.aborted || writer.isClosed()) {
            writer.close();
            return;
          }

          emittedText = true;
          if (!emit({ type: 'text', text: chunk })) {
            writer.close();
            return;
          }
        }

        if (!emittedText && inferenceConfig.mode === 'local') {
          emit({
            type: 'error',
            message: 'Local model produced no output. Check Ollama server and selected model.',
          });
        }

        emit({ type: 'done' });
      } catch (error) {
        if (clientSignal.aborted || writer.isClosed() || isAbortLikeError(error)) {
          writer.close();
          return;
        }
        const message = sanitizeErrorMessage(error);
        logger.error('notes-ai', 'Error:', message);
        emit({ type: 'error', message });
      } finally {
        writer.done();
        writer.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const POST = withMiddleware(_POST, { maxRequests: 30, windowMs: 60_000 });
