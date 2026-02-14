import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/api-middleware';
import { generateText } from 'ai';
import { resolveProvider, isAllowedOllamaUrl } from '@/lib/engine/llm/provider';
import type { InferenceConfig } from '@/lib/engine/llm/config';
import { parseBodyWithLimit } from '@/lib/api-utils';

interface TestConnectionBody {
  mode?: InferenceConfig['mode'];
  provider?: InferenceConfig['apiProvider'];
  apiKey?: string;
  openaiModel?: string;
  anthropicModel?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}

async function _POST(request: NextRequest) {
  try {
    const parsedBody = await parseBodyWithLimit<TestConnectionBody>(request, 5 * 1024 * 1024);
    if ('error' in parsedBody) {
      return parsedBody.error;
    }
    const body = parsedBody.data;

    // SSRF guard: validate ollamaBaseUrl before passing to resolveProvider
    if (body.mode === 'local' && body.ollamaBaseUrl && !isAllowedOllamaUrl(body.ollamaBaseUrl)) {
      return NextResponse.json(
        { success: false, error: 'Only localhost Ollama URLs are allowed' },
        { status: 400 },
      );
    }

    const config: InferenceConfig = {
      mode: body.mode || 'api',
      apiProvider: body.provider,
      apiKey: body.apiKey,
      openaiModel: body.openaiModel as InferenceConfig['openaiModel'],
      anthropicModel: body.anthropicModel as InferenceConfig['anthropicModel'],
      ollamaBaseUrl: body.ollamaBaseUrl,
      ollamaModel: body.ollamaModel,
    };

    const model = resolveProvider(config);
    const result = await generateText({
      model,
      prompt: 'Respond with exactly: "Connection successful"',
      maxOutputTokens: 20,
    });

    return NextResponse.json({ success: true, response: result.text.trim() });
  } catch (error) {
    // Sanitize: strip API keys or tokens that may appear in error messages
    let message = error instanceof Error ? error.message : 'Unknown error';
    message = message.replace(/(?:sk-|key-|token-|Bearer\s+)\S+/gi, '[REDACTED]');
    if (message.length > 500) message = message.slice(0, 500) + '...';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export const POST = withMiddleware(_POST, { maxRequests: 60, windowMs: 60_000 });
