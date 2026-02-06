import { NextRequest } from 'next/server';
import { checkOllamaAvailability } from '@/lib/engine/llm/ollama';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = searchParams.get('baseUrl') || 'http://localhost:11434';
  const result = await checkOllamaAvailability(baseUrl);
  return Response.json(result);
}
