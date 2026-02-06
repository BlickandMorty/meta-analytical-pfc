// ═══════════════════════════════════════════════════════════════════
// ██ LLM GENERATE — Real LLM-Backed Text Generation Functions
// ═══════════════════════════════════════════════════════════════════
//
// Each function mirrors its simulation counterpart but calls a real LLM.
// Uses generateText() for raw analysis (free-form text) and
// generateObject() for structured outputs (Zod-validated JSON).
// ═══════════════════════════════════════════════════════════════════

import { generateText, generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import type { PipelineStage } from '@/lib/constants';
import type { QueryAnalysis } from '../simulate';
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

// ── Raw Analysis ────────────────────────────────────────────────

export async function llmGenerateRawAnalysis(
  model: LanguageModel,
  qa: QueryAnalysis,
  signals: Partial<SignalUpdate>,
): Promise<string> {
  const prompt = buildRawAnalysisPrompt(qa, signals);
  const result = await generateText({
    model,
    system: prompt.system,
    prompt: prompt.user,
    maxOutputTokens: 2048,
    temperature: 0.7,
  });
  return result.text;
}

// ── Layman Summary ──────────────────────────────────────────────

export async function llmGenerateLaymanSummary(
  model: LanguageModel,
  qa: QueryAnalysis,
  rawAnalysis: string,
  sectionLabels: Record<string, string>,
): Promise<LaymanSummary> {
  const prompt = buildLaymanSummaryPrompt(qa, rawAnalysis, sectionLabels);
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
): Promise<ReflectionResult> {
  const prompt = buildReflectionPrompt(stageResults, rawAnalysis);
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
): Promise<ArbitrationResult> {
  const prompt = buildArbitrationPrompt(stageResults);
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
): Promise<TruthAssessment> {
  const prompt = buildTruthAssessmentPrompt(dualMessage, signals);
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
