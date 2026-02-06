export type PipelineStage =
  | 'triage'
  | 'memory'
  | 'routing'
  | 'statistical'
  | 'causal'
  | 'meta_analysis'
  | 'bayesian'
  | 'synthesis'
  | 'adversarial'
  | 'calibration';

export type StageStatus = 'idle' | 'active' | 'complete' | 'error';

export const STAGES: PipelineStage[] = [
  'triage',
  'memory',
  'routing',
  'statistical',
  'causal',
  'meta_analysis',
  'bayesian',
  'synthesis',
  'adversarial',
  'calibration',
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  triage: 'Triage',
  memory: 'Memory Retrieval',
  routing: 'Pathway Routing',
  statistical: 'Statistical Analysis',
  causal: 'Causal Inference',
  meta_analysis: 'Meta-Analysis',
  bayesian: 'Bayesian Updating',
  synthesis: 'Synthesis',
  adversarial: 'Adversarial Review',
  calibration: 'Confidence Calibration',
};

export const STAGE_DESCRIPTIONS: Record<PipelineStage, string> = {
  triage: 'Classifying query complexity and domain',
  memory: 'Retrieving relevant context and prior results',
  routing: 'Selecting optimal analytical pathways',
  statistical: 'Running frequentist statistical tests',
  causal: 'Evaluating causal relationships and DAGs',
  meta_analysis: 'Aggregating multi-study evidence',
  bayesian: 'Updating prior beliefs with new evidence',
  synthesis: 'Combining all analytical outputs',
  adversarial: 'Stress-testing conclusions',
  calibration: 'Calibrating final confidence intervals',
};

export const EXAMPLE_QUERIES = [
  {
    title: 'Analyze a claim',
    query: 'Is intermittent fasting effective for weight loss?',
    icon: '🔬',
  },
  {
    title: 'Evaluate evidence',
    query: 'What does the research say about screen time effects on children?',
    icon: '📊',
  },
  {
    title: 'Compare approaches',
    query: 'CBT vs medication for treating anxiety disorders',
    icon: '⚖️',
  },
  {
    title: 'Investigate a topic',
    query: 'How reliable are polygraph tests as evidence?',
    icon: '🕵️',
  },
];

export type SafetyState = 'green' | 'yellow' | 'orange' | 'red';
