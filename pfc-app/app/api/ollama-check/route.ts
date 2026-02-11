import { NextRequest } from 'next/server';
import { checkOllamaAvailability } from '@/lib/engine/llm/ollama';

// Only allow localhost/127.0.0.1 to prevent SSRF
function isAllowedOllamaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = searchParams.get('baseUrl') || 'http://localhost:11434';

  if (!isAllowedOllamaUrl(baseUrl)) {
    return Response.json(
      { error: 'Only localhost Ollama URLs are allowed' },
      { status: 400 },
    );
  }

  const result = await checkOllamaAvailability(baseUrl);
  return Response.json(result);
}
