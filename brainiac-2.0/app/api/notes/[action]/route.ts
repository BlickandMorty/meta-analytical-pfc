/**
 * Consolidated notes API route.
 *
 * Merges the following former standalone routes:
 *   /api/notes-ai     -> /api/notes/ai     (POST)
 *   /api/notes-learn  -> /api/notes/learn   (POST)
 *   /api/notes/sync   -> /api/notes/sync    (GET/POST)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api-middleware';

// ═══════════════════════════════════════════════════════════════════
// notes-ai handler (POST)
// ═══════════════════════════════════════════════════════════════════

import { streamText, generateText } from 'ai';
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

function normalizeAIPages(raw: unknown): NotesAIPageInput[] | null {
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

function normalizeAIBlocks(raw: unknown): NotesAIBlockInput[] | null {
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

// ── Build note content string (for notes-ai) ──
function buildAINoteContent(pages: NotesAIPageInput[], blocks: NotesAIBlockInput[]): string {
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

async function handleNotesAI(request: NextRequest) {
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

    const normalizedPages = normalizeAIPages(body.pages);
    if (!normalizedPages) {
      return NextResponse.json({ error: 'Invalid pages payload' }, { status: 400 });
    }
    const normalizedBlocks = normalizeAIBlocks(body.blocks);
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
  const noteContent = buildAINoteContent(pages, blocks);
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

// ═══════════════════════════════════════════════════════════════════
// notes-learn handler (POST)
// ═══════════════════════════════════════════════════════════════════

import type { LearningSession, LearningStepType } from '@/lib/notes/learning-protocol';
import {
  buildInventoryPrompt,
  buildGapAnalysisPrompt,
  buildDeepDivePrompt,
  buildCrossReferencePrompt,
  buildSynthesisPrompt,
  buildQuestionsPrompt,
  buildIterationCheckPrompt,
  buildDailyBriefPrompt,
} from '@/lib/notes/learning-prompts';

interface NotesLearnPageInput {
  id: string;
  title: string;
}

interface NotesLearnBlockInput {
  id: string;
  pageId: string;
  order: string;
  indent: number;
  content: string;
}

interface NotesLearnInput {
  pages: NotesLearnPageInput[];
  blocks: NotesLearnBlockInput[];
}

interface NotesLearnRequestBody {
  notes?: { pages?: unknown; blocks?: unknown };
  session?: LearningSession;
  inferenceConfig?: InferenceConfig;
  sessionType?: 'full-protocol' | 'daily-brief';
  recentActivity?: string;
}

function normalizeLearnPages(raw: unknown): NotesLearnPageInput[] | null {
  if (!Array.isArray(raw)) return null;
  const pages: NotesLearnPageInput[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (!id || !title) return null;
    pages.push({ id, title });
  }
  return pages;
}

function normalizeLearnBlocks(raw: unknown, pageIds: Set<string>): NotesLearnBlockInput[] | null {
  if (!Array.isArray(raw)) return null;
  const blocks: NotesLearnBlockInput[] = [];
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
    if (!pageIds.has(pageId)) continue;
    blocks.push({ id, pageId, order, indent, content });
  }
  return blocks;
}

// ── Temperature per step type ──
function getTemperature(stepType: LearningStepType): number {
  switch (stepType) {
    case 'deep-dive':
    case 'synthesis':
      return 0.7; // Creative steps
    case 'inventory':
    case 'gap-analysis':
    case 'questions':
      return 0.4; // Analytical steps
    case 'cross-reference':
      return 0.5;
    case 'iterate':
      return 0.3;
    default:
      return 0.5;
  }
}

function getStepMaxTokens(
  stepType: LearningStepType | 'daily-brief',
  mode: InferenceConfig['mode'] | undefined,
): number {
  const isLocal = mode === 'local';
  if (stepType === 'daily-brief') {
    return isLocal ? 1000 : 2048;
  }
  if (isLocal) {
    return stepType === 'deep-dive' || stepType === 'synthesis' ? 1200 : 700;
  }
  return stepType === 'deep-dive' || stepType === 'synthesis' ? 4096 : 2048;
}

// ── Build note content string (for notes-learn) ──
function buildLearnNoteContent(pages: NotesLearnPageInput[], blocks: NotesLearnBlockInput[]): string {
  const sections: string[] = [];

  for (const page of pages) {
    const pageBlocks = blocks
      .filter((b) => b.pageId === page.id)
      .sort((a, b) => a.order.localeCompare(b.order));

    const blockContent = pageBlocks
      .map((b) => {
        const indent = '  '.repeat(b.indent || 0);
        return `${indent}- ${b.content}`;
      })
      .filter((line) => line.trim() !== '-')
      .join('\n');

    if (blockContent.trim()) {
      sections.push(`## ${page.title}\n${blockContent}`);
    } else {
      sections.push(`## ${page.title}\n(empty page)`);
    }
  }

  return sections.join('\n\n');
}

// ── Build prompt for a given step type ──
function buildPromptForStep(
  stepType: LearningStepType,
  noteContent: string,
  session: LearningSession,
  previousStepOutputs: Record<string, string>,
): { system: string; user: string } {
  switch (stepType) {
    case 'inventory':
      return buildInventoryPrompt(noteContent);
    case 'gap-analysis':
      return buildGapAnalysisPrompt(noteContent, previousStepOutputs['inventory'] ?? '');
    case 'deep-dive':
      return buildDeepDivePrompt(noteContent, previousStepOutputs['gap-analysis'] ?? '', session.depth);
    case 'cross-reference':
      return buildCrossReferencePrompt(noteContent);
    case 'synthesis':
      return buildSynthesisPrompt(noteContent, previousStepOutputs['cross-reference'] ?? '');
    case 'questions':
      return buildQuestionsPrompt(noteContent, previousStepOutputs['inventory'] ?? '');
    case 'iterate': {
      // Build a summary of all previous steps for the iteration check
      const summaryParts = Object.entries(previousStepOutputs)
        .map(([key, val]) => `[${key}]: ${val.slice(0, 500)}`)
        .join('\n\n');
      return buildIterationCheckPrompt(noteContent, summaryParts);
    }
    default:
      return {
        system: 'You are a learning assistant analyzing notes.',
        user: `Analyze the following notes:\n\n${noteContent}`,
      };
  }
}

// ── Parse step response into structured data ──
// Each page carries a clientPageRef so the client can map to real page IDs
function parseStepResponse(
  stepType: LearningStepType,
  text: string,
  stepIndex: number,
): {
  insights: string[];
  pagesCreated: { title: string; clientPageRef: string; blocks: string[] }[];
} {
  const insights: string[] = [];
  const pagesCreated: { title: string; clientPageRef: string; blocks: string[] }[] = [];
  const fromRecord = (value: unknown, key: string): string | null => {
    if (!value || typeof value !== 'object') return null;
    const maybe = (value as Record<string, unknown>)[key];
    return typeof maybe === 'string' ? maybe : null;
  };
  const normalizeListItem = (value: unknown, key: string): string => {
    if (typeof value === 'string') return value;
    const fromObj = fromRecord(value, key);
    return fromObj ?? String(value);
  };

  // Strip <thinking> tags from LLM response before parsing
  const cleanText = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(cleanText);

    if (Array.isArray(parsed.insights)) {
      insights.push(...parsed.insights);
    }

    // deep-dive step: generatedContent array with page+blocks
    if (Array.isArray(parsed.generatedContent)) {
      for (let i = 0; i < parsed.generatedContent.length; i++) {
        const entry = parsed.generatedContent[i];
        if (entry && entry.pageTitle) {
          const blocks: string[] = [];
          if (Array.isArray(entry.blocks)) {
            for (const block of entry.blocks) {
              blocks.push(typeof block === 'string' ? block : block.content ?? '');
            }
          }
          pagesCreated.push({
            title: entry.pageTitle,
            clientPageRef: `ref-${stepIndex}-${i}`,
            blocks,
          });
        }
      }
    }

    // synthesis step: synthPages array
    if (Array.isArray(parsed.synthPages)) {
      for (let i = 0; i < parsed.synthPages.length; i++) {
        const entry = parsed.synthPages[i];
        if (entry && entry.title) {
          const blocks: string[] = [];
          if (Array.isArray(entry.blocks)) {
            for (const block of entry.blocks) {
              blocks.push(typeof block === 'string' ? block : block.content ?? '');
            }
          }
          pagesCreated.push({
            title: entry.title,
            clientPageRef: `ref-${stepIndex}-${i}`,
            blocks,
          });
        }
      }
    }

    // Legacy: pages array (generic)
    if (Array.isArray(parsed.pages)) {
      for (let i = 0; i < parsed.pages.length; i++) {
        const page = parsed.pages[i];
        if (typeof page === 'string') {
          pagesCreated.push({ title: page, clientPageRef: `ref-${stepIndex}-p${i}`, blocks: [] });
        } else if (page?.title) {
          const blocks: string[] = [];
          if (Array.isArray(page.blocks)) {
            for (const block of page.blocks) {
              blocks.push(typeof block === 'string' ? block : block.content ?? '');
            }
          }
          pagesCreated.push({ title: page.title, clientPageRef: `ref-${stepIndex}-p${i}`, blocks });
        }
      }
    }

    if (Array.isArray(parsed.gaps)) {
      insights.push(...parsed.gaps.map((g: unknown) => normalizeListItem(g, 'reason')));
    }
    if (Array.isArray(parsed.connections)) {
      insights.push(...parsed.connections.map((c: unknown) => normalizeListItem(c, 'relationship')));
    }
    if (Array.isArray(parsed.questions)) {
      insights.push(...parsed.questions.map((q: unknown) => normalizeListItem(q, 'question')));
    }
    if (typeof parsed.shouldContinue === 'boolean') {
      insights.push(parsed.shouldContinue ? 'Recommends another iteration' : 'Coverage is sufficient');
    }
    if (Array.isArray(parsed.topics)) {
      insights.push(...parsed.topics.map((t: unknown) => normalizeListItem(t, 'name')));
    }
    if (Array.isArray(parsed.orphanTopics)) {
      insights.push(...parsed.orphanTopics.map((t: unknown) => typeof t === 'string' ? `Orphan: ${t}` : String(t)));
    }

    return { insights, pagesCreated };
  } catch {
    // Not JSON — extract insights from plain text using line-based heuristics
    const lines = cleanText.split('\n').filter((l) => l.trim());
    for (const line of lines) {
      const trimmed = line.replace(/^[-*\d.)\s]+/, '').trim();
      if (trimmed.length > 10 && trimmed.length < 500) {
        insights.push(trimmed);
      }
    }

    // Cap at reasonable number
    return {
      insights: insights.slice(0, 20),
      pagesCreated: [],
    };
  }
}

// ── Parse iterate step response for recursive decision ──
function parseIterateResponse(text: string): {
  shouldContinue: boolean;
  reason: string;
  focusAreas: string[];
  confidenceScore: number;
} {
  const cleanText = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
  try {
    const parsed = JSON.parse(cleanText);
    return {
      shouldContinue: parsed.shouldContinue ?? false,
      reason: parsed.reason ?? '',
      focusAreas: parsed.focusAreas ?? [],
      confidenceScore: parsed.confidenceScore ?? 0.5,
    };
  } catch {
    // Fallback heuristics
    const lower = text.toLowerCase();
    const shouldContinue = lower.includes('"shouldcontinue": true')
      || lower.includes('"shouldcontinue":true');
    return {
      shouldContinue,
      reason: 'Could not parse iterate response',
      focusAreas: [],
      confidenceScore: 0.5,
    };
  }
}

async function handleNotesLearn(request: NextRequest) {
  let notes: NotesLearnInput;
  let session: LearningSession;
  let inferenceConfig: InferenceConfig | undefined;
  let sessionType: 'full-protocol' | 'daily-brief' = 'full-protocol';
  let recentActivity = '';

  try {
    const parsedBody = await parseBodyWithLimit<NotesLearnRequestBody>(request, 10 * 1024 * 1024);
    if ('error' in parsedBody) {
      return parsedBody.error;
    }
    const body = parsedBody.data;

    const bodyNotes = body.notes;
    const bodySession = body.session;
    if (!bodyNotes || !bodySession || !isRecord(bodySession)) {
      return NextResponse.json({ error: 'Missing notes or session' }, { status: 400 });
    }

    const normalizedPages = normalizeLearnPages(bodyNotes.pages);
    if (!normalizedPages) {
      return NextResponse.json({ error: 'Invalid notes payload: pages must be an array of {id, title}' }, { status: 400 });
    }
    const normalizedBlocks = normalizeLearnBlocks(
      bodyNotes.blocks,
      new Set(normalizedPages.map((p) => p.id)),
    );
    if (!normalizedBlocks) {
      return NextResponse.json({ error: 'Invalid notes payload: blocks must be an array of {id, pageId, order}' }, { status: 400 });
    }

    if (!Array.isArray(bodySession.steps) || bodySession.steps.length === 0) {
      return NextResponse.json({ error: 'Invalid session payload: steps must be a non-empty array' }, { status: 400 });
    }
    if (bodySession.depth !== 'shallow' && bodySession.depth !== 'moderate' && bodySession.depth !== 'deep') {
      return NextResponse.json({ error: 'Invalid session payload: depth must be shallow, moderate, or deep' }, { status: 400 });
    }
    if (typeof bodySession.iteration !== 'number' || typeof bodySession.maxIterations !== 'number') {
      return NextResponse.json({ error: 'Invalid session payload: iteration and maxIterations are required' }, { status: 400 });
    }
    const allowedStepTypes = new Set<LearningStepType>([
      'inventory',
      'gap-analysis',
      'deep-dive',
      'cross-reference',
      'synthesis',
      'questions',
      'iterate',
    ]);
    for (const step of bodySession.steps) {
      if (!isRecord(step) || typeof step.type !== 'string' || !allowedStepTypes.has(step.type as LearningStepType)) {
        return NextResponse.json({ error: 'Invalid session payload: steps contain unsupported type' }, { status: 400 });
      }
    }
    if (!Number.isFinite(bodySession.iteration) || !Number.isFinite(bodySession.maxIterations) || bodySession.iteration < 1 || bodySession.maxIterations < 1) {
      return NextResponse.json({ error: 'Invalid session payload: iteration values must be >= 1' }, { status: 400 });
    }
    if (bodySession.maxIterations > 20) {
      return NextResponse.json({ error: 'Invalid session payload: maxIterations cannot exceed 20' }, { status: 400 });
    }
    if (bodySession.iteration > bodySession.maxIterations) {
      return NextResponse.json({ error: 'Invalid session payload: iteration cannot exceed maxIterations' }, { status: 400 });
    }

    notes = { pages: normalizedPages, blocks: normalizedBlocks };
    session = bodySession;
    inferenceConfig = body.inferenceConfig;
    sessionType = body.sessionType === 'daily-brief' ? 'daily-brief' : 'full-protocol';
    recentActivity = typeof body.recentActivity === 'string' ? body.recentActivity : '';
  } catch (error) {
    logger.error('notes-learn', 'Request parsing error:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  // Resolve the LLM provider
  if (!inferenceConfig) {
    return NextResponse.json(
      { error: 'No inference model configured. Set an API key or connect a local model.' },
      { status: 400 },
    );
  }

  let model: Awaited<ReturnType<typeof resolveProvider>>;
  try {
    model = resolveProvider(inferenceConfig);
  } catch (error) {
    logger.error('notes-learn', 'Provider resolution error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve LLM provider' },
      { status: 400 },
    );
  }

  // Build the note content string
  const noteContent = buildLearnNoteContent(notes.pages, notes.blocks);

  const encoder = new TextEncoder();
  const capturedSession = session;
  const capturedModel = model;
  const capturedNoteContent = noteContent;
  const capturedSessionType = sessionType;
  const capturedRecentActivity = recentActivity;
  const capturedInferenceMode = inferenceConfig?.mode;

  // Use request.signal to detect client disconnect
  const clientSignal = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      const writer = createSSEWriter(controller, encoder);
      const emit = (data: Record<string, unknown>) => {
        if (!writer.raw(sseEvent(data))) {
          throw new Error('STREAM_CLOSED');
        }
      };

      let totalInsights = 0;
      let totalPagesCreated = 0;
      let totalBlocksCreated = 0;

      // ═══ DAILY BRIEF: shortcut path — skip the 7-step protocol ═══
      if (capturedSessionType === 'daily-brief') {
        try {
          const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          let responseText: string;

          emit({ type: 'step-start', stepIndex: 0, stepType: 'daily-brief' });

          const prompt = buildDailyBriefPrompt(capturedNoteContent, capturedRecentActivity, today);
          const result = await generateText({
            model: capturedModel,
            system: prompt.system,
            prompt: prompt.user,
            maxOutputTokens: getStepMaxTokens('daily-brief', capturedInferenceMode),
            temperature: 0.5,
          });
          responseText = result.text;

          // Stream the text
          const chunkSize = 80;
          for (let i = 0; i < responseText.length; i += chunkSize) {
            if (clientSignal.aborted || writer.isClosed()) { writer.close(); return; }
            emit({ type: 'stream-text', text: responseText.slice(i, i + chunkSize) });
          }

          // Parse the daily brief response
          const cleanText = responseText.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
          try {
            const parsed = JSON.parse(cleanText);
            const briefTitle = parsed.title || `Daily Brief — ${today}`;

            // Emit page + blocks
            const ref = 'ref-brief-0';
            emit({ type: 'page-created', pageTitle: briefTitle, clientPageRef: ref });

            const allBlocks: string[] = [];
            if (Array.isArray(parsed.sections)) {
              for (const section of parsed.sections) {
                if (section.heading) allBlocks.push(`## ${section.heading}`);
                if (Array.isArray(section.blocks)) {
                  allBlocks.push(...section.blocks);
                }
              }
            }

            for (let bi = 0; bi < allBlocks.length; bi++) {
              emit({ type: 'block-created', content: allBlocks[bi], clientPageRef: ref, blockIndex: bi });
            }

            totalPagesCreated = 1;
            totalBlocksCreated = allBlocks.length;
            totalInsights = 1;
          } catch {
            // Fallback — emit raw text as a single block
            const ref = 'ref-brief-0';
            emit({ type: 'page-created', pageTitle: `Daily Brief — ${today}`, clientPageRef: ref });
            emit({ type: 'block-created', content: cleanText, clientPageRef: ref, blockIndex: 0 });
            totalPagesCreated = 1;
            totalBlocksCreated = 1;
          }

          emit({ type: 'step-complete', stepIndex: 0, insights: ['Daily brief generated'], pagesCreated: ['Daily Brief'], blocksCreated: [] });
          emit({ type: 'session-complete', totalInsights, totalPagesCreated, totalBlocksCreated });
        } catch (error) {
          if (clientSignal.aborted || writer.isClosed() || isAbortLikeError(error)) {
            writer.close(); return;
          }
          const message = error instanceof Error ? error.message : 'Daily brief error';
          logger.error('notes-learn', 'Daily brief error:', message);
          emit({ type: 'error', message });
        } finally {
          writer.done();
          writer.close();
        }
        return;
      }

      // ═══ FULL PROTOCOL: 7-step recursive learning ═══
      const previousStepOutputs: Record<string, string> = {};

      // Filter steps to target pages if specified
      const targetPages = capturedSession.targetPageIds?.length
        ? notes.pages.filter((p) => capturedSession.targetPageIds!.includes(p.id))
        : notes.pages;
      const targetBlocks = capturedSession.targetPageIds?.length
        ? notes.blocks.filter((b) => targetPages.some((p) => p.id === b.pageId))
        : notes.blocks;

      const effectiveNoteContent = capturedSession.targetPageIds?.length
        ? buildLearnNoteContent(targetPages, targetBlocks)
        : capturedNoteContent;

      // Track generated content across iterations so subsequent passes see new material
      let generatedContentAccumulator = '';

      try {
        // ── Outer recursive iteration loop ──
        let currentIteration = capturedSession.iteration;
        const maxIterations = capturedSession.maxIterations;
        let shouldBreak = false;

        while (currentIteration <= maxIterations && !shouldBreak) {
          // Emit iteration start (only meaningful for iterations > 1)
          if (currentIteration > 1) {
            emit({ type: 'iteration-start', iteration: currentIteration });
          }

          // For subsequent iterations, append generated content to note context
          const iterationNoteContent = currentIteration > 1
            ? `${effectiveNoteContent}\n\n--- Generated in previous pass ---\n\n${generatedContentAccumulator}`
            : effectiveNoteContent;

          // Reset previous step outputs for each iteration
          if (currentIteration > 1) {
            Object.keys(previousStepOutputs).forEach((k) => delete previousStepOutputs[k]);
          }

          for (let stepIndex = 0; stepIndex < capturedSession.steps.length; stepIndex++) {
            // Stop if client disconnected
            if (clientSignal.aborted || writer.isClosed()) {
              writer.close();
              return;
            }

            const step = capturedSession.steps[stepIndex]!;

            // Emit step-start
            emit({ type: 'step-start', stepIndex, stepType: step.type });

            try {
              let responseText: string;

              const stepPrompt = buildPromptForStep(
                step.type,
                iterationNoteContent,
                capturedSession,
                previousStepOutputs,
              );

              const temperature = getTemperature(step.type);

              const result = await generateText({
                model: capturedModel,
                system: stepPrompt.system,
                prompt: stepPrompt.user,
                maxOutputTokens: getStepMaxTokens(step.type, capturedInferenceMode),
                temperature,
              });

              responseText = result.text;

              // Emit stream-text chunks for progressive display
              const chunkSize = 80;
              for (let i = 0; i < responseText.length; i += chunkSize) {
                if (clientSignal.aborted || writer.isClosed()) {
                  writer.close();
                  return;
                }
                const chunk = responseText.slice(i, i + chunkSize);
                emit({ type: 'stream-text', text: chunk });
              }

              // Store output for subsequent steps
              previousStepOutputs[step.type] = responseText;

              // Parse the response
              const parsed = parseStepResponse(step.type, responseText, stepIndex);

              // Emit insights
              for (const insight of parsed.insights) {
                emit({ type: 'insight', text: insight });
              }

              // ── Emit page-created + block-created per entry for note creation steps ──
              if (step.type === 'deep-dive' || step.type === 'synthesis') {
                for (const page of parsed.pagesCreated) {
                  // Emit page creation — client will call createPage()
                  emit({
                    type: 'page-created',
                    pageTitle: page.title,
                    clientPageRef: page.clientPageRef,
                  });

                  // Emit each block for this page — client will call createBlock()
                  for (let bi = 0; bi < page.blocks.length; bi++) {
                    emit({
                      type: 'block-created',
                      content: page.blocks[bi],
                      clientPageRef: page.clientPageRef,
                      blockIndex: bi,
                    });
                  }

                  // Accumulate for next iteration's context
                  generatedContentAccumulator += `\n\n## ${page.title}\n${page.blocks.join('\n\n')}`;
                }
              }

              // Count totals
              totalInsights += parsed.insights.length;
              totalPagesCreated += parsed.pagesCreated.length;
              const blockCount = parsed.pagesCreated.reduce((sum, p) => sum + p.blocks.length, 0);
              totalBlocksCreated += blockCount;

              // Emit step-complete
              emit({
                type: 'step-complete',
                stepIndex,
                insights: parsed.insights,
                pagesCreated: parsed.pagesCreated.map((p) => p.title),
                blocksCreated: parsed.pagesCreated.flatMap((p) => p.blocks.map((b) => b.slice(0, 100))),
              });

              // ── Iterate step: decide whether to continue recursively ──
              if (step.type === 'iterate') {
                const iterateResult = parseIterateResponse(responseText);

                emit({
                  type: 'iterate-result',
                  shouldContinue: iterateResult.shouldContinue,
                  reason: iterateResult.reason,
                  focusAreas: iterateResult.focusAreas,
                  confidenceScore: iterateResult.confidenceScore,
                });

                if (!iterateResult.shouldContinue || currentIteration >= maxIterations) {
                  shouldBreak = true;
                  break;
                }
                // Continue to next iteration — steps will restart
              }
            } catch (stepError) {
              if (clientSignal.aborted || writer.isClosed() || isAbortLikeError(stepError)) {
                writer.close();
                return;
              }
              const message = stepError instanceof Error ? stepError.message : 'Unknown step error';
              logger.error('notes-learn', `Step ${step.type} error:`, message);

              emit({
                type: 'step-complete',
                stepIndex,
                insights: [],
                pagesCreated: [],
                blocksCreated: [],
                error: message,
              });
            }
          }

          currentIteration++;
        }

        // Emit session-complete
        emit({
          type: 'session-complete',
          totalInsights,
          totalPagesCreated,
          totalBlocksCreated,
        });
      } catch (error) {
        if (clientSignal.aborted || writer.isClosed() || isAbortLikeError(error)) {
          writer.close();
          return;
        }
        const message = sanitizeErrorMessage(error);
        logger.error('notes-learn', 'Session error:', message);
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

// ═══════════════════════════════════════════════════════════════════
// notes/sync handler (GET/POST)
// ═══════════════════════════════════════════════════════════════════

import {
  syncVaultToDb,
  loadVaultFromDb,
  hasNotesInDb,
  getVaults,
  upsertVault,
  deleteVault,
} from '@/lib/db/notes-queries';
import type {
  NotePage, NoteBlock, NoteBook, Vault, Concept, PageLink,
} from '@/lib/notes/types';
import { vaultId as toVaultId } from '@/lib/branded';

async function handleSyncGet(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const check = searchParams.get('check');
    const vaultId = searchParams.get('vaultId');

    // Migration check
    if (check === 'migration') {
      const hasNotes = await hasNotesInDb();
      return NextResponse.json({ hasMigrated: hasNotes });
    }

    // Load specific vault
    if (vaultId) {
      const data = await loadVaultFromDb(toVaultId(vaultId));
      if (!data) {
        return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
      }
      return NextResponse.json(data);
    }

    // List all vaults
    const vaults = await getVaults();
    return NextResponse.json({ vaults });
  } catch (err) {
    logger.error('notes/sync', 'GET error:', err);
    return NextResponse.json(
      { error: 'Failed to read notes from database' },
      { status: 500 },
    );
  }
}

interface SyncPayload {
  action: 'sync';
  vaultId: string;
  vault: Vault;
  pages: NotePage[];
  blocks: NoteBlock[];
  books: NoteBook[];
  concepts: Concept[];
  pageLinks: PageLink[];
}

interface MigratePayload {
  action: 'migrate';
  vaults: Array<{
    vault: Vault;
    pages: NotePage[];
    blocks: NoteBlock[];
    books: NoteBook[];
    concepts: Concept[];
    pageLinks: PageLink[];
  }>;
}

interface UpsertVaultPayload {
  action: 'upsert-vault';
  vault: Vault;
}

interface DeleteVaultPayload {
  action: 'delete-vault';
  vaultId: string;
}

type SyncPostPayload = SyncPayload | MigratePayload | UpsertVaultPayload | DeleteVaultPayload;

// Limit body to ~10MB (notes shouldn't need more; prevents abuse)
const SYNC_MAX_BODY_SIZE = 10 * 1024 * 1024;

async function handleSyncPost(req: NextRequest) {
  try {
    // Use parseBodyWithLimit for actual stream-level size enforcement (not just header check)
    const parsedBody = await parseBodyWithLimit<SyncPostPayload>(req, SYNC_MAX_BODY_SIZE);
    if ('error' in parsedBody) {
      return parsedBody.error;
    }
    const body = parsedBody.data;

    switch (body.action) {
      // ── Full vault sync (write-through) ──
      case 'sync': {
        const { vaultId, vault, pages, blocks, books, concepts, pageLinks } = body;
        if (!vaultId) {
          return NextResponse.json({ error: 'vaultId is required' }, { status: 400 });
        }
        await syncVaultToDb(toVaultId(vaultId), vault, pages, blocks, books, concepts, pageLinks);
        return NextResponse.json({ ok: true, synced: pages.length });
      }

      // ── One-time migration: push all vaults from localStorage ──
      case 'migrate': {
        // Check if already migrated
        const alreadyMigrated = await hasNotesInDb();
        if (alreadyMigrated) {
          return NextResponse.json({ ok: true, skipped: true, reason: 'already migrated' });
        }

        const { vaults } = body;
        let totalPages = 0;

        for (const vaultData of vaults) {
          const { vault, pages, blocks, books, concepts, pageLinks } = vaultData;
          await syncVaultToDb(toVaultId(vault.id), vault, pages, blocks, books, concepts, pageLinks);
          totalPages += pages.length;
        }

        return NextResponse.json({
          ok: true,
          migrated: true,
          vaultCount: vaults.length,
          totalPages,
        });
      }

      // ── Upsert a single vault record ──
      case 'upsert-vault': {
        await upsertVault(body.vault);
        return NextResponse.json({ ok: true });
      }

      // ── Delete a vault ──
      case 'delete-vault': {
        if (!body.vaultId) {
          return NextResponse.json({ error: 'vaultId is required' }, { status: 400 });
        }
        await deleteVault(toVaultId(body.vaultId));
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 },
        );
    }
  } catch (err) {
    logger.error('notes/sync', 'POST error:', err);
    return NextResponse.json(
      { error: 'Failed to sync notes to database' },
      { status: 500 },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// Route exports — dispatch by [action] param
// ═══════════════════════════════════════════════════════════════════

async function _GET(
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> },
) {
  const { action } = await context!.params;

  switch (action) {
    case 'sync':
      return handleSyncGet(req);
    default:
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

async function _POST(
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> },
) {
  const { action } = await context!.params;

  switch (action) {
    case 'ai':
      return handleNotesAI(req);
    case 'learn':
      return handleNotesLearn(req);
    case 'sync':
      return handleSyncPost(req);
    default:
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

// Rate limits applied at route level — most restrictive is notes-learn (5/min).
// Using a reasonable common limit; individual handlers enforce their own constraints.
export const GET = withRateLimit(_GET, { maxRequests: 20, windowMs: 60_000 });
export const POST = withRateLimit(_POST, { maxRequests: 30, windowMs: 60_000 });
