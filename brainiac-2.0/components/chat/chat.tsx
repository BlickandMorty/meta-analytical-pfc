'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useChatStream } from '@/hooks/use-chat-stream';
import { Messages } from './messages';
import { MultimodalInput } from './multimodal-input';
import { PixelSun } from '../pixel-sun';
import { type ChatEntry, formatRelativeTime, parseTimestamp } from './recent-chats';
import { ResearchModeBar } from './research-mode-bar';
import { ThinkingControls } from './thinking-controls';
import { ErrorBoundary } from '../layout/error-boundary';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsDark } from '@/hooks/use-is-dark';
import { getInferenceModeFeatures } from '@/lib/research/types';
import { CloudIcon, MonitorIcon, ArrowLeftIcon, MessageSquareIcon, SearchIcon, ExternalLinkIcon, ZapIcon, DownloadIcon, LockIcon, SettingsIcon } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// Dynamic imports — only loaded when the tier enables them
// ═══════════════════════════════════════════════════════════════════

const LiveControls = dynamic(() => import('./live-controls').then((m) => ({ default: m.LiveControls })), { ssr: false });
const ConceptHierarchyPanel = dynamic(() => import('../concept-hierarchy-panel').then((m) => ({ default: m.ConceptHierarchyPanel })), { ssr: false });
const PortalSidebar = dynamic(() => import('../portal-sidebar').then((m) => ({ default: m.PortalSidebar })), { ssr: false });

/* Spring configs — spring physics handle interruption gracefully
   (retarget mid-animation) unlike duration-based easing which
   queues up and glitches on rapid page cycling / All Chats toggle */
const ENTER_SPRING = { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.6 };
const ENTER_SPRING_SNAPPY = { type: 'spring' as const, stiffness: 500, damping: 35, mass: 0.5 };

// ═══════════════════════════════════════════════════════════════════
// Greeting Typewriter — AI-style typing with idle escalation
// ═══════════════════════════════════════════════════════════════════
// 200+ phrases from lib/greeting-phrases.ts — interesting questions,
// cool stats, scary stats, funny observations, profound thoughts,
// research sparks, and writing prompts.

import {
  ALL_GREETING_PHRASES as GREETING_PHRASES,
  BORED_PHRASES,
  PHILOSOPHICAL_PHRASES,
  FOURTH_WALL_PHRASES,
} from '@/lib/greeting-phrases';

// Simple static placeholders for the search bar (replaces old syntax typewriter)
const SEARCH_PLACEHOLDERS = [
  "What's up?",
  "How can I help?",
  "Ask me anything...",
  "What are you working on?",
];

// ═══════════════════════════════════════════════════════════════════
// GreetingTypewriter — AI-style typing in the H1 greeting title
//
// Types out phrases with natural stutter pauses. Progresses through
// idle phases the longer the user sits on the landing page:
//   Phase 0 (0-20s):  Normal greetings
//   Phase 1 (20-45s): Bored / impatient
//   Phase 2 (45-75s): Philosophical questions
//   Phase 3 (75s+):   4th-wall breaking
//   Phase 4:          Counting to 10
// ═══════════════════════════════════════════════════════════════════

function pickRandom<T>(arr: readonly T[], exclude?: T): T {
  if (arr.length <= 1) return arr[0]!;
  let pick: T;
  do {
    pick = arr[Math.floor(Math.random() * arr.length)]!;
  } while (pick === exclude && arr.length > 1);
  return pick;
}

function GreetingTypewriter({ isDark, isSunny }: { isDark: boolean; isSunny?: boolean }) {
  const [displayText, setDisplayText] = useState('');
  const mountTimeRef = useRef(Date.now());
  const stateRef = useRef({
    charIdx: 0,
    phase: 'typing' as 'typing' | 'pausing' | 'deleting',
    currentPhrase: '',
    lastPhrase: '' as string, // prevents consecutive repeats
    idlePhase: 0 as 0 | 1 | 2 | 3 | 4,
    countValue: 0, // for counting phase
    phrasesShown: 0,
  });

  // Pick next phrase based on idle duration
  const getNextPhrase = useCallback((): string => {
    const s = stateRef.current;
    const elapsed = (Date.now() - mountTimeRef.current) / 1000;

    // Phase 4: counting
    if (s.idlePhase === 4) {
      s.countValue++;
      if (s.countValue <= 10) { s.lastPhrase = String(s.countValue); return s.lastPhrase; }
      if (s.countValue === 11) { s.lastPhrase = '...well that was anticlimactic'; return s.lastPhrase; }
      // Reset to philosophical after counting
      s.idlePhase = 2;
      s.countValue = 0;
      const p = pickRandom(PHILOSOPHICAL_PHRASES, s.lastPhrase);
      s.lastPhrase = p;
      return p;
    }

    // Determine phase from elapsed time
    if (elapsed > 75 && s.idlePhase < 3) {
      s.idlePhase = 3;
    } else if (elapsed > 45 && s.idlePhase < 2) {
      s.idlePhase = 2;
    } else if (elapsed > 20 && s.idlePhase < 1) {
      s.idlePhase = 1;
    }

    const last = s.lastPhrase;
    let phrase: string;
    switch (s.idlePhase) {
      case 0: phrase = pickRandom(GREETING_PHRASES, last); break;
      case 1: phrase = pickRandom(BORED_PHRASES, last); break;
      case 2: phrase = pickRandom(PHILOSOPHICAL_PHRASES, last); break;
      case 3: {
        phrase = pickRandom(FOURTH_WALL_PHRASES, last);
        if (phrase === "i'm gonna count to 10.") {
          s.idlePhase = 4;
          s.countValue = 0;
        }
        break;
      }
      default: phrase = pickRandom(GREETING_PHRASES, last);
    }
    s.lastPhrase = phrase;
    return phrase;
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    // First greeting is always "Sup, Brainiac!" — subsequent ones are random questions
    stateRef.current.currentPhrase = 'Sup, Brainiac!';

    function tick() {
      const s = stateRef.current;
      const target = s.currentPhrase;

      if (s.phase === 'typing') {
        if (s.charIdx < target.length) {
          s.charIdx++;
          setDisplayText(target.slice(0, s.charIdx));

          const ch = target[s.charIdx - 1] ?? '';

          // AI-style stutter with natural rhythm
          let delay = 45 + Math.random() * 30; // 45-75ms base (snappier)

          // Punctuation pauses — natural reading rhythm
          if ('.!?'.includes(ch)) delay += 200 + Math.random() * 200;
          else if (',;:'.includes(ch)) delay += 80 + Math.random() * 80;
          else if (ch === ' ' && Math.random() < 0.08) delay += 60 + Math.random() * 60; // breath at some spaces

          // ~10% chance: short stutter (brief hesitation, like rethinking a word)
          if (Math.random() < 0.10) delay += 120 + Math.random() * 130;
          // ~3% chance: longer "thinking" pause (like reformulating mid-sentence)
          if (Math.random() < 0.03) delay += 350 + Math.random() * 250;

          // Slightly slower on first 2 chars (initial thought forming)
          if (s.charIdx <= 2) delay += 100;

          timer = setTimeout(tick, delay);
        } else {
          s.phase = 'pausing';
          // Hold the completed phrase — longer for contemplative, shorter for counting
          const pauseTime = target.length < 5 ? 1000 : 2600 + Math.random() * 1000;
          timer = setTimeout(tick, pauseTime);
        }
      } else if (s.phase === 'pausing') {
        s.phase = 'deleting';
        timer = setTimeout(tick, 80); // small beat before deleting
      } else {
        // Deleting — accelerates as it goes (fast wipe effect)
        if (s.charIdx > 0) {
          // Delete faster as we get closer to empty: 30ms → 8ms
          const progress = 1 - s.charIdx / target.length;
          const deleteSpeed = Math.max(8, 28 - progress * 20);
          // Delete 1-3 chars at a time for speed (more aggressive near start)
          const charsToDelete = s.charIdx > 10 ? Math.min(s.charIdx, 1 + Math.floor(Math.random() * 2)) : 1;
          s.charIdx = Math.max(0, s.charIdx - charsToDelete);
          setDisplayText(target.slice(0, s.charIdx));
          timer = setTimeout(tick, deleteSpeed);
        } else {
          // Pick next phrase — brief pause before new thought
          s.currentPhrase = getNextPhrase();
          s.phrasesShown++;
          s.phase = 'typing';
          timer = setTimeout(tick, 350 + Math.random() * 250);
        }
      }
    }

    timer = setTimeout(tick, 250);
    return () => clearTimeout(timer);
  }, [getNextPhrase]);

  // White cursor for all dark themes (amber, navy, cosmic, sunset, oled)
  // Black cursor for default light AND sunny
  const cursorColor = isDark
    ? 'rgba(255,255,255,0.9)'
    : 'rgba(0,0,0,0.85)';

  return (
    <span style={{ display: 'inline' }}>
      {displayText}
      <span
        className="typewriter-cursor"
        style={{
          display: 'inline-block',
          width: '0.35em',
          height: '0.95em',
          backgroundColor: cursorColor,
          marginLeft: '2px',
          verticalAlign: 'text-bottom',
          borderRadius: '1.5px',
        }}
      />
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SearchBarPlaceholder — simple static text for the search input
// ═══════════════════════════════════════════════════════════════════

function SearchBarPlaceholder({ isDark }: { isDark: boolean }) {
  const [text] = useState(() => pickRandom(SEARCH_PLACEHOLDERS));
  return (
    <span
      style={{
        fontSize: '0.9375rem',
        fontWeight: 400,
        color: isDark ? 'rgba(156,143,128,0.4)' : 'rgba(0,0,0,0.3)',
        fontFamily: 'var(--font-display)',
        letterSpacing: '-0.01em',
      }}
    >
      {text}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ChatsSidePanel — M3 side panel on landing (like Notes sidebar)
// Slides in from the left. Flat Material You cards, no blur.
// Typewriter summary reveals on hover per chat card.
// ═══════════════════════════════════════════════════════════════════

const PANEL_SPRING = { type: 'spring' as const, stiffness: 480, damping: 36, mass: 0.7 };

/** Typewriter hook for summary text — types out on hover, resets on leave */
function useSummaryTypewriter(text: string, active: boolean) {
  const [display, setDisplay] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (!active || !text) { setDisplay(''); return; }
    let idx = 0;
    setDisplay('');
    function tick() {
      idx++;
      setDisplay(text.slice(0, idx));
      if (idx < text.length) {
        timerRef.current = setTimeout(tick, 18 + Math.random() * 12);
      }
    }
    timerRef.current = setTimeout(tick, 120);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, active]);

  return display;
}

function ChatCardSummary({ text, active, isDark }: { text: string; active: boolean; isDark: boolean }) {
  const display = useSummaryTypewriter(text, active);
  if (!active && !display) return null;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      style={{
        fontSize: '0.6875rem',
        fontWeight: 400,
        lineHeight: 1.45,
        color: isDark ? 'rgba(155,150,137,0.55)' : 'rgba(73,69,79,0.6)',
        fontFamily: 'var(--font-sans)',
        marginTop: '0.25rem',
        overflow: 'hidden',
      }}
    >
      {display}
      {display.length < text.length && (
        <span style={{
          display: 'inline-block',
          width: '1px',
          height: '0.625rem',
          backgroundColor: 'var(--pfc-accent)',
          marginLeft: '1px',
          verticalAlign: 'text-bottom',
          opacity: 0.7,
        }} />
      )}
    </motion.div>
  );
}

function ChatsSidePanel({ isDark, isOled, isCosmic, isSunny, isSunset, onClose }: {
  isDark: boolean; isOled?: boolean; isCosmic?: boolean; isSunny?: boolean; isSunset?: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [chats, setChats] = useState<ChatEntry[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchChats() {
      try {
        const res = await fetch('/api/history?userId=local-user');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.chats) setChats(data.chats);
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    fetchChats();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return chats;
    const q = search.toLowerCase();
    return chats.filter((c) => c.title.toLowerCase().includes(q));
  }, [chats, search]);

  // M3 surface colors — flat, no blur
  const panelBg = isOled ? '#0c0c0c'
    : isCosmic ? '#161330'
    : isSunset ? '#1e1418'
    : isDark ? 'var(--m3-surface-container-low, #1c1b1f)'
    : isSunny ? 'var(--card)'
    : '#f7f2fa';

  const cardBg = isOled ? '#161616'
    : isCosmic ? '#1e1b35'
    : isSunset ? '#261a1e'
    : isDark ? 'var(--m3-surface-container, #211f26)'
    : isSunny ? 'var(--secondary)'
    : '#ece6f0';

  const cardHoverBg = isOled ? '#202020'
    : isCosmic ? '#26223e'
    : isSunset ? '#2e2025'
    : isDark ? 'var(--m3-surface-container-high, #2b2930)'
    : isSunny ? 'color-mix(in srgb, var(--secondary) 80%, white)'
    : '#e0dae4';

  const textPrimary = isDark ? 'rgba(232,228,222,0.92)' : 'rgba(28,27,31,0.87)';
  const textSecondary = isDark ? 'rgba(155,150,137,0.65)' : 'rgba(73,69,79,0.7)';
  const textTertiary = isDark ? 'rgba(155,150,137,0.4)' : 'rgba(73,69,79,0.45)';
  const searchBg = isOled ? '#1a1a1a'
    : isCosmic ? '#1e1b35'
    : isSunset ? '#261a1e'
    : isDark ? 'rgba(255,255,255,0.04)'
    : isSunny ? 'var(--secondary)'
    : '#ece6f0';

  return (
    <>
      {/* Scrim — flat, no blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          background: isDark ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.04)',
        }}
      />

      {/* Floating side panel — M3 rounded box */}
      <motion.div
        initial={{ x: '-110%', opacity: 0.5 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '-110%', opacity: 0 }}
        transition={PANEL_SPRING}
        style={{
          position: 'absolute',
          top: '1rem',
          left: '0.75rem',
          bottom: '1rem',
          zIndex: 11,
          width: '16.5rem',
          maxWidth: 'calc(80vw - 1.5rem)',
          display: 'flex',
          flexDirection: 'column',
          background: panelBg,
          borderRadius: '1.5rem',
          border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
          boxShadow: isDark
            ? '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)'
            : '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '0.75rem 0.75rem 0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '1.75rem',
              height: '1.75rem',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: textSecondary,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = cardBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <ArrowLeftIcon style={{ height: '1.125rem', width: '1.125rem' }} />
          </motion.button>
          <span style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: textPrimary,
            fontFamily: 'var(--font-sans)',
          }}>
            All Chats
          </span>
          <span style={{
            fontSize: '0.6875rem',
            fontFamily: 'var(--font-mono)',
            color: textTertiary,
            fontWeight: 500,
          }}>
            {chats.length}
          </span>
        </div>

        {/* Search */}
        <div style={{ padding: '0 0.625rem 0.375rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.375rem 0.625rem',
            borderRadius: '1.25rem',
            background: searchBg,
            transition: 'background 0.15s',
          }}>
            <SearchIcon style={{
              height: '0.75rem', width: '0.75rem',
              color: textTertiary, flexShrink: 0,
            }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              aria-label="Search chats"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-sans)',
                color: textPrimary,
              }}
            />
          </div>
        </div>

        {/* Chat list */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '0.25rem 0.5rem 0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          scrollbarWidth: 'thin',
          scrollbarColor: isDark ? 'rgba(155,150,137,0.2) transparent' : 'rgba(0,0,0,0.1) transparent',
        }}>
          {!loaded && (
            <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
              <div style={{
                width: '1.5rem', height: '1.5rem', borderRadius: '50%',
                border: '2px solid currentColor', borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto', color: textTertiary,
              }} />
            </div>
          )}
          {loaded && filtered.map((chat, idx) => {
            const isHovered = hoveredId === chat.id;
            const timeStr = formatRelativeTime(parseTimestamp(chat.updatedAt));
            // Build a summary preview from first assistant message
            const summary = (chat as ChatEntry & { preview?: string }).preview
              ?? chat.title;

            return (
              <motion.button
                key={chat.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.25,
                  ease: [0.2, 0, 0, 1],
                  delay: Math.min(idx * 0.025, 0.25),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  router.push(`/chat/${chat.id}`);
                }}
                onMouseEnter={() => setHoveredId(chat.id)}
                onMouseLeave={() => setHoveredId(null)}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '0.5rem 0.625rem',
                  borderRadius: '0.75rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  border: 'none',
                  background: isHovered ? cardHoverBg : cardBg,
                  transition: 'background 0.15s ease',
                }}
              >
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '1.5rem',
                    height: '1.5rem',
                    borderRadius: '50%',
                    background: isHovered
                      ? `rgba(var(--pfc-accent-rgb), ${isDark ? '0.12' : '0.08'})`
                      : 'transparent',
                    flexShrink: 0,
                    transition: 'background 0.15s',
                  }}>
                    <MessageSquareIcon style={{
                      height: '0.6875rem',
                      width: '0.6875rem',
                      color: isHovered ? 'var(--pfc-accent)' : textTertiary,
                      transition: 'color 0.15s',
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      lineHeight: 1.35,
                      color: isHovered ? textPrimary : textSecondary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-sans)',
                      transition: 'color 0.15s',
                    }}>
                      {chat.title}
                    </div>
                    <div style={{
                      fontSize: '0.5625rem',
                      fontWeight: 400,
                      color: textTertiary,
                      fontFamily: 'var(--font-sans)',
                      marginTop: '0.0625rem',
                    }}>
                      {timeStr}
                    </div>
                  </div>
                </div>
                {/* Typewriter summary — reveals on hover */}
                <AnimatePresence>
                  {isHovered && summary && (
                    <ChatCardSummary
                      text={summary.length > 120 ? summary.slice(0, 120) + '...' : summary}
                      active={isHovered}
                      isDark={isDark}
                    />
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
          {loaded && filtered.length === 0 && (
            <div style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              fontSize: '0.8125rem',
              color: textTertiary,
            }}>
              {search ? 'No chats found' : 'No conversations yet'}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ChatsOverlay — M3 standard side sheet (slides from left)
// Material You: flat surface, no blur, clean elevation, fluid spring
// ═══════════════════════════════════════════════════════════════════

const SHEET_SPRING = { type: 'spring' as const, stiffness: 500, damping: 38, mass: 0.8 };

function ChatsOverlay({ isDark, isOled, isCosmic, isSunny, onClose }: {
  isDark: boolean; isOled?: boolean; isCosmic?: boolean; isSunny?: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [chats, setChats] = useState<ChatEntry[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchChats() {
      try {
        setFetchError(false);
        const res = await fetch('/api/history?userId=local-user');
        if (!res.ok) { if (!cancelled) setFetchError(true); return; }
        const data = await res.json();
        if (!cancelled && data.chats) setChats(data.chats);
      } catch { if (!cancelled) setFetchError(true); }
    }
    fetchChats();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return chats;
    const q = search.toLowerCase();
    return chats.filter((c) => c.title.toLowerCase().includes(q));
  }, [chats, search]);

  // Surface colors — M3 surface-container-low
  const sheetBg = isOled ? '#0a0a0a'
    : isCosmic ? '#1a1730'
    : isDark ? 'var(--m3-surface-container-low, #1c1b1f)'
    : isSunny ? 'var(--card)'
    : '#f7f2fa';

  const itemBg = isOled ? '#141414'
    : isCosmic ? '#221f38'
    : isDark ? 'var(--m3-surface-container, #211f26)'
    : isSunny ? 'var(--secondary)'
    : '#ece6f0';

  const itemHoverBg = isOled ? '#1e1e1e'
    : isCosmic ? '#2a2640'
    : isDark ? 'var(--m3-surface-container-high, #2b2930)'
    : isSunny ? 'color-mix(in srgb, var(--secondary) 80%, white)'
    : '#e0dae4';

  const textPrimary = isDark ? 'rgba(232,228,222,0.92)' : 'rgba(28,27,31,0.87)';
  const textSecondary = isDark ? 'rgba(155,150,137,0.65)' : 'rgba(73,69,79,0.7)';
  const textTertiary = isDark ? 'rgba(155,150,137,0.4)' : 'rgba(73,69,79,0.45)';

  return (
    <>
      {/* M3 Scrim — flat, no blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 'var(--z-modal-backdrop)',
          background: isDark ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.04)',
        }}
      />

      {/* M3 Floating sheet — slides from left, rounded */}
      <motion.div
        initial={{ x: '-110%', opacity: 0.5 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '-110%', opacity: 0 }}
        transition={SHEET_SPRING}
        style={{
          position: 'absolute',
          top: '1rem',
          left: '0.75rem',
          bottom: '1rem',
          zIndex: 'var(--z-modal)',
          width: '16.5rem',
          maxWidth: 'calc(80vw - 1.5rem)',
          display: 'flex',
          flexDirection: 'column',
          background: sheetBg,
          borderRadius: '1.5rem',
          border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
          boxShadow: isDark
            ? '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)'
            : '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '0.75rem 0.75rem 0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '1.75rem',
              height: '1.75rem',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: textSecondary,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = itemBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <ArrowLeftIcon style={{ height: '1.125rem', width: '1.125rem' }} />
          </motion.button>
          <span style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: textPrimary,
            fontFamily: 'var(--font-sans)',
          }}>
            All Chats
          </span>
          <span style={{
            fontSize: '0.6875rem',
            fontFamily: 'var(--font-mono)',
            color: textTertiary,
            fontWeight: 500,
          }}>
            {chats.length}
          </span>
        </div>

        {/* Search */}
        <div style={{ padding: '0 0.625rem 0.375rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.375rem 0.625rem',
            borderRadius: '1.25rem',
            background: itemBg,
            transition: 'background 0.15s',
          }}>
            <SearchIcon style={{
              height: '0.75rem', width: '0.75rem',
              color: textTertiary, flexShrink: 0,
            }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              aria-label="Search chats"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-sans)',
                color: textPrimary,
              }}
            />
          </div>
        </div>

        {/* Chat list */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '0.25rem 0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.125rem',
          scrollbarWidth: 'thin',
          scrollbarColor: isDark ? 'rgba(155,150,137,0.2) transparent' : 'rgba(0,0,0,0.1) transparent',
        }}>
          {filtered.map((chat, idx) => {
            const isHovered = hoveredId === chat.id;
            const timeStr = formatRelativeTime(parseTimestamp(chat.updatedAt));

            return (
              <motion.button
                key={chat.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.25,
                  ease: [0.2, 0, 0, 1],
                  delay: Math.min(idx * 0.02, 0.2),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  router.push(`/chat/${chat.id}`);
                }}
                onMouseEnter={() => setHoveredId(chat.id)}
                onMouseLeave={() => setHoveredId(null)}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.625rem',
                  borderRadius: '0.75rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  border: 'none',
                  background: isHovered ? itemHoverBg : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '1.5rem',
                  height: '1.5rem',
                  borderRadius: '50%',
                  background: isHovered
                    ? `rgba(var(--pfc-accent-rgb), ${isDark ? '0.12' : '0.08'})`
                    : itemBg,
                  flexShrink: 0,
                  transition: 'background 0.15s',
                }}>
                  <MessageSquareIcon style={{
                    height: '0.6875rem',
                    width: '0.6875rem',
                    color: isHovered ? 'var(--pfc-accent)' : textTertiary,
                    transition: 'color 0.15s',
                  }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    lineHeight: 1.35,
                    color: isHovered ? textPrimary : textSecondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-sans)',
                    transition: 'color 0.15s',
                  }}>
                    {chat.title}
                  </div>
                  <div style={{
                    fontSize: '0.5625rem',
                    fontWeight: 400,
                    color: textTertiary,
                    fontFamily: 'var(--font-sans)',
                    marginTop: '0.0625rem',
                  }}>
                    {timeStr}
                  </div>
                </div>
              </motion.button>
            );
          })}
          {filtered.length === 0 && !fetchError && (
            <div style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              fontSize: '0.8125rem',
              color: textTertiary,
            }}>
              {search ? 'No chats found' : 'No conversations yet'}
            </div>
          )}
          {fetchError && (
            <div style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              fontSize: '0.8125rem',
              color: textTertiary,
            }}>
              Failed to load chats
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AllChatsBubble — pill button that toggles the ChatsSidePanel
// ═══════════════════════════════════════════════════════════════════

function AllChatsBubble({ isDark, isOled, isSunny, isCosmic, onToggle }: {
  isDark: boolean; isOled?: boolean; isSunny?: boolean; isCosmic?: boolean; onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...ENTER_SPRING_SNAPPY, delay: 0.12 }}
      style={{ display: 'flex', justifyContent: 'center' }}
    >
      <motion.button
        onClick={onToggle}
        whileTap={{ scale: 0.97 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.4375rem 0.875rem',
          borderRadius: '9999px',
          border: 'none',
          background: isOled ? 'rgba(35,35,35,0.7)'
            : isCosmic ? 'rgba(14,12,26,0.45)'
            : isDark ? 'rgba(244,189,111,0.05)'
            : isSunny ? 'var(--card)'
            : 'rgba(0,0,0,0.04)',
          cursor: 'pointer',
          fontSize: '0.625rem',
          fontWeight: 500,
          color: isOled ? 'rgba(200,200,200,0.85)'
            : isCosmic ? 'rgba(180,175,200,0.75)'
            : isDark ? 'rgba(155,150,137,0.7)'
            : isSunny ? 'var(--muted-foreground)'
            : 'rgba(0,0,0,0.55)',
          fontFamily: 'var(--font-sans)',
          letterSpacing: '0.02em',
          boxShadow: 'none',
          transition: 'color 0.15s, background 0.15s',
        }}
      >
        <MessageSquareIcon style={{ height: '0.75rem', width: '0.75rem' }} />
        All Chats
      </motion.button>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ActiveThreadsPills — shows mini-chat threads with messages on landing page
// ═══════════════════════════════════════════════════════════════════

function ActiveThreadsPills({ isDark, isCosmic }: { isDark: boolean; isCosmic?: boolean }) {
  const router = useRouter();
  const chatThreads = usePFCStore((s) => s.chatThreads);
  const expandThreadToChat = usePFCStore((s) => s.expandThreadToChat);
  const setChatMinimized = usePFCStore((s) => s.setChatMinimized);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Only show threads that have at least 1 message
  const threadsWithMessages = chatThreads.filter((t) => t.messages.length > 0);
  if (threadsWithMessages.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...ENTER_SPRING_SNAPPY, delay: 0.16 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        width: '100%',
        maxWidth: '36rem',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.375rem',
        width: '100%', padding: '0 0.125rem',
      }}>
        <ZapIcon style={{
          height: '0.75rem', width: '0.75rem',
          color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)',
        }} />
        <span style={{
          fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)',
          fontFamily: 'var(--font-sans)',
        }}>
          Active Threads
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', width: '100%' }}>
        {threadsWithMessages.map((thread) => {
          const isHovered = hoveredId === thread.id;
          const msgCount = thread.messages.length;
          const lastMsg = thread.messages[msgCount - 1];
          const preview = lastMsg?.content?.slice(0, 50) || '';
          return (
            <motion.button
              key={thread.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (thread.chatId) {
                  setChatMinimized(false);
                  router.push(`/chat/${thread.chatId}`);
                } else {
                  expandThreadToChat(thread.id);
                }
              }}
              onMouseEnter={() => setHoveredId(thread.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.875rem',
                borderRadius: 'var(--shape-lg)',
                border: 'none',
                background: isCosmic
                  ? (isHovered ? 'rgba(22,18,40,0.55)' : 'rgba(14,12,26,0.45)')
                  : isDark
                    ? (isHovered ? 'var(--glass-hover)' : 'var(--pfc-surface-dark)')
                    : (isHovered ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.6)'),
                cursor: 'pointer', textAlign: 'left', flex: '1 1 auto',
                minWidth: '10rem', maxWidth: '100%',
                backdropFilter: isCosmic ? 'blur(24px) saturate(1.3)' : 'blur(16px) saturate(1.4)',
                WebkitBackdropFilter: isCosmic ? 'blur(24px) saturate(1.3)' : 'blur(16px) saturate(1.4)',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <MessageSquareIcon style={{
                height: '0.875rem', width: '0.875rem', flexShrink: 0,
                color: isHovered ? 'var(--pfc-accent)' : (isDark ? 'rgba(155,150,137,0.45)' : 'rgba(0,0,0,0.2)'),
                transition: 'color 0.15s',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.4,
                  color: isHovered
                    ? (isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.85)')
                    : (isDark ? 'rgba(155,150,137,0.75)' : 'rgba(0,0,0,0.5)'),
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-sans)', transition: 'color 0.15s',
                }}>
                  {thread.label}
                </div>
                {preview && (
                  <div style={{
                    fontSize: '0.6875rem', fontWeight: 400, marginTop: '0.125rem',
                    color: isDark ? 'rgba(155,150,137,0.35)' : 'rgba(0,0,0,0.2)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-sans)',
                  }}>
                    {preview}{preview.length >= 50 ? '...' : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                <span style={{
                  fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', fontWeight: 500,
                  color: isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.2)',
                }}>
                  {msgCount} msg{msgCount !== 1 ? 's' : ''}
                </span>
                <ExternalLinkIcon style={{
                  height: '0.625rem', width: '0.625rem',
                  color: isHovered ? 'var(--pfc-accent)' : (isDark ? 'rgba(155,150,137,0.25)' : 'rgba(0,0,0,0.12)'),
                  transition: 'color 0.15s',
                }} />
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ModelLockOverlay — shown when no API key or local model is configured
// ═══════════════════════════════════════════════════════════════════

function ModelLockOverlay({ isDark, inferenceMode }: { isDark: boolean; inferenceMode: string }) {
  const router = useRouter();
  const isLocal = inferenceMode === 'local';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        padding: '1rem 1.25rem',
        cursor: 'pointer',
      }}
      onClick={() => router.push('/settings')}
    >
      <LockIcon
        style={{
          width: '1rem',
          height: '1rem',
          color: isDark ? 'rgba(232,228,222,0.35)' : 'rgba(0,0,0,0.25)',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          fontFamily: 'var(--font-display)',
          color: isDark ? 'rgba(232,228,222,0.45)' : 'rgba(0,0,0,0.35)',
        }}
      >
        {isLocal
          ? 'No local model found — start Ollama or switch to API mode'
          : 'Add your API key to get started'}
      </span>
      <SettingsIcon
        style={{
          width: '0.875rem',
          height: '0.875rem',
          color: 'var(--pfc-accent)',
          flexShrink: 0,
          opacity: 0.7,
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Chat — landing page ↔ chat interface with TOC sidebar
// ═══════════════════════════════════════════════════════════════════

export function Chat({ mode = 'landing' }: { mode?: 'landing' | 'conversation' }) {
  const router = useRouter();
  const messages = usePFCStore((s) => s.messages);
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const isStreaming = usePFCStore((s) => s.isStreaming);
  const inferenceMode = usePFCStore((s) => s.inferenceMode);
  const apiKey = usePFCStore((s) => s.apiKey);
  const ollamaAvailable = usePFCStore((s) => s.ollamaAvailable);
  const chatMinimized = usePFCStore((s) => s.chatMinimized);
  const setChatMinimized = usePFCStore((s) => s.setChatMinimized);
  const clearMessages = usePFCStore((s) => s.clearMessages);
  const currentChatId = usePFCStore((s) => s.currentChatId);
  const { sendQuery, abort, pause, resume } = useChatStream();
  const { isDark, isOled, isCosmic, isSunny, isSunset, mounted } = useIsDark();

  // Landing mode: clear stale messages so the greeting always shows
  const navigatedRef = useRef(false);
  useEffect(() => {
    if (mode === 'landing') {
      navigatedRef.current = false;
      clearMessages();
    }
  }, [mode, clearMessages]);

  // Landing → conversation: navigate to /chat/[id] once a NEW query creates a chat
  // Only fires when isStreaming (active query), preventing stale-state navigation
  useEffect(() => {
    if (mode === 'landing' && currentChatId && messages.length > 0 && isStreaming && !navigatedRef.current) {
      navigatedRef.current = true;
      router.push(`/chat/${currentChatId}`);
    }
  }, [mode, currentChatId, messages.length, isStreaming, router]);

  // Model readiness — lock input when no usable model is configured
  const modelReady = inferenceMode === 'local' ? ollamaAvailable : apiKey.length > 0;
  const [modeHintDismissed, setModeHintDismissed] = useState(false);
  const [showAllChats, setShowAllChats] = useState(false);
  const [showChatsOverlay, setShowChatsOverlay] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const lastBackClickRef = useRef(0);
  const lastChatsClickRef = useRef(0);

  const toggleAllChats = useCallback(() => {
    setShowAllChats((prev) => !prev);
  }, []);

  // Mode-driven UI: landing always shows greeting, conversation always shows chat
  const showLanding = mode === 'landing' || (mode === 'conversation' && messages.length === 0 && chatMinimized);
  // Hide full chat when minimized — mini-chat widget takes over
  const showFullChat = mode === 'conversation' && messages.length > 0 && !chatMinimized;
  const features = useMemo(() => getInferenceModeFeatures(inferenceMode), [inferenceMode]);
  const showModeHint = !features.playPause && !modeHintDismissed && showFullChat;

  return (
    <ErrorBoundary>
    <div style={{ position: 'relative', display: 'flex', height: '100%', flexDirection: 'column' }}>

      {/* ═══════════════════════════════════════════════════════════════
          Landing page — greeting + search bar
          Also shown when chat is minimized to floating widget
          ═══════════════════════════════════════════════════════════════ */}
      {showLanding && (
        <div
          style={{
            position: 'relative',
            zIndex: 'var(--z-base)',
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            padding: '0 24px',
            background: (isOled || isCosmic)
              ? 'transparent'
              : isDark
                ? 'var(--background)'
                : 'var(--m3-surface)',
          }}
        >
          {/* Wallpaper fade overlay — covers starfield/stars when search focused.
              Skipped for cosmic — wallpaper stays visible, search bar uses blur glass instead. */}
          {!isCosmic && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 0,
                background: isOled ? '#000' : isDark ? 'var(--background)' : 'var(--m3-surface)',
                opacity: (searchFocused && !showAllChats) ? 1 : 0,
                transition: 'opacity 0.3s cubic-bezier(0.2, 0, 0, 1)',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* All Chats side panel — overlay on landing */}
          <AnimatePresence>
            {showAllChats && (
              <ChatsSidePanel
                isDark={isDark}
                isOled={isOled}
                isCosmic={isCosmic}
                isSunny={isSunny}
                isSunset={isSunset}
                onClose={() => setShowAllChats(false)}
              />
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={ENTER_SPRING_SNAPPY}
            style={{
              position: 'relative',
              zIndex: 'calc(var(--z-base) + 1)',
              width: '100%',
              maxWidth: '44rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.5rem',
            }}
          >

                {/* Mascot + greeting — min-height container, overflow visible
                   so the mascot/sun never gets clipped when text wraps. */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    minHeight: (isDark || isSunny) ? '11rem' : '5.5rem',
                    gap: '1.5rem',
                    overflow: 'visible',
                  }}
                >
                  {/* Pixel mascot — sun on sunny, robot on all dark themes, hidden on default light */}
                  {(isDark || isSunny) && (
                    <motion.div
                      initial={{ opacity: 0, y: 14, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ ...ENTER_SPRING_SNAPPY, delay: 0.0 }}
                      style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <motion.div
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <Image
                          src={isSunny ? '/pixel-sun.gif' : '/pixel-robot.gif'}
                          alt={isSunny ? 'Brainiac Sun' : 'Brainiac Robot'}
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
                  )}

                  {/* Greeting title — RetroGaming font with typewriter */}
                  <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ ...ENTER_SPRING_SNAPPY, delay: 0.04 }}
                    style={{ textAlign: 'center', flexShrink: 0 }}
                  >
                    <h1
                      style={{
                        fontFamily: "'RetroGaming', var(--font-display)",
                        fontSize: '1.625rem',
                        letterSpacing: '-0.01em',
                        lineHeight: 1.3,
                        fontWeight: 400,
                        margin: 0,
                        color: isDark ? 'rgba(232,228,222,0.95)' : 'rgba(28,27,31,0.9)',
                      }}
                    >
                      <GreetingTypewriter isDark={isDark} isSunny={isSunny} />
                    </h1>
                  </motion.div>
                </div>

              </motion.div>

          {/* Search bar — locked when no model configured */}
          {(
            <motion.div
              data-search-bar
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1, borderRadius: searchExpanded ? '1.25rem' : '1.625rem' }}
              transition={{ ...ENTER_SPRING_SNAPPY, delay: 0.08 }}
              style={{
                position: 'relative',
                borderRadius: '1.625rem',
                overflow: 'hidden',
                width: '100%',
                maxWidth: '42rem',
                background: isDark
                  ? (isOled ? 'rgba(8,8,8,0.92)' : isCosmic ? '#1a1730' : isSunset ? 'rgba(18,10,20,0.88)' : 'rgba(30,28,25,0.72)')
                  : 'rgba(255,255,255,0.92)',
                backdropFilter: isCosmic ? 'none' : 'blur(24px) saturate(1.3)',
                WebkitBackdropFilter: isCosmic ? 'none' : 'blur(24px) saturate(1.3)',
                border: isCosmic ? '1px solid rgba(139,159,212,0.08)' : isDark ? '1px solid rgba(255,255,255,0.06)' : 'none',
                boxShadow: searchFocused
                  ? (isDark
                      ? '0 8px 40px -8px rgba(0,0,0,0.25), 0 2px 14px -2px rgba(0,0,0,0.12)'
                      : '0 8px 40px -8px rgba(0,0,0,0.06), 0 2px 14px -2px rgba(0,0,0,0.03)')
                  : '0 0px 0px 0px rgba(0,0,0,0)',
                transition: 'box-shadow 0.3s cubic-bezier(0.2, 0, 0, 1)',
              }}
            >
              {modelReady ? (
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
                  placeholderOverlay={mounted ? <SearchBarPlaceholder isDark={isDark} /> : undefined}
                />
              ) : (
                <ModelLockOverlay isDark={isDark} inferenceMode={inferenceMode} />
              )}
            </motion.div>
          )}

          {/* All Chats bubble + Active threads */}
          {mounted && (
            <AllChatsBubble isDark={isDark} isOled={isOled} isSunny={isSunny} isCosmic={isCosmic} onToggle={toggleAllChats} />
          )}
          {!showAllChats && mounted && <ActiveThreadsPills isDark={isDark} isCosmic={isCosmic} />}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          Chat interface — messages + chats overlay
          Hidden when chatMinimized (mini-chat widget takes over)
          ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showFullChat && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={ENTER_SPRING}
            style={{
              position: 'relative',
              zIndex: 'var(--z-base)',
              display: 'flex',
              flex: 1,
              minHeight: 0,
              background: isCosmic ? 'transparent' : isDark ? 'var(--background)' : 'var(--m3-surface)',
              transform: 'translateZ(0)',
            }}
          >
            {/* Chats overlay — domino bubbles */}
            <AnimatePresence>
              {showChatsOverlay && (
                <ChatsOverlay isDark={isDark} isOled={isOled} isCosmic={isCosmic} isSunny={isSunny} onClose={() => setShowChatsOverlay(false)} />
              )}
            </AnimatePresence>

            {/* Main chat column */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
              {/* Header — M3 top app bar, frosted glass */}
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...ENTER_SPRING_SNAPPY, delay: 0.08 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  zIndex: 'var(--z-dropdown)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  pointerEvents: 'none',
                  background: isDark
                    ? 'linear-gradient(180deg, var(--background) 0%, transparent 100%)'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.85) 0%, transparent 100%)',
                }}
              >
                {/* Back button — M3 tonal icon button */}
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  whileHover={{ scale: 1.04 }}
                  onClick={() => {
                    if (Date.now() - lastBackClickRef.current < 300) return;
                    lastBackClickRef.current = Date.now();
                    router.push('/');
                  }}
                  style={{
                    pointerEvents: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    height: '2.25rem',
                    padding: '0 0.875rem',
                    borderRadius: 'var(--shape-full)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 'var(--type-label-md)',
                    fontWeight: 500,
                    fontFamily: 'var(--font-sans)',
                    letterSpacing: '0.01em',
                    color: isDark ? 'rgba(232,228,222,0.75)' : 'rgba(0,0,0,0.5)',
                    background: isDark ? 'var(--m3-surface-container)' : 'var(--m3-surface-container)',
                    backdropFilter: 'blur(16px) saturate(1.5)',
                    WebkitBackdropFilter: 'blur(16px) saturate(1.5)',
                    boxShadow: isDark
                      ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 12px -2px rgba(0,0,0,0.15)'
                      : '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(0,0,0,0.03)',
                    transition: 'color 0.2s, background 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.8)';
                    e.currentTarget.style.background = isDark ? 'var(--m3-surface-container-high)' : 'var(--m3-surface-container-high)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = isDark ? 'rgba(232,228,222,0.75)' : 'rgba(0,0,0,0.5)';
                    e.currentTarget.style.background = isDark ? 'var(--m3-surface-container)' : 'var(--m3-surface-container)';
                  }}
                >
                  <ArrowLeftIcon style={{ height: '0.875rem', width: '0.875rem' }} />
                  Back
                </motion.button>

                {/* Chats overlay toggle */}
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  whileHover={{ scale: 1.04 }}
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
                    height: '2.25rem',
                    padding: '0 0.875rem',
                    borderRadius: 'var(--shape-full)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 'var(--type-label-md)',
                    fontWeight: 500,
                    fontFamily: 'var(--font-sans)',
                    letterSpacing: '0.01em',
                    color: showChatsOverlay
                      ? 'var(--m3-primary)'
                      : (isDark ? 'rgba(232,228,222,0.75)' : 'rgba(0,0,0,0.5)'),
                    background: showChatsOverlay
                      ? (isDark ? 'rgba(var(--pfc-accent-rgb), 0.12)' : 'rgba(var(--pfc-accent-rgb), 0.08)')
                      : (isDark ? 'var(--m3-surface-container)' : 'var(--m3-surface-container)'),
                    backdropFilter: 'blur(16px) saturate(1.5)',
                    WebkitBackdropFilter: 'blur(16px) saturate(1.5)',
                    boxShadow: isDark
                      ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 12px -2px rgba(0,0,0,0.15)'
                      : '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(0,0,0,0.03)',
                    transition: 'color 0.2s, background 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!showChatsOverlay) {
                      e.currentTarget.style.color = isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.8)';
                      e.currentTarget.style.background = isDark ? 'var(--m3-surface-container-high)' : 'var(--m3-surface-container-high)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!showChatsOverlay) {
                      e.currentTarget.style.color = isDark ? 'rgba(232,228,222,0.75)' : 'rgba(0,0,0,0.5)';
                      e.currentTarget.style.background = isDark ? 'var(--m3-surface-container)' : 'var(--m3-surface-container)';
                    }
                  }}
                >
                  <MessageSquareIcon style={{ height: '0.875rem', width: '0.875rem' }} />
                  Chats
                </motion.button>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Export thread button — right-aligned */}
                {messages.length > 0 && (
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    whileHover={{ scale: 1.04 }}
                    onClick={() => {
                      const lines = messages.map((m: { role: string; text?: string; content?: string }) => {
                        const role = m.role === 'user' ? 'You' : 'Assistant';
                        const text = m.text || m.content || '';
                        return `## ${role}\n\n${text}`;
                      });
                      const md = `# Chat Export — ${new Date().toLocaleDateString()}\n\n${lines.join('\n\n---\n\n')}`;
                      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    style={{
                      pointerEvents: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      height: '2.25rem',
                      padding: '0 0.875rem',
                      borderRadius: 'var(--shape-full)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 'var(--type-label-md)',
                      fontWeight: 500,
                      fontFamily: 'var(--font-sans)',
                      letterSpacing: '0.01em',
                      color: isDark ? 'rgba(232,228,222,0.75)' : 'rgba(0,0,0,0.5)',
                      background: isDark ? 'var(--m3-surface-container)' : 'var(--m3-surface-container)',
                      backdropFilter: 'blur(16px) saturate(1.5)',
                      WebkitBackdropFilter: 'blur(16px) saturate(1.5)',
                      boxShadow: isDark
                        ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 12px -2px rgba(0,0,0,0.15)'
                        : '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px -2px rgba(0,0,0,0.03)',
                      transition: 'color 0.2s, background 0.2s, box-shadow 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.8)';
                      e.currentTarget.style.background = isDark ? 'var(--m3-surface-container-high)' : 'var(--m3-surface-container-high)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = isDark ? 'rgba(232,228,222,0.75)' : 'rgba(0,0,0,0.5)';
                      e.currentTarget.style.background = isDark ? 'var(--m3-surface-container)' : 'var(--m3-surface-container)';
                    }}
                  >
                    <DownloadIcon style={{ height: '0.875rem', width: '0.875rem' }} />
                    Export
                  </motion.button>
                )}
              </motion.div>

              <Messages />

              {/* Bottom controls area */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' }}>

                {/* Mode hint — M3 tonal surface */}
                <AnimatePresence>
                  {showModeHint && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                      style={{ margin: '0 auto', maxWidth: '48rem', width: '100%', padding: '0.25rem 1rem', overflow: 'hidden', transform: 'translateZ(0)' }}
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
                {(isProcessing || isStreaming) && (
                  <div style={{ margin: '0 auto', maxWidth: '48rem', width: '100%', padding: '0.375rem 1rem' }}>
                    <ThinkingControls
                      isDark={isDark}
                      onStop={abort}
                      onPause={pause}
                      onResume={resume}
                      onReroute={(instruction) => {
                        // Queue the reroute as a follow-up query after current stream
                        abort();
                        // Small delay to let abort propagate, then send reroute
                        setTimeout(() => sendQuery(instruction), 300);
                      }}
                    />
                  </div>
                )}

                <LiveControls />
                <ConceptHierarchyPanel />

                {/* Research Mode Bar + Input — M3 surface container */}
                <div style={{
                  margin: '0 auto',
                  maxWidth: '48rem',
                  width: '100%',
                  padding: '0.25rem 1rem 0.625rem',
                }}>
                  <div style={{ position: 'relative', marginBottom: '0.25rem' }}>
                    <ResearchModeBar isDark={isDark} />
                  </div>
                  <MultimodalInput
                    onSubmit={sendQuery}
                    onStop={abort}
                    isProcessing={isProcessing}
                    showControlsToggle
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
