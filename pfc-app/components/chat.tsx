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
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
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
        return (
          <motion.button
            key={m.key}
            whileTap={{ scale: 0.93 }}
            whileHover={{ scale: 1.06, y: -3 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25, mass: 0.5 }}
            onClick={() => setChatMode(m.key)}
            style={{
              padding: '0.3125rem 0.75rem',
              borderRadius: 'var(--shape-full)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--type-label-sm)',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.02em',
              transition: 'color 0.15s cubic-bezier(0.32,0.72,0,1), background 0.15s cubic-bezier(0.32,0.72,0,1), box-shadow 0.15s cubic-bezier(0.32,0.72,0,1)',
              color: isActive
                ? '#FFFFFF'
                : (isDark ? 'rgba(155,150,137,0.7)' : 'rgba(0,0,0,0.4)'),
              background: isActive
                ? '#C4956A'
                : (isDark ? 'rgba(55,50,45,0.4)' : 'rgba(0,0,0,0.05)'),
              boxShadow: isActive
                ? '0 4px 24px -4px rgba(196,149,106,0.25), 0 2px 8px -2px rgba(196,149,106,0.15)'
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
// IDE Syntax Coloring — rotating code prompts as subtitle
// ═══════════════════════════════════════════════════════════════════

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
    plain: 'print("What\'s on your mind?")',
    colored: [
      { text: 'print', color: '#22D3EE' },
      { text: '(', color: '#9CA3AF' },
      { text: '"What\'s on your mind?"', color: '#4ADE80' },
      { text: ')', color: '#9CA3AF' },
    ],
  },
  {
    plain: 'console.log("Any interesting queries?")',
    colored: [
      { text: 'console', color: '#E07850' },
      { text: '.', color: '#9CA3AF' },
      { text: 'log', color: '#E07850' },
      { text: '(', color: '#9CA3AF' },
      { text: '"Any interesting queries?"', color: '#4ADE80' },
      { text: ')', color: '#9CA3AF' },
    ],
  },
  {
    plain: 'echo "What do you want?"',
    colored: [
      { text: 'echo', color: '#F87171' },
      { text: ' ', color: '#9CA3AF' },
      { text: '"What do you want?"', color: '#FBBF24' },
    ],
  },
  {
    plain: 'return "Ready to research"',
    colored: [
      { text: 'return', color: '#C4B5FD' },
      { text: ' ', color: '#9CA3AF' },
      { text: '"Ready to research"', color: '#4ADE80' },
    ],
  },
  {
    plain: 'SELECT insight FROM questions',
    colored: [
      { text: 'SELECT', color: '#22D3EE' },
      { text: ' insight ', color: '#F9A8D4' },
      { text: 'FROM', color: '#22D3EE' },
      { text: ' questions', color: '#FBBF24' },
    ],
  },
  {
    plain: 'fmt.Println("Ask me anything")',
    colored: [
      { text: 'fmt', color: '#22D3EE' },
      { text: '.', color: '#9CA3AF' },
      { text: 'Println', color: '#E07850' },
      { text: '(', color: '#9CA3AF' },
      { text: '"Ask me anything"', color: '#4ADE80' },
      { text: ')', color: '#9CA3AF' },
    ],
  },
  {
    plain: 'puts "Let\'s dive in"',
    colored: [
      { text: 'puts', color: '#C4B5FD' },
      { text: ' ', color: '#9CA3AF' },
      { text: '"Let\'s dive in"', color: '#F87171' },
    ],
  },
  {
    plain: 'System.out.println("Curious?")',
    colored: [
      { text: 'System', color: '#FACC15' },
      { text: '.out.', color: '#9CA3AF' },
      { text: 'println', color: '#E07850' },
      { text: '(', color: '#9CA3AF' },
      { text: '"Curious?"', color: '#4ADE80' },
      { text: ')', color: '#9CA3AF' },
    ],
  },
  {
    plain: 'grep -i "research topic"',
    colored: [
      { text: 'grep', color: '#22D3EE' },
      { text: ' -i ', color: '#C4B5FD' },
      { text: '"research topic"', color: '#4ADE80' },
    ],
  },
  {
    plain: 'whats t?',
    colored: [
      { text: 'whats t?', color: '#FBBF24' },
    ],
  },
  {
    plain: 'soooooo....you gonna type something?',
    colored: [
      { text: 'soooooo....you gonna type something?', color: '#F87171' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// SyntaxSubtitle — IDE-colored typewriter subtitle with blinking cursor
// ═══════════════════════════════════════════════════════════════════

function SyntaxSubtitle({ isDark }: { isDark: boolean }) {
  const [displayText, setDisplayText] = useState('');
  const [cursorOn, setCursorOn] = useState(true);
  const [variationIdx, setVariationIdx] = useState(0);
  const stateRef = useRef({
    variation: 0,
    charIdx: 0,
    phase: 'typing' as 'typing' | 'pausing' | 'deleting',
  });

  useEffect(() => {
    const id = setInterval(() => setCursorOn((v) => !v), 530);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      const s = stateRef.current;
      const target = PROMPT_DEFS[s.variation].plain;

      if (s.phase === 'typing') {
        if (s.charIdx < target.length) {
          s.charIdx++;
          setDisplayText(target.slice(0, s.charIdx));
          setVariationIdx(s.variation);
          timer = setTimeout(tick, s.variation === 0 ? 55 : 40);
        } else {
          s.phase = 'pausing';
          timer = setTimeout(tick, s.variation === 0 ? 2500 : 3200);
        }
      } else if (s.phase === 'pausing') {
        s.phase = 'deleting';
        tick();
      } else {
        if (s.charIdx > 0) {
          s.charIdx--;
          setDisplayText(target.slice(0, s.charIdx));
          timer = setTimeout(tick, 18);
        } else {
          s.variation = (s.variation + 1) % PROMPT_DEFS.length;
          s.phase = 'typing';
          setVariationIdx(s.variation);
          timer = setTimeout(tick, 500);
        }
      }
    }

    timer = setTimeout(tick, 120);
    return () => clearTimeout(timer);
  }, []);

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

  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.9375rem',
        letterSpacing: '0em',
        lineHeight: 1.3,
        fontWeight: 400,
        whiteSpace: 'nowrap',
        minHeight: '1.5rem',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {coloredOutput.map((span, i) => (
        <span key={i} style={{ color: span.color }}>{span.text}</span>
      ))}
      <span
        style={{
          display: 'inline-block',
          width: '2px',
          height: '0.9375rem',
          backgroundColor: 'var(--m3-primary)',
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

function AllChatsView({ chats, isDark, onBack }: { chats: ChatEntry[]; isDark: boolean; onBack: () => void }) {
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
          whileHover={{ scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.96 }}
          transition={ENTER_SPRING}
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
            background: isDark ? 'rgba(28,27,25,0.7)' : 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(12px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
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
        background: isDark ? 'rgba(22,21,19,0.65)' : 'rgba(237,232,222,0.6)',
        backdropFilter: 'blur(12px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
        border: `1px solid ${isDark ? 'rgba(50,49,45,0.25)' : 'rgba(190,183,170,0.3)'}`,
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
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push(`/chat/${chat.id}`)}
              onMouseEnter={() => setHoveredId(chat.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.625rem 0.875rem',
                borderRadius: 'var(--shape-lg)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                background: isDark
                  ? (isHovered ? 'rgba(55,50,45,0.45)' : 'rgba(28,27,25,0.5)')
                  : (isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)'),
                boxShadow: isHovered
                  ? (isDark
                    ? '0 2px 8px -1px rgba(0,0,0,0.3), 0 1px 3px -1px rgba(0,0,0,0.2)'
                    : '0 2px 16px -2px rgba(0,0,0,0.06), 0 1px 4px -1px rgba(0,0,0,0.04)')
                  : 'none',
                border: `1px solid ${
                  isHovered
                    ? (isDark ? 'rgba(196,149,106,0.15)' : 'rgba(196,149,106,0.2)')
                    : (isDark ? 'rgba(50,49,45,0.25)' : 'rgba(190,183,170,0.2)')
                }`,
                backdropFilter: 'blur(10px) saturate(1.3)',
                WebkitBackdropFilter: 'blur(10px) saturate(1.3)',
                transition: 'all 0.2s ease',
                overflow: 'hidden',
              }}
            >
              <MessageSquareIcon style={{
                height: '0.9375rem',
                width: '0.9375rem',
                flexShrink: 0,
                color: isHovered ? '#C4956A' : (isDark ? 'rgba(155,150,137,0.45)' : 'rgba(0,0,0,0.2)'),
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
                <div style={{
                  fontSize: '0.625rem',
                  fontWeight: 500,
                  color: isDark ? 'rgba(155,150,137,0.35)' : 'rgba(0,0,0,0.2)',
                  fontFamily: 'var(--font-sans)',
                  marginTop: '0.125rem',
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

function ChatsOverlay({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
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
          zIndex: 30,
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
          zIndex: 31,
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
              whileHover={{ scale: 1.03, x: 4 }}
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
                  ? (isDark ? 'rgba(55,50,45,0.85)' : 'rgba(255,255,255,0.95)')
                  : (isDark ? 'rgba(28,27,25,0.8)' : 'rgba(255,255,255,0.85)'),
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
                color: isHovered ? '#C4956A' : (isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.2)'),
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

function AllChatsButton({ isDark, onShowAll }: { isDark: boolean; onShowAll: (chats: ChatEntry[]) => void }) {
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
        whileHover={{ scale: 1.04, y: -2 }}
        whileTap={{ scale: 0.96 }}
        transition={ENTER_SPRING}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.4375rem 0.875rem',
          borderRadius: '9999px',
          border: `1px solid ${isDark ? 'rgba(50,49,45,0.25)' : 'rgba(190,183,170,0.3)'}`,
          background: isDark ? 'rgba(22,21,19,0.65)' : 'rgba(237,232,222,0.6)',
          backdropFilter: 'blur(12px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: isDark ? 'rgba(155,150,137,0.7)' : 'rgba(0,0,0,0.4)',
          fontFamily: 'var(--font-sans)',
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
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [modeHintDismissed, setModeHintDismissed] = useState(false);
  const [showAllChats, setShowAllChats] = useState(false);
  const [allChatsData, setAllChatsData] = useState<ChatEntry[]>([]);
  const [showChatsOverlay, setShowChatsOverlay] = useState(false);
  const lastBackClickRef = useRef(0);
  const lastChatsClickRef = useRef(0);

  const handleShowAllChats = useCallback((chats: ChatEntry[]) => {
    setAllChatsData(chats);
    setShowAllChats(true);
  }, []);

  useEffect(() => setMounted(true), []);

  const isEmpty = messages.length === 0;
  const isDark = mounted ? (resolvedTheme === 'dark' || resolvedTheme === 'oled') : true;
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
            zIndex: 1,
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 24px',
            background: 'var(--m3-surface)',
            transform: 'translateZ(0)',
          }}
        >
          <AnimatePresence mode="wait">
            {showAllChats ? (
              <AllChatsView
                key="all-chats"
                chats={allChatsData}
                isDark={isDark}
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
                  zIndex: 2,
                  width: '100%',
                  maxWidth: '38rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1.5rem',
                }}
              >

                {/* Mode toggle — Measurement / Research / Plain Chat */}
                {mounted && <ModeToggle isDark={isDark} />}

                {/* Greeting section — Title with sun/moon, syntax subtitle below */}
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
                  {/* Static title — Minecraft font, with sun/moon GIF */}
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ ...ENTER_SPRING, delay: 0.08 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.625rem',
                    }}
                  >
                    {mounted && (isDark ? <PixelMoon size={36} /> : <PixelSun size={36} />)}
                    <h1
                      style={{
                        fontFamily: "'Minecraft', var(--font-display)",
                        fontSize: '2.5rem',
                        letterSpacing: '-0.03em',
                        lineHeight: 1.15,
                        fontWeight: 550,
                        margin: 0,
                        color: isDark ? 'rgba(232,228,222,0.95)' : 'rgba(43,42,39,0.9)',
                      }}
                    >
                      Greetings, Researcher
                    </h1>
                  </motion.div>

                  {/* Syntax typewriter subtitle — below the title, smaller */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...ENTER_SPRING, delay: 0.16 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {mounted && <SyntaxSubtitle isDark={isDark} />}
                  </motion.div>
                </div>

                {/* Search bar — M3 surface container with tonal elevation */}
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ ...ENTER_SPRING, delay: 0.18 }}
                  style={{ width: '100%' }}
                >
                  <div
                    data-search-bar
                    style={{
                      borderRadius: '1.25rem',
                      overflow: 'hidden',
                      background: isDark
                        ? 'var(--m3-surface-container)'
                        : 'var(--m3-surface-container-high)',
                      border: `1px solid ${isDark ? 'rgba(50,49,45,0.3)' : 'var(--m3-outline-variant)'}`,
                      boxShadow: 'none',
                    }}
                  >
                    <MultimodalInput
                      onSubmit={sendQuery}
                      onStop={abort}
                      isProcessing={isProcessing}
                      hero
                      inputStyle={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1rem',
                        fontWeight: 500,
                        letterSpacing: '-0.01em',
                      }}
                    />
                  </div>
                </motion.div>

                {/* Feature buttons — M3 tonal pills (hidden in plain chat mode) */}
                <AnimatePresence>
                  {chatMode !== 'plain' && (
                    <motion.div
                      key="feature-btns"
                      initial={{ opacity: 0, y: 16, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -8, height: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.6 }}
                      style={{ overflow: 'hidden' }}
                    >
                      {mounted && <FeatureButtons isDark={isDark} onSubmit={sendQuery} />}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* All Chats — standalone pill (replaces RecentChats card list) */}
                {mounted && (
                  <AllChatsButton isDark={isDark} onShowAll={handleShowAllChats} />
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
              zIndex: 1,
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
                <ChatsOverlay isDark={isDark} onClose={() => setShowChatsOverlay(false)} />
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
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  pointerEvents: 'none',
                }}
              >
                {/* Back button */}
                <motion.button
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.96 }}
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
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.96 }}
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
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <ThoughtVisualizer isDark={isDark} />
                </div>
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
                            background: isDark ? 'rgba(196,149,106,0.08)' : 'rgba(196,149,106,0.06)',
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
