import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { resolveProvider } from '@/lib/engine/llm/provider';
import type { InferenceConfig } from '@/lib/engine/llm/config';
import { parseBodyWithLimit } from '@/lib/api-utils';

// Only allow localhost/127.0.0.1 to prevent SSRF via ollamaBaseUrl
function isAllowedOllamaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

interface TestConnectionBody {
  mode?: InferenceConfig['mode'];
  provider?: InferenceConfig['apiProvider'];
  apiKey?: string;
  openaiModel?: string;
  anthropicModel?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}

export async function POST(request: NextRequest) {
  try {
    const parsedBody = await parseBodyWithLimit<TestConnectionBody>(request, 5 * 1024 * 1024);
    if ('error' in parsedBody) {
      return parsedBody.error;
    }
    const body = parsedBody.data;

    // SSRF guard: validate ollamaBaseUrl before passing to resolveProvider
    if (body.mode === 'local' && body.ollamaBaseUrl && !isAllowedOllamaUrl(body.ollamaBaseUrl)) {
      return Response.json(
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

    return Response.json({ success: true, response: result.text.trim() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 400 });
  }
}
