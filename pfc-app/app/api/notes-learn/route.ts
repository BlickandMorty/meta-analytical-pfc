import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { resolveProvider } from '@/lib/engine/llm/provider';
import type { InferenceConfig } from '@/lib/engine/llm/config';
import type { NotePage, NoteBlock } from '@/lib/notes/types';
import type { LearningSession, LearningStepType } from '@/lib/notes/learning-protocol';
import {
  buildInventoryPrompt,
  buildGapAnalysisPrompt,
  buildDeepDivePrompt,
  buildCrossReferencePrompt,
  buildSynthesisPrompt,
  buildQuestionsPrompt,
  buildIterationCheckPrompt,
} from '@/lib/notes/learning-prompts';

// ── SSE helper ──
function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ── Temperature per step type ──
function getTemperature(stepType: LearningStepType): number {
  switch (stepType) {
    case 'deep-dive':
    case 'synthesis':
      return 0.7; // Creative steps
    case 'inventory':
    case 'gap-analysis':
    case 'questions':
      return 0.4; // Analytical steps
    case 'cross-reference':
      return 0.5;
    case 'iterate':
      return 0.3;
    default:
      return 0.5;
  }
}

// ── Build note content string ──
function buildNoteContent(pages: NotePage[], blocks: NoteBlock[]): string {
  const sections: string[] = [];

  for (const page of pages) {
    const pageBlocks = blocks
      .filter((b) => b.pageId === page.id)
      .sort((a, b) => a.order.localeCompare(b.order));

    const blockContent = pageBlocks
      .map((b) => {
        const indent = '  '.repeat(b.indent || 0);
        return `${indent}- ${b.content}`;
      })
      .filter((line) => line.trim() !== '-')
      .join('\n');

    if (blockContent.trim()) {
      sections.push(`## ${page.title}\n${blockContent}`);
    } else {
      sections.push(`## ${page.title}\n(empty page)`);
    }
  }

  return sections.join('\n\n');
}

// ── Build prompt for a given step type ──
function buildPromptForStep(
  stepType: LearningStepType,
  noteContent: string,
  session: LearningSession,
  previousStepOutputs: Record<string, string>,
): { system: string; user: string } {
  switch (stepType) {
    case 'inventory':
      return buildInventoryPrompt(noteContent);
    case 'gap-analysis':
      return buildGapAnalysisPrompt(noteContent, previousStepOutputs['inventory'] ?? '');
    case 'deep-dive':
      return buildDeepDivePrompt(noteContent, previousStepOutputs['gap-analysis'] ?? '', session.depth);
    case 'cross-reference':
      return buildCrossReferencePrompt(noteContent);
    case 'synthesis':
      return buildSynthesisPrompt(noteContent, previousStepOutputs['cross-reference'] ?? '');
    case 'questions':
      return buildQuestionsPrompt(noteContent, previousStepOutputs['inventory'] ?? '');
    case 'iterate': {
      // Build a summary of all previous steps for the iteration check
      const summaryParts = Object.entries(previousStepOutputs)
        .map(([key, val]) => `[${key}]: ${val.slice(0, 500)}`)
        .join('\n\n');
      return buildIterationCheckPrompt(noteContent, summaryParts);
    }
    default:
      return {
        system: 'You are a learning assistant analyzing notes.',
        user: `Analyze the following notes:\n\n${noteContent}`,
      };
  }
}

// ── Parse step response into structured data ──
function parseStepResponse(
  stepType: LearningStepType,
  text: string,
): {
  insights: string[];
  pagesCreated: { title: string }[];
  blocksCreated: { content: string; pageTitle?: string }[];
} {
  const insights: string[] = [];
  const pagesCreated: { title: string }[] = [];
  const blocksCreated: { content: string; pageTitle?: string }[] = [];

  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed.insights)) {
      insights.push(...parsed.insights);
    }
    if (Array.isArray(parsed.pages)) {
      for (const page of parsed.pages) {
        if (typeof page === 'string') {
          pagesCreated.push({ title: page });
        } else if (page.title) {
          pagesCreated.push({ title: page.title });
          if (Array.isArray(page.blocks)) {
            for (const block of page.blocks) {
              blocksCreated.push({
                content: typeof block === 'string' ? block : block.content ?? '',
                pageTitle: page.title,
              });
            }
          }
        }
      }
    }
    if (Array.isArray(parsed.gaps)) {
      insights.push(...parsed.gaps.map((g: any) => typeof g === 'string' ? g : g.description ?? String(g)));
    }
    if (Array.isArray(parsed.connections)) {
      insights.push(...parsed.connections.map((c: any) => typeof c === 'string' ? c : c.description ?? String(c)));
    }
    if (Array.isArray(parsed.questions)) {
      insights.push(...parsed.questions.map((q: any) => typeof q === 'string' ? q : q.text ?? String(q)));
    }
    if (typeof parsed.shouldContinue === 'boolean') {
      insights.push(parsed.shouldContinue ? 'Recommends another iteration' : 'Coverage is sufficient');
    }

    return { insights, pagesCreated, blocksCreated };
  } catch {
    // Not JSON — extract insights from plain text using line-based heuristics
    const lines = text.split('\n').filter((l) => l.trim());
    for (const line of lines) {
      const trimmed = line.replace(/^[-*\d.)\s]+/, '').trim();
      if (trimmed.length > 10 && trimmed.length < 500) {
        insights.push(trimmed);
      }
    }

    // Cap at reasonable number
    return {
      insights: insights.slice(0, 20),
      pagesCreated,
      blocksCreated,
    };
  }
}

// ── Simulation mode: generate mock responses ──
function generateSimulatedResponse(stepType: LearningStepType, noteContent: string): string {
  const pageCount = (noteContent.match(/^## /gm) || []).length;
  const wordCount = noteContent.split(/\s+/).length;

  switch (stepType) {
    case 'inventory':
      return JSON.stringify({
        topics: [
          { name: 'Primary concepts', coverage: wordCount > 200 ? 'moderate' : 'sparse', pageCount },
          { name: 'Supporting details', coverage: 'sparse', pageCount: Math.max(1, pageCount - 1) },
        ],
        concepts: ['analysis', 'synthesis', 'evaluation', 'cross-reference'],
        orphanTopics: ['methodology', 'future directions'],
        connectionDensity: 0.3,
      });
    case 'gap-analysis':
      return JSON.stringify({
        gaps: [
          { topic: 'Primary concepts', severity: 'important', reason: 'Missing foundational definitions', suggestedAction: 'Add definitions and context' },
          { topic: 'Supporting details', severity: 'minor', reason: 'Could benefit from examples', suggestedAction: 'Add concrete examples' },
        ],
        weakConnections: [{ topicA: 'Primary concepts', topicB: 'Supporting details', relationship: 'Conceptual prerequisite' }],
        missingContext: [{ assumption: 'Domain terminology', usedIn: 'Multiple pages', explanation: 'Key terms are used without definition' }],
      });
    case 'deep-dive':
      return JSON.stringify({
        generatedContent: [{
          pageTitle: 'Knowledge Expansion',
          gapAddressed: 'Missing foundational definitions',
          blocks: [
            '## Foundational Concepts\n\nBased on the analysis of your notes, several key concepts would benefit from deeper exploration.',
            'The core ideas in your notes revolve around interconnected themes that build on each other in meaningful ways.',
          ],
        }],
      });
    case 'cross-reference':
      return JSON.stringify({
        connections: [{
          sourcePageTitle: 'Notes',
          targetPageTitle: 'Analysis',
          relationship: 'Shared conceptual framework',
          connectionType: 'shared-concept',
          suggestedLinkText: 'See also: [[Analysis]] for related concepts',
        }],
      });
    case 'synthesis':
      return JSON.stringify({
        synthPages: [{
          title: 'Synthesis Overview',
          summary: 'An integrated view of the key themes across your notes.',
          blocks: [
            '## Synthesis\n\nYour notes reveal several interconnected themes worth consolidating.',
            'The connections between topics suggest a coherent narrative that ties your learning together.',
          ],
        }],
      });
    case 'questions':
      return JSON.stringify({
        questions: [
          { question: 'What are the practical applications of these concepts?', relatedTopics: ['Primary concepts'], depth: 'analytical', whyItMatters: 'Connects theory to practice' },
          { question: 'How do these ideas relate to broader frameworks?', relatedTopics: ['Supporting details'], depth: 'philosophical', whyItMatters: 'Provides wider context' },
        ],
      });
    case 'iterate':
      return JSON.stringify({
        shouldContinue: false,
        reason: 'Initial pass provides good coverage for the current note density.',
        confidenceScore: 0.75,
        focusAreas: [],
        diminishingReturnsRisk: 'moderate',
      });
    default:
      return '{"insights": ["Analysis complete"]}';
  }
}

// ── POST handler ──
export async function POST(request: NextRequest) {
  let notes: { pages: NotePage[]; blocks: NoteBlock[] };
  let session: LearningSession;
  let inferenceConfig: InferenceConfig;

  try {
    const body = await request.json();
    notes = body.notes;
    session = body.session;
    inferenceConfig = body.inferenceConfig;

    if (!notes || !session) {
      return new Response('Missing notes or session', { status: 400 });
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Resolve the LLM provider (null for simulation mode)
  const isSimulation = !inferenceConfig || inferenceConfig.mode === 'simulation';
  let model: Awaited<ReturnType<typeof resolveProvider>> | null = null;
  if (!isSimulation) {
    try {
      model = resolveProvider(inferenceConfig);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to resolve provider' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  // Build the note content string
  const noteContent = buildNoteContent(notes.pages, notes.blocks);

  const encoder = new TextEncoder();
  const capturedSession = session;
  const capturedModel = model;
  const capturedNoteContent = noteContent;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseEvent(data)));
      };

      let totalInsights = 0;
      let totalPagesCreated = 0;
      let totalBlocksCreated = 0;
      const previousStepOutputs: Record<string, string> = {};

      // Filter steps to target pages if specified
      const targetPages = capturedSession.targetPageIds?.length
        ? notes.pages.filter((p) => capturedSession.targetPageIds!.includes(p.id))
        : notes.pages;
      const targetBlocks = capturedSession.targetPageIds?.length
        ? notes.blocks.filter((b) => targetPages.some((p) => p.id === b.pageId))
        : notes.blocks;

      const effectiveNoteContent = capturedSession.targetPageIds?.length
        ? buildNoteContent(targetPages, targetBlocks)
        : capturedNoteContent;

      try {
        for (let stepIndex = 0; stepIndex < capturedSession.steps.length; stepIndex++) {
          const step = capturedSession.steps[stepIndex];

          // Emit step-start
          emit({ type: 'step-start', stepIndex, stepType: step.type });

          try {
            let responseText: string;

            if (isSimulation || !capturedModel) {
              // ── Simulation mode: generate mock insights with delays ──
              responseText = generateSimulatedResponse(step.type, effectiveNoteContent);
              // Simulate processing time
              await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
            } else {
              // ── LLM mode: call the real provider ──
              // Build the prompt for this step
              const prompt = buildPromptForStep(
                step.type,
                effectiveNoteContent,
                capturedSession,
                previousStepOutputs,
              );

              const temperature = getTemperature(step.type);

              const result = await generateText({
                model: capturedModel,
                system: prompt.system,
                prompt: prompt.user,
                maxOutputTokens: step.type === 'deep-dive' || step.type === 'synthesis' ? 4096 : 2048,
                temperature,
              });

              responseText = result.text;
            }

            // Emit the response text as stream chunks
            // Break into chunks for progressive display
            const chunkSize = 80;
            for (let i = 0; i < responseText.length; i += chunkSize) {
              const chunk = responseText.slice(i, i + chunkSize);
              emit({ type: 'stream-text', text: chunk });
            }

            // Store output for subsequent steps
            previousStepOutputs[step.type] = responseText;

            // Parse the response
            const parsed = parseStepResponse(step.type, responseText);

            // Emit insights
            for (const insight of parsed.insights) {
              emit({ type: 'insight', text: insight });
            }

            // Emit page-created and block-created events for deep-dive and synthesis
            if (step.type === 'deep-dive' || step.type === 'synthesis') {
              for (const page of parsed.pagesCreated) {
                emit({ type: 'page-created', pageTitle: page.title });
              }
              for (const block of parsed.blocksCreated) {
                emit({
                  type: 'block-created',
                  content: block.content,
                  pageTitle: block.pageTitle,
                });
              }
            }

            totalInsights += parsed.insights.length;
            totalPagesCreated += parsed.pagesCreated.length;
            totalBlocksCreated += parsed.blocksCreated.length;

            // Emit step-complete
            emit({
              type: 'step-complete',
              stepIndex,
              insights: parsed.insights,
              pagesCreated: parsed.pagesCreated.map((p) => p.title),
              blocksCreated: parsed.blocksCreated.map((b) => b.content.slice(0, 100)),
            });

            // For the iterate step, check whether to continue
            if (step.type === 'iterate') {
              const shouldContinue = responseText.toLowerCase().includes('continue')
                || responseText.toLowerCase().includes('another pass')
                || responseText.toLowerCase().includes('another iteration');

              if (!shouldContinue || capturedSession.iteration >= capturedSession.maxIterations) {
                // Stop iterating
                break;
              }
              // If continuing, the client would need to re-start with incremented iteration
              // For now, we complete this pass
            }
          } catch (stepError) {
            // One step failure should not kill the whole session
            const message = stepError instanceof Error ? stepError.message : 'Unknown step error';
            console.error(`[notes-learn] Step ${step.type} error:`, message);

            emit({
              type: 'step-complete',
              stepIndex,
              insights: [],
              pagesCreated: [],
              blocksCreated: [],
              error: message,
            });

            // Continue to next step
          }
        }

        // Emit session-complete
        emit({
          type: 'session-complete',
          totalInsights,
          totalPagesCreated,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[notes-learn] Session error:', message);
        emit({ type: 'error', message });
      } finally {
        // Signal end of stream
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
