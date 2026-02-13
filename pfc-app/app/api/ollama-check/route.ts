import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/api-middleware';
import { logger } from '@/lib/debug-logger';
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

async function _GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = searchParams.get('baseUrl') || 'http://localhost:11434';

  if (!isAllowedOllamaUrl(baseUrl)) {
    return NextResponse.json(
      { error: 'Only localhost Ollama URLs are allowed' },
      { status: 400 },
    );
  }

  try {
    const result = await checkOllamaAvailability(baseUrl);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('ollama-check', 'Error:', error);
    return NextResponse.json({ available: false, error: 'Connection check failed' });
  }
}

export const GET = withMiddleware(_GET, { maxRequests: 60, windowMs: 60_000, skipAuth: true });
