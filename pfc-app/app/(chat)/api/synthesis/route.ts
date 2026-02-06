import { NextRequest } from 'next/server';
import { generateSynthesisReport } from '@/lib/engine/synthesizer';
import type { ChatMessage } from '@/lib/engine/types';

export async function POST(request: NextRequest) {
  const { messages, signals } = await request.json();

  if (!messages || !Array.isArray(messages)) {
    return new Response('Missing messages', { status: 400 });
  }

  const report = generateSynthesisReport(
    messages as ChatMessage[],
    signals,
  );

  return Response.json(report);
}
