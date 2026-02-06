import { NextRequest } from 'next/server';
import { generateSynthesisReport } from '@/lib/engine/synthesizer';
import type { ChatMessage } from '@/lib/engine/types';

export async function POST(request: NextRequest) {
  try {
    const { messages, signals } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response('Missing messages', { status: 400 });
    }

    if (!signals || typeof signals !== 'object') {
      return new Response('Missing signals', { status: 400 });
    }

    // Defensive defaults for all required signal fields — prevents crash
    // if the client somehow sends an incomplete payload
    const safeSignals = {
      confidence: signals.confidence ?? 0.5,
      entropy: signals.entropy ?? 0,
      dissonance: signals.dissonance ?? 0,
      healthScore: signals.healthScore ?? 1.0,
      safetyState: signals.safetyState ?? 'green',
      riskScore: signals.riskScore ?? 0,
      tda: signals.tda ?? { betti0: 0, betti1: 0, persistenceEntropy: 0, maxPersistence: 0 },
      focusDepth: signals.focusDepth ?? 3,
      temperatureScale: signals.temperatureScale ?? 1.0,
      activeConcepts: signals.activeConcepts ?? [],
      activeChordProduct: signals.activeChordProduct ?? 1,
      harmonyKeyDistance: signals.harmonyKeyDistance ?? 0,
      queriesProcessed: signals.queriesProcessed ?? 0,
      totalTraces: signals.totalTraces ?? 0,
      skillGapsDetected: signals.skillGapsDetected ?? 0,
      inferenceMode: signals.inferenceMode ?? 'hybrid',
    };

    const report = generateSynthesisReport(
      messages as ChatMessage[],
      safeSignals,
    );

    return Response.json(report);
  } catch (error) {
    console.error('[synthesis/route] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Synthesis failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
