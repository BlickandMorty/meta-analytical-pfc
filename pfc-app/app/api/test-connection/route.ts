import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { resolveProvider } from '@/lib/engine/llm/provider';
import type { InferenceConfig } from '@/lib/engine/llm/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config: InferenceConfig = {
      mode: body.mode || 'api',
      apiProvider: body.provider,
      apiKey: body.apiKey,
      openaiModel: body.openaiModel,
      anthropicModel: body.anthropicModel,
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
