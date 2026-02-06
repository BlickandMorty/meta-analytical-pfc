import { NextRequest } from 'next/server';
import { generateTrainMeReport } from '@/lib/engine/trainme';
import type { ChatMessage, TruthAssessment } from '@/lib/engine/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, signals, truthAssessment } = body;

    // Messages are optional — the trainme engine can work with signals alone
    const resolvedMessages: ChatMessage[] = Array.isArray(messages) ? messages : [];

    const report = generateTrainMeReport(
      resolvedMessages,
      signals ?? {},
      (truthAssessment as TruthAssessment | null) ?? null,
    );

    return Response.json(report);
  } catch (error) {
    console.error('[trainme/route] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate report' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
