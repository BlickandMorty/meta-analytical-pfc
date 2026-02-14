// ═══════════════════════════════════════════════════════════════════
// Learning Runner — executes the 7-step recursive learning protocol
//
// Runs the same protocol as the web UI's /api/notes/learn route,
// but writes results directly to SQLite instead of streaming SSE.
// ═══════════════════════════════════════════════════════════════════

import { generateText } from 'ai';
import {
  buildInventoryPrompt,
  buildGapAnalysisPrompt,
  buildDeepDivePrompt,
  buildCrossReferencePrompt,
  buildSynthesisPrompt,
  buildQuestionsPrompt,
  buildIterationCheckPrompt,
} from '@/lib/notes/learning-prompts';
import { stripHtml, generatePageId, generateBlockId } from '@/lib/notes/types';
import type { DaemonTask } from '../scheduler';
import type { DaemonContext } from '../context';

const STEP_NAMES = [
  'inventory', 'gap-analysis', 'deep-dive', 'cross-reference',
  'synthesis', 'questions', 'iterate',
] as const;

export const learningRunner: DaemonTask = {
  name: 'learning-runner',
  description: 'Run the 7-step recursive learning protocol',

  async run(ctx: DaemonContext): Promise<string> {
    const vaultId = ctx.notes.getActiveVaultId();
    if (!vaultId) return 'No active vault';

    const pages = ctx.notes.getPages(vaultId);
    const blocks = ctx.notes.getBlocks(vaultId);

    if (pages.length === 0) return 'No pages to learn from';

    const depth = ctx.config.get('task.learningRunner.depth') as 'shallow' | 'moderate' | 'deep';
    const maxIterations = ctx.config.getNumber('task.learningRunner.maxIterations');
    const model = ctx.resolveModel();

    // Build notes content
    const notesContent = pages.map(page => {
      const pageBlocks = blocks
        .filter(b => b.pageId === page.id)
        .sort((a, b) => a.order.localeCompare(b.order));
      return `## ${page.title}\n${pageBlocks.map(b => stripHtml(b.content)).filter(Boolean).join('\n')}`;
    }).join('\n\n---\n\n').slice(0, 32_000);

    let totalInsights = 0;
    let totalPagesCreated = 0;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      ctx.log.task('learning-runner', `Starting iteration ${iteration + 1}/${maxIterations}`);

      const stepOutputs: Record<string, string> = {};

      for (const stepName of STEP_NAMES) {
        ctx.log.task('learning-runner', `Step: ${stepName}`);

        const prompt = getPromptForStep(stepName, notesContent, stepOutputs, depth);
        if (!prompt) continue;

        try {
          const result = await generateText({
            model,
            system: prompt.system,
            prompt: prompt.user,
            maxOutputTokens: getMaxTokens(stepName, depth),
            temperature: getTemperature(stepName),
          });

          stepOutputs[stepName] = result.text;

          // Process step results
          const processed = processStepResult(ctx, vaultId, stepName, result.text);
          totalInsights += processed.insights;
          totalPagesCreated += processed.pagesCreated;

          // Check if we should continue iterating
          if (stepName === 'iterate') {
            const shouldContinue = checkIteration(result.text);
            if (!shouldContinue) {
              ctx.log.task('learning-runner', 'Iteration check: stopping (diminishing returns)');
              return `Completed ${iteration + 1} iteration(s): ${totalInsights} insights, ${totalPagesCreated} pages created`;
            }
          }
        } catch (err) {
          ctx.log.error(`Learning step "${stepName}" failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    return `Completed ${maxIterations} iterations: ${totalInsights} insights, ${totalPagesCreated} pages created`;
  },
};

// ── Prompt routing ──

function getPromptForStep(
  step: string,
  notesContent: string,
  outputs: Record<string, string>,
  depth: string,
): { system: string; user: string } | null {
  switch (step) {
    case 'inventory':
      return buildInventoryPrompt(notesContent);
    case 'gap-analysis':
      return outputs['inventory']
        ? buildGapAnalysisPrompt(notesContent, outputs['inventory'])
        : null;
    case 'deep-dive':
      return outputs['gap-analysis']
        ? buildDeepDivePrompt(notesContent, outputs['gap-analysis'], depth)
        : null;
    case 'cross-reference':
      return buildCrossReferencePrompt(notesContent);
    case 'synthesis':
      return outputs['cross-reference']
        ? buildSynthesisPrompt(notesContent, outputs['cross-reference'])
        : null;
    case 'questions':
      return outputs['inventory']
        ? buildQuestionsPrompt(notesContent, outputs['inventory'])
        : null;
    case 'iterate': {
      const summary = Object.entries(outputs)
        .map(([k, v]) => `### ${k}\n${v.slice(0, 500)}`)
        .join('\n\n');
      return buildIterationCheckPrompt(notesContent, summary);
    }
    default:
      return null;
  }
}

function getMaxTokens(step: string, depth: string): number {
  const base = depth === 'deep' ? 4096 : depth === 'moderate' ? 2048 : 1024;
  if (step === 'deep-dive' || step === 'synthesis') return base * 2;
  if (step === 'iterate') return 512;
  return base;
}

function getTemperature(step: string): number {
  if (step === 'inventory' || step === 'iterate') return 0.3;
  if (step === 'deep-dive') return 0.7;
  return 0.5;
}

// ── Process step results ──

function processStepResult(
  ctx: DaemonContext,
  vaultId: string,
  step: string,
  text: string,
): { insights: number; pagesCreated: number } {
  let insights = 0;
  let pagesCreated = 0;

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { insights, pagesCreated };

  try {
    const data = JSON.parse(jsonMatch[0]);

    // Deep-dive and synthesis create pages
    if (step === 'deep-dive' && data.generatedContent) {
      for (const item of data.generatedContent) {
        createPageFromLearning(ctx, vaultId, item.pageTitle, item.blocks || [], 'deep-dive');
        pagesCreated++;
      }
    }

    if (step === 'synthesis' && data.synthPages) {
      for (const item of data.synthPages) {
        createPageFromLearning(ctx, vaultId, item.title, item.blocks || [], 'synthesis');
        pagesCreated++;
      }
    }

    // Questions create a page
    if (step === 'questions' && data.questions) {
      const questionBlocks = data.questions.map((q: { question: string; whyItMatters?: string }) =>
        `**${q.question}**${q.whyItMatters ? `\n${q.whyItMatters}` : ''}`
      );
      if (questionBlocks.length > 0) {
        createPageFromLearning(ctx, vaultId, 'Open Questions (AI Generated)', questionBlocks, 'questions');
        pagesCreated++;
      }
      insights += data.questions.length;
    }

    // Count insights from other steps
    if (data.topics) insights += data.topics.length;
    if (data.gaps) insights += data.gaps.length;
    if (data.connections) insights += data.connections.length;
  } catch {
    // Non-critical parse failure
  }

  return { insights, pagesCreated };
}

function createPageFromLearning(
  ctx: DaemonContext,
  vaultId: string,
  title: string,
  blockTexts: string[],
  source: string,
): void {
  const now = Date.now();
  const pageId = generatePageId();

  ctx.notes.upsertPage({
    id: pageId,
    title,
    name: title.toLowerCase(),
    isJournal: false,
    properties: { autoGenerated: 'true', source: `daemon-${source}` },
    tags: ['auto-generated', source],
    favorite: false,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  }, vaultId);

  blockTexts.forEach((text, i) => {
    ctx.notes.upsertBlock({
      id: generateBlockId(),
      pageId,
      type: 'paragraph',
      content: text,
      parentId: null,
      order: `a${i}`,
      collapsed: false,
      indent: 0,
      properties: { autoGenerated: 'true' },
      refs: [],
      createdAt: now,
      updatedAt: now,
    });
  });
}

function checkIteration(text: string): boolean {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return false;
    const data = JSON.parse(match[0]);
    return data.shouldContinue === true;
  } catch {
    return false;
  }
}
