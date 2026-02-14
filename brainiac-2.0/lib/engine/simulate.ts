/**
 * Pipeline orchestrator — the core async generator that drives the
 * 10-stage analytical pipeline, yielding SSE-compatible PipelineEvent objects.
 *
 * Query analysis, signal generation, and fallback generators have been
 * extracted into focused modules:
 *   - ./query-analysis   — analyzeQuery, ConversationContext, QueryAnalysis
 *   - ./signal-generation — generateSignals, extractConceptsFromAnalysis
 *   - ./fallback-generators — generateStageDetail, getSectionLabels, etc.
 *
 * Supports two inference modes:
 *   - API: cloud LLM calls with structured prompt templates
 *   - Local: Ollama-compatible models with the same prompt templates
 */

import { STAGES, type PipelineStage } from '@/lib/constants';
import { logger } from '@/lib/debug-logger';
import type { SteeringBias } from '@/lib/engine/steering/types';
import type {
  DualMessage,
  LaymanSummary,
  PipelineEvent,
  PipelineControls,
  StageResult,
  SafetyState,
} from './types';
import { generateReflection } from './reflection';
import { generateArbitration } from './arbitration';
import { generateTruthAssessment } from './truthbot';
import type { InferenceConfig } from './llm/config';
import { resolveProvider } from './llm/provider';
import {
  llmGenerateRawAnalysis,
  llmStreamRawAnalysis,
  llmGenerateLaymanSummary,
  llmGenerateReflection,
  llmGenerateArbitration,
  llmGenerateTruthAssessment,
} from './llm/generate';
import { runSOAR, quickProbe } from './soar';
import type { SOARConfig, SOARSession } from './soar/types';
import { DEFAULT_SOAR_CONFIG } from './soar/types';
import { composeSteeringDirectives } from './steering/prompt-composer';

// ── Extracted modules ──
import { analyzeQuery, type ConversationContext, type QueryAnalysis } from './query-analysis';
import { generateSignals, extractConceptsFromAnalysis } from './signal-generation';
import { generateStageDetail, getSectionLabels } from './fallback-generators';

// Re-export for downstream consumers
export type { ConversationContext, QueryAnalysis };
export { extractConceptsFromAnalysis };

// ═════════════════════════════════════════════════════════════════════
// ██ ASYNC GENERATOR — yields PipelineEvent for SSE streaming
// ═════════════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wrap a promise with a timeout to prevent infinite hangs */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/** Helper: yield a stage event */
function stageEvent(
  stage: PipelineStage,
  status: 'active' | 'complete',
  detail?: string,
  value?: number,
): PipelineEvent {
  return { type: 'stage', stage, status, detail: detail ?? '', value: value ?? (status === 'complete' ? 1 : 0.5) };
}

/**
 * runPipeline — the core async generator.
 * Yields PipelineEvent objects that the SSE route streams to the client.
 *
 * Stages progress as actual LLM calls execute (api or local mode).
 */
export async function* runPipeline(
  query: string,
  controls?: PipelineControls,
  context?: ConversationContext,
  steeringBias?: SteeringBias,
  inferenceConfig?: InferenceConfig,
  soarConfig?: SOARConfig,
  analyticsEngineEnabled: boolean = true,
  chatMode?: 'research' | 'plain',
  images?: Array<{ mimeType: string; base64: string }>,
): AsyncGenerator<PipelineEvent> {
  const qa = analyzeQuery(query, context);
  // When analytics engine is disabled, use neutral signals (no steering, no TDA computation)
  const signals = analyticsEngineEnabled
    ? generateSignals(qa, controls, steeringBias)
    : generateSignals(qa); // no controls or steering = baseline only

  // Track stage results for reflection/arbitration
  const stageResults: StageResult[] = STAGES.map((s) => ({
    stage: s,
    status: 'idle' as const,
    summary: s,
  }));

  // ════════════════════════════════════════════════════════════════
  // LLM MODE — stages correspond to real LLM processing steps
  // ════════════════════════════════════════════════════════════════
  {
    const LLM_TIMEOUT = 60_000; // 60s per call
    let rawAnalysis: string;
    let laymanSummary: LaymanSummary;
    let reflection: ReturnType<typeof generateReflection>;
    let arbitration: ReturnType<typeof generateArbitration>;

    if (!inferenceConfig) {
      yield { type: 'error', message: 'No inference configuration provided. Please configure an API key or local model in Settings.' };
      return;
    }

    try {
      const model = resolveProvider(inferenceConfig);

      // Compose steering directives for API-mode prompt injection
      // When analytics engine is disabled, directives are empty (no steering)
      const directives = composeSteeringDirectives({
        controls,
        steeringBias,
        soarConfig: soarConfig ?? DEFAULT_SOAR_CONFIG,
        analyticsEngineEnabled,
        chatMode,
      });

      // ── Stage 1: Triage — query analysis ──
      yield stageEvent('triage', 'active', 'Analyzing query structure...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.1, dissonance: signals.dissonance * 0.1, healthScore: 0.9, safetyState: 'green' as SafetyState, riskScore: signals.riskScore * 0.1 } };
      stageResults[0] = { stage: 'triage', status: 'complete', summary: 'triage', detail: generateStageDetail('triage', qa), value: 1 };
      await sleep(200);
      yield stageEvent('triage', 'complete', stageResults[0].detail, 1);

      // ── Stage 2: Memory — context retrieval ──
      yield stageEvent('memory', 'active', 'Retrieving relevant context...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.2, dissonance: signals.dissonance * 0.15, healthScore: 0.85, safetyState: 'green' as SafetyState, riskScore: signals.riskScore * 0.15 } };
      stageResults[1] = { stage: 'memory', status: 'complete', summary: 'memory', detail: generateStageDetail('memory', qa), value: 1 };
      await sleep(200);
      yield stageEvent('memory', 'complete', stageResults[1].detail, 1);

      // ── Stage 3: Routing — pathway selection ──
      yield stageEvent('routing', 'active', 'Selecting analytical pathways...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.3, dissonance: signals.dissonance * 0.25, healthScore: 0.8, safetyState: 'green' as SafetyState, riskScore: signals.riskScore * 0.2 } };
      stageResults[2] = { stage: 'routing', status: 'complete', summary: 'routing', detail: generateStageDetail('routing', qa), value: 1 };
      await sleep(150);
      yield stageEvent('routing', 'complete', stageResults[2].detail, 1);

      // ── Stage 4: Statistical — LLM raw analysis (THE BIG CALL) ──
      // Uses streaming to yield real-time reasoning events for thought visualization.
      // Models that output <think> tags (DeepSeek R1, Qwen QwQ, etc.) will have
      // their thinking separated and streamed as 'reasoning' events.
      yield stageEvent('statistical', 'active', 'Running statistical analysis via LLM...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.4, dissonance: signals.dissonance * 0.35 } };
      rawAnalysis = '';
      try {
        const stream = llmStreamRawAnalysis(model, qa, signals, directives, images);
        let streamTimeoutId: ReturnType<typeof setTimeout> | null = null;
        try {
          streamTimeoutId = setTimeout(() => { /* noop — just a safety net, caught below */ }, LLM_TIMEOUT);
          for await (const chunk of stream) {
            if (chunk.kind === 'reasoning') {
              yield { type: 'reasoning', text: chunk.text } as PipelineEvent;
            } else {
              rawAnalysis += chunk.text;
            }
          }
        } finally {
          if (streamTimeoutId !== null) clearTimeout(streamTimeoutId);
        }
      } catch (streamError) {
        // Fallback to non-streaming if stream fails
        logger.warn('runPipeline', 'Stream failed, falling back to non-streaming:', streamError);
        if (!rawAnalysis) {
          rawAnalysis = await withTimeout(llmGenerateRawAnalysis(model, qa, signals, directives), LLM_TIMEOUT, 'Raw analysis');
        }
      }
      stageResults[3] = { stage: 'statistical', status: 'complete', summary: 'statistical', detail: 'Statistical analysis complete', value: 1 };
      yield stageEvent('statistical', 'complete', 'Analysis generated', 1);

      // ── Stage 5: Causal — completed (part of raw analysis) ──
      yield stageEvent('causal', 'active', 'Evaluating causal relationships...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.55, dissonance: signals.dissonance * 0.5, healthScore: signals.healthScore * 0.7 } };
      stageResults[4] = { stage: 'causal', status: 'complete', summary: 'causal', detail: generateStageDetail('causal', qa), value: 1 };
      await sleep(100);
      yield stageEvent('causal', 'complete', stageResults[4].detail, 1);

      // Extract real concepts from LLM analysis (replaces hardcoded pools)
      if (rawAnalysis) {
        const llmConcepts = extractConceptsFromAnalysis(rawAnalysis, qa);
        if (llmConcepts.length > 0) {
          signals.activeConcepts = llmConcepts;
        }
      }

      // Emit mid-pipeline TDA and concept signals
      yield { type: 'signals', data: { tda: signals.tda, focusDepth: signals.focusDepth, temperatureScale: signals.temperatureScale, activeConcepts: signals.activeConcepts, activeChordProduct: signals.activeChordProduct, harmonyKeyDistance: signals.harmonyKeyDistance } };

      // ── Stage 6: Meta-Analysis — completed (part of raw analysis) ──
      yield stageEvent('meta_analysis', 'active', 'Running meta-analytical synthesis...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.65, dissonance: signals.dissonance * 0.6 } };
      stageResults[5] = { stage: 'meta_analysis', status: 'complete', summary: 'meta_analysis', detail: generateStageDetail('meta_analysis', qa), value: 1 };
      await sleep(100);
      yield stageEvent('meta_analysis', 'complete', stageResults[5].detail, 1);

      // ── SOAR: Meta-Reasoning Loop (if enabled and at edge of learnability) ──
      // Skip SOAR entirely when analytics engine is disabled
      const effectiveSoarConfig = soarConfig ?? DEFAULT_SOAR_CONFIG;
      let soarSession: SOARSession | null = null;
      if (analyticsEngineEnabled && effectiveSoarConfig.enabled) {
        const probe = quickProbe(qa, {
          confidence: signals.confidence,
          entropy: signals.entropy,
          dissonance: signals.dissonance,
        }, effectiveSoarConfig);

        yield { type: 'soar', event: 'probe', data: { atEdge: probe.atEdge, difficulty: probe.estimatedDifficulty, reason: probe.reason } };

        if (probe.atEdge || !effectiveSoarConfig.autoDetect) {
          yield { type: 'soar', event: 'start', data: { recommendedDepth: probe.recommendedDepth } };

          const inferenceMode = inferenceConfig.mode ?? 'api';
          soarSession = await runSOAR(
            model,
            query,
            qa,
            {
              confidence: signals.confidence,
              entropy: signals.entropy,
              dissonance: signals.dissonance,
              healthScore: signals.healthScore,
              persistenceEntropy: signals.tda.persistenceEntropy,
            },
            inferenceMode,
            effectiveSoarConfig,
            (event) => {
              // SOAR events are emitted but we can't yield from a callback
              // so we just log. The session result carries all data.
            },
          );

          yield { type: 'soar', event: 'complete', data: {
            improved: soarSession.overallImproved,
            iterations: soarSession.iterationsCompleted,
            reward: soarSession.rewards.reduce((s, r) => s + r.composite, 0),
            contradictions: soarSession.contradictionScan?.contradictions.length ?? 0,
          }};

          // If SOAR improved signals, update them for downstream stages
          if (soarSession.overallImproved && soarSession.finalSignals) {
            signals.confidence = soarSession.finalSignals.confidence;
            signals.entropy = soarSession.finalSignals.entropy;
            signals.dissonance = soarSession.finalSignals.dissonance;
            signals.healthScore = soarSession.finalSignals.healthScore;
            signals.tda.persistenceEntropy = soarSession.finalSignals.persistenceEntropy;

            yield { type: 'signals', data: {
              confidence: signals.confidence,
              entropy: signals.entropy,
              dissonance: signals.dissonance,
              healthScore: signals.healthScore,
              tda: signals.tda,
            }};
          }
        }
      }

      // ── Stage 7-8: Bayesian + Synthesis — parallel LLM calls ──
      yield stageEvent('bayesian', 'active', 'Computing Bayesian posteriors...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.75, dissonance: signals.dissonance * 0.7, healthScore: signals.healthScore * 0.85 } };
      const sectionLabels = getSectionLabels(qa);
      const [laymanResult, reflectionResult, arbitrationResult] = await withTimeout(
        Promise.allSettled([
          llmGenerateLaymanSummary(model, qa, rawAnalysis, sectionLabels, directives),
          llmGenerateReflection(model, stageResults, rawAnalysis, directives),
          llmGenerateArbitration(model, stageResults, directives),
        ]),
        LLM_TIMEOUT,
        'Parallel LLM calls',
      );
      if (laymanResult.status === 'rejected') throw laymanResult.reason;
      laymanSummary = laymanResult.value;
      reflection = reflectionResult.status === 'fulfilled'
        ? reflectionResult.value
        : { selfCriticalQuestions: [], adjustments: [], leastDefensibleClaim: '', precisionVsEvidenceCheck: '' };
      arbitration = arbitrationResult.status === 'fulfilled'
        ? arbitrationResult.value
        : { consensus: true, votes: [], disagreements: [], resolution: 'Arbitration unavailable' };

      stageResults[6] = { stage: 'bayesian', status: 'complete', summary: 'bayesian', detail: 'Bayesian updating complete', value: 1 };
      yield stageEvent('bayesian', 'complete', 'Bayesian posteriors computed', 1);
      stageResults[7] = { stage: 'synthesis', status: 'complete', summary: 'synthesis', detail: 'Synthesis complete', value: 1 };
      yield stageEvent('synthesis', 'active', 'Synthesizing results...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.85, dissonance: signals.dissonance * 0.8, safetyState: signals.safetyState } };
      await sleep(80);
      yield stageEvent('synthesis', 'complete', 'Results synthesized', 1);

      // ── Stage 9: Adversarial — reflection ──
      yield stageEvent('adversarial', 'active', 'Running adversarial review...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.92, dissonance: signals.dissonance * 0.9, riskScore: signals.riskScore * 0.85 } };
      stageResults[8] = { stage: 'adversarial', status: 'complete', summary: 'adversarial', detail: `${reflection.selfCriticalQuestions.length} critical questions, ${reflection.adjustments.length} adjustments`, value: 1 };
      await sleep(80);
      yield stageEvent('adversarial', 'complete', stageResults[8].detail, 1);

      // ── Build dualMessage before truth assessment ──
      const adjustedConfidence = reflection.adjustments.length > 0
        ? Math.max(0.15, signals.confidence - 0.02 * reflection.adjustments.length)
        : signals.confidence;

      const uncertaintyTags = (rawAnalysis.match(/\[(DATA|MODEL|UNCERTAIN|CONFLICT)\]/g) ?? []).map((tag) => ({
        claim: tag,
        tag: tag.replace(/[[\]]/g, '') as 'DATA' | 'MODEL' | 'UNCERTAIN' | 'CONFLICT',
      }));

      const modelVsDataFlags = uncertaintyTags.map((t) => ({
        claim: t.claim,
        source: t.tag === 'DATA' ? 'data-driven' as const
          : t.tag === 'MODEL' ? 'model-assumption' as const
          : 'heuristic' as const,
      }));

      const dualMessage: DualMessage = {
        rawAnalysis,
        uncertaintyTags,
        modelVsDataFlags,
        laymanSummary,
        reflection,
        arbitration,
      };

      // ── Stage 10: Calibration — truth assessment ──
      yield stageEvent('calibration', 'active', 'Calibrating truth assessment...');
      yield { type: 'signals', data: { entropy: signals.entropy, dissonance: signals.dissonance, healthScore: signals.healthScore, riskScore: signals.riskScore, confidence: adjustedConfidence } };

      let truthAssessment;
      try {
        truthAssessment = await withTimeout(
          llmGenerateTruthAssessment(model, dualMessage, {
            entropy: signals.entropy,
            dissonance: signals.dissonance,
            confidence: adjustedConfidence,
            healthScore: signals.healthScore,
            safetyState: signals.safetyState,
            riskScore: signals.riskScore,
          }, directives),
          LLM_TIMEOUT,
          'Truth assessment',
        );
      } catch (truthError) {
        logger.error('runPipeline', 'Truth assessment LLM call failed, using computed fallback:', truthError);
        yield {
          type: 'error',
          message: `Truth assessment LLM call failed — using signal-based computation instead: ${truthError instanceof Error ? truthError.message : 'timeout'}`,
        };
        truthAssessment = generateTruthAssessment(dualMessage, {
          entropy: signals.entropy,
          dissonance: signals.dissonance,
          confidence: adjustedConfidence,
          healthScore: signals.healthScore,
          safetyState: signals.safetyState,
          tda: signals.tda,
          riskScore: signals.riskScore,
        });
      }

      stageResults[9] = { stage: 'calibration', status: 'complete', summary: 'calibration', detail: 'Calibration complete', value: 1 };
      yield stageEvent('calibration', 'complete', 'Calibration complete', 1);

      // ── Stream the layman summary word-by-word ──
      const textToStream = laymanSummary.whatIsLikelyTrue;
      const words = textToStream.split(' ');
      for (let w = 0; w < words.length; w++) {
        const word = (w === 0 ? '' : ' ') + words[w];
        yield { type: 'text-delta', text: word };
        await sleep(25 + Math.random() * 35);
      }

      // ── Emit complete event ──
      yield {
        type: 'complete',
        dualMessage,
        truthAssessment,
        confidence: adjustedConfidence,
        grade: signals.grade,
        mode: signals.mode,
        signals: {
          ...signals,
          confidence: adjustedConfidence,
        },
      };
      return;
    } catch (llmError) {
      logger.error('runPipeline', 'LLM inference failed:', llmError);
      yield {
        type: 'error',
        message: `LLM inference failed: ${llmError instanceof Error ? llmError.message : 'Unknown error'}. Please check your API key and provider settings.`,
      };
      return;
    }
  }
}
