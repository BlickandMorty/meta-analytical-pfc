'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useChatStream } from '@/hooks/use-chat-stream';
import { Messages } from './messages';
import { MultimodalInput } from './multimodal-input';
import { SynthesisCard } from './synthesis-card';
import { PixelSun } from './pixel-sun';
import { PixelMoon } from './pixel-moon';
import { FeatureButtons } from './feature-buttons';
import { RecentChats, type ChatEntry, formatRelativeTime, parseTimestamp } from './recent-chats';
import { ResearchModeBar } from './research-mode-bar';
import { ThinkingControls } from './thinking-controls';
import { ErrorBoundary } from './error-boundary';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsDark } from '@/hooks/use-is-dark';
import { getInferenceModeFeatures } from '@/lib/research/types';
import { CloudIcon, MonitorIcon, ArrowLeftIcon, MessageSquareIcon, SearchIcon } from 'lucide-react';
import type { ChatMode } from '@/lib/store/use-pfc-store';

// ═══════════════════════════════════════════════════════════════════
// Dynamic imports — only loaded when the tier enables them
// ═══════════════════════════════════════════════════════════════════

const LiveControls = dynamic(() => import('./live-controls').then((m) => ({ default: m.LiveControls })), { ssr: false });
const ConceptHierarchyPanel = dynamic(() => import('./concept-hierarchy-panel').then((m) => ({ default: m.ConceptHierarchyPanel })), { ssr: false });
const ThoughtVisualizer = dynamic(() => import('./thought-visualizer').then((m) => ({ default: m.ThoughtVisualizer })), { ssr: false });
const PortalSidebar = dynamic(() => import('./portal-sidebar').then((m) => ({ default: m.PortalSidebar })), { ssr: false });

/* Harmonoid-inspired spring configs */
const ENTER_SPRING = { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.6 };

// ═══════════════════════════════════════════════════════════════════
// ModeToggle — 3-mode toggle pills (Measurement / Research / Plain Chat)
// ═══════════════════════════════════════════════════════════════════

function ModeToggle({ isDark }: { isDark: boolean }) {
  const chatMode = usePFCStore((s) => s.chatMode);
  const setChatMode = usePFCStore((s) => s.setChatMode);
  const [hovered, setHovered] = useState<string | null>(null);

  const modes: { key: ChatMode; label: string }[] = [
    { key: 'measurement', label: 'Research Suite' },
    { key: 'research', label: 'Deep Analysis' },
    { key: 'plain', label: 'Plain Chat' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.15, duration: 0.3 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.375rem',
      }}
    >
      {modes.map((m) => {
        const isActive = chatMode === m.key;
        const isHovered = hovered === m.key && !isActive;
        return (
          <motion.button
            key={m.key}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25, mass: 0.5 }}
            onClick={() => setChatMode(m.key)}
            onMouseEnter={() => setHovered(m.key)}
            onMouseLeave={() => setHovered(null)}
            style={{
              padding: '0.3125rem 0.75rem',
              borderRadius: 'var(--shape-full)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--type-label-sm)',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.02em',
              transition: 'color 0.15s cubic-bezier(0.32,0.72,0,1), background 0.2s cubic-bezier(0.32,0.72,0,1), box-shadow 0.2s cubic-bezier(0.32,0.72,0,1)',
              color: isActive
                ? (isDark ? '#1A1816' : '#FFFFFF')
                : isHovered
                  ? (isDark ? 'rgba(232,228,222,0.9)' : 'rgba(43,42,39,0.75)')
                  : (isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.35)'),
              background: isActive
                ? 'var(--pfc-accent)'
                : isHovered
                  ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(160,120,80,0.1)')
                  : 'transparent',
              boxShadow: isActive
                ? '0 4px 24px -4px rgba(var(--pfc-accent-rgb), 0.25), 0 2px 8px -2px rgba(var(--pfc-accent-rgb), 0.15)'
                : 'none',
            }}
          >
            {m.label}
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Greeting Subtitle — casual rotating prompts with typewriter
// ═══════════════════════════════════════════════════════════════════

// Only 3 colors: ashy red, warm mocha, light blue
const ASHY_RED = '#B85C5C';
const WARM_ORANGE = '#C4956A';
const LIGHT_BLUE = '#6B8EBF';

// Landing page greetings — randomly picked each visit
const LANDING_GREETINGS = [
  'Greetings, Researcher...',
  'Greetings, Nerd!',
  'Greetings, Blerd!',
  'Hey there...You!',
  'Greetings, Scholar...',
  'Greetings, Thinker...',
  'Sup, Brainiac!',
  'Hey there, Curious One...',
];

interface ColoredSpan {
  text: string;
  color: string;
}

type PromptDef = {
  plain: string;
  colored: ColoredSpan[];
};

const PROMPT_DEFS: PromptDef[] = [
  {
    plain: 'print("what\'s on your mind?")',
    colored: [
      { text: 'print', color: LIGHT_BLUE },
      { text: '(', color: WARM_ORANGE },
      { text: '"what\'s on your mind?"', color: ASHY_RED },
      { text: ')', color: WARM_ORANGE },
    ],
  },
  {
    plain: 'echo "whatcha waitin forrrrr?"',
    colored: [
      { text: 'echo', color: LIGHT_BLUE },
      { text: ' ', color: WARM_ORANGE },
      { text: '"whatcha waitin forrrrr?"', color: ASHY_RED },
    ],
  },
  {
    plain: 'console.log("soooooo... you gonna type something?")',
    colored: [
      { text: 'console', color: WARM_ORANGE },
      { text: '.', color: WARM_ORANGE },
      { text: 'log', color: LIGHT_BLUE },
      { text: '(', color: WARM_ORANGE },
      { text: '"soooooo... you gonna type something?"', color: ASHY_RED },
      { text: ')', color: WARM_ORANGE },
    ],
  },
  {
    plain: 'puts "hmmmm any interesting queries?"',
    colored: [
      { text: 'puts', color: LIGHT_BLUE },
      { text: ' ', color: WARM_ORANGE },
      { text: '"hmmmm any interesting queries?"', color: ASHY_RED },
    ],
  },
  {
    plain: 'print("whats t?")',
    colored: [
      { text: 'print', color: LIGHT_BLUE },
      { text: '(', color: WARM_ORANGE },
      { text: '"whats t?"', color: ASHY_RED },
      { text: ')', color: WARM_ORANGE },
    ],
  },
  {
    plain: 'log("ask me anything, literally anything")',
    colored: [
      { text: 'log', color: LIGHT_BLUE },
      { text: '(', color: WARM_ORANGE },
      { text: '"ask me anything, literally anything"', color: ASHY_RED },
      { text: ')', color: WARM_ORANGE },
    ],
  },
  {
    plain: 'echo "got a burning question?"',
    colored: [
      { text: 'echo', color: LIGHT_BLUE },
      { text: ' ', color: WARM_ORANGE },
      { text: '"got a burning question?"', color: ASHY_RED },
    ],
  },
  {
    plain: 'print("i\'m ready when you are")',
    colored: [
      { text: 'print', color: LIGHT_BLUE },
      { text: '(', color: WARM_ORANGE },
      { text: '"i\'m ready when you are"', color: ASHY_RED },
      { text: ')', color: WARM_ORANGE },
    ],
  },
  {
    plain: 'console.log("type type type type type...")',
    colored: [
      { text: 'console', color: WARM_ORANGE },
      { text: '.', color: WARM_ORANGE },
      { text: 'log', color: LIGHT_BLUE },
      { text: '(', color: WARM_ORANGE },
      { text: '"type type type type type..."', color: ASHY_RED },
      { text: ')', color: WARM_ORANGE },
    ],
  },
  {
    plain: 'puts "hellloooo? anyone there?"',
    colored: [
      { text: 'puts', color: LIGHT_BLUE },
      { text: ' ', color: WARM_ORANGE },
      { text: '"hellloooo? anyone there?"', color: ASHY_RED },
    ],
  },
  {
    plain: 'echo "just vibing... waiting on you"',
    colored: [
      { text: 'echo', color: LIGHT_BLUE },
      { text: ' ', color: WARM_ORANGE },
      { text: '"just vibing... waiting on you"', color: ASHY_RED },
    ],
  },
  {
    plain: 'print("go on... don\'t be shy")',
    colored: [
      { text: 'print', color: LIGHT_BLUE },
      { text: '(', color: WARM_ORANGE },
      { text: '"go on... don\'t be shy"', color: ASHY_RED },
      { text: ')', color: WARM_ORANGE },
    ],
  },
  {
    plain: 'log("what are we researching today?")',
    colored: [
      { text: 'log', color: LIGHT_BLUE },
      { text: '(', color: WARM_ORANGE },
      { text: '"what are we researching today?"', color: ASHY_RED },
      { text: ')', color: WARM_ORANGE },
    ],
  },
  {
    plain: 'fmt.print("curiosity killed the cat. but not here.")',
    colored: [
      { text: 'fmt', color: WARM_ORANGE },
      { text: '.', color: WARM_ORANGE },
      { text: 'print', color: LIGHT_BLUE },
      { text: '(', color: WARM_ORANGE },
      { text: '"curiosity killed the cat. but not here."', color: ASHY_RED },
      { text: ')', color: WARM_ORANGE },
    ],
  },
  {
    plain: 'puts "the search bar is right there ↑"',
    colored: [
      { text: 'puts', color: LIGHT_BLUE },
      { text: ' ', color: WARM_ORANGE },
      { text: '"the search bar is right there ↑"', color: ASHY_RED },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// GreetingSubtitle — syntax-styled typewriter subtitle with blinking cursor
// ═══════════════════════════════════════════════════════════════════

function GreetingSubtitle({ isDark, isOled, dismissing }: { isDark: boolean; isOled?: boolean; dismissing?: boolean }) {
  const [displayText, setDisplayText] = useState('');
  const [cursorOn, setCursorOn] = useState(true);
  const [variationIdx, setVariationIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const stateRef = useRef({
    variation: 0,
    charIdx: 0,
    phase: 'typing' as 'typing' | 'pausing' | 'deleting' | 'dismissed',
  });
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const id = setInterval(() => setCursorOn((v) => !v), 530);
    return () => clearInterval(id);
  }, []);

  // When dismissing=true, interrupt the normal cycle and backspace away
  useEffect(() => {
    if (!dismissing) {
      // If we were dismissed and now coming back, reset to typing
      if (dismissed) {
        setDismissed(false);
        stateRef.current.phase = 'typing';
        stateRef.current.charIdx = 0;
        stateRef.current.variation = (stateRef.current.variation + 1) % PROMPT_DEFS.length;
      }
      return;
    }

    // Start backspace animation from current position
    stateRef.current.phase = 'dismissed';

    function backspaceTick() {
      const s = stateRef.current;
      if (s.charIdx > 0) {
        s.charIdx--;
        const target = PROMPT_DEFS[s.variation].plain;
        setDisplayText(target.slice(0, s.charIdx));
        dismissTimerRef.current = setTimeout(backspaceTick, 20); // Fast backspace
      } else {
        setDisplayText('');
        setDismissed(true);
      }
    }

    backspaceTick();
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissing]);

  useEffect(() => {
    if (dismissing || dismissed) return; // Don't run normal cycle while dismissing

    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      const s = stateRef.current;
      if (s.phase === 'dismissed') return; // Guard against stale tick

      const target = PROMPT_DEFS[s.variation].plain;

      if (s.phase === 'typing') {
        if (s.charIdx < target.length) {
          s.charIdx++;
          setDisplayText(target.slice(0, s.charIdx));
          setVariationIdx(s.variation);
          // Slower typing: 75ms first prompt, 60ms rest
          timer = setTimeout(tick, s.variation === 0 ? 75 : 60);
        } else {
          s.phase = 'pausing';
          // Longer pause before deleting
          timer = setTimeout(tick, s.variation === 0 ? 3000 : 3800);
        }
      } else if (s.phase === 'pausing') {
        s.phase = 'deleting';
        tick();
      } else {
        if (s.charIdx > 0) {
          s.charIdx--;
          setDisplayText(target.slice(0, s.charIdx));
          // Slower delete
          timer = setTimeout(tick, 25);
        } else {
          s.variation = (s.variation + 1) % PROMPT_DEFS.length;
          s.phase = 'typing';
          setVariationIdx(s.variation);
          timer = setTimeout(tick, 600);
        }
      }
    }

    timer = setTimeout(tick, 200);
    return () => clearTimeout(timer);
  }, [dismissing, dismissed]);

  const def = PROMPT_DEFS[variationIdx];

  // Build colored spans for current displayText length
  const coloredOutput = useMemo(() => {
    let remaining = displayText.length;
    const spans: ColoredSpan[] = [];
    for (const seg of def.colored) {
      if (remaining <= 0) break;
      const chars = Math.min(remaining, seg.text.length);
      spans.push({ text: seg.text.slice(0, chars), color: seg.color });
      remaining -= chars;
    }
    return spans;
  }, [displayText, def]);

  // Opacity multiplier: syntax colors show through but muted for placeholder feel
  const opacityMul = isOled ? 0.6 : isDark ? 0.5 : 0.55;

  // Cursor color — matches the general text tone
  const cursorColor = isOled
    ? 'rgba(160,160,160,0.5)'
    : isDark
      ? 'rgba(180,160,140,0.4)'
      : 'rgba(0,0,0,0.25)';

  return (
    <span
      style={{
        fontFamily: 'ui-monospace, "SF Mono", "Fira Code", "Cascadia Code", monospace',
        fontSize: '0.8125rem',
        letterSpacing: '0.01em',
        lineHeight: 1.6,
        fontWeight: 400,
        whiteSpace: 'nowrap',
        minHeight: '1.5rem',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {coloredOutput.map((span, i) => (
        <span key={i} style={{ color: span.color, opacity: opacityMul }}>{span.text}</span>
      ))}
      <span
        style={{
          display: 'inline-block',
          width: '1.5px',
          height: '0.875rem',
          backgroundColor: cursorColor,
          marginLeft: '1px',
          opacity: cursorOn ? 1 : 0,
          transition: 'opacity 0.1s',
        }}
      />
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AllChatsView — fullscreen searchable list replacing greeting
// ═══════════════════════════════════════════════════════════════════

function AllChatsView({ chats, isDark, isOled, onBack }: { chats: ChatEntry[]; isDark: boolean; isOled?: boolean; onBack: () => void }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return chats;
    const q = search.toLowerCase();
    return chats.filter((c) => c.title.toLowerCase().includes(q));
  }, [chats, search]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={ENTER_SPRING}
      style={{
        width: '100%',
        maxWidth: '38rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '2rem 0',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <motion.button
          onClick={onBack}
          whileTap={{ scale: 0.97 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            height: '2.125rem',
            padding: '0 0.75rem',
            borderRadius: '9999px',
            border: 'none',
            cursor: 'pointer',
            fontSize: 'var(--type-label-md)',
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
            color: isDark ? 'rgba(155,150,137,0.8)' : 'rgba(0,0,0,0.45)',
            background: isDark ? (isOled ? 'rgba(14,14,14,0.85)' : 'rgba(28,27,25,0.7)') : 'rgba(255,255,255,0.75)',
            transition: 'background 0.15s ease',
          }}
        >
          <ArrowLeftIcon style={{ height: '0.8125rem', width: '0.8125rem' }} />
          Back
        </motion.button>
        <span style={{
          fontSize: '1rem',
          fontWeight: 650,
          letterSpacing: '-0.02em',
          color: isDark ? 'rgba(232,228,222,0.9)' : 'rgba(43,42,39,0.8)',
          fontFamily: 'var(--font-sans)',
        }}>
          All Chats
        </span>
      </div>

      {/* Search bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.875rem',
        borderRadius: '9999px',
        background: isDark ? (isOled ? 'rgba(10,10,10,0.8)' : 'rgba(22,21,19,0.65)') : 'rgba(237,232,222,0.6)',
        backdropFilter: 'blur(12px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
        border: `1px solid ${isDark ? (isOled ? 'rgba(40,40,40,0.3)' : 'rgba(50,49,45,0.25)') : 'rgba(190,183,170,0.3)'}`,
      }}>
        <SearchIcon style={{
          height: '0.875rem',
          width: '0.875rem',
          color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)',
          flexShrink: 0,
        }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats..."
          aria-label="Search chats"
          autoFocus
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-sans)',
            color: isDark ? 'rgba(232,228,222,0.9)' : 'rgba(43,42,39,0.8)',
          }}
        />
      </div>

      {/* Chat list */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.375rem',
        maxHeight: '60vh',
        overflowY: 'auto',
      }}>
        {filtered.map((chat, idx) => {
          const isHovered = hoveredId === chat.id;
          const timeStr = formatRelativeTime(parseTimestamp(chat.updatedAt));

          return (
            <motion.button
              key={chat.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ENTER_SPRING, delay: Math.min(idx * 0.02, 0.3) }}
              onClick={() => router.push(`/chat/${chat.id}`)}
              onMouseEnter={() => setHoveredId(chat.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--shape-lg)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                minHeight: '3.25rem',
                background: isDark
                  ? (isOled
                    ? (isHovered ? 'rgba(35,35,35,0.8)' : 'rgba(14,14,14,0.8)')
                    : (isHovered ? 'rgba(45,42,38,0.6)' : 'rgba(28,27,25,0.5)'))
                  : (isHovered ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.6)'),
                border: `1px solid ${
                  isDark ? (isOled ? 'rgba(40,40,40,0.35)' : 'rgba(50,49,45,0.25)') : 'rgba(190,183,170,0.2)'
                }`,
                transition: 'background 0.15s ease',
              }}
            >
              <MessageSquareIcon style={{
                height: '1rem',
                width: '1rem',
                flexShrink: 0,
                color: isHovered ? 'var(--pfc-accent)' : (isDark ? 'rgba(155,150,137,0.45)' : 'rgba(0,0,0,0.2)'),
                transition: 'color 0.15s',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  lineHeight: 1.4,
                  color: isHovered
                    ? (isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.85)')
                    : (isDark ? 'rgba(155,150,137,0.75)' : 'rgba(0,0,0,0.5)'),
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-sans)',
                  transition: 'color 0.15s',
                }}>
                  {chat.title}
                </div>
                <div style={{
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  color: isDark ? 'rgba(155,150,137,0.35)' : 'rgba(0,0,0,0.2)',
                  fontFamily: 'var(--font-sans)',
                  marginTop: '0.1875rem',
                }}>
                  {timeStr}
                </div>
              </div>
            </motion.button>
          );
        })}
        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)', padding: '2rem 0' }}>
            No chats found
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ChatsOverlay — domino-staggered chat bubbles (replaces sidebar)
// ═══════════════════════════════════════════════════════════════════

function ChatsOverlay({ isDark, isOled, onClose }: { isDark: boolean; isOled?: boolean; onClose: () => void }) {
  const router = useRouter();
  const [chats, setChats] = useState<ChatEntry[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchChats() {
      try {
        setFetchError(false);
        const res = await fetch('/api/history?userId=local-user');
        if (!res.ok) {
          if (!cancelled) setFetchError(true);
          return;
        }
        const data = await res.json();
        if (!cancelled && data.chats) setChats(data.chats);
      } catch {
        if (!cancelled) setFetchError(true);
      }
    }
    fetchChats();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 'var(--z-nav)',
          background: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Chat bubbles — domino stagger from top-left */}
      <div
        style={{
          position: 'absolute',
          top: '3.5rem',
          left: '0.625rem',
          zIndex: 'calc(var(--z-nav) + 1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
          maxHeight: 'calc(100% - 5rem)',
          overflowY: 'auto',
          padding: '0.25rem',
          scrollbarWidth: 'none',
        }}
      >
        {chats.map((chat, idx) => {
          const isHovered = hoveredId === chat.id;
          const timeStr = formatRelativeTime(parseTimestamp(chat.updatedAt));

          return (
            <motion.button
              key={chat.id}
              initial={{ opacity: 0, x: -40, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -30, scale: 0.95 }}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 30,
                mass: 0.5,
                delay: Math.min(idx * 0.04, 0.5),
              }}
              onClick={() => router.push(`/chat/${chat.id}`)}
              onMouseEnter={() => setHoveredId(chat.id)}
              onMouseLeave={() => setHoveredId(null)}
              whileTap={{ scale: 0.97 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.5rem 0.875rem',
                borderRadius: '9999px',
                cursor: 'pointer',
                textAlign: 'left',
                border: 'none',
                maxWidth: '22rem',
                background: isHovered
                  ? (isDark ? (isOled ? 'rgba(24,24,24,0.9)' : 'rgba(55,50,45,0.85)') : 'rgba(255,255,255,0.95)')
                  : (isDark ? (isOled ? 'rgba(12,12,12,0.9)' : 'rgba(28,27,25,0.8)') : 'rgba(255,255,255,0.85)'),
                boxShadow: isHovered
                  ? (isDark
                    ? '0 4px 20px -4px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.2)'
                    : '0 4px 20px -4px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)')
                  : (isDark
                    ? '0 2px 8px -2px rgba(0,0,0,0.3)'
                    : '0 2px 12px -3px rgba(0,0,0,0.06)'),
                backdropFilter: 'blur(16px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
                transition: 'background 0.15s, box-shadow 0.15s',
              }}
            >
              <MessageSquareIcon style={{
                height: '0.75rem',
                width: '0.75rem',
                flexShrink: 0,
                color: isHovered ? 'var(--pfc-accent)' : (isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.2)'),
                transition: 'color 0.15s',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: isHovered
                    ? (isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.85)')
                    : (isDark ? 'rgba(155,150,137,0.75)' : 'rgba(0,0,0,0.5)'),
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-sans)',
                  transition: 'color 0.15s',
                }}>
                  {chat.title}
                </div>
              </div>
              <span style={{
                fontSize: '0.5625rem',
                fontWeight: 500,
                color: isDark ? 'rgba(155,150,137,0.3)' : 'rgba(0,0,0,0.15)',
                fontFamily: 'var(--font-sans)',
                flexShrink: 0,
              }}>
                {timeStr}
              </span>
            </motion.button>
          );
        })}
        {fetchError && (
          <div style={{
            padding: '1rem',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: isDark ? 'rgba(155,150,137,0.6)' : 'rgba(0,0,0,0.35)',
          }}>
            Failed to load chats
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AllChatsButton — standalone pill on landing page (no card list)
// ═══════════════════════════════════════════════════════════════════

function AllChatsButton({ isDark, isOled, onShowAll }: { isDark: boolean; isOled?: boolean; onShowAll: (chats: ChatEntry[]) => void }) {
  const [allChats, setAllChats] = useState<ChatEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchChats() {
      try {
        const res = await fetch('/api/history?userId=local-user');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.chats) setAllChats(data.chats);
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    fetchChats();
    return () => { cancelled = true; };
  }, []);

  if (!loaded || allChats.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...ENTER_SPRING, delay: 0.28 }}
      style={{ display: 'flex', justifyContent: 'center' }}
    >
      <motion.button
        onClick={() => onShowAll(allChats)}
        whileTap={{ scale: 0.97 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.4375rem 0.875rem',
          borderRadius: '9999px',
          border: `1px solid ${isDark ? 'rgba(50,49,45,0.25)' : 'rgba(190,183,170,0.3)'}`,
          background: isDark ? (isOled ? 'rgba(10,10,10,0.8)' : 'rgba(22,21,19,0.65)') : 'rgba(237,232,222,0.6)',
          cursor: 'pointer',
          fontSize: '0.625rem',
          fontWeight: 400,
          color: isDark ? 'rgba(155,150,137,0.7)' : 'rgba(0,0,0,0.4)',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.02em',
          boxShadow: isDark
            ? '0 2px 8px -1px rgba(0,0,0,0.2)'
            : '0 2px 12px -2px rgba(0,0,0,0.04)',
          transition: 'color 0.15s, background 0.15s',
        }}
      >
        <MessageSquareIcon style={{ height: '0.75rem', width: '0.75rem' }} />
        All Chats
        <span style={{
          fontSize: '0.5625rem',
          fontFamily: 'var(--font-mono)',
          opacity: 0.6,
        }}>
          {allChats.length}
        </span>
      </motion.button>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Chat — landing page ↔ chat interface with TOC sidebar
// ═══════════════════════════════════════════════════════════════════

export function Chat() {
  const messages = usePFCStore((s) => s.messages);
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const isStreaming = usePFCStore((s) => s.isStreaming);
  const researchChatMode = usePFCStore((s) => s.researchChatMode);
  const chatMode = usePFCStore((s) => s.chatMode);
  const chatViewMode = usePFCStore((s) => s.chatViewMode);
  const tierFeatures = usePFCStore((s) => s.tierFeatures);
  const inferenceMode = usePFCStore((s) => s.inferenceMode);
  const clearMessages = usePFCStore((s) => s.clearMessages);
  const { sendQuery, abort, pause, resume } = useChatStream();
  const { isDark, isOled, mounted } = useIsDark();
  const [modeHintDismissed, setModeHintDismissed] = useState(false);
  const [showAllChats, setShowAllChats] = useState(false);
  const [allChatsData, setAllChatsData] = useState<ChatEntry[]>([]);
  const [showChatsOverlay, setShowChatsOverlay] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [landingGreeting, setLandingGreeting] = useState(LANDING_GREETINGS[0]);
  // Pick random greeting client-side only to avoid hydration mismatch
  useEffect(() => {
    setLandingGreeting(LANDING_GREETINGS[Math.floor(Math.random() * LANDING_GREETINGS.length)]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const lastBackClickRef = useRef(0);
  const lastChatsClickRef = useRef(0);

  const handleShowAllChats = useCallback((chats: ChatEntry[]) => {
    setAllChatsData(chats);
    setShowAllChats(true);
  }, []);

  const isEmpty = messages.length === 0;
  const showThoughtViz = researchChatMode && chatViewMode === 'visualize-thought' && tierFeatures.thoughtVisualizer !== 'off' && !isEmpty;
  const features = useMemo(() => getInferenceModeFeatures(inferenceMode), [inferenceMode]);
  const showModeHint = researchChatMode && !features.playPause && !modeHintDismissed && !isEmpty;

  return (
    <ErrorBoundary>
    <div style={{ position: 'relative', display: 'flex', height: '100%', flexDirection: 'column' }}>

      {/* ═══════════════════════════════════════════════════════════════
          Landing page — greeting + search bar
          ═══════════════════════════════════════════════════════════════ */}
      {isEmpty && (
        <motion.div
          key="empty"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'relative',
            zIndex: 'var(--z-base)',
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 24px',
            background: isOled
              ? 'transparent'
              : isDark
                ? '#151311'
                : 'var(--m3-surface)',
            transform: 'translateZ(0)',
          }}
        >
          {/* Wallpaper fade overlay — covers starfield when search focused */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              background: isOled ? '#000' : isDark ? '#151311' : 'var(--m3-surface)',
              opacity: searchFocused ? 1 : 0,
              transition: searchFocused ? 'opacity 0.4s ease-out' : 'opacity 3s ease-in',
              pointerEvents: 'none',
            }}
          />

          <AnimatePresence mode="wait">
            {showAllChats ? (
              <AllChatsView
                key="all-chats"
                chats={allChatsData}
                isDark={isDark}
                isOled={isOled}
                onBack={() => setShowAllChats(false)}
              />
            ) : (
              <motion.div
                key="greeting"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={ENTER_SPRING}
                style={{
                  position: 'relative',
                  zIndex: 'calc(var(--z-base) + 1)',
                  width: '100%',
                  maxWidth: '38rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1.5rem',
                }}
              >

                {/* Pixel mascot — sun for light mode, robot for dark/OLED */}
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ ...ENTER_SPRING, delay: 0.02 }}
                  style={{ display: 'flex', justifyContent: 'center' }}
                >
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Image
                      src={isDark ? '/pixel-robot.gif' : '/pixel-sun.gif'}
                      alt={isDark ? 'PFC Robot' : 'PFC Sun'}
                      width={96}
                      height={96}
                      unoptimized
                      style={{
                        imageRendering: 'pixelated',
                        width: '4.5rem',
                        height: '4.5rem',
                      }}
                    />
                  </motion.div>
                </motion.div>

                {/* Greeting title — RetroGaming font */}
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ ...ENTER_SPRING, delay: 0.08 }}
                  style={{ textAlign: 'center' }}
                >
                  <h1
                    style={{
                      fontFamily: "'RetroGaming', var(--font-display)",
                      fontSize: '2.75rem',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.2,
                      fontWeight: 400,
                      margin: 0,
                      color: isDark ? 'rgba(232,228,222,0.95)' : 'rgba(43,42,39,0.9)',
                    }}
                  >
                    {landingGreeting}
                  </h1>
                </motion.div>

                {/* Search bar — pill nav style with glassmorphism */}
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ ...ENTER_SPRING, delay: 0.18 }}
                  style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                >
                  <motion.div
                    data-search-bar
                    animate={{
                      borderRadius: searchExpanded ? '1.25rem' : '1.625rem',
                    }}
                    transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                    style={{
                      borderRadius: '1.625rem',
                      overflow: 'hidden',
                      width: '100%',
                      maxWidth: '36rem',
                      background: isDark
                        ? (isOled ? 'rgba(18,18,18,0.88)' : 'rgba(30,28,25,0.72)')
                        : 'rgba(237,232,222,0.6)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: `1px solid ${isDark ? (isOled ? 'rgba(55,55,55,0.4)' : 'rgba(55,50,44,0.3)') : 'rgba(190,183,170,0.3)'}`,
                      boxShadow: isDark
                        ? '0 2px 12px -2px rgba(0,0,0,0.3)'
                        : '0 2px 16px -2px rgba(0,0,0,0.06), 0 1px 4px -1px rgba(0,0,0,0.03)',
                      transform: 'translateZ(0)',
                    }}
                  >
                    <MultimodalInput
                      onSubmit={sendQuery}
                      onStop={abort}
                      isProcessing={isProcessing}
                      hero
                      onExpandChange={setSearchExpanded}
                      inputStyle={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1rem',
                        fontWeight: 500,
                        letterSpacing: '-0.01em',
                      }}
                      onFocusChange={setSearchFocused}
                      placeholderOverlay={mounted ? <GreetingSubtitle isDark={isDark} isOled={isOled} dismissing={searchFocused} /> : undefined}
                    />
                  </motion.div>
                </motion.div>

                {/* Feature action chips — 4 buttons below search bar */}
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...ENTER_SPRING, delay: 0.26 }}
                >
                  <FeatureButtons isDark={isDark} onSubmit={sendQuery} />
                </motion.div>

                {/* All Chats — standalone pill */}
                {mounted && (
                  <AllChatsButton isDark={isDark} isOled={isOled} onShowAll={handleShowAllChats} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          Chat interface — messages + chats overlay
          ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {!isEmpty && (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
            style={{
              position: 'relative',
              zIndex: 'var(--z-base)',
              display: 'flex',
              flex: 1,
              minHeight: 0,
              background: 'var(--m3-surface)',
              transform: 'translateZ(0)',
            }}
          >
            {/* Chats overlay — domino bubbles */}
            <AnimatePresence>
              {showChatsOverlay && (
                <ChatsOverlay isDark={isDark} isOled={isOled} onClose={() => setShowChatsOverlay(false)} />
              )}
            </AnimatePresence>

            {/* Main chat column */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
              {/* Header button row — Back + Chats (left) */}
              <motion.div
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.8, delay: 0.15 }}
                style={{
                  position: 'absolute',
                  top: '0.625rem',
                  left: '0.625rem',
                  right: '0.625rem',
                  zIndex: 'var(--z-dropdown)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  pointerEvents: 'none',
                }}
              >
                {/* Back button */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (Date.now() - lastBackClickRef.current < 300) return;
                    lastBackClickRef.current = Date.now();
                    clearMessages();
                  }}
                  style={{
                    pointerEvents: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    height: '2.125rem',
                    padding: '0 0.75rem',
                    borderRadius: 'var(--shape-full)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 'var(--type-label-md)',
                    fontWeight: 500,
                    fontFamily: 'var(--font-sans)',
                    color: isDark ? 'rgba(155,150,137,0.8)' : 'rgba(0,0,0,0.45)',
                    background: isDark ? 'rgba(28,27,25,0.7)' : 'rgba(255,255,255,0.75)',
                    backdropFilter: 'blur(12px) saturate(1.4)',
                    WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
                    boxShadow: isDark
                      ? '0 2px 8px -1px rgba(0,0,0,0.3)'
                      : '0 2px 12px -2px rgba(0,0,0,0.06)',
                    transition: 'color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.8)';
                    e.currentTarget.style.background = isDark ? 'rgba(55,50,45,0.7)' : 'rgba(255,255,255,0.9)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = isDark ? 'rgba(155,150,137,0.8)' : 'rgba(0,0,0,0.45)';
                    e.currentTarget.style.background = isDark ? 'rgba(28,27,25,0.7)' : 'rgba(255,255,255,0.75)';
                  }}
                >
                  <ArrowLeftIcon style={{ height: '0.8125rem', width: '0.8125rem' }} />
                  Back
                </motion.button>

                {/* Chats overlay toggle */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (Date.now() - lastChatsClickRef.current < 300) return;
                    lastChatsClickRef.current = Date.now();
                    setShowChatsOverlay((v) => !v);
                  }}
                  style={{
                    pointerEvents: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    height: '2.125rem',
                    padding: '0 0.75rem',
                    borderRadius: 'var(--shape-full)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 'var(--type-label-md)',
                    fontWeight: 500,
                    fontFamily: 'var(--font-sans)',
                    color: showChatsOverlay
                      ? (isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.8)')
                      : (isDark ? 'rgba(155,150,137,0.8)' : 'rgba(0,0,0,0.45)'),
                    background: showChatsOverlay
                      ? (isDark ? 'rgba(55,50,45,0.7)' : 'rgba(255,255,255,0.9)')
                      : (isDark ? 'rgba(28,27,25,0.7)' : 'rgba(255,255,255,0.75)'),
                    backdropFilter: 'blur(12px) saturate(1.4)',
                    WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
                    boxShadow: isDark
                      ? '0 2px 8px -1px rgba(0,0,0,0.3)'
                      : '0 2px 12px -2px rgba(0,0,0,0.06)',
                    transition: 'color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!showChatsOverlay) {
                      e.currentTarget.style.color = isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.8)';
                      e.currentTarget.style.background = isDark ? 'rgba(55,50,45,0.7)' : 'rgba(255,255,255,0.9)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!showChatsOverlay) {
                      e.currentTarget.style.color = isDark ? 'rgba(155,150,137,0.8)' : 'rgba(0,0,0,0.45)';
                      e.currentTarget.style.background = isDark ? 'rgba(28,27,25,0.7)' : 'rgba(255,255,255,0.75)';
                    }
                  }}
                >
                  <MessageSquareIcon style={{ height: '0.8125rem', width: '0.8125rem' }} />
                  Chats
                </motion.button>
              </motion.div>

              {/* Thought Visualizer (mind-map mode) */}
              {showThoughtViz ? (
                <ErrorBoundary fallback={
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, fontSize: 13 }}>
                    Visualization unavailable
                  </div>
                }>
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <ThoughtVisualizer isDark={isDark} />
                </div>
                </ErrorBoundary>
              ) : (
                <Messages />
              )}

              {/* Bottom controls area */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                {researchChatMode && (
                  <div style={{ margin: '0 auto', maxWidth: '48rem', width: '100%', padding: '0 1rem' }}>
                    <SynthesisCard />
                  </div>
                )}

                {/* Mode hint — M3 tonal surface */}
                <AnimatePresence>
                  {showModeHint && (
                    <motion.div
                      initial={{ opacity: 0, scaleY: 0 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      exit={{ opacity: 0, scaleY: 0 }}
                      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                      style={{ margin: '0 auto', maxWidth: '48rem', width: '100%', padding: '0.25rem 1rem', overflow: 'hidden', transformOrigin: 'top', transform: 'translateZ(0)' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.375rem 0.75rem',
                          borderRadius: 'var(--shape-full)',
                          background: isDark ? 'var(--m3-surface-container)' : 'var(--m3-surface-container)',
                          border: 'none',
                          fontSize: 'var(--type-label-sm)',
                          color: isDark ? 'rgba(155,150,137,0.9)' : 'rgba(0,0,0,0.4)',
                        }}
                      >
                        {inferenceMode === 'api'
                          ? <CloudIcon style={{ height: '0.6875rem', width: '0.6875rem', flexShrink: 0, color: 'var(--m3-primary)' }} />
                          : <MonitorIcon style={{ height: '0.6875rem', width: '0.6875rem', flexShrink: 0, color: 'var(--m3-primary)' }} />
                        }
                        <span style={{ flex: 1 }}>
                          {features.modeHint} — Switch to local inference for full thinking controls.
                        </span>
                        <button
                          onClick={() => setModeHintDismissed(true)}
                          style={{
                            border: 'none',
                            background: isDark ? 'rgba(var(--pfc-accent-rgb), 0.08)' : 'rgba(var(--pfc-accent-rgb), 0.06)',
                            cursor: 'pointer',
                            fontSize: 'var(--type-label-sm)',
                            color: 'var(--m3-primary)',
                            fontWeight: 600,
                            padding: '0.125rem 0.5rem',
                            borderRadius: 'var(--shape-full)',
                          }}
                        >
                          Got it
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Thinking Controls */}
                {(isProcessing || isStreaming) && researchChatMode && (
                  <div style={{ margin: '0 auto', maxWidth: '48rem', width: '100%', padding: '0.375rem 1rem' }}>
                    <ThinkingControls isDark={isDark} onStop={abort} onPause={pause} onResume={resume} />
                  </div>
                )}

                {tierFeatures.liveControls && <LiveControls />}
                {tierFeatures.conceptHierarchy && <ConceptHierarchyPanel />}

                {/* Research Mode Bar + Input — M3 surface container */}
                <div style={{
                  margin: '0 auto',
                  maxWidth: '48rem',
                  width: '100%',
                  padding: '0.375rem 1rem 0.5rem',
                }}>
                  {researchChatMode && (
                    <div style={{ position: 'relative', marginBottom: '0.375rem' }}>
                      <ResearchModeBar isDark={isDark} />
                    </div>
                  )}
                  <MultimodalInput
                    onSubmit={sendQuery}
                    onStop={abort}
                    isProcessing={isProcessing}
                    showControlsToggle={tierFeatures.liveControls}
                  />
                </div>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Portal sidebar — code suggestions and artifacts */}
      {mounted && <PortalSidebar />}
    </div>
    </ErrorBoundary>
  );
}
