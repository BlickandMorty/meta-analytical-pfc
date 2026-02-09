// Types for the learning protocol

export type LearningStepType =
  | 'inventory'      // Scan all notes, build knowledge map
  | 'gap-analysis'   // Find topics mentioned but not elaborated
  | 'deep-dive'      // Generate detailed content for gaps
  | 'cross-reference' // Find connections between notes
  | 'synthesis'      // Create summary/overview pages
  | 'questions'      // Generate questions the notes don't answer
  | 'iterate';       // Loop back with new content

export type LearningSessionStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'error';

export interface LearningStep {
  id: string;
  type: LearningStepType;
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'error';
  title: string;
  description: string;
  startedAt?: number;
  completedAt?: number;
  output?: string;          // Generated content
  insights: string[];       // Key insights found
  pagesCreated: string[];   // IDs of pages created/modified
  blocksCreated: string[];  // IDs of blocks created
  error?: string;
}

export interface LearningSession {
  id: string;
  status: LearningSessionStatus;
  startedAt: number;
  completedAt?: number;
  currentStepIndex: number;
  steps: LearningStep[];
  iteration: number;        // Which loop iteration (1 = first pass)
  maxIterations: number;    // How many loops to run
  totalInsights: number;
  totalPagesCreated: number;
  totalBlocksCreated: number;
  // Config
  targetPageIds?: string[]; // If set, only analyze these pages
  depth: 'shallow' | 'moderate' | 'deep';  // How thorough
}

// Generate unique IDs
export function generateSessionId(): string {
  return `learn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// The 7-step protocol definition
export const PROTOCOL_STEPS: { type: LearningStepType; title: string; description: string }[] = [
  {
    type: 'inventory',
    title: 'Knowledge Inventory',
    description: 'Scanning all notes to build a map of topics, concepts, and coverage density',
  },
  {
    type: 'gap-analysis',
    title: 'Gap Analysis',
    description: 'Identifying topics mentioned but not elaborated, weak connections, and missing context',
  },
  {
    type: 'deep-dive',
    title: 'Deep Dive',
    description: 'Generating detailed explanatory content for the most significant knowledge gaps',
  },
  {
    type: 'cross-reference',
    title: 'Cross-Reference',
    description: 'Finding hidden connections between disparate notes and creating [[page links]]',
  },
  {
    type: 'synthesis',
    title: 'Synthesis',
    description: 'Creating overview pages that tie related topics together into coherent narratives',
  },
  {
    type: 'questions',
    title: 'Question Generation',
    description: 'Generating thought-provoking questions that the current notes don\'t yet answer',
  },
  {
    type: 'iterate',
    title: 'Iteration Check',
    description: 'Evaluating whether another learning pass would add value or if coverage is sufficient',
  },
];

// Create a fresh session
export function createLearningSession(
  depth: LearningSession['depth'] = 'moderate',
  maxIterations: number = 3,
  targetPageIds?: string[],
): LearningSession {
  return {
    id: generateSessionId(),
    status: 'idle',
    startedAt: Date.now(),
    currentStepIndex: 0,
    steps: PROTOCOL_STEPS.map((def) => ({
      id: generateStepId(),
      type: def.type,
      status: 'pending' as const,
      title: def.title,
      description: def.description,
      insights: [],
      pagesCreated: [],
      blocksCreated: [],
    })),
    iteration: 1,
    maxIterations,
    totalInsights: 0,
    totalPagesCreated: 0,
    totalBlocksCreated: 0,
    targetPageIds,
    depth,
  };
}
