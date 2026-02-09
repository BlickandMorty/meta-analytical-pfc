'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConicalIcon,
  BrainCircuitIcon,
  BookOpenIcon,
  WrenchIcon,
  LightbulbIcon,
  TargetIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardCopyIcon,
  CheckIcon,
  LayersIcon,
  BarChart3Icon,
  ShieldCheckIcon,
  GitBranchIcon,
  ZapIcon,
  NetworkIcon,
  FilterIcon,
} from 'lucide-react';
import { usePFCStore, type ConceptWeight } from '@/lib/store/use-pfc-store';
import { cn } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { GlassBubbleButton } from '@/components/glass-bubble-button';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { PageShell, GlassSection } from '@/components/page-shell';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResearchTechnique {
  id: string;
  name: string;
  category: 'statistical' | 'causal' | 'qualitative' | 'meta' | 'computational' | 'experimental';
  description: string;
  whenToUse: string;
  strengths: string[];
  limitations: string[];
  relatedConcepts: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  icon: React.ReactNode;
}

interface ScaffoldingTool {
  id: string;
  name: string;
  description: string;
  category: 'design' | 'analysis' | 'validation' | 'reporting' | 'collaboration';
  actionLabel: string;
  icon: React.ReactNode;
}

interface StudyReference {
  id: string;
  title: string;
  domain: string;
  methodology: string;
  keyConcept: string;
  relevance: number; // 0-1 how relevant to current concepts
}

// ---------------------------------------------------------------------------
// Static data — Research Techniques
// ---------------------------------------------------------------------------

const TECHNIQUES: ResearchTechnique[] = [
  {
    id: 'rct',
    name: 'Randomized Controlled Trial',
    category: 'experimental',
    description: 'Gold standard for causal inference. Randomly assigns participants to treatment and control groups to isolate the effect of an intervention.',
    whenToUse: 'When you need to establish causation, not just correlation. Best when ethical and practical constraints allow randomization.',
    strengths: ['Strong internal validity', 'Controls for confounders', 'Clear causal interpretation'],
    limitations: ['Expensive', 'May lack external validity', 'Ethical constraints'],
    relatedConcepts: ['causality', 'confounding', 'effect_size', 'power'],
    difficulty: 'advanced',
    icon: <ShieldCheckIcon className="h-4 w-4" />,
  },
  {
    id: 'meta-analysis',
    name: 'Meta-Analysis',
    category: 'meta',
    description: 'Quantitatively combines results from multiple studies to arrive at a pooled estimate. Uses weighting, heterogeneity assessment, and forest plots.',
    whenToUse: 'When multiple studies exist on the same question and you want a summary effect. Also useful for identifying moderators of effects.',
    strengths: ['Increased statistical power', 'Identifies patterns across studies', 'Quantifies heterogeneity'],
    limitations: ['Garbage in, garbage out', 'Publication bias', 'Assumes comparable outcomes'],
    relatedConcepts: ['heterogeneity', 'effect_size', 'bayesian_prior', 'replication'],
    difficulty: 'advanced',
    icon: <LayersIcon className="h-4 w-4" />,
  },
  {
    id: 'bayesian-updating',
    name: 'Bayesian Updating',
    category: 'statistical',
    description: 'Starts with a prior belief and updates it with new evidence to form a posterior. Transparent about assumptions and handles uncertainty naturally.',
    whenToUse: 'When you have informative priors, want to quantify uncertainty, or need to update beliefs incrementally as evidence arrives.',
    strengths: ['Handles small samples well', 'Transparent priors', 'Natural uncertainty quantification'],
    limitations: ['Prior specification can be controversial', 'Computationally intensive', 'Requires statistical expertise'],
    relatedConcepts: ['bayesian_prior', 'confidence', 'evidence', 'inference'],
    difficulty: 'intermediate',
    icon: <GitBranchIcon className="h-4 w-4" />,
  },
  {
    id: 'causal-dag',
    name: 'Causal DAG Analysis',
    category: 'causal',
    description: 'Uses directed acyclic graphs to model causal relationships. Identifies confounders, mediators, and colliders to guide analysis strategy.',
    whenToUse: 'When you need to reason about causal structure before running statistical tests. Essential for observational studies.',
    strengths: ['Explicit causal assumptions', 'Guides covariate selection', 'Identifies bias sources'],
    limitations: ['Requires domain knowledge', 'Can be complex', 'Untestable assumptions'],
    relatedConcepts: ['causality', 'confounding', 'coherence', 'framework'],
    difficulty: 'intermediate',
    icon: <NetworkIcon className="h-4 w-4" />,
  },
  {
    id: 'bradford-hill',
    name: 'Bradford Hill Criteria',
    category: 'causal',
    description: 'Nine criteria for evaluating whether an observed association is causal: strength, consistency, specificity, temporality, biological gradient, plausibility, coherence, experiment, analogy.',
    whenToUse: 'When evaluating epidemiological or observational evidence for causal claims. Useful as a systematic checklist.',
    strengths: ['Systematic framework', 'Widely accepted', 'Multi-dimensional assessment'],
    limitations: ['Criteria are not sufficient/necessary', 'Subjective weighting', 'Originally for epidemiology'],
    relatedConcepts: ['causality', 'evidence', 'replication', 'effect_size'],
    difficulty: 'beginner',
    icon: <BarChart3Icon className="h-4 w-4" />,
  },
  {
    id: 'adversarial-collab',
    name: 'Adversarial Collaboration',
    category: 'experimental',
    description: 'Researchers with opposing views design and conduct a study together, agreeing on methodology and interpretation criteria in advance.',
    whenToUse: 'When a research question is highly contested and standard approaches have failed to resolve disagreement.',
    strengths: ['Reduces bias', 'Pre-registered', 'Builds consensus'],
    limitations: ['Difficult to arrange', 'May compromise on design', 'Requires good faith'],
    relatedConcepts: ['replication', 'bias', 'coherence'],
    difficulty: 'advanced',
    icon: <ZapIcon className="h-4 w-4" />,
  },
  {
    id: 'thematic-analysis',
    name: 'Thematic Analysis',
    category: 'qualitative',
    description: 'Systematic identification, analysis, and reporting of patterns (themes) within qualitative data. Flexible and widely applicable.',
    whenToUse: 'When working with interview transcripts, open-ended responses, or other qualitative data. When you want to capture the richness of human experience.',
    strengths: ['Flexible', 'Accessible', 'Rich descriptions'],
    limitations: ['Subjective', 'Hard to replicate', 'Can miss context'],
    relatedConcepts: ['coherence', 'framework', 'inference'],
    difficulty: 'beginner',
    icon: <BookOpenIcon className="h-4 w-4" />,
  },
  {
    id: 'power-analysis',
    name: 'Power Analysis',
    category: 'statistical',
    description: 'Calculates the sample size needed to detect an effect of a given size with a specified probability. Essential for study planning.',
    whenToUse: 'Before running any study. Determines whether your planned sample size is adequate to detect meaningful effects.',
    strengths: ['Prevents underpowered studies', 'Guides resource allocation', 'Required by many journals'],
    limitations: ['Requires effect size estimate', 'Assumes specific test', 'Can be misused to justify small samples'],
    relatedConcepts: ['effect_size', 'power', 'replication'],
    difficulty: 'beginner',
    icon: <TargetIcon className="h-4 w-4" />,
  },
  {
    id: 'sensitivity-analysis',
    name: 'Sensitivity Analysis',
    category: 'computational',
    description: 'Tests how robust your conclusions are to changes in assumptions, model specifications, or analytical choices. A research integrity essential.',
    whenToUse: 'After any analysis to check if conclusions hold under different reasonable assumptions. Required for credible research.',
    strengths: ['Reveals fragility', 'Builds confidence', 'Identifies critical assumptions'],
    limitations: ['Can generate many results', 'Judgment needed on what to vary', 'Time-consuming'],
    relatedConcepts: ['confidence', 'evidence', 'bayesian_prior'],
    difficulty: 'intermediate',
    icon: <FilterIcon className="h-4 w-4" />,
  },
];

// ---------------------------------------------------------------------------
// Static data — Scaffolding Tools
// ---------------------------------------------------------------------------

const SCAFFOLDING_TOOLS: ScaffoldingTool[] = [
  {
    id: 'hypothesis-generator',
    name: 'Hypothesis Generator',
    description: 'Given your current concepts and signal state, generates testable hypotheses ranked by novelty and feasibility.',
    category: 'design',
    actionLabel: 'Generate Hypotheses',
    icon: <LightbulbIcon className="h-4 w-4" />,
  },
  {
    id: 'study-designer',
    name: 'Study Design Advisor',
    description: 'Recommends study designs (RCT, cohort, cross-sectional, etc.) based on your research question and constraints.',
    category: 'design',
    actionLabel: 'Get Design Advice',
    icon: <FlaskConicalIcon className="h-4 w-4" />,
  },
  {
    id: 'bias-detector',
    name: 'Bias Detector',
    description: 'Analyzes your current reasoning pipeline for potential cognitive and methodological biases based on signal patterns.',
    category: 'validation',
    actionLabel: 'Detect Biases',
    icon: <ShieldCheckIcon className="h-4 w-4" />,
  },
  {
    id: 'effect-calculator',
    name: 'Effect Size Calculator',
    description: 'Computes and interprets effect sizes (Cohen\'s d, odds ratio, correlation) from your pipeline\'s statistical stage outputs.',
    category: 'analysis',
    actionLabel: 'Calculate Effects',
    icon: <BarChart3Icon className="h-4 w-4" />,
  },
  {
    id: 'replication-checker',
    name: 'Replication Readiness',
    description: 'Assesses how replicable your current findings would be based on power, effect size stability, and methodological transparency.',
    category: 'validation',
    actionLabel: 'Check Replicability',
    icon: <GitBranchIcon className="h-4 w-4" />,
  },
  {
    id: 'concept-mapper',
    name: 'Concept Relationship Mapper',
    description: 'Exports the current concept hierarchy with weights as a structured research framework for further exploration.',
    category: 'analysis',
    actionLabel: 'Map Concepts',
    icon: <NetworkIcon className="h-4 w-4" />,
  },
  {
    id: 'preregistration-helper',
    name: 'Pre-Registration Draft',
    description: 'Generates a structured pre-registration template based on your research question, hypotheses, and planned analyses.',
    category: 'reporting',
    actionLabel: 'Draft Pre-Registration',
    icon: <BookOpenIcon className="h-4 w-4" />,
  },
  {
    id: 'signal-interpreter',
    name: 'Signal Interpreter',
    description: 'Explains what your current PFC signal profile means for research quality, and suggests specific improvements.',
    category: 'analysis',
    actionLabel: 'Interpret Signals',
    icon: <BrainCircuitIcon className="h-4 w-4" />,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  statistical: 'bg-pfc-violet/10 text-pfc-violet border-pfc-violet/20',
  causal: 'bg-pfc-ember/10 text-pfc-ember border-pfc-ember/20',
  qualitative: 'bg-pfc-green/10 text-pfc-green border-pfc-green/20',
  meta: 'bg-pfc-yellow/10 text-pfc-yellow border-pfc-yellow/20',
  computational: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  experimental: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  design: 'bg-pfc-violet/10 text-pfc-violet border-pfc-violet/20',
  analysis: 'bg-pfc-ember/10 text-pfc-ember border-pfc-ember/20',
  validation: 'bg-pfc-green/10 text-pfc-green border-pfc-green/20',
  reporting: 'bg-pfc-yellow/10 text-pfc-yellow border-pfc-yellow/20',
  collaboration: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-pfc-green/15 text-pfc-green border-pfc-green/30',
  intermediate: 'bg-pfc-yellow/15 text-pfc-yellow border-pfc-yellow/30',
  advanced: 'bg-pfc-red/15 text-pfc-red border-pfc-red/30',
};

function generateStudyReferences(concepts: string[], weights: Record<string, ConceptWeight>): StudyReference[] {
  // Generate contextual study references based on active concepts
  const studies: StudyReference[] = [];
  const conceptList = Object.keys(weights);

  const studyTemplates = [
    { domain: 'Methodology', methodology: 'Systematic Review', title: 'Assessing replication rates across {concept} research paradigms', keyConcept: 'replication' },
    { domain: 'Statistics', methodology: 'Monte Carlo Simulation', title: 'Statistical power in {concept} studies: A simulation analysis', keyConcept: 'power' },
    { domain: 'Meta-Science', methodology: 'Meta-Analysis', title: 'Publication bias and effect inflation in {concept} literature', keyConcept: 'bias' },
    { domain: 'Causal Inference', methodology: 'DAG Analysis', title: 'Confounding structures in observational {concept} studies', keyConcept: 'confounding' },
    { domain: 'Bayesian Methods', methodology: 'Bayesian Meta-Analysis', title: 'Prior sensitivity in {concept} evidence synthesis', keyConcept: 'bayesian_prior' },
    { domain: 'Research Design', methodology: 'Pre-Registration Analysis', title: 'Deviation from pre-registered {concept} protocols', keyConcept: 'evidence' },
    { domain: 'Epistemology', methodology: 'Philosophical Analysis', title: 'Epistemic standards for {concept} claims', keyConcept: 'coherence' },
    { domain: 'Computational', methodology: 'Network Analysis', title: 'Concept co-occurrence networks in {concept} discourse', keyConcept: 'framework' },
  ];

  for (let i = 0; i < Math.min(conceptList.length * 2, 8); i++) {
    const template = studyTemplates[i % studyTemplates.length];
    const concept = conceptList[i % conceptList.length] || 'research';
    const cw = weights[concept];
    const relevance = cw ? Math.min(1, (cw.weight * cw.autoWeight) / 1.5) : 0.3;

    studies.push({
      id: `study-${i}`,
      title: template.title.replace('{concept}', concept.replace(/_/g, ' ')),
      domain: template.domain,
      methodology: template.methodology,
      keyConcept: template.keyConcept,
      relevance,
    });
  }

  return studies.sort((a, b) => b.relevance - a.relevance);
}

// ---------------------------------------------------------------------------
// Technique Card
// ---------------------------------------------------------------------------

function TechniqueCard({
  technique,
  isRelevant,
}: {
  technique: ResearchTechnique;
  isRelevant: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={cn(
      'transition-all duration-200',
      isRelevant && 'ring-1 ring-pfc-violet/20',
    )}>
      <CardHeader
        className="cursor-pointer pb-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <div className={cn('p-1.5 rounded-md shrink-0', CATEGORY_COLORS[technique.category])}>
              {technique.icon}
            </div>
            <div>
              <CardTitle className="text-sm">{technique.name}</CardTitle>
              <div className="flex items-center gap-1.5 mt-1">
                <Badge variant="outline" className={cn('text-[8px] uppercase', CATEGORY_COLORS[technique.category])}>
                  {technique.category}
                </Badge>
                <Badge variant="outline" className={cn('text-[8px] uppercase', DIFFICULTY_COLORS[technique.difficulty])}>
                  {technique.difficulty}
                </Badge>
                {isRelevant && (
                  <Badge variant="outline" className="text-[8px] uppercase bg-pfc-violet/10 text-pfc-violet border-pfc-violet/20">
                    relevant
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {expanded ? <ChevronUpIcon className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
      </CardHeader>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <CardContent className="pt-0 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">{technique.description}</p>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium mb-1">When to use</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{technique.whenToUse}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-pfc-green/60 font-medium mb-1">Strengths</p>
                  <ul className="space-y-0.5">
                    {technique.strengths.map((s, i) => (
                      <li key={i} className="text-[10px] text-foreground/60 flex items-start gap-1">
                        <span className="text-pfc-green mt-0.5">+</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-pfc-red/60 font-medium mb-1">Limitations</p>
                  <ul className="space-y-0.5">
                    {technique.limitations.map((l, i) => (
                      <li key={i} className="text-[10px] text-foreground/60 flex items-start gap-1">
                        <span className="text-pfc-red mt-0.5">-</span> {l}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {technique.relatedConcepts.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {technique.relatedConcepts.map((c) => (
                    <Badge key={c} variant="secondary" className="text-[8px] bg-pfc-violet/5 text-pfc-violet/70">
                      {c.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Scaffolding Tool Card
// ---------------------------------------------------------------------------

function ToolCard({ tool }: { tool: ScaffoldingTool }) {
  const [copied, setCopied] = useState(false);
  const confidence = usePFCStore((s) => s.confidence);
  const entropy = usePFCStore((s) => s.entropy);
  const activeConcepts = usePFCStore((s) => s.activeConcepts);
  const conceptWeights = usePFCStore((s) => s.conceptWeights);

  const handleAction = () => {
    // Generate contextual output for each tool
    const output = generateToolOutput(tool.id, {
      confidence,
      entropy,
      concepts: activeConcepts,
      weights: conceptWeights,
    });
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="hover:border-pfc-ember/20 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg shrink-0', CATEGORY_COLORS[tool.category])}>
            {tool.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium">{tool.name}</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{tool.description}</p>
            <GlassBubbleButton
              color="ember"
              size="sm"
              onClick={handleAction}
              className="mt-2"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-3 w-3 text-pfc-green" />
                  Copied
                </>
              ) : (
                <>
                  <ClipboardCopyIcon className="h-3 w-3" />
                  {tool.actionLabel}
                </>
              )}
            </GlassBubbleButton>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tool output generator
// ---------------------------------------------------------------------------

function generateToolOutput(
  toolId: string,
  ctx: { confidence: number; entropy: number; concepts: string[]; weights: Record<string, ConceptWeight> },
): string {
  const conceptStr = ctx.concepts.join(', ') || 'none extracted';
  const weightedConcepts = Object.entries(ctx.weights)
    .sort(([, a], [, b]) => (b.weight * b.autoWeight) - (a.weight * a.autoWeight))
    .map(([k, v]) => `${k}: ${(v.weight * v.autoWeight).toFixed(2)}`)
    .join('\n  ');

  switch (toolId) {
    case 'hypothesis-generator':
      return `HYPOTHESIS GENERATION\n` +
        `Active concepts: ${conceptStr}\n` +
        `Confidence: ${(ctx.confidence * 100).toFixed(0)}%\n` +
        `Entropy: ${(ctx.entropy * 100).toFixed(0)}%\n\n` +
        `Generated Hypotheses:\n` +
        `H1: Increasing ${ctx.concepts[0] || 'the primary variable'} exposure leads to measurable changes in ${ctx.concepts[1] || 'the outcome variable'}\n` +
        `H2: The relationship between concepts is moderated by ${ctx.concepts[2] || 'contextual factors'}\n` +
        `H3: Signal entropy (${(ctx.entropy * 100).toFixed(0)}%) suggests ${ctx.entropy > 0.5 ? 'multiple competing mechanisms' : 'convergent evidence'}`;

    case 'bias-detector':
      return `BIAS DETECTION REPORT\n` +
        `Confidence: ${(ctx.confidence * 100).toFixed(0)}% | Entropy: ${(ctx.entropy * 100).toFixed(0)}%\n\n` +
        `Detected patterns:\n` +
        `${ctx.confidence > 0.7 ? 'Warning: Overconfidence risk — high confidence with limited evidence base' : 'OK: Confidence appears calibrated'}\n` +
        `${ctx.entropy < 0.2 ? 'Warning: Low entropy may indicate premature convergence' : 'OK: Entropy suggests adequate exploration'}\n` +
        `${ctx.concepts.length < 3 ? 'Warning: Narrow concept base — consider expanding analytical scope' : 'OK: Concept diversity is adequate'}`;

    case 'concept-mapper':
      return `CONCEPT HIERARCHY EXPORT\n` +
        `Timestamp: ${new Date().toISOString()}\n\n` +
        `Weighted Concepts:\n  ${weightedConcepts || 'No concepts with weights'}\n\n` +
        `Active: ${conceptStr}`;

    case 'signal-interpreter':
      return `SIGNAL INTERPRETATION\n` +
        `Confidence: ${(ctx.confidence * 100).toFixed(0)}% — ${ctx.confidence > 0.7 ? 'Strong' : ctx.confidence > 0.4 ? 'Moderate' : 'Weak'}\n` +
        `Entropy: ${(ctx.entropy * 100).toFixed(0)}% — ${ctx.entropy > 0.6 ? 'High divergence in evidence' : ctx.entropy > 0.3 ? 'Some disagreement' : 'Low divergence'}\n` +
        `Concepts: ${ctx.concepts.length}\n\n` +
        `Recommendation: ${ctx.entropy > 0.5 && ctx.confidence < 0.5 ? 'Consider narrowing your research question — high entropy with low confidence suggests the question is too broad' : ctx.confidence > 0.6 ? 'Evidence is converging — consider moving to validation phase' : 'Continue gathering evidence — signals suggest more data needed'}`;

    default:
      return `${toolId.toUpperCase()} OUTPUT\n` +
        `Concepts: ${conceptStr}\n` +
        `Confidence: ${(ctx.confidence * 100).toFixed(0)}%\n` +
        `Full concept weights:\n  ${weightedConcepts}`;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ResearchCopilotPage() {
  const ready = useSetupGuard();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'techniques' | 'tools' | 'studies'>('techniques');
  const activeConcepts = usePFCStore((s) => s.activeConcepts);
  const conceptWeights = usePFCStore((s) => s.conceptWeights);
  const confidence = usePFCStore((s) => s.confidence);
  const entropy = usePFCStore((s) => s.entropy);

  // Filter techniques by search and relevance to current concepts
  const filteredTechniques = useMemo(() => {
    const lower = searchQuery.toLowerCase();
    return TECHNIQUES
      .filter((t) =>
        !lower ||
        t.name.toLowerCase().includes(lower) ||
        t.category.includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        t.relatedConcepts.some((c) => c.includes(lower))
      )
      .map((t) => ({
        ...t,
        isRelevant: t.relatedConcepts.some((rc) =>
          activeConcepts.some((ac) => ac.toLowerCase().includes(rc) || rc.includes(ac.toLowerCase()))
        ),
      }))
      .sort((a, b) => (b.isRelevant ? 1 : 0) - (a.isRelevant ? 1 : 0));
  }, [searchQuery, activeConcepts]);

  // Generate contextual study references
  const studyRefs = useMemo(
    () => generateStudyReferences(activeConcepts, conceptWeights),
    [activeConcepts, conceptWeights],
  );

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--chat-surface)]">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <PageShell
      icon={FlaskConicalIcon}
      iconColor="var(--color-pfc-ember)"
      title="Research Copilot"
      subtitle="Techniques, tools, and study references"
    >
      {/* Intro */}
      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 rounded-xl bg-pfc-ember/10 shrink-0">
          <FlaskConicalIcon className="h-6 w-6 text-pfc-ember" />
        </div>
        <div>
          <h2 className="text-base font-semibold mb-1">Your Research Toolkit</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Techniques, scaffolding tools, and study references tailored to your current analytical state.
            {activeConcepts.length > 0
              ? ` Currently tracking ${activeConcepts.length} concepts with ${(confidence * 100).toFixed(0)}% confidence.`
              : ' Start a chat to see personalized recommendations.'}
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <GlassSection className="">
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
          {(['techniques', 'tools', 'studies'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 px-4 py-2 rounded-md text-xs font-medium transition-all cursor-pointer',
                activeTab === tab
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab === 'techniques' && <WrenchIcon className="h-3 w-3 inline mr-1.5" />}
              {tab === 'tools' && <FlaskConicalIcon className="h-3 w-3 inline mr-1.5" />}
              {tab === 'studies' && <BookOpenIcon className="h-3 w-3 inline mr-1.5" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </GlassSection>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === 'techniques' && (
          <motion.div
            key="techniques"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Search */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search techniques by name, category, or concept..."
                className="pl-9 text-sm"
              />
            </div>

            {/* Technique cards */}
            <div className="space-y-3">
              {filteredTechniques.map((t) => (
                <TechniqueCard
                  key={t.id}
                  technique={t}
                  isRelevant={t.isRelevant}
                />
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'tools' && (
          <motion.div
            key="tools"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <p className="text-xs text-muted-foreground">
              Scaffolding tools that generate outputs based on your current PFC state. Results are copied to clipboard.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SCAFFOLDING_TOOLS.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'studies' && (
          <motion.div
            key="studies"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <p className="text-xs text-muted-foreground">
              Study references contextual to your current research concepts. Relevance scores reflect concept hierarchy weights.
            </p>
            {studyRefs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpenIcon className="h-8 w-8 text-muted-foreground/15 mb-3" />
                  <p className="text-sm text-muted-foreground/50">No study references yet</p>
                  <p className="text-[10px] text-muted-foreground/30 mt-1">Ask research questions to generate concept-based study suggestions</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {studyRefs.map((ref) => (
                  <Card key={ref.id} className="hover:border-pfc-violet/20 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium leading-snug">{ref.title}</h4>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="outline" className={cn('text-[8px] uppercase', CATEGORY_COLORS[ref.domain.toLowerCase()] || 'text-muted-foreground')}>
                              {ref.domain}
                            </Badge>
                            <Badge variant="secondary" className="text-[8px]">
                              {ref.methodology}
                            </Badge>
                            <Badge variant="secondary" className="text-[8px] bg-pfc-violet/5 text-pfc-violet/70">
                              {ref.keyConcept.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className={cn(
                            'text-[10px] font-mono font-bold',
                            ref.relevance > 0.7 ? 'text-pfc-green' :
                            ref.relevance > 0.4 ? 'text-pfc-yellow' :
                            'text-muted-foreground/40',
                          )}>
                            {(ref.relevance * 100).toFixed(0)}%
                          </div>
                          <div className="text-[8px] text-muted-foreground/30">relevance</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
