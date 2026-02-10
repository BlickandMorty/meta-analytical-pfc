'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConicalIcon,
  SendIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  TrendingUpIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ZapIcon,
  BookOpenIcon,
  GaugeIcon,
} from 'lucide-react';

import { PageShell, GlassSection } from '@/components/page-shell';
import { PixelBook } from '@/components/pixel-book';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { cn } from '@/lib/utils';
import { GlassBubbleButton } from '@/components/glass-bubble-button';
import type {
  MLProjectEvaluation,
  MLProjectInput,
  ProjectType,
  DimensionScore,
} from '@/lib/engine/ml-evaluator';

// ---------------------------------------------------------------------------
// Project type options
// ---------------------------------------------------------------------------

const PROJECT_TYPES: { value: ProjectType; label: string; icon: string }[] = [
  { value: 'classifier', label: 'Classifier', icon: '🎯' },
  { value: 'regressor', label: 'Regressor', icon: '📈' },
  { value: 'recommender', label: 'Recommender', icon: '🔮' },
  { value: 'clustering', label: 'Clustering', icon: '🫧' },
  { value: 'anomaly_detection', label: 'Anomaly Detection', icon: '🔍' },
  { value: 'time_series', label: 'Time Series', icon: '⏱️' },
  { value: 'nlp_pipeline', label: 'NLP Pipeline', icon: '💬' },
  { value: 'computer_vision', label: 'Computer Vision', icon: '👁️' },
  { value: 'reinforcement_learning', label: 'Reinforcement Learning', icon: '🎮' },
  { value: 'data_tool', label: 'Data Tool', icon: '🔧' },
  { value: 'etl_pipeline', label: 'ETL Pipeline', icon: '🔄' },
  { value: 'general_ml', label: 'General ML', icon: '🧠' },
];

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 0.7) return 'text-pfc-green';
  if (score >= 0.5) return 'text-pfc-yellow';
  return 'text-pfc-red';
}

function scoreBarClass(score: number): string {
  if (score >= 0.7) return '[&>div]:bg-pfc-green';
  if (score >= 0.5) return '[&>div]:bg-pfc-yellow';
  return '[&>div]:bg-pfc-red';
}

function gradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-pfc-green bg-pfc-green/10 border-pfc-green/30';
  if (grade.startsWith('B')) return 'text-pfc-cyan bg-pfc-cyan/10 border-pfc-cyan/30';
  if (grade.startsWith('C')) return 'text-pfc-yellow bg-pfc-yellow/10 border-pfc-yellow/30';
  return 'text-pfc-red bg-pfc-red/10 border-pfc-red/30';
}

// ---------------------------------------------------------------------------
// Dimension card
// ---------------------------------------------------------------------------

function DimensionCard({ dim }: { dim: DimensionScore }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full text-left cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs capitalize">
              {dim.dimension.replace(/_/g, ' ')}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={cn('text-[10px] font-bold', gradeColor(dim.grade))}>
                {dim.grade}
              </Badge>
              {expanded ? (
                <ChevronUpIcon className="h-3.5 w-3.5 text-muted-foreground/50" />
              ) : (
                <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground/50" />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="flex items-center gap-3">
            <p className={cn('text-lg font-bold tabular-nums', scoreColor(dim.score))}>
              {Math.round(dim.score * 100)}%
            </p>
            <Progress
              value={dim.score * 100}
              className={cn('flex-1 h-1.5', scoreBarClass(dim.score))}
            />
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1.5">{dim.benchmarkComparison}</p>
        </CardContent>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            style={{ transformOrigin: 'top', transform: 'translateZ(0)' }}
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
              {dim.findings.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-1.5">Findings</p>
                  {dim.findings.map((f, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5 mb-1">
                      <CheckCircle2Icon className="h-3 w-3 mt-0.5 shrink-0 text-pfc-green/60" />
                      {f}
                    </p>
                  ))}
                </div>
              )}

              {dim.recommendations.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-pfc-ember/60 mb-1.5">Recommendations</p>
                  {dim.recommendations.map((r, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5 mb-1">
                      <TrendingUpIcon className="h-3 w-3 mt-0.5 shrink-0 text-pfc-ember/60" />
                      {r}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function EvaluatePage() {
  const ready = useSetupGuard();
  const [input, setInput] = useState<Partial<MLProjectInput>>({
    name: '',
    description: '',
    projectType: 'general_ml',
    techStack: [],
    hasTests: false,
    hasDocumentation: false,
    modelArchitecture: '',
    datasetSize: '',
    concerns: [],
    performanceMetrics: {},
  });
  const [techStackInput, setTechStackInput] = useState('');
  const [metricKey, setMetricKey] = useState('');
  const [metricValue, setMetricValue] = useState('');
  const [evaluation, setEvaluation] = useState<MLProjectEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = async () => {
    if (!input.name || !input.description) {
      setError('Please provide a project name and description');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Evaluation failed');
      }

      const result = await res.json();
      setEvaluation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setLoading(false);
    }
  };

  const addTechStack = () => {
    if (techStackInput.trim()) {
      setInput(prev => ({
        ...prev,
        techStack: [...(prev.techStack ?? []), techStackInput.trim()],
      }));
      setTechStackInput('');
    }
  };

  const addMetric = () => {
    if (metricKey.trim() && metricValue.trim()) {
      const val = parseFloat(metricValue);
      if (!isNaN(val)) {
        setInput(prev => ({
          ...prev,
          performanceMetrics: { ...(prev.performanceMetrics ?? {}), [metricKey.trim()]: val },
        }));
        setMetricKey('');
        setMetricValue('');
      }
    }
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--chat-surface)]">
        <PixelBook size={40} />
      </div>
    );
  }

  return (
    <PageShell
      icon={FlaskConicalIcon}
      iconColor="var(--color-pfc-ember)"
      title="ML Evaluator"
      subtitle="Proprietary intelligence assessment for ML projects"
    >
      {/* ── Input Form ── */}
      <GlassSection title="Project Intake" className="">
        <p className="text-[11px] text-muted-foreground/60 mb-5">
          Describe your ML project and we&apos;ll run a comprehensive 12-dimension evaluation
          using proprietary assessment techniques inspired by SHAP/LIME feature attribution,
          Process Reward Models, and enterprise MLOps benchmarks.
        </p>

        <div className="space-y-5">
          {/* Name & description */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Project Name *
              </label>
              <input
                type="text"
                value={input.name}
                onChange={(e) => setInput(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Customer Churn Predictor"
                className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-pfc-ember/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Model Architecture
              </label>
              <input
                type="text"
                value={input.modelArchitecture}
                onChange={(e) => setInput(prev => ({ ...prev, modelArchitecture: e.target.value }))}
                placeholder="e.g. XGBoost, ResNet-50, LSTM"
                className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-pfc-ember/30"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Project Description *
            </label>
            <textarea
              value={input.description}
              onChange={(e) => setInput(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what your ML project does, the problem it solves, data sources, preprocessing steps, training approach, evaluation methodology, and any specific techniques used. Be as detailed as possible for the best assessment."
              rows={4}
              className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-pfc-ember/30 resize-none"
            />
          </div>

          {/* Project type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Project Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_TYPES.map((pt) => (
                <GlassBubbleButton
                  key={pt.value}
                  onClick={() => setInput(prev => ({ ...prev, projectType: pt.value }))}
                  active={input.projectType === pt.value}
                  color="ember"
                  size="sm"
                >
                  <span>{pt.icon}</span>
                  {pt.label}
                </GlassBubbleButton>
              ))}
            </div>
          </div>

          {/* Tech stack */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Tech Stack
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={techStackInput}
                  onChange={(e) => setTechStackInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTechStack()}
                  placeholder="e.g. pytorch, scikit-learn"
                  className="flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-pfc-ember/30"
                />
                <GlassBubbleButton onClick={addTechStack} color="violet" size="sm">Add</GlassBubbleButton>
              </div>
              {(input.techStack ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {(input.techStack ?? []).map((t, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="text-[10px] cursor-pointer hover:bg-pfc-red/10"
                      onClick={() => setInput(prev => ({
                        ...prev,
                        techStack: (prev.techStack ?? []).filter((_, idx) => idx !== i),
                      }))}
                    >
                      {t} ✕
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Dataset Size
              </label>
              <input
                type="text"
                value={input.datasetSize}
                onChange={(e) => setInput(prev => ({ ...prev, datasetSize: e.target.value }))}
                placeholder="e.g. 100k rows, 50k images"
                className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-pfc-ember/30"
              />
            </div>
          </div>

          {/* Performance metrics */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Performance Metrics
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={metricKey}
                onChange={(e) => setMetricKey(e.target.value)}
                placeholder="Metric name (e.g. accuracy)"
                className="flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-pfc-ember/30"
              />
              <input
                type="text"
                value={metricValue}
                onChange={(e) => setMetricValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMetric()}
                placeholder="Value (e.g. 0.92)"
                className="w-28 rounded-lg border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-pfc-ember/30"
              />
              <GlassBubbleButton onClick={addMetric} color="violet" size="sm">Add</GlassBubbleButton>
            </div>
            {Object.keys(input.performanceMetrics ?? {}).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(input.performanceMetrics ?? {}).map(([k, v]) => (
                  <Badge
                    key={k}
                    variant="secondary"
                    className="text-[10px] cursor-pointer hover:bg-pfc-red/10"
                    onClick={() => {
                      const next = { ...(input.performanceMetrics ?? {}) };
                      delete next[k];
                      setInput(prev => ({ ...prev, performanceMetrics: next }));
                    }}
                  >
                    {k}: {v} ✕
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Checkboxes */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={input.hasTests}
                onChange={(e) => setInput(prev => ({ ...prev, hasTests: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-xs text-muted-foreground">Has test suite</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={input.hasDocumentation}
                onChange={(e) => setInput(prev => ({ ...prev, hasDocumentation: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-xs text-muted-foreground">Has documentation</span>
            </label>
          </div>

          {/* Submit */}
          {error && (
            <p className="text-xs text-pfc-red">{error}</p>
          )}
          <GlassBubbleButton
            onClick={handleEvaluate}
            disabled={loading}
            color="ember"
            size="lg"
          >
            {loading ? (
              <>
                <PixelBook size={18} />
                Analyzing...
              </>
            ) : (
              <>
                <SendIcon style={{ height: 16, width: 16 }} />
                Run Evaluation
              </>
            )}
          </GlassBubbleButton>
        </div>
      </GlassSection>

      {/* ── Results ── */}
      <AnimatePresence>
        {evaluation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="space-y-6 mt-6"
          >
            {/* ── Hero scores ── */}
            <GlassSection title="Score Overview">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl glass-bubble-pill p-5 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-pfc-ember/5 to-transparent" />
                  <div className="relative">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-1">Overall Score</p>
                    <p className={cn('text-4xl font-black tabular-nums', scoreColor(evaluation.overallScore / 100))}>
                      {evaluation.overallScore}
                    </p>
                    <Badge className={cn('mt-1.5 text-[10px] font-bold', gradeColor(evaluation.overallGrade))}>
                      Grade {evaluation.overallGrade}
                    </Badge>
                  </div>
                </div>

                <div className="rounded-2xl glass-bubble-pill p-5 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-pfc-violet/5 to-transparent" />
                  <div className="relative">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-1">Project IQ</p>
                    <p className="text-4xl font-black tabular-nums text-pfc-violet">
                      {evaluation.intelligenceQuotient}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1.5">of 150</p>
                  </div>
                </div>

                <div className="rounded-2xl glass-bubble-pill p-5 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-pfc-cyan/5 to-transparent" />
                  <div className="relative">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-1">Maturity</p>
                    <p className="text-lg font-bold capitalize text-pfc-cyan mt-2">
                      {evaluation.maturityLevel}
                    </p>
                    <Badge variant="outline" className="mt-1.5 text-[10px]">
                      P{evaluation.industryPercentile} Percentile
                    </Badge>
                  </div>
                </div>

                <div className="rounded-2xl glass-bubble-pill p-5 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-pfc-green/5 to-transparent" />
                  <div className="relative">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-1">Deploy Ready</p>
                    <p className={cn('text-4xl font-black tabular-nums', scoreColor(evaluation.readinessScore))}>
                      {Math.round(evaluation.readinessScore * 100)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                      Tech debt: {Math.round(evaluation.technicalDebt * 100)}%
                    </p>
                  </div>
                </div>
              </div>
            </GlassSection>

            {/* ── Dimension scores grid ── */}
            <GlassSection title="12-Dimension Assessment">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {evaluation.dimensions.map((dim) => (
                  <DimensionCard key={dim.dimension} dim={dim} />
                ))}
              </div>
            </GlassSection>

            {/* ── Robustness & Calibration ── */}
            <GlassSection title="Robustness & Calibration">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Robustness Profile */}
                <div className="rounded-xl border border-border/30 p-4">
                  <h4 className="text-sm flex items-center gap-2 mb-3 font-semibold">
                    <ShieldCheckIcon className="h-4 w-4 text-pfc-ember" />
                    Robustness Profile
                  </h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Perturbation Sensitivity', value: 1 - evaluation.robustness.perturbationSensitivity, inverted: true },
                      { label: 'Distribution Shift Resilience', value: evaluation.robustness.distributionShiftResilience },
                      { label: 'Adversarial Resistance', value: evaluation.robustness.adversarialResistance },
                      { label: 'Edge Case Coverage', value: evaluation.robustness.edgeCaseCoverage },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-muted-foreground">{item.label}</span>
                          <span className={cn('text-[11px] font-mono font-medium', scoreColor(item.value))}>
                            {Math.round(item.value * 100)}%
                          </span>
                        </div>
                        <Progress value={item.value * 100} className={cn('h-1.5', scoreBarClass(item.value))} />
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                      <span className="text-[11px] text-muted-foreground">Graceful Failure:</span>
                      {evaluation.robustness.failureGracefully ? (
                        <Badge className="text-[10px] bg-pfc-green/10 text-pfc-green border-pfc-green/30">Yes</Badge>
                      ) : (
                        <Badge className="text-[10px] bg-pfc-red/10 text-pfc-red border-pfc-red/30">No</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Calibration Profile */}
                <div className="rounded-xl border border-border/30 p-4">
                  <h4 className="text-sm flex items-center gap-2 mb-3 font-semibold">
                    <GaugeIcon className="h-4 w-4 text-pfc-violet" />
                    Calibration Profile
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-muted-foreground/60 mb-0.5">ECE</p>
                        <p className="text-xl font-bold tabular-nums text-pfc-violet">
                          {evaluation.calibration.expectedCalibrationError.toFixed(3)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground/60 mb-0.5">Brier Score</p>
                        <p className="text-xl font-bold tabular-nums text-pfc-cyan">
                          {evaluation.calibration.brierScore.toFixed(3)}
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-border/30" />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-muted-foreground/60 mb-0.5">Overconfidence</p>
                        <p className={cn('text-lg font-bold tabular-nums', evaluation.calibration.overconfidenceIndex > 0.2 ? 'text-pfc-red' : 'text-pfc-green')}>
                          {(evaluation.calibration.overconfidenceIndex * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground/60 mb-0.5">Underconfidence</p>
                        <p className="text-lg font-bold tabular-nums text-pfc-yellow">
                          {(evaluation.calibration.underconfidenceIndex * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border/30">
                      <span className="text-[11px] text-muted-foreground">Reliability Diagram: </span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {evaluation.calibration.reliabilityDiagramShape.replace(/-/g, ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </GlassSection>

            {/* ── Pattern Analysis ── */}
            <GlassSection title="Pattern Analysis">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Anti-patterns */}
                <div className={cn('rounded-xl border border-border/30 p-4', evaluation.patternAnalysis.antiPatterns.length > 0 && 'border-pfc-red/20')}>
                  <h4 className="text-xs flex items-center gap-2 mb-3 font-semibold">
                    <AlertTriangleIcon className="h-3.5 w-3.5 text-pfc-red" />
                    Anti-Patterns Detected
                  </h4>
                  {evaluation.patternAnalysis.antiPatterns.length === 0 ? (
                    <p className="text-[11px] text-pfc-green flex items-center gap-1.5">
                      <CheckCircle2Icon className="h-3 w-3" /> No anti-patterns detected
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {evaluation.patternAnalysis.antiPatterns.map((ap, i) => (
                        <div key={i} className="rounded-md bg-pfc-red/5 border border-pfc-red/15 px-2.5 py-2">
                          <p className="text-[11px] font-medium text-pfc-red">{ap.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{ap.impact}</p>
                          <p className="text-[10px] text-pfc-ember mt-1">Fix: {ap.fix}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Best practices */}
                <div className="rounded-xl border border-border/30 p-4">
                  <h4 className="text-xs flex items-center gap-2 mb-3 font-semibold">
                    <CheckCircle2Icon className="h-3.5 w-3.5 text-pfc-green" />
                    Best Practices
                  </h4>
                  <div className="space-y-1.5">
                    {evaluation.patternAnalysis.bestPractices.map((bp, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        {bp.implemented ? (
                          <CheckCircle2Icon className="h-3 w-3 text-pfc-green shrink-0" />
                        ) : (
                          <div className="h-3 w-3 rounded-full border border-muted-foreground/30 shrink-0" />
                        )}
                        <span className={bp.implemented ? 'text-foreground/80' : 'text-muted-foreground/60'}>
                          {bp.name}
                        </span>
                        {bp.importance === 'essential' && !bp.implemented && (
                          <Badge className="text-[8px] bg-pfc-red/10 text-pfc-red border-pfc-red/20 px-1 py-0">!</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Innovation */}
                <div className="rounded-xl border border-border/30 p-4">
                  <h4 className="text-xs flex items-center gap-2 mb-3 font-semibold">
                    <SparklesIcon className="h-3.5 w-3.5 text-pfc-violet" />
                    Innovation & Complexity
                  </h4>
                  <div className="space-y-3">
                    {evaluation.patternAnalysis.innovativeApproaches.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {evaluation.patternAnalysis.innovativeApproaches.map((ia, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] bg-pfc-violet/10 text-pfc-violet border-pfc-violet/20">
                            {ia}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/50">No innovative approaches detected</p>
                    )}
                    <div className="border-t border-border/30" />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground/60">Complexity</p>
                        <Progress value={evaluation.patternAnalysis.complexityScore * 100} className="h-1.5 mt-1" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground/60">Modularity</p>
                        <Progress value={evaluation.patternAnalysis.modularityScore * 100} className="h-1.5 mt-1" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassSection>

            {/* ── Improvement Roadmap ── */}
            <GlassSection title="Improvement Roadmap">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {evaluation.criticalIssues.length > 0 && (
                  <div className="rounded-xl border border-pfc-red/20 p-4">
                    <h4 className="text-xs text-pfc-red flex items-center gap-1.5 mb-3 font-semibold">
                      <ZapIcon className="h-3.5 w-3.5" /> Critical Issues
                    </h4>
                    {evaluation.criticalIssues.map((issue, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground mb-1.5">{issue}</p>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-pfc-ember/20 p-4">
                  <h4 className="text-xs text-pfc-ember flex items-center gap-1.5 mb-3 font-semibold">
                    <TrendingUpIcon className="h-3.5 w-3.5" /> Quick Wins
                  </h4>
                  {evaluation.quickWins.length > 0 ? (
                    evaluation.quickWins.map((qw, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground mb-1.5">{qw}</p>
                    ))
                  ) : (
                    <p className="text-[11px] text-pfc-green">No urgent quick wins — solid foundation</p>
                  )}
                </div>

                <div className="rounded-xl border border-border/30 p-4">
                  <h4 className="text-xs text-pfc-violet flex items-center gap-1.5 mb-3 font-semibold">
                    <BookOpenIcon className="h-3.5 w-3.5" /> Long-Term
                  </h4>
                  {evaluation.longTermRecommendations.length > 0 ? (
                    evaluation.longTermRecommendations.map((rec, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground mb-1.5">{rec}</p>
                    ))
                  ) : (
                    <p className="text-[11px] text-pfc-green">Excellent long-term positioning</p>
                  )}
                </div>
              </div>
            </GlassSection>

            {/* ── Comparable projects ── */}
            <GlassSection className="pb-8">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-2">Comparable Benchmarks</p>
              <div className="flex flex-wrap gap-1.5">
                {evaluation.comparableProjects.map((cp, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">{cp}</Badge>
                ))}
              </div>
            </GlassSection>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
