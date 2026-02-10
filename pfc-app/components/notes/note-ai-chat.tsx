'use client';

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  Sparkles,
  X,
  ArrowUp,
  Square,
  Copy,
  Check,
  PenLine,
  FileText,
  Maximize2,
  RefreshCw,
  CornerDownLeft,
  Brain,
  Pause,
  Play,
  CircleDot,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import type { LearningSession } from '@/lib/notes/learning-protocol';

/* ═══════════════════════════════════════════════════════════════════
   NoteAIChat — docked AI assistant panel for the notes editor

   A Notion AI / Cursor-inspired inline chat that floats at the
   bottom-right of the notes area. Manages UI state via Zustand
   store actions — actual LLM calls are handled elsewhere.
   ═══════════════════════════════════════════════════════════════════ */

// ── Types ──────────────────────────────────────────────────────────

interface NoteAIChatProps {
  pageId: string;
  activeBlockId?: string | null;
}

type QuickAction = {
  id: string;
  label: string;
  icon: React.ElementType;
  prompt: string;
  requiresBlock: boolean;
};

// ── Constants ──────────────────────────────────────────────────────

const CUPERTINO_EASE = [0.32, 0.72, 0, 1] as const;

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'continue',
    label: 'Continue writing',
    icon: PenLine,
    prompt: 'Continue writing from where this note left off. Match the tone and style.',
    requiresBlock: false,
  },
  {
    id: 'summarize',
    label: 'Summarize page',
    icon: FileText,
    prompt: 'Summarize the key points of this note page concisely.',
    requiresBlock: false,
  },
  {
    id: 'expand',
    label: 'Expand',
    icon: Maximize2,
    prompt: 'Expand on this block with more detail and supporting points.',
    requiresBlock: true,
  },
  {
    id: 'rewrite',
    label: 'Rewrite',
    icon: RefreshCw,
    prompt: 'Rewrite this block to be clearer and more concise.',
    requiresBlock: true,
  },
];

const PANEL_WIDTH = 300;
const PANEL_HEIGHT = 200;

// ── Animations ─────────────────────────────────────────────────────

const pillVariants = {
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

const panelVariants = {
  initial: { opacity: 0, scale: 0.92, y: 12, filter: 'blur(8px)' },
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
    y: 12,
    filter: 'blur(8px)',
    transition: { duration: 0.25, ease: CUPERTINO_EASE },
  },
};

const responseVariants = {
  initial: { opacity: 0, scaleY: 0 },
  animate: {
    opacity: 1,
    scaleY: 1,
    transition: { duration: 0.3, ease: CUPERTINO_EASE },
  },
  exit: {
    opacity: 0,
    scaleY: 0,
    transition: { duration: 0.2, ease: CUPERTINO_EASE },
  },
};

// ── AI Learn types & helpers ─────────────────────────────────────

type LearningDepth = 'shallow' | 'moderate' | 'deep';
type StepStatus = 'pending' | 'running' | 'completed' | 'error';

interface ProtocolStep {
  id: string;
  title: string;
  status: StepStatus;
  insightCount?: number;
}

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

function deriveSteps(session: LearningSession | null): ProtocolStep[] {
  if (!session) {
    return PROTOCOL_STEP_TITLES.map((title, i) => ({
      id: `step-${i}`,
      title,
      status: 'pending' as StepStatus,
    }));
  }
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

type AITab = 'ask' | 'learn';

// ── Component ──────────────────────────────────────────────────────

export function NoteAIChat({ pageId, activeBlockId }: NoteAIChatProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isDark = mounted ? (resolvedTheme === 'dark' || resolvedTheme === 'oled') : true;

  // ── Local UI state ──
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [copied, setCopied] = useState(false);
  const [hasResponse, setHasResponse] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [activeTab, setActiveTab] = useState<AITab>('ask');

  const inputRef = useRef<HTMLInputElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  // ── Store state — Ask AI ──
  const noteAI = usePFCStore((s) => s.noteAI);
  const startNoteAIGeneration = usePFCStore((s) => s.startNoteAIGeneration);
  const stopNoteAIGeneration = usePFCStore((s) => s.stopNoteAIGeneration);
  const createBlock = usePFCStore((s) => s.createBlock);
  const updateBlockContent = usePFCStore((s) => s.updateBlockContent);

  // ── Store state — AI Learn ──
  const learningSession = usePFCStore((s) => s.learningSession);
  const learningStreamText = usePFCStore((s) => s.learningStreamText);
  const learningAutoRun = usePFCStore((s) => s.learningAutoRun);
  const startLearningSession = usePFCStore((s) => s.startLearningSession);
  const pauseLearningSession = usePFCStore((s) => s.pauseLearningSession);
  const resumeLearningSession = usePFCStore((s) => s.resumeLearningSession);
  const stopLearningSession = usePFCStore((s) => s.stopLearningSession);
  const setLearningAutoRun = usePFCStore((s) => s.setLearningAutoRun);
  const [learnDepth, setLearnDepth] = useState<LearningDepth>('moderate');

  // ── Derived learning state ──
  const learnStatus: string = learningSession?.status ?? 'idle';
  const learnIsRunning = learnStatus === 'running';
  const learnIsPaused = learnStatus === 'paused';
  const learnIsCompleted = learnStatus === 'completed';
  const learnIsActive = learnIsRunning || learnIsPaused;
  const learnSteps = deriveSteps(learningSession);
  const learnProgress = getOverallProgress(learningSession);
  const learnCurrentPass: number = learningSession?.iteration ?? 1;
  const learnTotalPasses: number = learningSession?.maxIterations ?? 1;
  const learnInsights: number = learningSession?.totalInsights ?? 0;
  const learnPagesCreated: number = learningSession?.totalPagesCreated ?? 0;
  const learnBlocksAdded: number = learningSession?.totalBlocksCreated ?? 0;

  const learnStreamRef = useRef<HTMLDivElement>(null);

  // Auto-scroll learn stream
  useEffect(() => {
    if (learnIsRunning && learnStreamRef.current) {
      learnStreamRef.current.scrollTop = learnStreamRef.current.scrollHeight;
    }
  }, [learnIsRunning, learningStreamText]);

  // Auto-switch to learn tab when session starts
  useEffect(() => {
    if (learnIsActive || learnIsCompleted) {
      setActiveTab('learn');
      if (!isExpanded) setIsExpanded(true);
    }
  }, [learnIsActive, learnIsCompleted]);

  const isGenerating = noteAI?.isGenerating ?? false;
  const generatedText = noteAI?.generatedText ?? '';

  // ── Sync generated text to local response state ──
  useEffect(() => {
    if (generatedText) {
      setResponseText(generatedText);
      setHasResponse(true);
    }
  }, [generatedText]);

  // ── Auto-scroll response area during streaming ──
  useEffect(() => {
    if (isGenerating && responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [isGenerating, responseText]);

  // ── Focus input on expand ──
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  // ── Keyboard shortcut: Escape to close ──
  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape' && isExpanded) {
        if (isGenerating) {
          stopNoteAIGeneration();
        } else {
          setIsExpanded(false);
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, isGenerating, stopNoteAIGeneration]);

  // ── Handlers ──

  const handleSend = useCallback(() => {
    const prompt = inputValue.trim();
    if (!prompt || isGenerating) return;
    setHasResponse(false);
    setResponseText('');
    startNoteAIGeneration(pageId, activeBlockId ?? null, prompt);
    setInputValue('');
  }, [inputValue, isGenerating, pageId, activeBlockId, startNoteAIGeneration]);

  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      if (isGenerating) return;
      if (action.requiresBlock && !activeBlockId) return;
      setHasResponse(false);
      setResponseText('');
      startNoteAIGeneration(
        pageId,
        action.requiresBlock ? (activeBlockId ?? null) : null,
        action.prompt,
      );
    },
    [isGenerating, activeBlockId, pageId, startNoteAIGeneration],
  );

  const handleStop = useCallback(() => {
    stopNoteAIGeneration();
  }, [stopNoteAIGeneration]);

  const handleInsert = useCallback(() => {
    if (!responseText) return;
    createBlock(pageId, null, activeBlockId ?? null, responseText);
    setHasResponse(false);
    setResponseText('');
  }, [responseText, pageId, activeBlockId, createBlock]);

  const handleReplace = useCallback(() => {
    if (!responseText || !activeBlockId) return;
    updateBlockContent(activeBlockId, responseText);
    setHasResponse(false);
    setResponseText('');
  }, [responseText, activeBlockId, updateBlockContent]);

  const handleCopy = useCallback(async () => {
    if (!responseText) return;
    try {
      await navigator.clipboard.writeText(responseText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in some contexts
    }
  }, [responseText]);

  const handleInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleClose = useCallback(() => {
    if (isGenerating) {
      stopNoteAIGeneration();
    }
    setIsExpanded(false);
  }, [isGenerating, stopNoteAIGeneration]);

  // ── Styles ──

  const glassBackground = isDark
    ? 'rgba(20, 20, 28, 0.82)'
    : 'rgba(255, 255, 255, 0.78)';

  const glassBorder = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(0, 0, 0, 0.08)';

  const subtleText = isDark
    ? 'rgba(255, 255, 255, 0.45)'
    : 'rgba(0, 0, 0, 0.4)';

  const bodyText = isDark
    ? 'rgba(255, 255, 255, 0.8)'
    : 'rgba(0, 0, 0, 0.75)';

  const inputBg = isDark
    ? 'rgba(255, 255, 255, 0.05)'
    : 'rgba(0, 0, 0, 0.03)';

  const inputBorder = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(0, 0, 0, 0.08)';

  const hoverBg = isDark
    ? 'rgba(255, 255, 255, 0.06)'
    : 'rgba(0, 0, 0, 0.04)';

  // ── Collapsed pill — larger, fused AI button ──

  if (!isExpanded) {
    return (
      <AnimatePresence mode="wait">
        <motion.button
          key="pill"
          variants={pillVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={() => setIsExpanded(true)}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.55rem 1.1rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: '#C4956A',
            background: glassBackground,
            border: `1px solid ${glassBorder}`,
            borderRadius: '9999px',
            cursor: 'pointer',
            backdropFilter: 'blur(12px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
            boxShadow: 'none',
            zIndex: 50,
          }}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.04 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        >
          <Sparkles style={{ width: 16, height: 16 }} />
          AI
          <Brain style={{ width: 14, height: 14, opacity: 0.6 }} />
        </motion.button>
      </AnimatePresence>
    );
  }

  // ── Expanded panel with tabs ──

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="panel"
        variants={panelVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 340,
          maxHeight: 420,
          display: 'flex',
          flexDirection: 'column',
          background: glassBackground,
          border: `1px solid ${glassBorder}`,
          borderRadius: '1rem',
          backdropFilter: 'blur(12px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
          boxShadow: 'none',
          overflow: 'hidden',
          zIndex: 50,
        }}
      >
        {/* ── Header with tabs ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.625rem 0.375rem 0.5rem',
            borderBottom: `1px solid ${glassBorder}`,
            flexShrink: 0,
          }}
        >
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: '0.2rem', background: inputBg, borderRadius: '9999px', padding: '0.15rem' }}>
            <button
              onClick={() => setActiveTab('ask')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.25rem 0.625rem', fontSize: '0.6875rem', fontWeight: activeTab === 'ask' ? 650 : 450,
                borderRadius: '9999px', border: 'none', cursor: 'pointer',
                background: activeTab === 'ask' ? (isDark ? 'rgba(196,149,106,0.15)' : 'rgba(196,149,106,0.12)') : 'transparent',
                color: activeTab === 'ask' ? '#C4956A' : subtleText,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <Sparkles style={{ width: 11, height: 11 }} />
              Ask AI
            </button>
            <button
              onClick={() => setActiveTab('learn')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.25rem 0.625rem', fontSize: '0.6875rem', fontWeight: activeTab === 'learn' ? 650 : 450,
                borderRadius: '9999px', border: 'none', cursor: 'pointer',
                background: activeTab === 'learn' ? (isDark ? 'rgba(196,149,106,0.15)' : 'rgba(196,149,106,0.12)') : 'transparent',
                color: activeTab === 'learn' ? '#C4956A' : subtleText,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <Brain style={{ width: 11, height: 11 }} />
              Learn
              {learnIsRunning && (
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34D399', animation: 'pulse 1.5s ease-in-out infinite' }} />
              )}
            </button>
          </div>

          <motion.button
            onClick={handleClose}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, borderRadius: '50%',
              background: 'transparent', border: 'none', cursor: 'pointer', color: subtleText,
            }}
            aria-label="Close AI panel"
          >
            <X style={{ width: 13, height: 13 }} />
          </motion.button>
        </div>

        {/* ═══ ASK AI TAB ═══ */}
        {activeTab === 'ask' && (
          <>
            {/* Quick actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', padding: '0.5rem 0.625rem 0.375rem', flexShrink: 0 }}>
              {QUICK_ACTIONS.map((action) => {
                const ActionIcon = action.icon;
                const disabled = isGenerating || (action.requiresBlock && !activeBlockId);
                return (
                  <motion.button
                    key={action.id}
                    onClick={() => handleQuickAction(action)}
                    disabled={disabled}
                    whileTap={disabled ? undefined : { scale: 0.92 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      padding: '0.2rem 0.5rem', fontSize: '0.625rem', fontWeight: 500,
                      letterSpacing: '-0.005em',
                      color: disabled ? subtleText : bodyText,
                      background: inputBg, border: `1px solid ${inputBorder}`,
                      borderRadius: '9999px',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.45 : 1, whiteSpace: 'nowrap',
                      transition: 'background 0.15s, opacity 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = hoverBg; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = inputBg; }}
                    title={action.requiresBlock && !activeBlockId ? 'Select a block first' : action.label}
                  >
                    <ActionIcon style={{ width: 10, height: 10, flexShrink: 0 }} />
                    {action.label}
                  </motion.button>
                );
              })}
            </div>

            {/* Response area */}
            <AnimatePresence>
              {(isGenerating || hasResponse) && (
                <motion.div
                  variants={responseVariants}
                  initial="initial" animate="animate" exit="exit"
                  style={{ flexShrink: 0, overflow: 'hidden', transformOrigin: 'top', transform: 'translateZ(0)' }}
                >
                  <div ref={responseRef} style={{
                    maxHeight: 100, overflowY: 'auto', padding: '0.375rem 0.75rem',
                    fontSize: '0.6875rem', lineHeight: 1.55, color: bodyText, scrollbarWidth: 'thin',
                    scrollbarColor: isDark ? 'rgba(244,189,111,0.15) transparent' : 'rgba(0,0,0,0.1) transparent',
                  }}>
                    {responseText || ''}
                    {isGenerating && (
                      <span className="animate-blink" style={{
                        display: 'inline-block', width: 6, height: 13, marginLeft: 2,
                        background: '#C4956A', borderRadius: 1.5, verticalAlign: 'text-bottom',
                      }} />
                    )}
                  </div>
                  {hasResponse && !isGenerating && (
                    <div style={{ display: 'flex', gap: '0.3rem', padding: '0.25rem 0.625rem 0.375rem', borderTop: `1px solid ${glassBorder}` }}>
                      <ActionButton onClick={handleInsert} isDark={isDark} inputBg={inputBg} inputBorder={inputBorder} hoverBg={hoverBg} bodyText={bodyText}>
                        <CornerDownLeft style={{ width: 9, height: 9 }} />Insert
                      </ActionButton>
                      {activeBlockId && (
                        <ActionButton onClick={handleReplace} isDark={isDark} inputBg={inputBg} inputBorder={inputBorder} hoverBg={hoverBg} bodyText={bodyText}>
                          <RefreshCw style={{ width: 9, height: 9 }} />Replace
                        </ActionButton>
                      )}
                      <ActionButton onClick={handleCopy} isDark={isDark} inputBg={inputBg} inputBorder={inputBorder} hoverBg={hoverBg} bodyText={bodyText}>
                        {copied ? <Check style={{ width: 9, height: 9, color: '#34D399' }} /> : <Copy style={{ width: 9, height: 9 }} />}
                        {copied ? 'Copied' : 'Copy'}
                      </ActionButton>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.5rem 0.5rem', marginTop: 'auto', flexShrink: 0 }}>
              <input
                ref={inputRef} type="text" value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleInputKeyDown}
                disabled={isGenerating}
                placeholder="Ask about this note..."
                style={{
                  flex: 1, height: 28, padding: '0 0.5rem', fontSize: '0.6875rem',
                  color: bodyText, background: inputBg, border: `1px solid ${inputBorder}`,
                  borderRadius: '0.5rem', outline: 'none',
                  opacity: isGenerating ? 0.5 : 1, transition: 'border-color 0.15s, opacity 0.15s',
                }}
                onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(196,149,106,0.4)'; }}
                onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = inputBorder; }}
              />
              {isGenerating ? (
                <motion.button onClick={handleStop} whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(224,120,80,0.15)', border: '1px solid rgba(224,120,80,0.25)',
                    cursor: 'pointer', color: '#E07850', flexShrink: 0,
                  }} aria-label="Stop generation">
                  <Square style={{ width: 11, height: 11, fill: 'currentColor' }} />
                </motion.button>
              ) : (
                <motion.button onClick={handleSend} disabled={!inputValue.trim()}
                  whileTap={inputValue.trim() ? { scale: 0.92 } : undefined}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: '50%',
                    background: inputValue.trim() ? 'rgba(196,149,106,0.15)' : inputBg,
                    border: `1px solid ${inputValue.trim() ? 'rgba(196,149,106,0.3)' : inputBorder}`,
                    cursor: inputValue.trim() ? 'pointer' : 'default',
                    color: inputValue.trim() ? '#C4956A' : subtleText,
                    flexShrink: 0, opacity: inputValue.trim() ? 1 : 0.5,
                    transition: 'background 0.15s, border-color 0.15s, opacity 0.15s',
                  }} aria-label="Send prompt">
                  <ArrowUp style={{ width: 13, height: 13 }} />
                </motion.button>
              )}
            </div>
            <div style={{ textAlign: 'right', padding: '0 0.625rem 0.375rem', fontSize: '0.5625rem', color: subtleText, letterSpacing: '-0.005em', flexShrink: 0 }}>
              {isGenerating ? 'Esc to stop' : 'Cmd+Enter to send  ·  Esc to close'}
            </div>
          </>
        )}

        {/* ═══ AI LEARN TAB ═══ */}
        {activeTab === 'learn' && (
          <>
            {(learnIsActive || learnIsCompleted) ? (
              <>
                {/* Progress bar */}
                <div style={{ height: 2, width: '100%', background: isDark ? 'rgba(79,69,57,0.3)' : 'rgba(0,0,0,0.04)', flexShrink: 0 }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${learnProgress * 100}%` }}
                    transition={{ duration: 0.4, ease: CUPERTINO_EASE }}
                    style={{ height: '100%', background: learnIsCompleted ? '#34D399' : 'linear-gradient(90deg, #C4956A, #D4B896)', borderRadius: 1 }}
                  />
                </div>

                {/* Status header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.625rem 0.25rem 0.75rem', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      padding: '0.1rem 0.4rem', fontSize: '0.5625rem', fontWeight: 500,
                      borderRadius: '0.5rem',
                      background: learnIsRunning ? 'rgba(52,211,153,0.12)' : learnIsPaused ? 'rgba(251,191,36,0.12)' : 'rgba(52,211,153,0.12)',
                      color: learnIsRunning ? '#34D399' : learnIsPaused ? '#FBBF24' : '#34D399',
                      border: `1px solid ${learnIsRunning ? 'rgba(52,211,153,0.2)' : learnIsPaused ? 'rgba(251,191,36,0.2)' : 'rgba(52,211,153,0.2)'}`,
                    }}>
                      {learnIsRunning && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34D399', animation: 'pulse 1.5s ease-in-out infinite' }} />}
                      {learnIsRunning ? 'Running' : learnIsPaused ? 'Paused' : 'Done'}
                      {learnIsCompleted && <Check style={{ width: 8, height: 8 }} />}
                    </span>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 500, color: subtleText }}>
                      Pass {learnCurrentPass}/{learnTotalPasses}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {(learnIsRunning || learnIsPaused) && (
                      <motion.button onClick={learnIsPaused ? resumeLearningSession : pauseLearningSession}
                        whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '0.375rem', background: 'transparent', border: 'none', cursor: 'pointer', color: subtleText }}
                        aria-label={learnIsPaused ? 'Resume' : 'Pause'}>
                        {learnIsPaused ? <Play style={{ width: 12, height: 12 }} /> : <Pause style={{ width: 12, height: 12 }} />}
                      </motion.button>
                    )}
                    <motion.button onClick={stopLearningSession}
                      whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '0.375rem', background: 'transparent', border: 'none', cursor: 'pointer', color: subtleText }}
                      aria-label="Stop learning">
                      <X style={{ width: 13, height: 13 }} />
                    </motion.button>
                  </div>
                </div>

                {/* Steps */}
                <div style={{ padding: '0.375rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: 180, overflowY: 'auto', scrollbarWidth: 'thin' }}>
                  {learnSteps.map((step) => (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0' }}>
                      <LearnStepIcon status={step.status} isDark={isDark} />
                      <span style={{
                        flex: 1, fontSize: '0.6875rem', fontWeight: step.status === 'running' ? 500 : 400,
                        color: step.status === 'completed' ? bodyText : step.status === 'running' ? '#D4B896' : step.status === 'error' ? '#F87171' : subtleText,
                      }}>
                        {step.title}
                      </span>
                      {step.status === 'completed' && step.insightCount != null && step.insightCount > 0 && (
                        <span style={{ fontSize: '0.5625rem', fontWeight: 500, padding: '0.05rem 0.35rem', borderRadius: '0.375rem', background: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.15)', flexShrink: 0 }}>
                          {step.insightCount}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Stream preview */}
                {learnIsRunning && learningStreamText && (
                  <div style={{ borderTop: `1px solid ${glassBorder}`, flexShrink: 0 }}>
                    <div ref={learnStreamRef} style={{
                      maxHeight: 48, overflowY: 'auto', padding: '0.375rem 0.75rem',
                      fontSize: '0.625rem', lineHeight: 1.5, fontFamily: 'var(--font-mono)',
                      color: isDark ? 'rgba(237,224,212,0.35)' : 'rgba(0,0,0,0.3)',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word', scrollbarWidth: 'none',
                    }}>
                      {learningStreamText}
                    </div>
                  </div>
                )}

                {/* Completed summary */}
                {learnIsCompleted && (
                  <div style={{ borderTop: `1px solid ${glassBorder}`, padding: '0.5rem 0.75rem', flexShrink: 0 }}>
                    <p style={{ fontSize: '0.6875rem', color: bodyText, marginBottom: '0.5rem', lineHeight: 1.5 }}>
                      <span style={{ color: '#34D399', fontWeight: 600 }}>{learnInsights}</span> insights,{' '}
                      <span style={{ color: '#D4B896', fontWeight: 600 }}>{learnPagesCreated}</span> pages,{' '}
                      <span style={{ color: '#E07850', fontWeight: 600 }}>{learnBlocksAdded}</span> blocks
                    </p>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <motion.button onClick={() => startLearningSession(learnDepth, DEPTH_LABELS[learnDepth].passes)}
                        whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                        style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.35rem 0.625rem', fontSize: '0.6875rem', fontWeight: 500, color: '#D4B896', background: 'rgba(196,149,106,0.1)', border: '1px solid rgba(196,149,106,0.2)', borderRadius: '9999px', cursor: 'pointer' }}>
                        <RotateCcw style={{ width: 11, height: 11 }} />Run Again
                      </motion.button>
                      <motion.button onClick={stopLearningSession}
                        whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                        style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.35rem 0.625rem', fontSize: '0.6875rem', fontWeight: 500, color: bodyText, background: inputBg, border: `1px solid ${glassBorder}`, borderRadius: '9999px', cursor: 'pointer' }}>
                        Close
                      </motion.button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Idle learn state — depth selector + start */
              <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <p style={{ fontSize: '0.625rem', lineHeight: 1.5, color: subtleText, margin: 0 }}>
                  AI will recursively analyze and deepen your notes
                </p>

                {/* Depth selector */}
                <div style={{ display: 'flex', gap: '0.3rem', background: inputBg, borderRadius: '9999px', padding: '0.2rem' }}>
                  {(['shallow', 'moderate', 'deep'] as LearningDepth[]).map((d) => (
                    <motion.button key={d} onClick={() => setLearnDepth(d)}
                      whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                      style={{
                        flex: 1, padding: '0.3rem 0', fontSize: '0.625rem',
                        fontWeight: learnDepth === d ? 600 : 400,
                        color: learnDepth === d ? '#D4B896' : subtleText,
                        background: learnDepth === d ? (isDark ? 'rgba(196,149,106,0.12)' : 'rgba(196,149,106,0.1)') : 'transparent',
                        border: learnDepth === d ? '1px solid rgba(196,149,106,0.2)' : '1px solid transparent',
                        borderRadius: '9999px', cursor: 'pointer',
                        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                      }}>
                      {DEPTH_LABELS[d].label}
                    </motion.button>
                  ))}
                </div>

                {/* Auto-learn toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 450, color: bodyText }}>Auto-learn</span>
                  <motion.button onClick={() => setLearningAutoRun(!learningAutoRun)}
                    whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                    style={{
                      width: 32, height: 18, borderRadius: 9, padding: 2,
                      background: learningAutoRun ? 'rgba(196,149,106,0.5)' : (isDark ? 'rgba(244,189,111,0.1)' : 'rgba(0,0,0,0.1)'),
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.2s',
                    }} role="switch" aria-checked={learningAutoRun}>
                    <motion.span animate={{ x: learningAutoRun ? 14 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                      style={{ width: 14, height: 14, borderRadius: 7, background: learningAutoRun ? '#D4B896' : (isDark ? 'rgba(237,224,212,0.4)' : 'rgba(0,0,0,0.3)') }} />
                  </motion.button>
                </div>

                {/* Start button */}
                <motion.button onClick={() => { startLearningSession(learnDepth, DEPTH_LABELS[learnDepth].passes); }}
                  whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                    padding: '0.5rem', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '-0.01em',
                    color: '#fff', background: 'linear-gradient(135deg, #C4956A, #D4B896)', border: 'none',
                    borderRadius: '9999px', cursor: 'pointer',
                  }}>
                  <Brain style={{ width: 13, height: 13 }} />
                  Start Learning
                </motion.button>
              </div>
            )}
          </>
        )}

        {/* Keyframes */}
        <style>{`
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LearnStepIcon — step indicator for learning protocol
   ═══════════════════════════════════════════════════════════════════ */

function LearnStepIcon({ status, isDark }: { status: StepStatus; isDark: boolean }) {
  const size = 14;
  if (status === 'completed') return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Check style={{ width: 8, height: 8, color: '#34D399' }} />
    </div>
  );
  if (status === 'running') return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(196,149,106,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }}>
      <CircleDot style={{ width: 8, height: 8, color: '#D4B896' }} />
    </div>
  );
  if (status === 'error') return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(248,113,113,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <AlertCircle style={{ width: 8, height: 8, color: '#F87171' }} />
    </div>
  );
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: isDark ? 'rgba(244,189,111,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isDark ? 'rgba(79,69,57,0.5)' : 'rgba(0,0,0,0.06)'}`, flexShrink: 0 }} />
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ActionButton — tiny pill button for response actions
   ═══════════════════════════════════════════════════════════════════ */

function ActionButton({
  children,
  onClick,
  isDark,
  inputBg,
  inputBorder,
  hoverBg,
  bodyText,
}: {
  children: React.ReactNode;
  onClick: () => void;
  isDark: boolean;
  inputBg: string;
  inputBorder: string;
  hoverBg: string;
  bodyText: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.2rem',
        padding: '0.175rem 0.4rem',
        fontSize: '0.59375rem',
        fontWeight: 500,
        color: bodyText,
        background: inputBg,
        border: `1px solid ${inputBorder}`,
        borderRadius: '9999px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = hoverBg;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = inputBg;
      }}
    >
      {children}
    </motion.button>
  );
}
