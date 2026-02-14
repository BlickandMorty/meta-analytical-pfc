// ═══════════════════════════════════════════════════════════════════
// ██ STEERING PROMPT COMPOSER — Translates settings to directives
// ═══════════════════════════════════════════════════════════════════
//
// For API mode, we can't modify model internals. Instead, this module
// reads all user-controlled steering/pipeline/SOAR settings and
// composes behavioral directives injected into the system prompt.
//
// Design principle: Each directive must change HOW the model reasons,
// not just WHAT it says. We achieve this through procedural mandates
// (explicit steps to follow) rather than descriptive adjectives.
//
// Only emits directives for non-default values (deadband filtering).
// ═══════════════════════════════════════════════════════════════════

import type { PipelineControls } from '@/lib/engine/types';
import type { SteeringBias } from './types';
import type { SOARConfig } from '@/lib/engine/soar/types';

// ── Options ──────────────────────────────────────────────────────

export type AnalyticalMode = 'research' | 'plain';

export interface SteeringPromptOpts {
  controls?: PipelineControls;
  steeringBias?: SteeringBias;
  soarConfig?: SOARConfig;
  signalOverrides?: {
    confidence?: number | null;
    entropy?: number | null;
    dissonance?: number | null;
    // healthScore intentionally excluded — computed metric, not user-overridable
  };
  /** When false, analytics engine is disabled — skip all directives */
  analyticsEngineEnabled?: boolean;
  /** Chat mode — controls analytical depth and output style */
  chatMode?: AnalyticalMode;
}

// ── Deadband thresholds ──────────────────────────────────────────

const DEAD = 0.15; // ignore deviations smaller than this from defaults

function far(value: number, base: number): boolean {
  return Math.abs(value - base) > DEAD;
}

// ── Composer ─────────────────────────────────────────────────────

export function composeSteeringDirectives(opts: SteeringPromptOpts): string {
  // If analytics engine is explicitly disabled, emit nothing
  if (opts.analyticsEngineEnabled === false) return '';

  const lines: string[] = [];
  const c = opts.controls;
  const sb = opts.steeringBias;
  const soar = opts.soarConfig;
  const ov = opts.signalOverrides;

  // ═══════════════════════════════════════════════════════════════
  // 0. ANALYTICAL MODE — the most impactful single directive
  // ═══════════════════════════════════════════════════════════════

  if (opts.chatMode === 'research') {
    lines.push(
      `MODE: DEEP ANALYSIS — Full analytical pipeline activated.\n\n` +
      `You are operating as a research-grade reasoning engine. This means:\n` +
      `  PROCEDURE: For every claim, execute this 4-step chain:\n` +
      `    1. STATE the claim\n` +
      `    2. CITE the evidence (study name, N, effect size, year — or acknowledge absence)\n` +
      `    3. TAG its epistemic status [DATA/MODEL/UNCERTAIN/CONFLICT]\n` +
      `    4. NAME the strongest objection a methodologist would raise\n\n` +
      `  METHODOLOGY MANDATES:\n` +
      `    - Frequentist: report effect sizes (d, r, OR) with 95% CIs. Flag power < 0.80.\n` +
      `    - Causal: construct explicit DAGs. Name confounders. Apply Hill criteria.\n` +
      `    - Meta-analytical: report I², τ², publication bias indicators (Egger's, trim-and-fill).\n` +
      `    - Bayesian: state priors explicitly. Show how evidence updates them. Report BF₁₀.\n\n` +
      `  OUTPUT STANDARD: Your analysis should be defensible in a peer review appendix.\n` +
      `  A domain expert reading this should learn something they didn't already know.\n` +
      `  If they wouldn't, you haven't gone deep enough.`,
    );
  } else if (opts.chatMode === 'plain') {
    lines.push(
      `MODE: CONVERSATIONAL BRILLIANCE — Write like the smartest person at dinner.\n\n` +
      `  PROCEDURE:\n` +
      `    1. LEAD with the answer — not background, not context, THE ANSWER\n` +
      `    2. SUPPORT with the 1-2 most compelling evidence streams, told as narrative\n` +
      `    3. SURPRISE with one non-obvious insight the user didn't expect\n` +
      `    4. QUALIFY with the single most important caveat\n\n` +
      `  STYLE MANDATES:\n` +
      `    - Replace jargon with vivid analogies. "Effect size d=0.5" → "a difference you'd notice"\n` +
      `    - Weave evidence into narrative: "the landmark Kahneman & Tversky work showed..."\n` +
      `    - Express uncertainty naturally: "the evidence leans toward..." not "p = 0.07"\n` +
      `    - Be epistemically honest in plain language: "We genuinely don't know" when true\n\n` +
      `  ANTI-PATTERNS: No "Great question!", no "It's important to note that", no "There are\n` +
      `  many factors to consider." Start with substance. Every sentence earns its place.`,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. COMPLEXITY BIAS — reshapes analytical depth
  // ═══════════════════════════════════════════════════════════════

  if (c && far(c.complexityBias, 0)) {
    if (c.complexityBias > 0) {
      const intensity = c.complexityBias > 0.15 ? 'MAXIMUM' : 'ELEVATED';
      lines.push(
        `COMPLEXITY [${intensity}]: This query is deeper than it appears. Execute multi-layered analysis:\n\n` +
        `  MANDATORY LAYERS (address ALL of them):\n` +
        `    1. SURFACE — What the question literally asks. Answer it directly.\n` +
        `    2. ASSUMPTIONS — What does the question take for granted? Challenge at least one.\n` +
        `    3. INTERACTIONS — How does this connect to adjacent domains? What cross-pollination\n` +
        `       exists that the user probably hasn't considered?\n` +
        `    4. SECOND-ORDER — If the obvious answer is true, what unexpected consequences follow?\n` +
        `       What downstream effects do most people miss?\n` +
        `    5. META — Is the framing of the question itself misleading? Does the question contain\n` +
        `       a hidden false dichotomy, category error, or unstated assumption?\n\n` +
        `  REQUIREMENT: Your response must address at least 3 of these layers explicitly.\n` +
        `  A single-perspective answer is a failure. (bias: +${c.complexityBias.toFixed(2)})`,
      );
    } else {
      lines.push(
        `COMPLEXITY [REDUCED]: The user wants clarity, not exhaustiveness.\n\n` +
        `  PROCEDURE:\n` +
        `    1. Identify the SINGLE strongest conclusion the evidence supports\n` +
        `    2. Support it with the 1-2 most compelling evidence streams\n` +
        `    3. Mention ONLY caveats that would actually change the conclusion if true\n` +
        `    4. Resist the urge to list every perspective — pick the best-evidenced one\n\n` +
        `  A brilliant short answer beats a comprehensive mediocre one.\n` +
        `  (bias: ${c.complexityBias.toFixed(2)})`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. ADVERSARIAL INTENSITY — reshapes critical thinking
  // ═══════════════════════════════════════════════════════════════

  if (c && far(c.adversarialIntensity, 1.0)) {
    if (c.adversarialIntensity > 1.0) {
      const level =
        c.adversarialIntensity >= 2.0 ? 'MAXIMUM' :
        c.adversarialIntensity >= 1.5 ? 'HIGH' : 'ELEVATED';
      lines.push(
        `ADVERSARIAL [${level}]: Activate hostile-examiner mode.\n\n` +
        `  FOR EVERY CLAIM, execute this 4-step challenge protocol:\n` +
        `    1. STEEL-MAN: Construct the strongest possible opposing argument.\n` +
        `       Not a straw man. The actual best argument a smart critic would make.\n` +
        `    2. WEAKEST LINK: Identify the single assumption this claim most depends on.\n` +
        `       If that assumption is wrong, does the whole conclusion collapse?\n` +
        `    3. FAILURE SCENARIO: Describe a concrete, realistic situation where\n` +
        `       this claim fails. Not an absurd edge case — a plausible one.\n` +
        `    4. EXPERT DISSENT: What would a domain expert who disagrees actually say?\n` +
        `       Not a caricature — their real argument with their real evidence.\n\n` +
        `  FLAG overclaiming with [OVERCLAIM] tags. The user is paying for truth,\n` +
        `  not comfort. If a conclusion is fragile, say so plainly.\n` +
        `  (intensity: ${c.adversarialIntensity.toFixed(2)}×)`,
      );
    } else {
      lines.push(
        `ADVERSARIAL [CONSTRUCTIVE]: Build the strongest possible case FOR the conclusion.\n\n` +
        `  PROCEDURE:\n` +
        `    1. Lead with the most compelling evidence supporting the main conclusion\n` +
        `    2. Challenge only claims with clear evidential problems\n` +
        `    3. Frame alternatives as "worth noting" not "equally valid"\n` +
        `    4. The user wants synthesis, not a debate tournament\n\n` +
        `  (intensity: ${c.adversarialIntensity.toFixed(2)}×)`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. BAYESIAN PRIOR STRENGTH — reshapes belief updating
  // ═══════════════════════════════════════════════════════════════

  if (c && far(c.bayesianPriorStrength, 1.0)) {
    if (c.bayesianPriorStrength > 1.0) {
      const level = c.bayesianPriorStrength >= 1.8 ? 'IRON' : 'STRONG';
      lines.push(
        `BAYESIAN PRIORS [${level}]: Your priors are heavy. Extraordinary claims demand\n` +
        `extraordinary evidence. A single underpowered study should barely move your posterior.\n\n` +
        `  MANDATORY RULES:\n` +
        `    1. BASE RATES FIRST — Anchor on population-level frequencies before adjusting.\n` +
        `       Always ask: "What would I expect to be true BEFORE seeing this evidence?"\n` +
        `    2. REPLICATION WEIGHT — Replicated findings get 3× the weight of single studies.\n` +
        `       Pre-registered replications get an additional 1.5× multiplier.\n` +
        `    3. DECLINE EFFECT — Assume published effect sizes are inflated ~30%.\n` +
        `       The first study on a topic almost always has the largest effect.\n` +
        `    4. EVIDENCE HIERARCHY — Systematic reviews > RCTs > prospective cohort >\n` +
        `       case-control > cross-sectional > case report > expert opinion.\n` +
        `       Never let lower-tier evidence override higher-tier evidence.\n` +
        `    5. NOVELTY PENALTY — Brand-new findings get a credibility discount until\n` +
        `       independently replicated. The sexier the finding, the larger the discount.\n\n` +
        `  If evidence genuinely overwhelms your priors, update — but narrate WHY\n` +
        `  it's sufficient. Show the Bayesian reasoning explicitly.\n` +
        `  (prior strength: ${c.bayesianPriorStrength.toFixed(2)}×)`,
      );
    } else {
      lines.push(
        `BAYESIAN PRIORS [OPEN]: Be epistemically flexible. Don't anchor too hard.\n\n` +
        `  PROCEDURE:\n` +
        `    1. Give novel findings the benefit of the doubt if methodology is sound\n` +
        `    2. Remember: paradigm shifts happen (prions, H. pylori, continental drift)\n` +
        `    3. When conventional wisdom conflicts with new evidence, favor the evidence\n` +
        `    4. Update beliefs freely. Note where the field might be stuck in old thinking.\n\n` +
        `  The most interesting ideas are often the ones that challenge priors.\n` +
        `  (prior strength: ${c.bayesianPriorStrength.toFixed(2)}×)`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. FOCUS DEPTH — reshapes analytical thoroughness
  // ═══════════════════════════════════════════════════════════════

  if (c?.focusDepthOverride != null) {
    const d = c.focusDepthOverride;
    if (d >= 8) {
      lines.push(
        `FOCUS DEPTH [MAXIMUM]: Go as deep as the topic permits.\n\n` +
        `  MANDATORY DEEP-DIVE CHECKLIST:\n` +
        `    □ GENEALOGY — Who pioneered this idea? How has understanding evolved?\n` +
        `       Name the key papers, the turning points, the paradigm shifts.\n` +
        `    □ EVIDENCE MAP — Which studies are foundational? Which are controversial?\n` +
        `       Which findings are widely cited but poorly replicated?\n` +
        `    □ MECHANISM — Don't just report what happens. Model HOW it happens.\n` +
        `       What's the causal pathway? Where could the mechanism break down?\n` +
        `    □ CROSS-DOMAIN — What can we learn from analogous problems in other fields?\n` +
        `       What would a physicist/economist/biologist see here that a domain expert wouldn't?\n` +
        `    □ FAILURE MODES — Under what conditions does the dominant theory break down?\n` +
        `       What are the boundary conditions?\n` +
        `    □ FRONTIER — Where is this field heading? What are the open questions?\n` +
        `       What would a graduate student entering this area need to know?\n\n` +
        `  Your output should be useful to a PhD student entering this area.\n` +
        `  (depth: ${d.toFixed(1)})`,
      );
    } else if (d >= 5) {
      lines.push(
        `FOCUS DEPTH [MODERATE]: Thorough without being exhaustive.\n\n` +
        `  PROCEDURE:\n` +
        `    1. Cover the 2-3 main competing perspectives with their best evidence\n` +
        `    2. Cite landmark studies and key findings\n` +
        `    3. Identify the most important uncertainty\n` +
        `    4. Go beyond a surface answer but don't trace every thread\n\n` +
        `  Think "well-researched long-form article" not "dissertation chapter."\n` +
        `  (depth: ${d.toFixed(1)})`,
      );
    } else {
      lines.push(
        `FOCUS DEPTH [SURVEY]: Broad and efficient. The user wants the landscape.\n\n` +
        `  PROCEDURE:\n` +
        `    1. Give the essential takeaway in 2-3 sentences\n` +
        `    2. Map the main schools of thought without deep-diving any\n` +
        `    3. Note the single most important caveat\n` +
        `    4. Think "executive briefing" — what does a busy expert need in 60 seconds?\n\n` +
        `  (depth: ${d.toFixed(1)})`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. TEMPERATURE — reshapes cognitive style dramatically
  // ═══════════════════════════════════════════════════════════════

  if (c?.temperatureOverride != null) {
    const t = c.temperatureOverride;
    if (t >= 1.2) {
      lines.push(
        `COGNITIVE STYLE [DIVERGENT]: Think like a polymath at 2am.\n\n` +
        `  MANDATORY CREATIVE MANDATES:\n` +
        `    1. CROSS-POLLINATE — Draw at least one analogy from an unexpected domain.\n` +
        `       Biology↔economics, music↔physics, linguistics↔computation. The best\n` +
        `       insights come from pattern-matching across distant fields.\n` +
        `    2. INVERT — Ask "what if the opposite were true?" for at least one major\n` +
        `       assumption. Follow that thread for 2-3 sentences. See where it leads.\n` +
        `    3. COUNTERINTUITIVE — Surface the most counterintuitive implication you\n` +
        `       can find. The thing that's true but feels wrong.\n` +
        `    4. SPECULATE — Include at least one hypothesis that hasn't been tested yet.\n` +
        `       Label it [SPECULATIVE] but don't shy from it.\n` +
        `    5. CONTRARIAN — Consider at least one frame that's unfashionable but\n` +
        `       intellectually honest. What would the smartest contrarian say?\n\n` +
        `  The user chose creative mode because they want ideas they haven't thought of.\n` +
        `  Surprise them. (temperature: ${t.toFixed(2)})`,
      );
    } else if (t >= 0.85) {
      lines.push(
        `COGNITIVE STYLE [EXPLORATORY]: Balance rigor with imagination.\n\n` +
        `  Feel free to draw connections across domains. Mention speculative but\n` +
        `  plausible implications. You can wonder aloud. Don't limit yourself to\n` +
        `  the most conservative reading of the evidence. Follow interesting threads.\n` +
        `  (temperature: ${t.toFixed(2)})`,
      );
    } else if (t <= 0.4) {
      lines.push(
        `COGNITIVE STYLE [CONVERGENT]: Maximum precision. Strip all speculation.\n\n` +
        `  MANDATORY CONSTRAINTS:\n` +
        `    1. Report ONLY what the data directly supports — no extrapolation\n` +
        `    2. No analogies unless they're established in the literature\n` +
        `    3. Prefer understatement over overstatement, always\n` +
        `    4. If a claim lacks direct evidence, say "insufficient evidence"\n` +
        `       rather than reasoning by analogy or inference\n` +
        `    5. Every sentence should be defensible in a methods section\n\n` +
        `  Precision is the goal. When in doubt, say less. (temperature: ${t.toFixed(2)})`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. ADAPTIVE STEERING — learned biases from the 3-layer engine
  // ═══════════════════════════════════════════════════════════════

  if (sb && sb.steeringStrength > 0.1) {
    const biasLines: string[] = [];
    const str = sb.steeringStrength;

    if (Math.abs(sb.confidence) * str > 0.05) {
      biasLines.push(
        sb.confidence > 0
          ? `ASSERT: Where evidence is strong, commit. Replace "may suggest" with "demonstrates"\n` +
            `    when warranted. Weak hedging on strong evidence is its own form of dishonesty.\n` +
            `    (+${(sb.confidence * str).toFixed(2)})`
          : `HEDGE: Express more uncertainty. Widen confidence intervals. Show the full range of\n` +
            `    plausible interpretations. The user wants to see the uncertainty, not have it hidden.\n` +
            `    (${(sb.confidence * str).toFixed(2)})`,
      );
    }
    if (Math.abs(sb.entropy) * str > 0.05) {
      biasLines.push(
        sb.entropy > 0
          ? `COMPLEXIFY: Resist convergence. Surface disagreements between evidence streams.\n` +
            `    Show the user this topic is messier than it appears. Ambiguity is data.\n` +
            `    (+${(sb.entropy * str).toFixed(2)})`
          : `SIMPLIFY: Converge toward the most likely interpretation. Collapse ambiguity into\n` +
            `    actionable conclusions. The user wants clarity, not a map of all possible worlds.\n` +
            `    (${(sb.entropy * str).toFixed(2)})`,
      );
    }
    if (Math.abs(sb.dissonance) * str > 0.05) {
      biasLines.push(
        sb.dissonance > 0
          ? `TENSION: Hunt for contradictions. If Study A and Study B disagree, don't smooth it\n` +
            `    over — present both and analyze WHY they disagree (methods? populations? constructs?).\n` +
            `    Contradiction is information. (+${(sb.dissonance * str).toFixed(2)})`
          : `COHERENCE: Seek synthesis. Where evidence conflicts, look for reconciliation through\n` +
            `    moderator variables or different levels of analysis. Build a unified narrative.\n` +
            `    (${(sb.dissonance * str).toFixed(2)})`,
      );
    }
    if (Math.abs(sb.healthScore) * str > 0.05) {
      biasLines.push(
        sb.healthScore > 0
          ? `RIGOR: Check every inferential step. No logical leaps. Trace each conclusion back\n` +
            `    to its evidence base. If you can't show the chain, don't make the claim.\n` +
            `    (+${(sb.healthScore * str).toFixed(2)})`
          : `HEURISTIC: First-order approximations are acceptable when precision isn't critical.\n` +
            `    Not every claim needs a citation. Experienced-based reasoning is valid for\n` +
            `    practical advice. (${(sb.healthScore * str).toFixed(2)})`,
      );
    }
    if (Math.abs(sb.riskScore) * str > 0.05) {
      biasLines.push(
        sb.riskScore > 0
          ? `CAUTION: Adopt precautionary principle. Flag downside risks prominently.\n` +
            `    When the cost of being wrong is asymmetric, err toward safety.\n` +
            `    (+${(sb.riskScore * str).toFixed(2)})`
          : `OPPORTUNITY: Focus on upside potential. Emphasize what's possible and promising.\n` +
            `    Risk-aversion can be its own kind of error. (${(sb.riskScore * str).toFixed(2)})`,
      );
    }

    if (biasLines.length > 0) {
      lines.push(
        `ADAPTIVE STEERING (learned from ${sb.steeringSource || 'hybrid'}, ` +
        `strength ${(str * 100).toFixed(0)}%):\n  ${biasLines.join('\n  ')}`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. SIGNAL OVERRIDES — manual calibration priors
  // ═══════════════════════════════════════════════════════════════

  if (ov) {
    const overrides: string[] = [];
    if (ov.confidence != null) overrides.push(`confidence=${ov.confidence.toFixed(2)}`);
    if (ov.entropy != null) overrides.push(`entropy=${ov.entropy.toFixed(2)}`);
    if (ov.dissonance != null) overrides.push(`dissonance=${ov.dissonance.toFixed(2)}`);
    if (overrides.length > 0) {
      lines.push(
        `SIGNAL OVERRIDES: The user has manually set: ${overrides.join(', ')}.\n` +
        `  These represent the user's prior belief about the expected signal state.\n` +
        `  Calibrate your certainty language accordingly:\n` +
        `    - High confidence override → use stronger assertive language\n` +
        `    - High entropy override → acknowledge more competing valid interpretations\n` +
        `    - High dissonance override → surface more internal contradictions`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. SOAR MODE — meta-cognitive self-improvement loop
  // ═══════════════════════════════════════════════════════════════

  if (soar?.enabled) {
    lines.push(
      `SOAR MODE [ACTIVE]: Self-Optimizing Analytical Reasoning engaged.\n\n` +
      `  After completing your analysis, perform a MANDATORY meta-cognitive pass.\n` +
      `  Do not skip this. Do not treat it as optional. Weave these reflections\n` +
      `  naturally into your response — don't save them for a separate section.\n\n` +
      `  THE 4-QUESTION META-COGNITIVE PROTOCOL:\n` +
      `    1. GAPS — "What evidence would change my conclusion? What data don't I have\n` +
      `       that would be decisive? If I could commission one study, what would it be?"\n` +
      `    2. ASSUMPTIONS — "What are the 3 strongest assumptions my reasoning depends on?\n` +
      `       If I'm wrong about any of them, how does my conclusion change?"\n` +
      `    3. ALTERNATIVES — "What would the smartest person who disagrees with me argue?\n` +
      `       Not a straw man — their actual best argument with their actual best evidence."\n` +
      `    4. IMPROVEMENT — "If I could redo this analysis with one extra resource,\n` +
      `       methodology, or perspective, what would it be and why?"\n\n` +
      `  These reflections should feel like a researcher's honest internal monologue,\n` +
      `  not a performative display of humility.`,
    );
    if (soar.contradictionDetection) {
      lines.push(
        `CONTRADICTION SCAN [ACTIVE]: Before finalizing, cross-reference every major\n` +
        `  claim against every other major claim. If claim A and claim B cannot both\n` +
        `  be true simultaneously, flag it explicitly:\n` +
        `  "[CONTRADICTION: A vs B — resolution needed]"\n\n` +
        `  Do NOT silently resolve contradictions by dropping one side.\n` +
        `  Do NOT smooth over genuine disagreements with "both perspectives have merit."\n` +
        `  Contradictions are valuable information about where understanding breaks down.`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 9. CONCEPT EMPHASIS — focal attention weighting
  // ═══════════════════════════════════════════════════════════════

  if (c?.conceptWeights) {
    const boosted = Object.entries(c.conceptWeights)
      .filter(([, w]) => Math.abs(w - 1.0) > 0.3)
      .sort(([, a], [, b]) => b - a);
    if (boosted.length > 0) {
      const items = boosted.map(([concept, w]) =>
        w > 1.0
          ? `"${concept}" (boosted ${w.toFixed(1)}× — give this concept disproportionate analytical depth)`
          : `"${concept}" (dampened ${w.toFixed(1)}× — mention but don't let it dominate)`
      );
      lines.push(
        `CONCEPT EMPHASIS: Allocate analytical attention proportionally:\n  ${items.join('\n  ')}`,
      );
    }
  }

  if (lines.length === 0) return '';

  return (
    '\n--- STEERING DIRECTIVES (Active Settings) ---\n' +
    lines.join('\n\n') +
    '\n--- END DIRECTIVES ---\n'
  );
}
