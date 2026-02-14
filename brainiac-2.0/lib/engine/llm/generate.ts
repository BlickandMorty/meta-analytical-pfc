// ═══════════════════════════════════════════════════════════════════
// ██ LLM GENERATE — LLM-Backed Text Generation Functions
// ═══════════════════════════════════════════════════════════════════
//
// Uses generateText() for raw analysis (free-form text) and
// generateObject() for structured outputs (Zod-validated JSON).
// ═══════════════════════════════════════════════════════════════════

import { generateText, generateObject, streamText } from 'ai';
import type { LanguageModel } from 'ai';
import type { PipelineStage } from '@/lib/constants';
import type { QueryAnalysis } from '../query-analysis';
import type {
  LaymanSummary,
  ReflectionResult,
  ArbitrationResult,
  TruthAssessment,
  DualMessage,
  StageResult,
  SignalUpdate,
} from '../types';
import {
  buildRawAnalysisPrompt,
  buildLaymanSummaryPrompt,
  buildReflectionPrompt,
  buildArbitrationPrompt,
  buildTruthAssessmentPrompt,
} from './prompts';
import {
  laymanSummarySchema,
  reflectionResultSchema,
  arbitrationResultSchema,
  truthAssessmentSchema,
} from './schemas';

// ── Streaming chunk type for reasoning/text separation ────────

type StreamChunkKind = 'reasoning' | 'text';
interface LLMStreamChunk {
  kind: StreamChunkKind;
  text: string;
}

// ── Raw Analysis (non-streaming fallback) ─────────────────────

export async function llmGenerateRawAnalysis(
  model: LanguageModel,
  qa: QueryAnalysis,
  signals: Partial<SignalUpdate>,
  steeringDirectives?: string,
): Promise<string> {
  const prompt = buildRawAnalysisPrompt(qa, signals, steeringDirectives);
  const result = await generateText({
    model,
    system: prompt.system,
    prompt: prompt.user,
    maxOutputTokens: 2048,
    temperature: 0.7,
  });
  return result.text;
}

// ── Streaming Raw Analysis with <think> tag parsing ───────────
//
// Streams tokens from the LLM and separates reasoning (<think>
// blocks) from output text. Yields chunks in real-time so the UI
// can visualize the thinking process as it happens.

export async function* llmStreamRawAnalysis(
  model: LanguageModel,
  qa: QueryAnalysis,
  signals: Partial<SignalUpdate>,
  steeringDirectives?: string,
  images?: Array<{ mimeType: string; base64: string }>,
): AsyncGenerator<LLMStreamChunk> {
  const prompt = buildRawAnalysisPrompt(qa, signals, steeringDirectives);
  const hasImages = images && images.length > 0;

  const result = streamText({
    model,
    system: prompt.system,
    ...(hasImages
      ? {
          messages: [
            {
              role: 'user' as const,
              content: [
                ...images.map((img) => ({
                  type: 'image' as const,
                  image: (img.base64.includes(',') ? img.base64.split(',')[1] : img.base64) || img.base64,
                  mimeType: img.mimeType,
                })),
                { type: 'text' as const, text: prompt.user },
              ],
            },
          ],
        }
      : { prompt: prompt.user }),
    maxOutputTokens: 2048,
    temperature: 0.7,
  });

  let inThinkBlock = false;
  let buffer = '';
  let fullText = '';

  for await (const chunk of result.textStream) {
    buffer += chunk;

    // ── Detect <think> open tag ──
    if (!inThinkBlock) {
      const openIdx = buffer.indexOf('<think>');
      if (openIdx !== -1) {
        // Emit any text before the tag
        const before = buffer.slice(0, openIdx);
        if (before) {
          fullText += before;
          yield { kind: 'text', text: before };
        }
        buffer = buffer.slice(openIdx + 7); // skip <think>
        inThinkBlock = true;
      }
    }

    // ── Detect </think> close tag ──
    if (inThinkBlock) {
      const closeIdx = buffer.indexOf('</think>');
      if (closeIdx !== -1) {
        const thinking = buffer.slice(0, closeIdx);
        if (thinking) {
          yield { kind: 'reasoning', text: thinking };
        }
        buffer = buffer.slice(closeIdx + 8); // skip </think>
        inThinkBlock = false;
        continue;
      }

      // Emit reasoning in chunks (hold back last 10 chars in case
      // we're mid-tag like "</thi" to avoid false positives)
      if (buffer.length > 10 && !buffer.includes('<')) {
        yield { kind: 'reasoning', text: buffer };
        buffer = '';
      } else if (buffer.length > 10) {
        const safe = buffer.slice(0, buffer.lastIndexOf('<'));
        if (safe) {
          yield { kind: 'reasoning', text: safe };
          buffer = buffer.slice(safe.length);
        }
      }
    } else {
      // Not in think block — emit text (hold back for potential <think> tag)
      if (buffer.length > 10 && !buffer.includes('<')) {
        fullText += buffer;
        yield { kind: 'text', text: buffer };
        buffer = '';
      } else if (buffer.length > 10) {
        const safe = buffer.slice(0, buffer.lastIndexOf('<'));
        if (safe) {
          fullText += safe;
          yield { kind: 'text', text: safe };
          buffer = buffer.slice(safe.length);
        }
      }
    }
  }

  // Flush remaining buffer
  if (buffer) {
    if (inThinkBlock) {
      yield { kind: 'reasoning', text: buffer };
    } else {
      fullText += buffer;
      yield { kind: 'text', text: buffer };
    }
  }
}

// ── Layman Summary ──────────────────────────────────────────────

export async function llmGenerateLaymanSummary(
  model: LanguageModel,
  qa: QueryAnalysis,
  rawAnalysis: string,
  sectionLabels: Record<string, string>,
  steeringDirectives?: string,
): Promise<LaymanSummary> {
  const prompt = buildLaymanSummaryPrompt(qa, rawAnalysis, sectionLabels, steeringDirectives);
  const result = await generateObject({
    model,
    system: prompt.system,
    prompt: prompt.user,
    schema: laymanSummarySchema,
    maxOutputTokens: 2048,
    temperature: 0.6,
  });
  return {
    ...result.object,
    sectionLabels: sectionLabels as LaymanSummary['sectionLabels'],
  };
}

// ── Reflection ──────────────────────────────────────────────────

export async function llmGenerateReflection(
  model: LanguageModel,
  stageResults: StageResult[],
  rawAnalysis: string,
  steeringDirectives?: string,
): Promise<ReflectionResult> {
  const prompt = buildReflectionPrompt(stageResults, rawAnalysis, steeringDirectives);
  const result = await generateObject({
    model,
    system: prompt.system,
    prompt: prompt.user,
    schema: reflectionResultSchema,
    maxOutputTokens: 1024,
    temperature: 0.5,
  });
  return result.object;
}

// ── Arbitration ─────────────────────────────────────────────────

export async function llmGenerateArbitration(
  model: LanguageModel,
  stageResults: StageResult[],
  steeringDirectives?: string,
): Promise<ArbitrationResult> {
  const prompt = buildArbitrationPrompt(stageResults, steeringDirectives);
  const result = await generateObject({
    model,
    system: prompt.system,
    prompt: prompt.user,
    schema: arbitrationResultSchema,
    maxOutputTokens: 1024,
    temperature: 0.5,
  });
  // Cast engine strings to PipelineStage (Zod can't enforce the union)
  return {
    ...result.object,
    votes: result.object.votes.map((v) => ({
      ...v,
      engine: v.engine as PipelineStage,
    })),
  };
}

// ── Truth Assessment ────────────────────────────────────────────

export async function llmGenerateTruthAssessment(
  model: LanguageModel,
  dualMessage: DualMessage,
  signals: {
    entropy: number;
    dissonance: number;
    confidence: number;
    healthScore: number;
    safetyState: string;
    riskScore: number;
  },
  steeringDirectives?: string,
): Promise<TruthAssessment> {
  const prompt = buildTruthAssessmentPrompt(dualMessage, signals, steeringDirectives);
  const result = await generateObject({
    model,
    system: prompt.system,
    prompt: prompt.user,
    schema: truthAssessmentSchema,
    maxOutputTokens: 2048,
    temperature: 0.5,
  });
  return result.object;
}
