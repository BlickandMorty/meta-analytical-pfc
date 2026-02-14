import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/api-middleware';
import { logger } from '@/lib/debug-logger';
import { generateSynthesisReport } from '@/lib/engine/synthesizer';
import type { ChatMessage } from '@/lib/engine/types';
import { parseBodyWithLimit } from '@/lib/api-utils';

interface SynthesisBody {
  messages?: unknown;
  signals?: Record<string, unknown>;
}

async function _POST(request: NextRequest) {
  try {
    const parsedBody = await parseBodyWithLimit<SynthesisBody>(request, 5 * 1024 * 1024);
    if ('error' in parsedBody) {
      return parsedBody.error;
    }
    const { messages, signals } = parsedBody.data;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Missing or invalid messages' }, { status: 400 });
    }

    if (!signals || typeof signals !== 'object') {
      return NextResponse.json({ error: 'Missing or invalid signals' }, { status: 400 });
    }

    // Defensive defaults for all required signal fields — prevents crash
    // if the client somehow sends an incomplete payload
    const signalData = signals as Record<string, unknown>;
    const toNumber = (value: unknown, fallback: number) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };
    const normalizeTda = (value: unknown) => {
      if (!value || typeof value !== 'object') {
        return { betti0: 0, betti1: 0, persistenceEntropy: 0, maxPersistence: 0 };
      }
      const tda = value as Record<string, unknown>;
      return {
        betti0: toNumber(tda.betti0, 0),
        betti1: toNumber(tda.betti1, 0),
        persistenceEntropy: toNumber(tda.persistenceEntropy, 0),
        maxPersistence: toNumber(tda.maxPersistence, 0),
      };
    };

    const safeSignals = {
      confidence: toNumber(signalData.confidence, 0.5),
      entropy: toNumber(signalData.entropy, 0),
      dissonance: toNumber(signalData.dissonance, 0),
      healthScore: toNumber(signalData.healthScore, 1.0),
      safetyState: typeof signalData.safetyState === 'string' ? signalData.safetyState : 'green',
      riskScore: toNumber(signalData.riskScore, 0),
      tda: normalizeTda(signalData.tda),
      focusDepth: toNumber(signalData.focusDepth, 3),
      temperatureScale: toNumber(signalData.temperatureScale, 1.0),
      activeConcepts: Array.isArray(signalData.activeConcepts) ? signalData.activeConcepts : [],
      activeChordProduct: toNumber(signalData.activeChordProduct, 1),
      harmonyKeyDistance: toNumber(signalData.harmonyKeyDistance, 0),
      queriesProcessed: toNumber(signalData.queriesProcessed, 0),
      totalTraces: toNumber(signalData.totalTraces, 0),
      skillGapsDetected: toNumber(signalData.skillGapsDetected, 0),
      inferenceMode: typeof signalData.inferenceMode === 'string' ? signalData.inferenceMode : 'hybrid',
    };

    const report = generateSynthesisReport(
      messages as ChatMessage[],
      safeSignals,
    );

    return NextResponse.json(report);
  } catch (error) {
    logger.error('synthesis/route', 'Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export const POST = withMiddleware(_POST, { maxRequests: 10, windowMs: 60_000 });
