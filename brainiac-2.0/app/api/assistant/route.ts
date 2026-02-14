// ═══════════════════════════════════════════════════════════════════
// ██ ASSISTANT API — Streaming endpoint for the PFC Assistant widget
// ═══════════════════════════════════════════════════════════════════
//
// Lightweight SSE streaming route for the floating assistant. Uses
// the deep knowledge system prompt + dynamic context injection.
// Requires a configured inference provider (API or local).
// ═══════════════════════════════════════════════════════════════════

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/debug-logger';
import { withMiddleware } from '@/lib/api-middleware';
import { streamText } from 'ai';
import { resolveProvider } from '@/lib/engine/llm/provider';
import { buildAssistantSystemPrompt, type AssistantContext } from '@/lib/engine/llm/assistant-prompt';
import { createSSEWriter, isAbortLikeError, parseBodyWithLimit, sanitizeErrorMessage } from '@/lib/api-utils';
import type { InferenceConfig } from '@/lib/engine/llm/config';

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ── Route handler ─────────────────────────────────────────────────

async function _POST(request: NextRequest) {
  type AssistantBody = {
    query: string;
    context: AssistantContext;
    inferenceConfig?: InferenceConfig;
    conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
  };

  const parsed = await parseBodyWithLimit<AssistantBody>(request, 2 * 1024 * 1024); // 2MB limit
  if ('error' in parsed) return parsed.error;
  const body = parsed.data;

  const { query, context, inferenceConfig, conversationHistory } = body;

  if (!query || typeof query !== 'string' || query.length > 10_000) {
    return NextResponse.json({ error: 'Invalid query (max 10k chars)' }, { status: 400 });
  }

  if (!inferenceConfig) {
    return NextResponse.json(
      { error: 'No inference model configured. Set an API key or connect a local model.' },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
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

        const systemPrompt = buildAssistantSystemPrompt(context);

        // Build messages array with conversation history
        const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
          { role: 'system', content: systemPrompt },
        ];

        if (Array.isArray(conversationHistory)) {
          for (const msg of conversationHistory.slice(-8)) {
            // Validate each history entry: role must be 'user' or 'assistant', content must be a string
            if (
              msg &&
              typeof msg === 'object' &&
              (msg.role === 'user' || msg.role === 'assistant') &&
              typeof msg.content === 'string'
            ) {
              messages.push({ role: msg.role, content: msg.content.slice(0, 50_000) });
            }
          }
        }

        messages.push({ role: 'user', content: query });

        const result = streamText({
          model,
          messages,
          maxOutputTokens: 2048,
          temperature: 0.7,
          abortSignal: clientSignal,
        });

        for await (const chunk of result.textStream) {
          if (clientSignal.aborted || writer.isClosed()) {
            writer.close();
            return;
          }
          if (!emit({ type: 'text', text: chunk })) {
            writer.close();
            return;
          }
        }

        emit({ type: 'done' });
      } catch (error) {
        if (clientSignal.aborted || writer.isClosed() || isAbortLikeError(error)) {
          writer.close();
          return;
        }
        const message = sanitizeErrorMessage(error);
        logger.error('assistant', 'Error:', message);
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
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
      'X-Accel-Buffering': 'no',
    },
  });
}

export const POST = withMiddleware(_POST, { maxRequests: 30, windowMs: 60_000 });
