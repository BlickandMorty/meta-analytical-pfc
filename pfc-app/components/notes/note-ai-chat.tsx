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
} from 'lucide-react';
import { usePFCStore } from '@/lib/store/use-pfc-store';

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

  const inputRef = useRef<HTMLInputElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  // ── Store state ──
  const noteAI = usePFCStore((s) => s.noteAI);
  const startNoteAIGeneration = usePFCStore((s) => s.startNoteAIGeneration);
  const stopNoteAIGeneration = usePFCStore((s) => s.stopNoteAIGeneration);
  const createBlock = usePFCStore((s) => s.createBlock);
  const updateBlockContent = usePFCStore((s) => s.updateBlockContent);

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

  // ── Collapsed pill ──

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
            position: 'absolute',
            bottom: 16,
            right: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.4rem 0.875rem',
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
            boxShadow: 'none',
            zIndex: 50,
          }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        >
          <Sparkles style={{ width: 14, height: 14 }} />
          Ask AI
        </motion.button>
      </AnimatePresence>
    );
  }

  // ── Expanded panel ──

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="panel"
        variants={panelVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          width: PANEL_WIDTH,
          maxHeight: hasResponse || isGenerating ? PANEL_HEIGHT + 120 : PANEL_HEIGHT,
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
          transition: 'max-height 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
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
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: bodyText,
            }}
          >
            <Sparkles
              style={{ width: 13, height: 13, color: '#C4956A' }}
            />
            Notes AI
          </div>
          <motion.button
            onClick={handleClose}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: subtleText,
            }}
            aria-label="Close AI panel"
          >
            <X style={{ width: 13, height: 13 }} />
          </motion.button>
        </div>

        {/* ── Quick actions ── */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.3rem',
            padding: '0.5rem 0.625rem 0.375rem',
            flexShrink: 0,
          }}
        >
          {QUICK_ACTIONS.map((action) => {
            const ActionIcon = action.icon;
            const disabled =
              isGenerating || (action.requiresBlock && !activeBlockId);

            return (
              <motion.button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                disabled={disabled}
                whileTap={disabled ? undefined : { scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.625rem',
                  fontWeight: 500,
                  letterSpacing: '-0.005em',
                  color: disabled ? subtleText : bodyText,
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  borderRadius: '9999px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.45 : 1,
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s, opacity 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!disabled) {
                    (e.currentTarget as HTMLElement).style.background =
                      hoverBg;
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    inputBg;
                }}
                title={
                  action.requiresBlock && !activeBlockId
                    ? 'Select a block first'
                    : action.label
                }
              >
                <ActionIcon style={{ width: 10, height: 10, flexShrink: 0 }} />
                {action.label}
              </motion.button>
            );
          })}
        </div>

        {/* ── Response / Streaming area ── */}
        <AnimatePresence>
          {(isGenerating || hasResponse) && (
            <motion.div
              variants={responseVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ flexShrink: 0, overflow: 'hidden', transformOrigin: 'top', transform: 'translateZ(0)' }}
            >
              <div
                ref={responseRef}
                style={{
                  maxHeight: 100,
                  overflowY: 'auto',
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.6875rem',
                  lineHeight: 1.55,
                  color: bodyText,
                  scrollbarWidth: 'thin',
                  scrollbarColor: isDark
                    ? 'rgba(244,189,111,0.15) transparent'
                    : 'rgba(0,0,0,0.1) transparent',
                }}
              >
                {responseText || (isGenerating ? '' : '')}
                {isGenerating && (
                  <span
                    className="animate-blink"
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 13,
                      marginLeft: 2,
                      background: '#C4956A',
                      borderRadius: 1.5,
                      verticalAlign: 'text-bottom',
                    }}
                  />
                )}
              </div>

              {/* ── Response action buttons ── */}
              {hasResponse && !isGenerating && (
                <div
                  style={{
                    display: 'flex',
                    gap: '0.3rem',
                    padding: '0.25rem 0.625rem 0.375rem',
                    borderTop: `1px solid ${glassBorder}`,
                  }}
                >
                  <ActionButton
                    onClick={handleInsert}
                    isDark={isDark}
                    inputBg={inputBg}
                    inputBorder={inputBorder}
                    hoverBg={hoverBg}
                    bodyText={bodyText}
                  >
                    <CornerDownLeft style={{ width: 9, height: 9 }} />
                    Insert
                  </ActionButton>

                  {activeBlockId && (
                    <ActionButton
                      onClick={handleReplace}
                      isDark={isDark}
                      inputBg={inputBg}
                      inputBorder={inputBorder}
                      hoverBg={hoverBg}
                      bodyText={bodyText}
                    >
                      <RefreshCw style={{ width: 9, height: 9 }} />
                      Replace
                    </ActionButton>
                  )}

                  <ActionButton
                    onClick={handleCopy}
                    isDark={isDark}
                    inputBg={inputBg}
                    inputBorder={inputBorder}
                    hoverBg={hoverBg}
                    bodyText={bodyText}
                  >
                    {copied ? (
                      <Check style={{ width: 9, height: 9, color: '#34D399' }} />
                    ) : (
                      <Copy style={{ width: 9, height: 9 }} />
                    )}
                    {copied ? 'Copied' : 'Copy'}
                  </ActionButton>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Input row ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.375rem 0.5rem 0.5rem',
            marginTop: 'auto',
            flexShrink: 0,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={isGenerating}
            placeholder="Ask about this note..."
            style={{
              flex: 1,
              height: 28,
              padding: '0 0.5rem',
              fontSize: '0.6875rem',
              color: bodyText,
              background: inputBg,
              border: `1px solid ${inputBorder}`,
              borderRadius: '9999px',
              outline: 'none',
              opacity: isGenerating ? 0.5 : 1,
              transition: 'border-color 0.15s, opacity 0.15s',
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124, 108, 240, 0.4)';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = inputBorder;
            }}
          />

          {/* Send / Stop button */}
          {isGenerating ? (
            <motion.button
              onClick={handleStop}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(224, 120, 80, 0.15)',
                border: `1px solid rgba(224, 120, 80, 0.25)`,
                cursor: 'pointer',
                color: '#E07850',
                flexShrink: 0,
              }}
              aria-label="Stop generation"
            >
              <Square style={{ width: 11, height: 11, fill: 'currentColor' }} />
            </motion.button>
          ) : (
            <motion.button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              whileTap={inputValue.trim() ? { scale: 0.92 } : undefined}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: inputValue.trim()
                  ? 'rgba(124, 108, 240, 0.15)'
                  : inputBg,
                border: `1px solid ${
                  inputValue.trim()
                    ? 'rgba(124, 108, 240, 0.3)'
                    : inputBorder
                }`,
                cursor: inputValue.trim() ? 'pointer' : 'default',
                color: inputValue.trim() ? '#C4956A' : subtleText,
                flexShrink: 0,
                opacity: inputValue.trim() ? 1 : 0.5,
                transition: 'background 0.15s, border-color 0.15s, opacity 0.15s',
              }}
              aria-label="Send prompt"
            >
              <ArrowUp style={{ width: 13, height: 13 }} />
            </motion.button>
          )}
        </div>

        {/* ── Keyboard hint ── */}
        <div
          style={{
            textAlign: 'right',
            padding: '0 0.625rem 0.375rem',
            fontSize: '0.5625rem',
            color: subtleText,
            letterSpacing: '-0.005em',
            flexShrink: 0,
          }}
        >
          {isGenerating ? 'Esc to stop' : 'Cmd+Enter to send  ·  Esc to close'}
        </div>
      </motion.div>

    </AnimatePresence>
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
