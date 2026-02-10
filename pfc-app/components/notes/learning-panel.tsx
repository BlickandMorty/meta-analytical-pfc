'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  memo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  Brain,
  X,
  Pause,
  Play,
  Check,
  CircleDot,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import type { LearningSession } from '@/lib/notes/learning-protocol';

/* ═══════════════════════════════════════════════════════════════════
   LearningPanel — AI recursive learning protocol status panel

   Appears at the bottom-left of the notes page. Shows a collapsed
   pill FAB when idle, and an expanded glass panel when a learning
   session is active or paused.
   ═══════════════════════════════════════════════════════════════════ */

// ── Types ──────────────────────────────────────────────────────────

type LearningDepth = 'shallow' | 'moderate' | 'deep';

type StepStatus = 'pending' | 'running' | 'completed' | 'error';

interface ProtocolStep {
  id: string;
  title: string;
  status: StepStatus;
  insightCount?: number;
}

// ── Constants ──────────────────────────────────────────────────────

const CUPERTINO_EASE = [0.32, 0.72, 0, 1] as const;

const PROTOCOL_STEP_TITLES = [
  'Content extraction',
  'Pattern recognition',
  'Concept mapping',
  'Gap analysis',
  'Insight synthesis',
  'Cross-reference linking',
  'Knowledge consolidation',
];

const DEPTH_LABELS: Record<LearningDepth, { label: string; passes: number }> = {
  shallow:  { label: 'Shallow',  passes: 1 },
  moderate: { label: 'Moderate', passes: 2 },
  deep:     { label: 'Deep',     passes: 3 },
};

const PANEL_WIDTH = 320;

// ── Animation variants ────────────────────────────────────────────

const fabVariants = {
  initial: { opacity: 0, scale: 0.85, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.35, ease: CUPERTINO_EASE },
  },
  exit: {
    opacity: 0,
    scale: 0.85,
    y: 8,
    transition: { duration: 0.2, ease: CUPERTINO_EASE },
  },
};

const popoverVariants = {
  initial: { opacity: 0, scale: 0.92, y: 8, filter: 'blur(6px)' },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.35, ease: CUPERTINO_EASE },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: 8,
    filter: 'blur(6px)',
    transition: { duration: 0.2, ease: CUPERTINO_EASE },
  },
};

const panelVariants = {
  initial: { opacity: 0, scale: 0.92, y: 16, filter: 'blur(8px)' },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.4, ease: CUPERTINO_EASE },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: 16,
    filter: 'blur(8px)',
    transition: { duration: 0.25, ease: CUPERTINO_EASE },
  },
};

const stepVariants = {
  initial: { opacity: 0, x: -6 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: CUPERTINO_EASE },
  },
};

// ── Helpers ────────────────────────────────────────────────────────

function deriveSteps(session: LearningSession | null): ProtocolStep[] {
  if (!session) {
    return PROTOCOL_STEP_TITLES.map((title, i) => ({
      id: `step-${i}`,
      title,
      status: 'pending' as StepStatus,
    }));
  }

  // Map from real session steps
  return session.steps.map((step, i) => ({
    id: step.id,
    title: step.title || PROTOCOL_STEP_TITLES[i] || `Step ${i + 1}`,
    status: (step.status === 'skipped' ? 'completed' : step.status) as StepStatus,
    insightCount: step.insights.length || undefined,
  }));
}

function getOverallProgress(session: LearningSession | null): number {
  if (!session) return 0;
  if (session.status === 'completed') return 1;
  const total = session.steps.length;
  if (total === 0) return 0;
  const completed = session.steps.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
  const running = session.steps.filter((s) => s.status === 'running').length;
  return Math.min((completed + running * 0.5) / total, 0.99);
}

// ── Component ──────────────────────────────────────────────────────

export const LearningPanel = memo(function LearningPanel() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  // ── Store selectors ──
  const learningSession = usePFCStore((s) => s.learningSession);
  const learningStreamText = usePFCStore((s) => s.learningStreamText);
  const learningAutoRun = usePFCStore((s) => s.learningAutoRun);
  const startLearningSession = usePFCStore((s) => s.startLearningSession);
  const pauseLearningSession = usePFCStore((s) => s.pauseLearningSession);
  const resumeLearningSession = usePFCStore((s) => s.resumeLearningSession);
  const stopLearningSession = usePFCStore((s) => s.stopLearningSession);
  const setLearningAutoRun = usePFCStore((s) => s.setLearningAutoRun);
  const notesSidebarOpen = usePFCStore((s) => s.notesSidebarOpen);

  // ── Derived state ──
  const sessionStatus: string = learningSession?.status ?? 'idle';
  const isRunning = sessionStatus === 'running';
  const isPaused = sessionStatus === 'paused';
  const isCompleted = sessionStatus === 'completed';
  const isActive = isRunning || isPaused;

  const currentPass: number = learningSession?.iteration ?? 1;
  const totalPasses: number = learningSession?.maxIterations ?? 1;

  const steps = deriveSteps(learningSession);
  const progress = getOverallProgress(learningSession);

  // Summary stats for completed state
  const insightsFound: number = learningSession?.totalInsights ?? 0;
  const pagesCreated: number = learningSession?.totalPagesCreated ?? 0;
  const blocksAdded: number = learningSession?.totalBlocksCreated ?? 0;

  // ── Local UI state ──
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [depth, setDepth] = useState<LearningDepth>('moderate');

  const streamRef = useRef<HTMLDivElement>(null);

  // Auto-scroll stream preview
  useEffect(() => {
    if (isRunning && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [isRunning, learningStreamText]);

  // ── Positioning ──
  const leftOffset = notesSidebarOpen ? 280 : 20;

  // ── Handlers ──

  const handleStart = useCallback(() => {
    startLearningSession(depth, DEPTH_LABELS[depth].passes);
    setPopoverOpen(false);
  }, [depth, startLearningSession]);

  const handlePause = useCallback(() => {
    pauseLearningSession();
  }, [pauseLearningSession]);

  const handleResume = useCallback(() => {
    resumeLearningSession();
  }, [resumeLearningSession]);

  const handleStop = useCallback(() => {
    stopLearningSession();
  }, [stopLearningSession]);

  const handleAutoRunToggle = useCallback(() => {
    setLearningAutoRun(!learningAutoRun);
  }, [learningAutoRun, setLearningAutoRun]);

  const handleRunAgain = useCallback(() => {
    startLearningSession(depth, DEPTH_LABELS[depth].passes);
  }, [depth, startLearningSession]);

  // ── Styles ──

  const glassBackground = isDark
    ? 'rgba(28, 27, 25, 0.92)'
    : 'rgba(255, 255, 255, 0.78)';

  const glassBorder = isDark
    ? 'rgba(50, 49, 45, 0.5)'
    : 'rgba(0, 0, 0, 0.08)';

  const subtleText = isDark
    ? 'rgba(155, 150, 137, 0.9)'
    : 'rgba(0, 0, 0, 0.4)';

  const bodyText = isDark
    ? 'rgba(232, 228, 222, 0.9)'
    : 'rgba(0, 0, 0, 0.75)';

  const inputBg = isDark
    ? 'rgba(196, 149, 106, 0.06)'
    : 'rgba(0, 0, 0, 0.03)';

  const glassShadow = 'none';

  const fabShadow = 'none';

  // ════════════════════════════════════════════════════════════════
  // B) Expanded state — active or completed session
  // ════════════════════════════════════════════════════════════════

  if (isActive || isCompleted) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="learning-panel"
          variants={panelVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{
            position: 'fixed',
            bottom: 80,
            left: leftOffset,
            width: PANEL_WIDTH,
            display: 'flex',
            flexDirection: 'column',
            background: glassBackground,
            border: `1px solid ${glassBorder}`,
            borderRadius: '1rem',
            backdropFilter: 'blur(12px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
            boxShadow: glassShadow,
            overflow: 'hidden',
            zIndex: 50,
            transition: 'left 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          {/* ── Progress bar ── */}
          <div
            style={{
              height: 2,
              width: '100%',
              background: isDark ? 'rgba(79,69,57,0.3)' : 'rgba(0,0,0,0.04)',
              flexShrink: 0,
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.4, ease: CUPERTINO_EASE }}
              style={{
                height: '100%',
                background: isCompleted
                  ? '#34D399'
                  : 'linear-gradient(90deg, #C4956A, #D4B896)',
                borderRadius: 1,
              }}
            />
          </div>

          {/* ── Header ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.625rem 0.375rem 0.75rem',
              borderBottom: `1px solid ${glassBorder}`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              <Brain
                style={{ width: 14, height: 14, color: '#C4956A' }}
              />
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: bodyText,
                }}
              >
                AI Learning
              </span>

              {/* Status badge */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.1rem 0.4rem',
                  fontSize: '0.5625rem',
                  fontWeight: 500,
                  borderRadius: '0.5rem',
                  background: isRunning
                    ? 'rgba(52, 211, 153, 0.12)'
                    : isPaused
                      ? 'rgba(251, 191, 36, 0.12)'
                      : 'rgba(52, 211, 153, 0.12)',
                  color: isRunning
                    ? '#34D399'
                    : isPaused
                      ? '#FBBF24'
                      : '#34D399',
                  border: `1px solid ${
                    isRunning
                      ? 'rgba(52, 211, 153, 0.2)'
                      : isPaused
                        ? 'rgba(251, 191, 36, 0.2)'
                        : 'rgba(52, 211, 153, 0.2)'
                  }`,
                }}
              >
                {isRunning && (
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: '#34D399',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                )}
                {isRunning ? 'Running' : isPaused ? 'Paused' : 'Done'}
                {isCompleted && (
                  <Check style={{ width: 8, height: 8 }} />
                )}
              </span>

              {/* Iteration counter */}
              <span
                style={{
                  fontSize: '0.5625rem',
                  fontWeight: 500,
                  color: subtleText,
                  marginLeft: '0.125rem',
                }}
              >
                Pass {currentPass}/{totalPasses}
              </span>
            </div>

            {/* Control buttons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              {/* Pause / Resume */}
              {(isRunning || isPaused) && (
                <motion.button
                  onClick={isPaused ? handleResume : handlePause}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    borderRadius: '0.375rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: subtleText,
                  }}
                  aria-label={isPaused ? 'Resume learning' : 'Pause learning'}
                >
                  {isPaused ? (
                    <Play style={{ width: 12, height: 12 }} />
                  ) : (
                    <Pause style={{ width: 12, height: 12 }} />
                  )}
                </motion.button>
              )}

              {/* Stop / Close */}
              <motion.button
                onClick={handleStop}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22,
                  height: 22,
                  borderRadius: '0.375rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: subtleText,
                }}
                aria-label="Stop learning"
              >
                <X style={{ width: 13, height: 13 }} />
              </motion.button>
            </div>
          </div>

          {/* ── Steps list ── */}
          <div
            style={{
              padding: '0.5rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              maxHeight: 220,
              overflowY: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: isDark
                ? 'rgba(244,189,111,0.08) transparent'
                : 'rgba(0,0,0,0.06) transparent',
            }}
          >
            {steps.map((step) => (
              <motion.div
                key={step.id}
                variants={stepVariants}
                initial="initial"
                animate="animate"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.25rem 0',
                }}
              >
                {/* Step indicator */}
                <StepIndicator status={step.status} isDark={isDark} />

                {/* Step title */}
                <span
                  style={{
                    flex: 1,
                    fontSize: '0.6875rem',
                    fontWeight: step.status === 'running' ? 500 : 400,
                    color: step.status === 'completed'
                      ? bodyText
                      : step.status === 'running'
                        ? '#D4B896'
                        : step.status === 'error'
                          ? '#F87171'
                          : subtleText,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {step.title}
                  {step.status === 'running' && (
                    <span
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: isDark
                          ? 'linear-gradient(90deg, transparent 0%, rgba(244,189,111,0.08) 50%, transparent 100%)'
                          : 'linear-gradient(90deg, transparent 0%, rgba(244,189,111,0.06) 50%, transparent 100%)',
                        animation: 'shimmer 2s ease-in-out infinite',
                      }}
                    />
                  )}
                </span>

                {/* Insight count badge */}
                {step.status === 'completed' && step.insightCount != null && step.insightCount > 0 && (
                  <span
                    style={{
                      fontSize: '0.5625rem',
                      fontWeight: 500,
                      padding: '0.05rem 0.35rem',
                      borderRadius: '0.375rem',
                      background: 'rgba(52, 211, 153, 0.1)',
                      color: '#34D399',
                      border: '1px solid rgba(52, 211, 153, 0.15)',
                      flexShrink: 0,
                    }}
                  >
                    {step.insightCount}
                  </span>
                )}
              </motion.div>
            ))}
          </div>

          {/* ── Stream preview ── */}
          {isRunning && learningStreamText && (
            <div
              style={{
                borderTop: `1px solid ${glassBorder}`,
                flexShrink: 0,
              }}
            >
              <div
                ref={streamRef}
                style={{
                  maxHeight: 52,
                  overflowY: 'auto',
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.625rem',
                  lineHeight: 1.5,
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                  color: isDark ? 'rgba(237,224,212,0.35)' : 'rgba(0,0,0,0.3)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  scrollbarWidth: 'none',
                }}
              >
                {learningStreamText}
                <span
                  style={{
                    display: 'inline-block',
                    width: 5,
                    height: 11,
                    marginLeft: 2,
                    background: '#C4956A',
                    borderRadius: 1,
                    verticalAlign: 'text-bottom',
                    animation: 'blink 1s step-end infinite',
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Completed summary ── */}
          {isCompleted && (
            <div
              style={{
                borderTop: `1px solid ${glassBorder}`,
                padding: '0.5rem 0.75rem',
                flexShrink: 0,
              }}
            >
              <p
                style={{
                  fontSize: '0.6875rem',
                  color: bodyText,
                  marginBottom: '0.5rem',
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: '#34D399', fontWeight: 600 }}>
                  {insightsFound}
                </span>{' '}
                insights found,{' '}
                <span style={{ color: '#D4B896', fontWeight: 600 }}>
                  {pagesCreated}
                </span>{' '}
                pages created,{' '}
                <span style={{ color: '#E07850', fontWeight: 600 }}>
                  {blocksAdded}
                </span>{' '}
                blocks added
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: '0.375rem',
                }}
              >
                <motion.button
                  onClick={handleRunAgain}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                    padding: '0.35rem 0.625rem',
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    color: '#D4B896',
                    background: 'rgba(196, 149, 106, 0.1)',
                    border: '1px solid rgba(196, 149, 106, 0.2)',
                    borderRadius: '9999px',
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw style={{ width: 11, height: 11 }} />
                  Run Again
                </motion.button>

                <motion.button
                  onClick={handleStop}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                    padding: '0.35rem 0.625rem',
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    color: bodyText,
                    background: inputBg,
                    border: `1px solid ${glassBorder}`,
                    borderRadius: '9999px',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </motion.button>
              </div>
            </div>
          )}

          {/* ── Pulse + shimmer keyframes ── */}
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
            @keyframes blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
          `}</style>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // A) Collapsed state — no active session
  // ════════════════════════════════════════════════════════════════

  return (
    <>
      <AnimatePresence>
        {/* ── FAB pill ── */}
        {!popoverOpen && (
          <motion.button
            key="fab"
            variants={fabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={() => setPopoverOpen(true)}
            style={{
              position: 'fixed',
              bottom: 80,
              left: leftOffset,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.45rem 0.9rem',
              fontSize: '0.75rem',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              color: '#C4956A',
              background: glassBackground,
              border: `1px solid ${glassBorder}`,
              borderRadius: '1.25rem',
              cursor: 'pointer',
              backdropFilter: 'blur(12px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
              boxShadow: fabShadow,
              zIndex: 50,
              transition: 'left 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          >
            <Brain style={{ width: 14, height: 14 }} />
            AI Learn
          </motion.button>
        )}

        {/* ── Popover ── */}
        {popoverOpen && (
          <motion.div
            key="popover"
            variants={popoverVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{
              position: 'fixed',
              bottom: 80,
              left: leftOffset,
              width: 260,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.625rem',
              padding: '0.75rem',
              background: glassBackground,
              border: `1px solid ${glassBorder}`,
              borderRadius: '1rem',
              backdropFilter: 'blur(12px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
              boxShadow: glassShadow,
              zIndex: 50,
              transition: 'left 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          >
            {/* Close */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                }}
              >
                <Brain style={{ width: 13, height: 13, color: '#C4956A' }} />
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    color: bodyText,
                  }}
                >
                  AI Learn
                </span>
              </div>
              <motion.button
                onClick={() => setPopoverOpen(false)}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  borderRadius: '0.375rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: subtleText,
                }}
                aria-label="Close"
              >
                <X style={{ width: 12, height: 12 }} />
              </motion.button>
            </div>

            {/* Description */}
            <p
              style={{
                fontSize: '0.625rem',
                lineHeight: 1.5,
                color: subtleText,
                margin: 0,
              }}
            >
              AI will recursively analyze and deepen your notes
            </p>

            {/* Depth selector */}
            <div
              style={{
                display: 'flex',
                gap: '0.3rem',
                background: inputBg,
                borderRadius: '9999px',
                padding: '0.2rem',
              }}
            >
              {(['shallow', 'moderate', 'deep'] as LearningDepth[]).map((d) => (
                <motion.button
                  key={d}
                  onClick={() => setDepth(d)}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  style={{
                    flex: 1,
                    padding: '0.3rem 0',
                    fontSize: '0.625rem',
                    fontWeight: depth === d ? 600 : 400,
                    color: depth === d ? '#D4B896' : subtleText,
                    background: depth === d
                      ? (isDark ? 'rgba(196, 149, 106, 0.12)' : 'rgba(196, 149, 106, 0.1)')
                      : 'transparent',
                    border: depth === d
                      ? '1px solid rgba(196, 149, 106, 0.2)'
                      : '1px solid transparent',
                    borderRadius: '9999px',
                    cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                  }}
                >
                  {DEPTH_LABELS[d].label}
                </motion.button>
              ))}
            </div>

            {/* Auto-learn toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 450,
                  color: bodyText,
                }}
              >
                Auto-learn
              </span>
              <motion.button
                onClick={handleAutoRunToggle}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                style={{
                  width: 32,
                  height: 18,
                  borderRadius: 9,
                  padding: 2,
                  background: learningAutoRun
                    ? 'rgba(196, 149, 106, 0.5)'
                    : (isDark ? 'rgba(244,189,111,0.1)' : 'rgba(0,0,0,0.1)'),
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'background 0.2s',
                }}
                role="switch"
                aria-checked={learningAutoRun}
              >
                <motion.span
                  animate={{ x: learningAutoRun ? 14 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    background: learningAutoRun ? '#D4B896' : (isDark ? 'rgba(237,224,212,0.4)' : 'rgba(0,0,0,0.3)'),
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  }}
                />
              </motion.button>
            </div>

            {/* Start button */}
            <motion.button
              onClick={handleStart}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.375rem',
                padding: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: '#fff',
                background: 'linear-gradient(135deg, #C4956A, #D4B896)',
                border: 'none',
                borderRadius: '9999px',
                cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(196, 149, 106, 0.3)',
              }}
            >
              <Brain style={{ width: 13, height: 13 }} />
              Start Learning
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   StepIndicator — circle indicator for each protocol step
   ═══════════════════════════════════════════════════════════════════ */

function StepIndicator({ status, isDark }: { status: StepStatus; isDark: boolean }) {
  const size = 14;

  if (status === 'completed') {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'rgba(52, 211, 153, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Check style={{ width: 8, height: 8, color: '#34D399' }} />
      </div>
    );
  }

  if (status === 'running') {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'rgba(196, 149, 106, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      >
        <CircleDot style={{ width: 8, height: 8, color: '#D4B896' }} />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'rgba(248, 113, 113, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <AlertCircle style={{ width: 8, height: 8, color: '#F87171' }} />
      </div>
    );
  }

  // Pending
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: isDark ? 'rgba(244,189,111,0.06)' : 'rgba(0,0,0,0.04)',
        border: `1px solid ${isDark ? 'rgba(79,69,57,0.5)' : 'rgba(0,0,0,0.06)'}`,
        flexShrink: 0,
      }}
    />
  );
}
