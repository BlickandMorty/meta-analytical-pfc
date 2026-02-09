'use client';

import { useCallback, useRef } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useSteeringStore } from '@/lib/store/use-steering-store';
import type { PipelineEvent } from '@/lib/engine/types';
import type { QueryFeatureVector } from '@/lib/engine/steering/types';
import type { SignalSnapshot, QueryAnalysisSnapshot } from '@/lib/engine/steering/encoder';
import type { TruthAssessmentInput } from '@/lib/engine/steering/feedback';
import { StreamingHandler, detectArtifacts } from '@/libs/agent-runtime/StreamingHandler';

export function useChatStream() {
  const abortRef = useRef<AbortController | null>(null);

  const sendQuery = useCallback(async (query: string, chatId?: string) => {
    const store = usePFCStore.getState();
    const steeringStore = useSteeringStore.getState();

    // Abort any existing stream
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // Optimistic: add user message immediately
    store.submitQuery(query);
    store.startStreaming();

    // Create StreamingHandler for reasoning/text separation
    const streamHandler = new StreamingHandler({
      onContentUpdate: (_content, _reasoning) => {
        // Content updates are handled via appendStreamingText in the event loop
      },
      onReasoningUpdate: (_reasoning) => {
        // Reasoning updates are handled via appendReasoningText in the event loop
      },
      onReasoningStart: () => {
        store.startReasoning();
      },
      onReasoningComplete: (durationMs) => {
        store.stopReasoning();
        usePFCStore.setState({ reasoningDuration: durationMs });
      },
      onComplete: () => {
        store.stopStreaming();
      },
      onError: (error) => {
        console.error('StreamingHandler error:', error);
        store.stopStreaming();
      },
    });

    // Gather pipeline controls from store
    const { controls, conceptWeights } = store;

    // Compute effective concept weights (user × auto)
    const effectiveWeights: Record<string, number> = {};
    let hasConceptWeights = false;
    for (const [key, cw] of Object.entries(conceptWeights)) {
      const ew = cw.weight * cw.autoWeight;
      if (Math.abs(ew - 0.65) > 0.01) hasConceptWeights = true;
      effectiveWeights[key] = ew;
    }

    const hasOverrides =
      controls.focusDepthOverride !== null ||
      controls.temperatureOverride !== null ||
      controls.complexityBias !== 0 ||
      controls.adversarialIntensity !== 1.0 ||
      controls.bayesianPriorStrength !== 1.0 ||
      hasConceptWeights;

    // Merge concept weights into controls for the API
    const mergedControls = hasOverrides
      ? { ...controls, ...(hasConceptWeights && { conceptWeights: effectiveWeights }) }
      : undefined;

    // ── Compute steering bias ──────────────────────────────────
    // Build a lightweight query feature vector from the query text
    // (mirrors analyzeQuery logic from simulate.ts but client-side)
    const queryFeatures = extractQueryFeatures(query);
    const steeringBias = steeringStore.computeBias(queryFeatures);
    const hasSteering = steeringBias.steeringStrength > 0.01;

    // ── Inference config ─────────────────────────────────────
    const inferenceConfig = store.getInferenceConfig();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chatId || store.currentChatId,
          query,
          userId: 'local-user',
          ...(mergedControls && { controls: mergedControls }),
          ...(hasSteering && { steeringBias }),
          inferenceConfig,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);

          if (data === '[DONE]') {
            store.stopStreaming();
            continue;
          }

          try {
            const event = JSON.parse(data) as PipelineEvent | { type: 'chat-id'; chatId: string };

            switch (event.type) {
              case 'chat-id':
                if ('chatId' in event) {
                  store.setCurrentChat(event.chatId);
                }
                break;

              case 'stage':
                store.advanceStage(event.stage, {
                  status: event.status,
                  detail: event.detail,
                  value: event.value,
                });
                break;

              case 'signals':
                store.applySignalUpdate(event.data);
                break;

              case 'reasoning':
                streamHandler.handleChunk({ type: 'reasoning', text: event.text });
                store.appendReasoningText(event.text);
                break;

              case 'text-delta':
                streamHandler.handleChunk({ type: 'text', text: event.text });
                store.appendStreamingText(event.text);
                break;

              case 'complete': {
                store.completeProcessing(
                  event.dualMessage,
                  event.confidence,
                  event.grade,
                  event.mode,
                  event.truthAssessment,
                );
                // Apply final signals
                store.applySignalUpdate(event.signals);

                // ── Record in steering memory ──────────────────
                // Build signal and query snapshots from the completed event
                const signalSnap: SignalSnapshot = {
                  confidence: event.confidence,
                  entropy: event.signals?.entropy ?? store.entropy,
                  dissonance: event.signals?.dissonance ?? store.dissonance,
                  healthScore: event.signals?.healthScore ?? store.healthScore,
                  riskScore: event.signals?.riskScore ?? store.riskScore,
                  safetyState: event.signals?.safetyState ?? store.safetyState,
                  tda: event.signals?.tda ?? store.tda,
                  focusDepth: event.signals?.focusDepth ?? store.focusDepth,
                  temperatureScale: event.signals?.temperatureScale ?? store.temperatureScale,
                  activeConcepts: event.signals?.activeConcepts ?? store.activeConcepts,
                  harmonyKeyDistance: event.signals?.harmonyKeyDistance ?? store.harmonyKeyDistance,
                };

                const querySnap: QueryAnalysisSnapshot = {
                  complexity: queryFeatures.complexity,
                  domain: getDomainName(queryFeatures.domain),
                  questionType: getQuestionTypeName(queryFeatures.questionType),
                  isEmpirical: queryFeatures.isEmpirical === 1,
                  isPhilosophical: queryFeatures.isPhilosophical === 1,
                  isMetaAnalytical: queryFeatures.isMetaAnalytical === 1,
                  hasSafetyKeywords: queryFeatures.hasSafetyKeywords === 1,
                  hasNormativeClaims: queryFeatures.hasNormativeClaims === 1,
                  wordCount: query.split(/\s+/).length,
                  entityCount: queryFeatures.entityCount * 8,
                };

                const truthInput: TruthAssessmentInput | null = event.truthAssessment
                  ? {
                      overallTruthLikelihood: event.truthAssessment.overallTruthLikelihood ?? 0.5,
                      // Consensus and disagreements come from arbitration (inside dualMessage),
                      // not from TruthAssessment directly — use safe defaults
                      consensus: true,
                      disagreements: event.truthAssessment.weaknesses ?? [],
                    }
                  : null;

                const resolvedChat = chatId || store.currentChatId || 'unknown';
                steeringStore.recordPipelineRun(signalSnap, querySnap, resolvedChat, truthInput);

                // ── Artifact detection → push to portal ──────────
                const rawText = event.dualMessage?.rawAnalysis || '';
                const detectedArtifacts = detectArtifacts(rawText);
                if (detectedArtifacts.length > 0) {
                  const latestMsg = store.messages[store.messages.length - 1];
                  const msgId = latestMsg?.id || 'unknown';
                  // Push the first significant artifact to the portal
                  const art = detectedArtifacts[0];
                  store.openArtifact({
                    messageId: msgId,
                    identifier: art.identifier,
                    title: art.title,
                    type: art.type,
                    language: art.language,
                    content: art.content,
                  });
                }
                break;
              }

              case 'error':
                console.error('Pipeline error:', event.message);
                store.stopStreaming();
                break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Stream error:', error);
      }
      store.stopStreaming();
    } finally {
      abortRef.current = null;
    }
  }, []);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      usePFCStore.getState().stopStreaming();
    }
  }, []);

  return { sendQuery, abort };
}

// ═══════════════════════════════════════════════════════════════════
// Lightweight client-side query feature extraction
// (mirrors key heuristics from simulate.ts analyzeQuery)
// ═══════════════════════════════════════════════════════════════════

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  philosophical: ['free will', 'consciousness', 'moral', 'ethics', 'determinism', 'existential', 'metaphysics', 'ontology'],
  medical: ['treatment', 'diagnosis', 'clinical', 'patient', 'disease', 'therapy', 'drug', 'symptom', 'medical'],
  science: ['quantum', 'physics', 'biology', 'chemistry', 'experiment', 'hypothesis', 'empirical'],
  technology: ['algorithm', 'software', 'machine learning', 'neural network', 'computing', 'AI', 'data'],
  social_science: ['society', 'culture', 'population', 'demographic', 'social', 'political'],
  economics: ['market', 'inflation', 'GDP', 'economic', 'trade', 'fiscal', 'monetary'],
  psychology: ['cognitive', 'behavior', 'mental', 'perception', 'emotion', 'personality'],
  ethics: ['should', 'ought', 'right', 'wrong', 'justice', 'fairness', 'moral'],
};

const QUESTION_TYPE_PATTERNS: Record<string, RegExp> = {
  causal: /^(why|what causes|how does .* affect|what leads to)/i,
  comparative: /^(compare|versus|vs|difference|better|worse)/i,
  definitional: /^(what is|define|what does .* mean)/i,
  evaluative: /^(is it true|evaluate|assess|how good)/i,
  speculative: /^(what if|could|would|imagine)/i,
  meta_analytical: /^(what does the evidence|meta-analy|systematic review|across studies)/i,
  empirical: /^(evidence|research|studies|data|literature)/i,
};

function extractQueryFeatures(query: string): QueryFeatureVector {
  const lower = query.toLowerCase();
  const words = query.split(/\s+/);

  // Domain detection
  let domain = 8; // default: general
  for (const [name, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      const domainNames = Object.keys(DOMAIN_KEYWORDS);
      domain = domainNames.indexOf(name);
      break;
    }
  }

  // Question type detection
  let questionType = 7; // default: conceptual
  for (const [name, pattern] of Object.entries(QUESTION_TYPE_PATTERNS)) {
    if (pattern.test(lower)) {
      const typeNames = Object.keys(QUESTION_TYPE_PATTERNS);
      questionType = typeNames.indexOf(name);
      break;
    }
  }

  // Complexity: based on word count, sentences, entities
  const sentences = query.split(/[.!?]+/).filter(s => s.trim()).length;
  const entities = words.filter(w => w.length > 5 && /^[A-Z]/.test(w)).length;
  const complexity = Math.min(1, 0.3 + (words.length / 40) * 0.5 + (entities / 8) * 0.3);

  // Flags
  const safetyKeywords = ['weapon', 'bomb', 'hack', 'exploit', 'drug', 'illegal', 'poison'];
  const normativeKeywords = ['should', 'ought', 'must', 'moral', 'ethical', 'right', 'wrong'];

  return {
    domain,
    questionType,
    complexity: Math.min(1, complexity),
    isEmpirical: /evidence|research|studies|data|empirical/i.test(lower) ? 1 : 0,
    isPhilosophical: /philosophy|consciousness|free will|moral|ethics|metaphysic/i.test(lower) ? 1 : 0,
    isMetaAnalytical: /meta-analy|systematic review|across studies/i.test(lower) ? 1 : 0,
    hasSafetyKeywords: safetyKeywords.some(kw => lower.includes(kw)) ? 1 : 0,
    hasNormativeClaims: normativeKeywords.some(kw => lower.includes(kw)) ? 1 : 0,
    wordCount: Math.min(1, words.length / 100),
    entityCount: Math.min(1, entities / 8),
  };
}

// Helper: index to domain name
const DOMAIN_NAMES = [
  'philosophical', 'medical', 'science', 'technology',
  'social_science', 'economics', 'psychology', 'ethics', 'general',
];
function getDomainName(idx: number): string { return DOMAIN_NAMES[idx] ?? 'general'; }

const QTYPE_NAMES = [
  'causal', 'comparative', 'definitional', 'evaluative',
  'speculative', 'meta_analytical', 'empirical', 'conceptual',
];
function getQuestionTypeName(idx: number): string { return QTYPE_NAMES[idx] ?? 'conceptual'; }
