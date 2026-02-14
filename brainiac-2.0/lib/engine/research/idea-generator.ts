/**
 * Idea Generator — Research Idea Generation with Reflective Refinement
 *
 * Ported from AI-Scientist v1's `generate_ideas()` in `generate_ideas.py`.
 *
 * Generates novel research ideas through a multi-step process:
 * 1. LLM generates an initial idea based on context and seed ideas
 * 2. Multiple reflection rounds refine and improve the idea
 * 3. Optional novelty check against Semantic Scholar
 * 4. Optional deduplication against existing ideas
 *
 * Each idea includes: title, experiment plan, interestingness,
 * feasibility, and novelty assessment.
 */

import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { checkNovelty, type NoveltyCheckResult, type NoveltyCheckInput } from './novelty-check';
import type { SemanticScholarConfig } from './semantic-scholar';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export interface ResearchIdea {
  name: string;                   // Short snake_case identifier
  title: string;                  // Full descriptive title
  experiment: string;             // Detailed experiment description
  interestingness: string;        // Why this idea is interesting
  feasibility: string;            // Why this is feasible
  novelty: string;                // Why this might be novel
}

interface IdeaGenerationInput {
  topic: string;                  // Research topic / area
  context?: string;               // Additional context about the field
  constraints?: string;           // Any constraints on the idea (methods, data, compute)
  seedIdeas?: ResearchIdea[];     // Example ideas to set format and inspiration
  existingIdeas?: string[];       // Titles of ideas already generated (for dedup)
}

interface ReflectionRound {
  roundNumber: number;
  critique: string;               // LLM's critique of the current idea
  improvements: string[];         // Specific improvements suggested
  refinedIdea: ResearchIdea;      // The improved idea
}

interface GeneratedIdea {
  idea: ResearchIdea;
  reflectionRounds: ReflectionRound[];
  noveltyCheck?: NoveltyCheckResult;
  overallScore: number;           // 0-1 composite quality score
  generationTimestamp: number;
}

interface IdeaGenerationResult {
  ideas: GeneratedIdea[];
  totalGenerated: number;
  totalAfterDedup: number;
  topic: string;
}

// ═══════════════════════════════════════════════════════════════════
// Schema
// ═══════════════════════════════════════════════════════════════════

const researchIdeaSchema = z.object({
  name: z.string().describe('Short snake_case name for the idea (max 5 words, e.g. "attention_pruning_dynamics")'),
  title: z.string().describe('Full descriptive title for the research idea'),
  experiment: z.string().describe('Detailed description of the proposed experiment, including methodology, data, and expected outcomes'),
  interestingness: z.string().describe('Why this idea is interesting and what impact it could have on the field'),
  feasibility: z.string().describe('Why this idea is feasible given available methods, data, and compute'),
  novelty: z.string().describe('Why this idea might be novel compared to existing published work'),
});

const reflectionSchema = z.object({
  critique: z.string().describe('Critical analysis of the current idea — what is strong, what is weak'),
  improvements: z.array(z.string()).describe('Specific, actionable improvements to the idea'),
  shouldKeep: z.boolean().describe('Whether the core idea is worth keeping (if false, the idea may be fundamentally flawed)'),
  refinedIdea: researchIdeaSchema.describe('The improved version of the idea incorporating the critique'),
});

const deduplicationSchema = z.object({
  isDuplicate: z.boolean().describe('Whether the two ideas are essentially the same research'),
  similarity: z.number().min(0).max(1).describe('How similar the ideas are (0=completely different, 1=identical)'),
  reasoning: z.string().describe('Brief explanation of why the ideas are or are not duplicates'),
});

const scoringSchema = z.object({
  interestingnessScore: z.number().min(0).max(1).describe('How interesting/impactful the idea is (0-1)'),
  feasibilityScore: z.number().min(0).max(1).describe('How feasible the idea is to execute (0-1)'),
  noveltyScore: z.number().min(0).max(1).describe('How novel the idea appears (0-1)'),
  clarityScore: z.number().min(0).max(1).describe('How clear and well-defined the experiment plan is (0-1)'),
  overallScore: z.number().min(0).max(1).describe('Overall quality score combining all factors (0-1)'),
  reasoning: z.string().describe('Brief rationale for the scores'),
});

// ═══════════════════════════════════════════════════════════════════
// Prompts
// ═══════════════════════════════════════════════════════════════════

function buildIdeaGenerationPrompt(input: IdeaGenerationInput): { system: string; user: string } {
  const seedExamples = input.seedIdeas?.length
    ? `\n\nHere are example ideas for reference (use these as format examples, NOT to copy from):\n${input.seedIdeas.map((idea, i) => `\nExample ${i + 1}:\n  Name: ${idea.name}\n  Title: ${idea.title}\n  Experiment: ${idea.experiment.slice(0, 300)}...\n  Interestingness: ${idea.interestingness.slice(0, 200)}...\n`).join('')}`
    : '';

  const existingList = input.existingIdeas?.length
    ? `\n\nThe following ideas have ALREADY been generated. Your new idea must be DIFFERENT:\n${input.existingIdeas.map((t) => `- ${t}`).join('\n')}`
    : '';

  return {
    system: `You are an ambitious AI researcher at a top institution, looking to generate novel research ideas that could lead to significant contributions to the field.

Your ideas should be:
- **Novel**: Not already published or widely explored
- **Feasible**: Achievable with current methods, data, and reasonable compute
- **Interesting**: Would generate excitement and have meaningful impact
- **Well-defined**: Clear experiment plan that another researcher could follow
- **Specific**: Not vague or overly broad — should describe a concrete experiment

Focus on ideas that are creative yet grounded. Avoid overly incremental work (just "applying X to Y") but also avoid moonshot ideas that cannot be tested.${seedExamples}`,

    user: `Research topic: ${input.topic}
${input.context ? `\nAdditional context: ${input.context}` : ''}
${input.constraints ? `\nConstraints: ${input.constraints}` : ''}${existingList}

Generate a novel, impactful research idea for this topic. The idea should be distinct from any examples or existing ideas listed above.`,
  };
}

function buildReflectionPrompt(
  idea: ResearchIdea,
  roundNumber: number,
  totalRounds: number,
): { system: string; user: string } {
  return {
    system: `You are a senior research advisor reviewing a proposed research idea. Your role is to provide constructive criticism and help improve the idea.

Round ${roundNumber} of ${totalRounds}.

Be thorough and honest in your critique. Focus on:
- Scientific rigor: Are the claims and methodology sound?
- Novelty: Is this truly new or does it overlap with existing work?
- Feasibility: Can this actually be done with available resources?
- Clarity: Is the experiment plan specific enough to follow?
- Impact: Would this matter to the field if successful?

If the idea is already excellent, make only minor refinements.
If the idea has fundamental flaws, say so and try to salvage the core insight.`,

    user: `Please critique and improve the following research idea:

Name: ${idea.name}
Title: ${idea.title}
Experiment: ${idea.experiment}
Interestingness: ${idea.interestingness}
Feasibility: ${idea.feasibility}
Novelty: ${idea.novelty}

Provide your critique and an improved version of the idea.`,
  };
}

function buildScoringPrompt(idea: ResearchIdea): { system: string; user: string } {
  return {
    system: `You are an expert research evaluator. Score the following research idea on multiple dimensions. Be calibrated and honest — not every idea is a 0.9.

Scoring guide:
- 0.0-0.2: Poor / fundamentally flawed
- 0.2-0.4: Below average / significant issues
- 0.4-0.6: Average / decent but not exceptional
- 0.6-0.8: Good / strong idea with minor issues
- 0.8-1.0: Excellent / top-tier research idea`,

    user: `Score this research idea:

Title: ${idea.title}
Experiment: ${idea.experiment}
Interestingness: ${idea.interestingness}
Feasibility: ${idea.feasibility}
Novelty: ${idea.novelty}`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a single research idea with reflection rounds.
 */
async function generateSingleIdea(
  model: LanguageModel,
  input: IdeaGenerationInput,
  options: {
    numReflections: number;
    temperature: number;
  },
): Promise<{ idea: ResearchIdea; reflections: ReflectionRound[] }> {
  // Step 1: Generate initial idea
  const genPrompt = buildIdeaGenerationPrompt(input);
  const { object: initialIdea } = await generateObject({
    model,
    schema: researchIdeaSchema,
    system: genPrompt.system,
    prompt: genPrompt.user,
    temperature: options.temperature,
  });

  let currentIdea: ResearchIdea = initialIdea;
  const reflections: ReflectionRound[] = [];

  // Step 2: Reflection rounds
  for (let round = 1; round <= options.numReflections; round++) {
    const refPrompt = buildReflectionPrompt(currentIdea, round, options.numReflections);
    const { object: reflection } = await generateObject({
      model,
      schema: reflectionSchema,
      system: refPrompt.system,
      prompt: refPrompt.user,
      temperature: 0.4,
    });

    reflections.push({
      roundNumber: round,
      critique: reflection.critique,
      improvements: reflection.improvements,
      refinedIdea: reflection.refinedIdea,
    });

    // Update idea for next round (unless reflection says it's not worth keeping)
    if (reflection.shouldKeep) {
      currentIdea = reflection.refinedIdea;
    } else {
      // Fundamental flaw — still use the refined version (it attempts to salvage)
      currentIdea = reflection.refinedIdea;
    }
  }

  return { idea: currentIdea, reflections };
}

/**
 * Check if two ideas are duplicates.
 */
async function checkDuplication(
  model: LanguageModel,
  idea1: ResearchIdea,
  idea2: ResearchIdea,
): Promise<{ isDuplicate: boolean; similarity: number }> {
  const { object: result } = await generateObject({
    model,
    schema: deduplicationSchema,
    system: 'You are a research expert determining if two research ideas are essentially the same.',
    prompt: `Are these two research ideas essentially the same?

Idea 1: "${idea1.title}"
${idea1.experiment.slice(0, 300)}

Idea 2: "${idea2.title}"
${idea2.experiment.slice(0, 300)}`,
    temperature: 0.1,
  });

  return { isDuplicate: result.isDuplicate, similarity: result.similarity };
}

/**
 * Score an idea on multiple dimensions.
 */
async function scoreIdea(
  model: LanguageModel,
  idea: ResearchIdea,
): Promise<number> {
  const scorePrompt = buildScoringPrompt(idea);
  const { object: scores } = await generateObject({
    model,
    schema: scoringSchema,
    system: scorePrompt.system,
    prompt: scorePrompt.user,
    temperature: 0.3,
  });

  return scores.overallScore;
}

// ═══════════════════════════════════════════════════════════════════
// Main Function
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate multiple research ideas with reflection, deduplication, and scoring.
 *
 * Each idea goes through:
 * 1. Initial generation
 * 2. N reflection rounds for improvement
 * 3. Deduplication against other generated ideas
 * 4. Quality scoring
 * 5. Optional novelty check against Semantic Scholar
 */
export async function generateIdeas(
  model: LanguageModel,
  input: IdeaGenerationInput,
  options?: {
    numIdeas?: number;
    numReflections?: number;
    checkNoveltyEnabled?: boolean;
    deduplicateEnabled?: boolean;
    s2Config?: SemanticScholarConfig;
  },
): Promise<IdeaGenerationResult> {
  const numIdeas = options?.numIdeas ?? 3;
  const numReflections = options?.numReflections ?? 3;
  const checkNoveltyEnabled = options?.checkNoveltyEnabled ?? false;
  const deduplicateEnabled = options?.deduplicateEnabled ?? true;

  // Use varying temperatures for diversity
  const temperatures = [0.6, 0.75, 0.85, 0.65, 0.8].slice(0, numIdeas);

  // ── Generate ideas sequentially (to feed existing ideas for dedup context) ──
  const rawIdeas: { idea: ResearchIdea; reflections: ReflectionRound[] }[] = [];
  const existingTitles = [...(input.existingIdeas ?? [])];

  for (let i = 0; i < numIdeas; i++) {
    const modifiedInput: IdeaGenerationInput = {
      ...input,
      existingIdeas: existingTitles,
    };

    const result = await generateSingleIdea(model, modifiedInput, {
      numReflections,
      temperature: temperatures[i] ?? 0.7,
    });

    rawIdeas.push(result);
    existingTitles.push(result.idea.title);
  }

  // ── Deduplicate ──
  let dedupedIdeas = rawIdeas;
  if (deduplicateEnabled && rawIdeas.length > 1) {
    const keepIndices = new Set<number>(rawIdeas.map((_, i) => i));

    for (let i = 0; i < rawIdeas.length; i++) {
      if (!keepIndices.has(i)) continue;
      for (let j = i + 1; j < rawIdeas.length; j++) {
        if (!keepIndices.has(j)) continue;
        try {
          const { isDuplicate } = await checkDuplication(model, rawIdeas[i]!.idea, rawIdeas[j]!.idea);
          if (isDuplicate) {
            keepIndices.delete(j); // Remove the later duplicate
          }
        } catch {
          // If dedup check fails, keep both
        }
      }
    }

    dedupedIdeas = rawIdeas.filter((_, i) => keepIndices.has(i));
  }

  // ── Score and optionally check novelty ──
  const generatedIdeas: GeneratedIdea[] = await Promise.all(
    dedupedIdeas.map(async ({ idea, reflections }) => {
      // Score the idea
      let overallScore = 0.5;
      try {
        overallScore = await scoreIdea(model, idea);
      } catch {
        // Scoring failed — use default
      }

      // Optional novelty check
      let noveltyResult: NoveltyCheckResult | undefined;
      if (checkNoveltyEnabled) {
        try {
          const noveltyInput: NoveltyCheckInput = {
            title: idea.title,
            description: idea.experiment,
            keywords: idea.name.split('_'),
          };
          noveltyResult = await checkNovelty(model, noveltyInput, {
            maxRounds: 3,
            s2Config: options?.s2Config,
          });
        } catch {
          // Novelty check failed — skip
        }
      }

      return {
        idea,
        reflectionRounds: reflections,
        noveltyCheck: noveltyResult,
        overallScore,
        generationTimestamp: Date.now(),
      };
    }),
  );

  // Sort by score descending
  generatedIdeas.sort((a, b) => b.overallScore - a.overallScore);

  return {
    ideas: generatedIdeas,
    totalGenerated: rawIdeas.length,
    totalAfterDedup: dedupedIdeas.length,
    topic: input.topic,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Utility — Quick single idea generation (no dedup/novelty)
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a single research idea quickly (1 reflection round, no novelty check).
 * Good for interactive "suggest an idea" workflows.
 */
export async function generateQuickIdea(
  model: LanguageModel,
  topic: string,
  context?: string,
): Promise<ResearchIdea> {
  const { idea } = await generateSingleIdea(
    model,
    { topic, context },
    { numReflections: 1, temperature: 0.75 },
  );
  return idea;
}

/**
 * Refine an existing idea through additional reflection rounds.
 */
export async function refineIdea(
  model: LanguageModel,
  idea: ResearchIdea,
  numRounds?: number,
): Promise<{ refined: ResearchIdea; reflections: ReflectionRound[] }> {
  const rounds = numRounds ?? 2;
  let currentIdea = idea;
  const reflections: ReflectionRound[] = [];

  for (let round = 1; round <= rounds; round++) {
    const refPrompt = buildReflectionPrompt(currentIdea, round, rounds);
    const { object: reflection } = await generateObject({
      model,
      schema: reflectionSchema,
      system: refPrompt.system,
      prompt: refPrompt.user,
      temperature: 0.4,
    });

    reflections.push({
      roundNumber: round,
      critique: reflection.critique,
      improvements: reflection.improvements,
      refinedIdea: reflection.refinedIdea,
    });

    currentIdea = reflection.refinedIdea;
  }

  return { refined: currentIdea, reflections };
}
