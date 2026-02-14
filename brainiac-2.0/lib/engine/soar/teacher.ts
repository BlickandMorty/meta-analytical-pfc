// ═══════════════════════════════════════════════════════════════════
// ██ SOAR — Teacher (Curriculum Generator)
// ═══════════════════════════════════════════════════════════════════
//
// The teacher generates stepping-stone problems that sit just inside
// the student's capability boundary. Critically, the teacher does NOT
// need to solve these problems — it only needs to generate problems
// whose STRUCTURE forces the right reasoning patterns.
//
// From the paper: "structural quality and well-posedness are more
// critical for learning progress than solution correctness."
// ═══════════════════════════════════════════════════════════════════

import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { logger } from '@/lib/debug-logger';
import type { QueryAnalysis } from '../query-analysis';
import type { Curriculum, SteppingStone, SOARReward } from './types';

// ---------------------------------------------------------------------------
// Curriculum generation prompt
// ---------------------------------------------------------------------------

function buildCurriculumPrompt(
  query: string,
  qa: QueryAnalysis,
  numStones: number,
  previousReward?: SOARReward,
): { system: string; user: string } {
  const rewardContext = previousReward
    ? `\n\nPrevious curriculum produced a reward of ${previousReward.composite.toFixed(3)} (${previousReward.improved ? 'improved' : 'no improvement'}).
Delta confidence: ${previousReward.deltaConfidence > 0 ? '+' : ''}${previousReward.deltaConfidence.toFixed(3)}
Delta entropy: ${previousReward.deltaEntropy > 0 ? '+' : ''}${previousReward.deltaEntropy.toFixed(3)}
Delta dissonance: ${previousReward.deltaDissonance > 0 ? '+' : ''}${previousReward.deltaDissonance.toFixed(3)}
${!previousReward.improved ? 'Generate a DIFFERENT curriculum approach this time. The previous stepping stones did not help.' : 'The approach worked. Refine and deepen it.'}`
    : '';

  return {
    system: `You are a pedagogical curriculum designer operating within a meta-analytical reasoning engine.

Your role is to generate STEPPING-STONE problems — intermediate questions that, when solved in sequence, build the reasoning scaffolding needed to tackle a hard target problem.

CRITICAL PRINCIPLES (from SOAR framework):
1. You are NOT trying to simplify the target problem. You are generating DIFFERENT problems that exercise the same reasoning patterns.
2. Structural quality matters more than solution correctness. Generate well-posed questions, even if you can't solve them yourself.
3. Each stepping stone should target a specific reasoning skill needed for the target problem.
4. Stones should increase in difficulty: start at ~40% of target difficulty, end at ~80%.
5. Your reward is based on whether the STUDENT IMPROVES on the target — not on how clever your questions are.

Query analysis context:
- Domain: ${qa.domain}
- Question type: ${qa.questionType}
- Complexity: ${(qa.complexity ?? 0.5).toFixed(2)}
- Key entities: ${(qa.entities ?? []).join(', ') || 'none extracted'}
- Is philosophical: ${qa.isPhilosophical ? 'yes' : 'no'}
- Is empirical: ${qa.isEmpirical ? 'yes' : 'no'}${rewardContext}`,

    user: `TARGET PROBLEM (the hard query the student cannot currently solve well):
"${query}"

Generate exactly ${numStones} stepping-stone problems. For each, specify:
1. The question text
2. What reasoning skill it targets
3. Its relative difficulty (0.0 to 1.0, where 1.0 = target difficulty)

Also provide a brief rationale explaining your curriculum strategy — why these particular stepping stones should help build toward the target problem.`,
  };
}

// ---------------------------------------------------------------------------
// Zod schema for structured output
// ---------------------------------------------------------------------------

const curriculumSchema = z.object({
  rationale: z.string().describe('Why this curriculum should help with the target problem'),
  stones: z.array(z.object({
    question: z.string().describe('The stepping-stone problem text'),
    targetSkill: z.string().describe('The reasoning skill this exercises'),
    relativeDifficulty: z.number().min(0).max(1).describe('Difficulty relative to target (0-1)'),
  })),
});

// ---------------------------------------------------------------------------
// Curriculum generation
// ---------------------------------------------------------------------------

let curriculumCounter = 0;

/**
 * Generate a curriculum of stepping-stone problems for a hard query.
 *
 * When an LLM model is provided, calls the model to produce structured
 * curriculum. Falls back to template-based stepping stones on error.
 */
export async function generateCurriculum(
  model: LanguageModel | null,
  query: string,
  qa: QueryAnalysis,
  numStones: number,
  iteration: number,
  previousReward?: SOARReward,
): Promise<Curriculum> {
  const startTime = Date.now();
  const curriculumId = `cur_${++curriculumCounter}_${Date.now()}`;

  if (model) {
    // Real LLM curriculum generation
    const prompt = buildCurriculumPrompt(query, qa, numStones, previousReward);

    try {
      const result = await generateObject({
        model,
        schema: curriculumSchema,
        system: prompt.system,
        prompt: prompt.user,
        maxOutputTokens: 1500,
        temperature: 0.8, // Slightly high for creative curriculum generation
      });

      const stones: SteppingStone[] = result.object.stones.map((s, i) => ({
        id: `stone_${curriculumId}_${i}`,
        question: s.question,
        targetSkill: s.targetSkill,
        relativeDifficulty: s.relativeDifficulty,
        structuralQuality: 0, // Assessed later
        wasUseful: null,
        order: i,
      }));

      return {
        id: curriculumId,
        targetQuery: query,
        stones,
        generationTimeMs: Date.now() - startTime,
        iteration,
        teacherRationale: result.object.rationale,
      };
    } catch (err) {
      // Fallback to template on LLM error — rationale marks it clearly
      logger.error('SOAR Teacher', 'LLM curriculum generation failed:', err);
      const fallback = generateSimulatedCurriculum(query, qa, numStones, iteration, curriculumId, startTime);
      fallback.teacherRationale = `[LLM Error Fallback] ${err instanceof Error ? err.message : 'Unknown error'}. ${fallback.teacherRationale}`;
      return fallback;
    }
  }

  // No model provided — use template fallback
  return generateSimulatedCurriculum(query, qa, numStones, iteration, curriculumId, startTime);
}

// ---------------------------------------------------------------------------
// Template fallback
// ---------------------------------------------------------------------------

function generateSimulatedCurriculum(
  query: string,
  qa: QueryAnalysis,
  numStones: number,
  iteration: number,
  curriculumId: string,
  startTime: number,
): Curriculum {
  const domain = qa.domain;
  const questionType = qa.questionType;

  // Template stepping stones based on domain + question type
  const templates = getTemplateStones(domain, questionType, numStones);

  const stones: SteppingStone[] = templates.map((t, i) => ({
    id: `stone_${curriculumId}_${i}`,
    question: t.question.replace('{TOPIC}', (qa.entities?.[0] ?? 'the subject')),
    targetSkill: t.skill,
    relativeDifficulty: 0.3 + (i / numStones) * 0.5,
    structuralQuality: 0.5 + Math.random() * 0.3,
    wasUseful: null,
    order: i,
  }));

  return {
    id: curriculumId,
    targetQuery: query,
    stones,
    generationTimeMs: Date.now() - startTime,
    iteration,
    teacherRationale: `[Template Fallback] Generated ${numStones} template stepping stones for ${domain}/${questionType} domain targeting progressive skill building.`,
  };
}

function getTemplateStones(domain: string, questionType: string, count: number) {
  const all = [
    { question: 'What are the key assumptions underlying {TOPIC}?', skill: 'Assumption identification' },
    { question: 'What evidence would change your view on {TOPIC}?', skill: 'Falsifiability reasoning' },
    { question: 'How would a skeptic critique the strongest argument for {TOPIC}?', skill: 'Adversarial thinking' },
    { question: 'What analogous problem in a different domain shares the same logical structure as {TOPIC}?', skill: 'Structural transfer' },
    { question: 'Decompose {TOPIC} into its three most fundamental sub-questions.', skill: 'Problem decomposition' },
    { question: 'What are the second-order effects of {TOPIC} that are commonly overlooked?', skill: 'Consequence tracing' },
    { question: 'Identify the most likely confounding variable in claims about {TOPIC}.', skill: 'Causal reasoning' },
    { question: 'If {TOPIC} is true, what else must necessarily be true?', skill: 'Deductive inference chain' },
    { question: 'Construct a minimal counterexample to the primary claim about {TOPIC}.', skill: 'Counterexample construction' },
    { question: 'What would a Bayesian update look like given new evidence about {TOPIC}?', skill: 'Bayesian reasoning' },
  ];

  return all.slice(0, Math.min(count, all.length));
}
