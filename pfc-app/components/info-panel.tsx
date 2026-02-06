'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InfoIcon, XIcon, SparklesIcon, BookOpenIcon, LightbulbIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────
// Info definitions for the educational system
// ─────────────────────────────────────────────────────────────────────

export interface InfoEntry {
  title: string;
  description: string;
  useCase: string;
  technique: string;
  icon?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Pipeline stage educational content
// ─────────────────────────────────────────────────────────────────────

export const PIPELINE_INFO: Record<string, InfoEntry> = {
  triage: {
    title: 'Cognitive Triage Protocol',
    description: 'Modeled after the prefrontal cortex\'s executive attention network, this stage classifies query complexity using multi-dimensional analysis — domain mapping, entity extraction, and cognitive load estimation. Inspired by the same triage systems used at DeepMind and Anthropic for routing queries to appropriate reasoning depths.',
    useCase: 'Use this to understand why some queries get deeper analysis than others. The complexity score directly determines how many reasoning passes the pipeline allocates.',
    technique: 'Combines regex-based NLP entity extraction with weighted complexity scoring (word count, entity density, sentence structure). The resulting complexity vector routes the query through an optimal subset of downstream stages.',
    icon: '🧠',
  },
  memory: {
    title: 'Contextual Memory Retrieval',
    description: 'Implements a simplified retrieval-augmented generation (RAG) pattern — the same architecture powering ChatGPT\'s knowledge retrieval and Google Gemini\'s grounding system. Searches for contextual fragments with semantic relevance scoring above configurable thresholds.',
    useCase: 'Critical for multi-turn conversations. This stage ensures follow-up queries inherit the full context of prior exchanges rather than analyzing in isolation.',
    technique: 'Cosine similarity-based fragment retrieval with configurable relevance threshold (default 0.7). Fragments are ranked by recency-weighted relevance scoring.',
    icon: '🔍',
  },
  routing: {
    title: 'Adaptive Pathway Routing',
    description: 'The system\'s meta-cognitive routing engine — analogous to how the anterior cingulate cortex selects between competing cognitive strategies. Determines whether to deploy statistical, causal, philosophical, or hybrid analytical modes based on query characteristics.',
    useCase: 'This is where the engine decides its analytical strategy. Understanding routing helps you predict what kind of analysis you\'ll receive and adjust live controls to bias toward specific approaches.',
    technique: 'Decision tree routing based on domain classification, question type, and empirical/normative signal detection. Supports manual override via the Pathway Routing control.',
    icon: '🔀',
  },
  statistical: {
    title: 'Frequentist Statistical Engine',
    description: 'Runs classical statistical tests following the same methodological standards as Cochrane systematic reviews. Computes effect sizes (Cohen\'s d), statistical power analysis, and evaluates whether observed patterns exceed chance expectations.',
    useCase: 'Essential for any evidence-based claim. When the confidence badge shows "Grade A," it\'s because this stage found strong convergent evidence with adequate statistical power.',
    technique: 'Computes Cohen\'s d effect sizes with 95% confidence intervals, conducts power analysis (target \u03B2 = 0.80), and evaluates practical significance against minimal clinically important difference (MCID) thresholds.',
    icon: '📊',
  },
  causal: {
    title: 'Causal Inference Framework',
    description: 'Implements Bradford Hill criteria analysis — the gold standard in epidemiology for distinguishing correlation from causation. Used by the WHO, FDA, and major research institutions to evaluate whether observed associations represent genuine causal relationships.',
    useCase: 'Critical for questions like "Does X cause Y?" This stage prevents the pipeline from confusing correlation with causation — a common failure mode in AI systems that lack causal reasoning.',
    technique: 'Evaluates 9 Bradford Hill criteria: strength, consistency, specificity, temporality, biological gradient, plausibility, coherence, experimental evidence, and analogy. Produces a composite causal evidence score (0-1).',
    icon: '🔗',
  },
  meta_analysis: {
    title: 'Multi-Study Evidence Synthesis',
    description: 'Performs meta-analytical aggregation following PRISMA guidelines — the same framework used in systematic reviews published in The Lancet, JAMA, and Nature Medicine. Pools evidence across multiple analytical perspectives while quantifying between-study heterogeneity.',
    useCase: 'This is what separates a rigorous analysis from a superficial one. Meta-analysis reveals whether apparent consensus is genuine convergence or an artifact of shared methodological biases.',
    technique: 'Random-effects meta-analytical pooling with DerSimonian-Laird estimator. Computes I\u00B2 heterogeneity statistic and conducts Egger\'s test for publication bias. Generates forest plot-equivalent data for visualization.',
    icon: '🔬',
  },
  bayesian: {
    title: 'Bayesian Belief Updating',
    description: 'Implements formal Bayesian inference — the mathematical framework that underpins all modern AI systems including GPT-4, Claude, and Gemini. Updates prior beliefs with new evidence using Bayes\' theorem, producing posterior probability distributions that reflect both data and assumptions.',
    useCase: 'The Bayesian stage is what makes the pipeline\'s confidence scores meaningful. It tests whether conclusions hold across different starting assumptions (priors), revealing whether your result is robust or assumption-dependent.',
    technique: 'Computes Bayes factors (BF\u2081\u2080) with multiple prior specifications to test robustness. BF > 10 indicates strong evidence, BF 3-10 moderate, BF < 3 weak. Tests prior sensitivity by computing posterior range across informative and skeptical priors.',
    icon: '📐',
  },
  synthesis: {
    title: 'Evidence Stream Integration',
    description: 'The executive synthesis stage — analogous to the dorsolateral prefrontal cortex integrating information from multiple cognitive subsystems. Combines outputs from statistical, causal, Bayesian, and meta-analytical engines into a unified analytical position.',
    useCase: 'This stage resolves conflicts between engines. When the statistical engine supports a conclusion but the causal engine raises concerns, synthesis determines the final position using weighted evidence integration.',
    technique: 'Weighted evidence integration using inverse-variance weighting. Each engine\'s contribution is weighted by its confidence and the relevance of its methodology to the specific query type.',
    icon: '🧬',
  },
  adversarial: {
    title: 'Red-Team Stress Testing',
    description: 'Implements adversarial review inspired by Anthropic\'s Constitutional AI red-teaming methodology and OpenAI\'s deliberative alignment framework. Actively attempts to falsify the synthesis output by generating counter-arguments, testing for overclaiming, and checking logical consistency.',
    useCase: 'This is the pipeline\'s quality control checkpoint. When you see "overclaiming flagged" in the stage details, the adversarial engine caught the pipeline making a stronger claim than the evidence supports.',
    technique: 'Generates structured counter-arguments targeting: (1) logical fallacies, (2) unfounded causal claims, (3) overclaiming beyond evidence, (4) is-ought boundary violations, (5) generalization beyond sample scope. Adjustable via the Adversarial Intensity control.',
    icon: '⚔️',
  },
  calibration: {
    title: 'Confidence Calibration System',
    description: 'Performs final confidence calibration using Expected Calibration Error (ECE) methodology — the same metric used by top AI labs to ensure their models\' stated confidence actually predicts accuracy. Adjusts raw confidence scores based on entropy, dissonance, and adversarial findings.',
    useCase: 'The final confidence and grade you see on each response comes from this stage. Understanding calibration helps you interpret what "45% confidence" actually means — it\'s calibrated, not arbitrary.',
    technique: 'Multi-signal calibration: applies entropy penalty (0.3x), dissonance penalty (0.4x), and adversarial adjustment. Computes final grade (A/B/C) using calibrated confidence thresholds. Includes meta-cognitive check: does the system\'s stated certainty match its internal signal coherence?',
    icon: '🎯',
  },
};

// ─────────────────────────────────────────────────────────────────────
// Visualizer section educational content
// ─────────────────────────────────────────────────────────────────────

export const VISUALIZER_INFO: Record<string, InfoEntry> = {
  radar: {
    title: 'Interactive Signal Radar — Manual Override System',
    description: 'A real-time multi-axis signal monitor that visualizes the four core cognitive signals simultaneously. Inspired by radar systems used in avionics and medical monitoring, adapted for AI reasoning telemetry. Supports drag-to-override for direct signal manipulation.',
    useCase: 'Drag any signal point to manually override the engine\'s auto-calculated value. This lets you test "what-if" scenarios — for example, what happens to the analysis if you force confidence to 0.9? The ghost polygon shows where the engine calculated vs where you set it.',
    technique: 'Four-axis polar plot mapping Confidence, Entropy, Dissonance, and System Health to radial distances. Supports bidirectional data flow: read from the pipeline or write overrides back to the store via pointer events.',
    icon: '📡',
  },
  pipeline: {
    title: 'Pipeline Flow Visualization',
    description: 'A linear directed graph showing the 10-stage reasoning pipeline as a connected node sequence. Active stages pulse, completed stages glow green, and the connecting edges show information flow between stages.',
    useCase: 'Use this to understand the sequential dependency chain. Each stage builds on the previous one — triage determines depth, which affects memory retrieval, which informs routing, and so on. Bottlenecks become visible when a stage takes longer than expected.',
    technique: 'SVG node-link diagram with animated state transitions. Node colors map to stage status (idle/active/complete/error). Pulse animations use SVG <animate> elements for performance.',
    icon: '🔄',
  },
  tda: {
    title: 'Topological Data Analysis — Reasoning Geometry',
    description: 'Implements Topological Data Analysis (TDA) — a breakthrough technique named one of MIT Technology Review\'s 10 Breakthrough Technologies of 2026 for AI interpretability. Maps the geometry of reasoning traces using Betti numbers and persistence diagrams.',
    useCase: 'Betti-0 counts connected reasoning components (more = fragmented thinking). Betti-1 counts loops (more = circular reasoning). Persistence Entropy measures topological complexity — higher values indicate more complex, potentially convoluted reasoning structures.',
    technique: 'Computes Betti numbers (\u03B2\u2080 for connected components, \u03B2\u2081 for 1-cycles/loops), persistence entropy (Shannon entropy of persistence diagram), and max persistence (longest-lived topological feature). Based on persistent homology theory.',
    icon: '🌐',
  },
  concepts: {
    title: 'Active Concept Network',
    description: 'Visualizes the semantic concept space activated by the current analysis. Each node represents a key concept extracted from the query, and edges show conceptual relationships. The central hub represents the query\'s focal point.',
    useCase: 'Use this to verify the pipeline identified the right concepts from your query. If important concepts are missing, try rephrasing your query to emphasize them. The Concept Hierarchy feature lets you weight concepts to bias future analyses.',
    technique: 'Force-directed graph layout using seeded pseudo-random positioning for deterministic placement. Concepts are extracted via regex-based NLP entity extraction and weighted by domain relevance.',
    icon: '🕸️',
  },
  risk: {
    title: 'Risk-Uncertainty Decision Matrix',
    description: 'A 2x2 quadrant decision matrix mapping Risk Score against Uncertainty — the same framework used in clinical decision-making, pharmaceutical risk assessment, and AI safety evaluation. The pulsing dot shows the current analytical position.',
    useCase: 'The four quadrants tell you how to interpret the analysis: Low Risk + High Confidence = act on it. High Risk + Low Confidence = investigate more. High Risk + High Confidence = proceed with caution. Low Risk + Low Confidence = gather more data.',
    technique: 'Cartesian plot with Risk Score (x-axis, 0-1) and Uncertainty (y-axis, derived from 1 - confidence). Quadrant colors indicate severity. Animated dot position updates in real-time as the pipeline runs.',
    icon: '🎯',
  },
  harmony: {
    title: 'Concept Harmony Spectrum',
    description: 'Measures the harmonic coherence of the active concept space using a prime-factored chord product. Inspired by music theory — when concepts "harmonize," their interactions produce clean, interpretable patterns. Dissonant concept combinations create analytical noise.',
    useCase: 'A harmonious spectrum (green zone) means the concepts work well together analytically. Dissonant (red zone) means the query combines concepts that create methodological tension — this isn\'t necessarily bad, but it explains why confidence may be lower.',
    technique: 'Active Chord Product: each concept is assigned a prime number; the product encodes the unique concept combination. Harmony Key Distance measures how far the current concept set deviates from "perfect" harmonic alignment.',
    icon: '🎵',
  },
  confidence: {
    title: 'Confidence Trajectory Tracker',
    description: 'Shows how confidence has evolved across recent analysis passes. The trajectory reveals whether the system is converging toward certainty or oscillating — a key metacognitive signal that indicates reasoning stability.',
    useCase: 'A steadily rising trajectory suggests the evidence is accumulating and converging. Oscillation suggests the pipeline is finding conflicting evidence. A flat line at low confidence suggests the question may be inherently difficult to resolve.',
    technique: 'Time-series bar chart with adaptive scaling. The "Now" bar (highlighted in ember) shows the current live value. Historical bars show drift patterns computed from the signal history ring buffer.',
    icon: '📈',
  },
};

// ─────────────────────────────────────────────────────────────────────
// Diagnostics section educational content
// ─────────────────────────────────────────────────────────────────────

export const DIAGNOSTICS_INFO: Record<string, InfoEntry> = {
  confidence: {
    title: 'Confidence Signal',
    description: 'The system\'s calibrated self-assessment of how likely its conclusions are to be correct. This is not raw model output — it\'s post-calibration confidence that accounts for entropy, dissonance, adversarial findings, and meta-cognitive adjustments.',
    useCase: 'Compare confidence across queries to identify which topics the system handles well and which it struggles with. Consistently low confidence on a topic suggests the system needs more training data or a different analytical approach.',
    technique: 'Multi-stage calibration: base confidence from evidence convergence, adjusted by entropy penalty (-30% max), dissonance penalty (-40% max), and reflection adjustments. Final output is ECE-calibrated.',
    icon: '🎯',
  },
  entropy: {
    title: 'Information Entropy',
    description: 'Measures the divergence among reasoning paths — how much the different analytical engines disagree about the answer. Low entropy means convergence; high entropy means the engines found different things and can\'t agree.',
    useCase: 'High entropy is a signal to narrow your query. Broad questions generate high entropy because each engine finds a different angle. Focused questions produce low entropy because the evidence converges.',
    technique: 'Shannon entropy computed across the distribution of engine-level confidence scores. Normalized to 0-1 range. Values above 0.7 trigger the "Divergent reasoning detected" anomaly alert.',
    icon: '⚡',
  },
  dissonance: {
    title: 'Evidential Dissonance',
    description: 'Quantifies the degree of outright contradiction between evidence streams. Unlike entropy (which measures diversity of opinion), dissonance specifically measures when one engine\'s evidence directly contradicts another\'s.',
    useCase: 'High dissonance is actually more informative than low dissonance — it means the pipeline found genuinely conflicting evidence, which is often where the most interesting insights hide. Check the arbitration section to see exactly which engines disagree.',
    technique: 'Pairwise comparison of engine positions (support/oppose/neutral) weighted by each engine\'s confidence. Values above 0.5 trigger the "Evidence conflicts found" critical alert.',
    icon: '💥',
  },
  health: {
    title: 'Pipeline Integrity Score',
    description: 'A composite health metric that reflects overall pipeline reliability. Degraded health means the system\'s outputs should be interpreted with extra caution — something in the pipeline is strained.',
    useCase: 'If health drops below 40%, the pipeline\'s internal consistency checks are failing. This usually means the query is pushing the system beyond its reliable operating range. Use the "Reset all controls" quick action to restore default parameters.',
    technique: 'Composite score: 1.0 - (entropy * 0.45) - (dissonance * 0.35) - (safety_penalty * 0.15). Minimum floor of 0.2 prevents total collapse. Health below 0.5 triggers degraded-mode warnings.',
    icon: '💚',
  },
  correlations: {
    title: 'Signal Correlation Matrix',
    description: 'A Pearson correlation heatmap showing statistical relationships between the four core signals across your query history. Reveals hidden patterns in how the system behaves across different types of questions.',
    useCase: 'If confidence and entropy are strongly negatively correlated (red), that\'s healthy — it means the system is less confident when reasoning diverges. If they\'re uncorrelated, the confidence calibration may need adjustment.',
    technique: 'Pearson product-moment correlation computed from the signal history ring buffer (last 50 entries). Requires minimum 3 data points. Color-coded: green = positive correlation, red = negative, gray = near-zero.',
    icon: '🔢',
  },
  tda: {
    title: 'Topological Data Analysis Metrics',
    description: 'Four key TDA metrics that characterize the geometric structure of the reasoning trace. Developed from research published in "The Shape of Reasoning" (2025), which demonstrated that topological features of reasoning graphs predict output quality better than any single metric.',
    useCase: 'Monitor Betti-1 closely — reasoning loops (beta-1 > 0) often indicate the system is using a conclusion as evidence for itself. Persistence Entropy above 1.5 suggests the reasoning structure is overly complex and may benefit from query simplification.',
    technique: 'Persistent homology analysis of the reasoning dependency graph. Betti-0 = connected components, Betti-1 = 1-cycles (loops), Persistence Entropy = Shannon entropy of the persistence diagram, Max Persistence = longest-lived feature.',
    icon: '🌐',
  },
};

// ─────────────────────────────────────────────────────────────────────
// Animated Info Button Component
// ─────────────────────────────────────────────────────────────────────

interface InfoButtonProps {
  info: InfoEntry;
  className?: string;
  compact?: boolean;
}

export function InfoButton({ info, className, compact }: InfoButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('relative inline-flex', className)}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'group inline-flex items-center gap-1 rounded-full transition-all duration-300 cursor-pointer',
          compact
            ? 'p-1 hover:bg-muted/60'
            : 'px-2 py-0.5 text-[10px] text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/40 border border-transparent hover:border-border/30',
        )}
        title={info.title}
      >
        <InfoIcon className={cn('transition-colors', compact ? 'h-3 w-3 text-muted-foreground/40 group-hover:text-pfc-ember' : 'h-2.5 w-2.5')} />
        {!compact && <span>What is this?</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute z-50 top-full mt-2 left-0 w-80 sm:w-96 rounded-xl border bg-popover/95 backdrop-blur-xl shadow-2xl p-0 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-2.5 border-b border-border/30 bg-gradient-to-r from-pfc-ember/5 to-pfc-violet/5">
              <div className="flex items-start gap-2.5">
                {info.icon && <span className="text-lg mt-0.5">{info.icon}</span>}
                <div>
                  <h3 className="text-xs font-semibold text-foreground leading-tight">{info.title}</h3>
                  <p className="text-[9px] text-pfc-ember font-medium mt-0.5 uppercase tracking-wider">Research-Grade Protocol</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-full hover:bg-muted/60 transition-colors shrink-0"
              >
                <XIcon className="h-3 w-3 text-muted-foreground/50" />
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-3">
              <div>
                <p className="text-[11px] text-foreground/80 leading-relaxed">{info.description}</p>
              </div>

              <div className="rounded-lg bg-pfc-ember/5 border border-pfc-ember/15 px-3 py-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <LightbulbIcon className="h-3 w-3 text-pfc-ember" />
                  <span className="text-[9px] font-semibold text-pfc-ember uppercase tracking-wider">Practical Application</span>
                </div>
                <p className="text-[10px] text-foreground/70 leading-relaxed">{info.useCase}</p>
              </div>

              <div className="rounded-lg bg-pfc-violet/5 border border-pfc-violet/15 px-3 py-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <SparklesIcon className="h-3 w-3 text-pfc-violet" />
                  <span className="text-[9px] font-semibold text-pfc-violet uppercase tracking-wider">Technical Method</span>
                </div>
                <p className="text-[10px] text-foreground/70 leading-relaxed font-mono">{info.technique}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border/20 bg-muted/20">
              <p className="text-[8px] text-muted-foreground/40 text-center uppercase tracking-widest">
                PFC Meta-Analytical Engine
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Animated Suggestion Chips — "Try this" examples
// ─────────────────────────────────────────────────────────────────────

export interface SuggestionChip {
  label: string;
  description: string;
}

interface AnimatedSuggestionProps {
  suggestions: SuggestionChip[];
  onSelect?: (label: string) => void;
  className?: string;
}

export function AnimatedSuggestions({ suggestions, onSelect, className }: AnimatedSuggestionProps) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {suggestions.map((s, i) => (
        <motion.button
          key={s.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.08, duration: 0.25 }}
          onClick={() => onSelect?.(s.label)}
          className="group inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-muted/30 px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:border-pfc-ember/30 hover:bg-pfc-ember/5 transition-all duration-200 cursor-pointer"
          title={s.description}
        >
          <BookOpenIcon className="h-2.5 w-2.5 text-muted-foreground/40 group-hover:text-pfc-ember transition-colors" />
          {s.label}
        </motion.button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Page-specific suggestion sets
// ─────────────────────────────────────────────────────────────────────

export const PIPELINE_SUGGESTIONS: SuggestionChip[] = [
  { label: 'What do the 10 stages do?', description: 'Overview of each pipeline stage\'s purpose and analytical technique' },
  { label: 'Why is a stage stuck?', description: 'Understand why a stage might take longer or show an error' },
  { label: 'How does triage routing work?', description: 'Learn how the engine decides which analytical path to take' },
  { label: 'What is adversarial review?', description: 'Red-team stress-testing inspired by Anthropic\'s Constitutional AI' },
  { label: 'Bayesian vs frequentist stages', description: 'Understand the two statistical paradigms the pipeline uses' },
  { label: 'How is confidence calibrated?', description: 'The final calibration stage that adjusts confidence using ECE methodology' },
];

export const VISUALIZER_SUGGESTIONS: SuggestionChip[] = [
  { label: 'How do I use the radar?', description: 'Drag signal points to manually override engine-calculated values' },
  { label: 'What are Betti numbers?', description: 'TDA metrics that measure topological features of reasoning traces' },
  { label: 'Risk matrix quadrants', description: 'The 2x2 matrix maps risk score against uncertainty for decision guidance' },
  { label: 'Concept harmony explained', description: 'How the prime-factored chord product measures concept coherence' },
  { label: 'Override vs auto signals', description: 'The ghost polygon shows engine values; dragged points override them' },
];

export const DIAGNOSTICS_SUGGESTIONS: SuggestionChip[] = [
  { label: 'What do the alerts mean?', description: 'Anomaly alerts trigger when signals exceed safety thresholds' },
  { label: 'How to read sparklines', description: 'Mini trend charts show how each signal changes across queries' },
  { label: 'Signal correlations', description: 'Pearson heatmap reveals hidden patterns between confidence, entropy, dissonance, health' },
  { label: 'When to reset controls', description: 'Reset when health drops below 40% or signals behave unexpectedly' },
  { label: 'Export & share snapshots', description: 'Copy the current engine state as JSON for debugging or sharing' },
  { label: 'TDA topology basics', description: 'Connected components, loops, and persistence entropy in reasoning geometry' },
];
