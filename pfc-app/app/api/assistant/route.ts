// ═══════════════════════════════════════════════════════════════════
// ██ ASSISTANT API — Streaming endpoint for the PFC Assistant widget
// ═══════════════════════════════════════════════════════════════════
//
// Lightweight SSE streaming route for the floating assistant. Uses
// the deep knowledge system prompt + dynamic context injection.
// Supports API mode (real LLM) and simulation mode (template fallback).
// ═══════════════════════════════════════════════════════════════════

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/debug-logger';
import { withMiddleware } from '@/lib/api-middleware';
import { streamText } from 'ai';
import { resolveProvider } from '@/lib/engine/llm/provider';
import { buildAssistantSystemPrompt, type AssistantContext } from '@/lib/engine/llm/assistant-prompt';
import { createSSEWriter, isAbortLikeError, parseBodyWithLimit } from '@/lib/api-utils';
import type { InferenceConfig } from '@/lib/engine/llm/config';

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ── Simulation fallback: keyword-matched template responses ──────

const SIMULATION_RESPONSES: { entropy: string; confidence: string; dissonance: string; steering: string; pipeline: string; ollama: string; default: string } = {
  entropy: `**Entropy** measures information disorder in the response space (0–1).

Current reading: the entropy level tells you how many competing valid answers exist for your query.

**High entropy (>0.6):** Many valid frameworks compete. This is actually CORRECT for genuinely ambiguous questions — the pipeline is honestly reporting uncertainty rather than pretending to be confident.

**Low entropy (<0.3):** Clear convergence on an answer. The analytical pathways agree.

**To reduce entropy:** Make your query more specific, provide more context, or focus on a narrower domain. Follow-up questions naturally reduce entropy as the pipeline narrows focus.

**To increase entropy (for exploration):** Ask broader, more open-ended questions. Philosophical and speculative queries naturally produce higher entropy.`,

  confidence: `**Confidence** (0–1) represents how certain the pipeline is about its conclusions.

**Interpreting your current reading:**
- >0.8: Strong evidence alignment across stages. Conclusions are well-supported.
- 0.5–0.8: Moderate confidence. Some evidence supports the conclusion, but gaps exist.
- <0.4: Low confidence. Genuine uncertainty, insufficient evidence, or poor query fit.

**How it's calculated:** Weighted combination of stage agreement, evidence strength, and domain-specific calibration. Adjusted by steering bias and complexity.

**Tuning tip:** Don't chase high confidence — it should match evidence strength. A properly calibrated confidence of 0.45 on a genuinely uncertain topic is MORE valuable than an artificially inflated 0.85.`,

  dissonance: `**Dissonance** (0–1) measures conflict between analytical pipeline stages.

**High dissonance (>0.5):** Pipeline stages disagree significantly. This often happens with:
- Normative/ethical questions where frameworks inherently conflict
- Topics with contradictory evidence
- Queries spanning multiple domains

**Low dissonance (<0.2):** Strong consensus across stages. All analytical pathways converge.

**What to do with high dissonance:** Consider that the disagreement might be informative. The adversarial stage (Stage 9) specifically stress-tests conclusions — some dissonance is healthy. If dissonance seems too high, try rephrasing your query to be more specific.`,

  steering: `**Steering Controls** let you bias pipeline behavior:

1. **Complexity Bias (0–1):** Override triage complexity assessment.
   - Low (0.2): Simpler, faster analysis
   - High (0.8): Deeper, more thorough — more pipeline stages engage fully

2. **Adversarial Intensity (0–1):** How aggressively Stage 9 stress-tests conclusions.
   - 0: Skip adversarial review entirely
   - 0.5: Moderate scrutiny
   - 1.0: Maximum — every claim gets challenged

3. **Bayesian Prior Strength (0–1):** Weight of prior beliefs vs. new evidence.
   - Low (0.2): Evidence-driven, easily changes stance
   - High (0.8): Prior-preserving, harder to shift

**Recommended settings by query type:**
- Empirical: complexity 0.7, adversarial 0.5, Bayesian 0.3
- Philosophical: complexity 0.5, adversarial 0.8, Bayesian 0.5
- Safety-sensitive: any complexity, adversarial 1.0, Bayesian 0.2`,

  pipeline: `**The 10-Stage Executive Pipeline:**

Every query flows through these stages sequentially:

1. **Triage** → Classifies complexity, domain, question type, extracts entities
2. **Memory** → Retrieves context from conversation history and cortex archive
3. **Routing** → Selects analytical pathways based on query type
4. **Statistical** → Main LLM generation: dense analysis with epistemic tags
5. **Causal** → Evaluates causal relationships and confounders
6. **Meta-Analysis** → Aggregates evidence, reports effect sizes and heterogeneity
7. **Bayesian** → Updates priors, generates layman summary + reflection + arbitration
8. **Synthesis** → Combines all outputs into coherent response
9. **Adversarial** → Stress-tests conclusions, identifies weakest claims
10. **Calibration** → Final truth assessment (0.05–0.95)

**The output is dual-layer:**
- Raw Analysis: Dense, research-grade with [DATA], [MODEL], [UNCERTAIN], [CONFLICT] tags
- Layman Summary: 5-section accessible format

**Signals are generated after triage** (Stage 1) and refined through the pipeline.`,

  ollama: `**Setting up Local Inference with Ollama:**

1. **Install Ollama:** \`curl -fsSL https://ollama.com/install.sh | sh\` (or download from ollama.com)

2. **Pull a model:**
   - For 16GB RAM: \`ollama pull llama3.1\` (8B params)
   - For 32GB+ RAM: \`ollama pull llama3.1:70b\`
   - For thinking: \`ollama pull qwen2.5:7b\` or \`ollama pull deepseek-r1:8b\`

3. **Start Ollama:** \`ollama serve\` (or it starts automatically on install)

4. **Configure in PFC:**
   - Settings → Inference Mode → Local
   - Base URL: \`http://localhost:11434\` (default)
   - Select your model from the dropdown

5. **Verify:** Settings → Test Connection (should show green)

**Hardware requirements:**
- 7B–8B models: 16GB RAM, 6GB GPU VRAM (4-bit quantized)
- 13B models: 24GB RAM, 10GB GPU VRAM
- 70B+ models: 64GB+ RAM, 48GB+ GPU VRAM`,

  default: `I'm the PFC Assistant — I know everything about this project's architecture, signals, pipeline stages, steering controls, and more.

**Quick things you can ask me:**
- "What does high entropy mean?" → Signal interpretation
- "How do I tune steering controls?" → Optimization recipes
- "Explain the pipeline stages" → Architecture deep-dive
- "Help me set up Ollama" → Local inference setup
- "What do the current signals indicate?" → Live signal analysis
- "How does the SOAR engine work?" → Meta-reasoning loop
- "What are epistemic tags?" → Output format explanation

Just ask anything about the PFC system and I'll explain it in detail!`,
};

function getSimulatedResponse(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('entropy')) return SIMULATION_RESPONSES.entropy;
  if (q.includes('confidence')) return SIMULATION_RESPONSES.confidence;
  if (q.includes('dissonance')) return SIMULATION_RESPONSES.dissonance;
  if (q.includes('steer') || q.includes('control') || q.includes('tune') || q.includes('tuning')) return SIMULATION_RESPONSES.steering;
  if (q.includes('pipeline') || q.includes('stage')) return SIMULATION_RESPONSES.pipeline;
  if (q.includes('ollama') || q.includes('local') || q.includes('setup')) return SIMULATION_RESPONSES.ollama;
  return SIMULATION_RESPONSES.default;
}

// ── Route handler ─────────────────────────────────────────────────

async function _POST(request: NextRequest) {
  type AssistantBody = {
    query: string;
    context: AssistantContext;
    inferenceConfig?: InferenceConfig;
    conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
  };

  const parsed = await parseBodyWithLimit<AssistantBody>(request, 2 * 1024 * 1024); // 2MB limit
  if ('error' in parsed) return parsed.error;
  const body = parsed.data;

  const { query, context, inferenceConfig, conversationHistory } = body;

  if (!query || typeof query !== 'string' || query.length > 10_000) {
    return NextResponse.json({ error: 'Invalid query (max 10k chars)' }, { status: 400 });
  }

  const isSimulation = !inferenceConfig || inferenceConfig.mode === 'simulation';
  const encoder = new TextEncoder();
  const clientSignal = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      const writer = createSSEWriter(controller, encoder);
      const emit = (data: Record<string, unknown>) => writer.raw(sseEvent(data));

      try {
        if (isSimulation) {
          // ── Simulation mode: keyword-matched templates ──
          const response = getSimulatedResponse(query);
          const chunkSize = 4;
          for (let i = 0; i < response.length; i += chunkSize) {
            if (clientSignal.aborted || writer.isClosed()) {
              writer.close();
              return;
            }
            const chunk = response.slice(i, i + chunkSize);
            if (!emit({ type: 'text', text: chunk })) {
              writer.close();
              return;
            }
            await new Promise((r) => setTimeout(r, 12));
          }
        } else {
          // ── Real LLM mode ──
          let model;
          try {
            model = resolveProvider(inferenceConfig!);
          } catch (error) {
            emit({ type: 'error', message: error instanceof Error ? error.message : 'Failed to resolve provider' });
            writer.done();
            writer.close();
            return;
          }

          const systemPrompt = buildAssistantSystemPrompt(context);

          // Build messages array with conversation history
          const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
            { role: 'system', content: systemPrompt },
          ];

          if (Array.isArray(conversationHistory)) {
            for (const msg of conversationHistory.slice(-8)) {
              // Validate each history entry: role must be 'user' or 'assistant', content must be a string
              if (
                msg &&
                typeof msg === 'object' &&
                (msg.role === 'user' || msg.role === 'assistant') &&
                typeof msg.content === 'string'
              ) {
                messages.push({ role: msg.role, content: msg.content.slice(0, 50_000) });
              }
            }
          }

          messages.push({ role: 'user', content: query });

          const result = streamText({
            model,
            messages,
            maxOutputTokens: 2048,
            temperature: 0.7,
            abortSignal: clientSignal,
          });

          for await (const chunk of result.textStream) {
            if (clientSignal.aborted || writer.isClosed()) {
              writer.close();
              return;
            }
            if (!emit({ type: 'text', text: chunk })) {
              writer.close();
              return;
            }
          }
        }

        emit({ type: 'done' });
      } catch (error) {
        if (clientSignal.aborted || writer.isClosed() || isAbortLikeError(error)) {
          writer.close();
          return;
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('assistant', 'Error:', message);
        emit({ type: 'error', message });
      } finally {
        writer.done();
        writer.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export const POST = withMiddleware(_POST, { maxRequests: 30, windowMs: 60_000 });
