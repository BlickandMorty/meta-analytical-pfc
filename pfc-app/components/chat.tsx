'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useChatStream } from '@/hooks/use-chat-stream';
import { ChatHeader } from './chat-header';
import { Messages } from './messages';
import { MultimodalInput } from './multimodal-input';
import { SynthesisCard } from './synthesis-card';
import { LiveControls } from './live-controls';
import { ConceptHierarchyPanel } from './concept-hierarchy-panel';
import { CodeRainCanvas, CodeRainOverlays } from './code-rain-canvas';
import { BrainMascot } from './brain-mascot';
import { FeatureButtons } from './feature-buttons';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';

const CUPERTINO_EASE = [0.32, 0.72, 0, 1] as const;

// ═══════════════════════════════════════════════════════════════════
// IDE Syntax Coloring — each greeting gets language-appropriate colors
// ═══════════════════════════════════════════════════════════════════

interface ColoredSpan {
  text: string;
  color: string;
}

type GreetingDef = {
  plain: string;
  colored: ColoredSpan[];
  isCode: boolean;
};

const GREETING_DEFS: GreetingDef[] = [
  {
    plain: 'Greetings, Researcher',
    colored: [
      { text: 'Greetings, ', color: '#C4B5FD' },
      { text: 'Researcher', color: '#F9A8D4' },
    ],
    isCode: false,
  },
  {
    plain: 'print("Greetings, Researcher")',
    colored: [
      { text: 'print', color: '#22D3EE' },
      { text: '(', color: '#9CA3AF' },
      { text: '"Greetings, Researcher"', color: '#4ADE80' },
      { text: ')', color: '#9CA3AF' },
    ],
    isCode: true,
  },
  {
    plain: 'console.log("Greetings, Researcher")',
    colored: [
      { text: 'console', color: '#E07850' },
      { text: '.', color: '#9CA3AF' },
      { text: 'log', color: '#E07850' },
      { text: '(', color: '#9CA3AF' },
      { text: '"Greetings, Researcher"', color: '#4ADE80' },
      { text: ')', color: '#9CA3AF' },
    ],
    isCode: true,
  },
  {
    plain: 'echo "Greetings, Researcher"',
    colored: [
      { text: 'echo', color: '#F87171' },
      { text: ' ', color: '#9CA3AF' },
      { text: '"', color: '#FBBF24' },
      { text: 'Greetings, Researcher', color: '#FBBF24' },
      { text: '"', color: '#FBBF24' },
    ],
    isCode: true,
  },
  {
    plain: 'return "Greetings, Researcher"',
    colored: [
      { text: 'return', color: '#C4B5FD' },
      { text: ' ', color: '#9CA3AF' },
      { text: '"Greetings, Researcher"', color: '#4ADE80' },
    ],
    isCode: true,
  },
  {
    plain: 'SELECT greeting FROM researchers',
    colored: [
      { text: 'SELECT', color: '#22D3EE' },
      { text: ' greeting ', color: '#F9A8D4' },
      { text: 'FROM', color: '#22D3EE' },
      { text: ' researchers', color: '#FBBF24' },
    ],
    isCode: true,
  },
  {
    plain: 'fmt.Println("Greetings, Researcher")',
    colored: [
      { text: 'fmt', color: '#22D3EE' },
      { text: '.', color: '#9CA3AF' },
      { text: 'Println', color: '#E07850' },
      { text: '(', color: '#9CA3AF' },
      { text: '"Greetings, Researcher"', color: '#4ADE80' },
      { text: ')', color: '#9CA3AF' },
    ],
    isCode: true,
  },
  {
    plain: 'puts "Greetings, Researcher"',
    colored: [
      { text: 'puts', color: '#C4B5FD' },
      { text: ' ', color: '#9CA3AF' },
      { text: '"Greetings, Researcher"', color: '#F87171' },
    ],
    isCode: true,
  },
  {
    plain: 'System.out.println("Greetings")',
    colored: [
      { text: 'System', color: '#FACC15' },
      { text: '.out.', color: '#9CA3AF' },
      { text: 'println', color: '#E07850' },
      { text: '(', color: '#9CA3AF' },
      { text: '"Greetings"', color: '#4ADE80' },
      { text: ')', color: '#9CA3AF' },
    ],
    isCode: true,
  },
  {
    plain: 'grep -i "Greetings, Researcher"',
    colored: [
      { text: 'grep', color: '#22D3EE' },
      { text: ' -i ', color: '#C4B5FD' },
      { text: '"Greetings, Researcher"', color: '#4ADE80' },
    ],
    isCode: true,
  },
];

// ═══════════════════════════════════════════════════════════════════
// GreetingTypewriter — IDE-colored typewriter with blinking cursor
// ═══════════════════════════════════════════════════════════════════

function GreetingTypewriter({ isDark }: { isDark: boolean }) {
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
      const target = GREETING_DEFS[s.variation].plain;

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
          s.variation = (s.variation + 1) % GREETING_DEFS.length;
          s.phase = 'typing';
          setVariationIdx(s.variation);
          timer = setTimeout(tick, 500);
        }
      }
    }

    timer = setTimeout(tick, 120);
    return () => clearTimeout(timer);
  }, []);

  const def = GREETING_DEFS[variationIdx];
  const isCode = def.isCode;

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

  const fontSize = isCode ? '1.6rem' : '2.6rem';
  const cursorHeight = isCode ? '1.6rem' : '2.4rem';

  return (
    <h1
      style={{
        fontFamily: isCode
          ? 'ui-monospace, "SF Mono", "Fira Code", monospace'
          : '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize,
        letterSpacing: isCode ? '0em' : '-0.03em',
        lineHeight: 1.15,
        fontWeight: isCode ? 400 : 500,
        whiteSpace: 'nowrap',
        minHeight: '3rem',
        display: 'flex',
        alignItems: 'center',
        margin: 0,
      }}
    >
      {coloredOutput.map((span, i) => (
        <span key={i} style={{ color: span.color }}>{span.text}</span>
      ))}
      <span
        style={{
          display: 'inline-block',
          width: '2px',
          height: cursorHeight,
          backgroundColor: isCode
            ? '#8B7CF6'
            : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
          marginLeft: '1px',
          opacity: cursorOn ? 1 : 0,
          transition: 'opacity 0.1s',
        }}
      />
    </h1>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Chat — landing page ↔ chat interface
// ═══════════════════════════════════════════════════════════════════

export function Chat() {
  const messages = usePFCStore((s) => s.messages);
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const { sendQuery, abort } = useChatStream();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => setMounted(true), []);

  const isEmpty = messages.length === 0;
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  return (
    <div style={{ position: 'relative', display: 'flex', height: '100%', flexDirection: 'column' }}>

      {/* ═══════════════════════════════════════════════════════════════
          Landing page — code rain + search bar
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
            /* OLED gradient: subtle radial from pure black → dark gray center → black */
            background: searchFocused
              ? (isDark ? '#000000' : '#F0E8DE')
              : (isDark
                ? 'radial-gradient(ellipse at 50% 50%, #0a0a0a 0%, #000000 70%)'
                : 'radial-gradient(ellipse at 50% 50%, #F4ECE2 0%, #F0E8DE 70%)'),
            transition: 'background 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          {/* Code rain background — fades on search focus */}
          <motion.div
            animate={{ opacity: searchFocused ? 0 : 1 }}
            transition={{ duration: 0.4, ease: CUPERTINO_EASE }}
            style={{ position: 'absolute', inset: 0, willChange: 'opacity' }}
          >
            {mounted && <CodeRainCanvas isDark={isDark} />}
            <CodeRainOverlays isDark={isDark} />
          </motion.div>

          <div style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            maxWidth: '40rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}>

            {/* Greeting section — orchestrated reveal with scale */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1, ease: CUPERTINO_EASE }}
              style={{
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                filter: isDark
                  ? 'drop-shadow(0 4px 24px rgba(0,0,0,0.4)) drop-shadow(0 1px 4px rgba(0,0,0,0.3))'
                  : 'drop-shadow(0 4px 24px rgba(80,50,20,0.08)) drop-shadow(0 1px 4px rgba(80,50,20,0.06))',
              }}
            >
              {mounted && <BrainMascot isDark={isDark} />}
              {mounted && <GreetingTypewriter isDark={isDark} />}
            </motion.div>

            {/* Search bar — snappy entrance with spring */}
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.22, ease: CUPERTINO_EASE }}
            >
              <div
                data-search-bar
                style={{
                  borderRadius: '1.75rem',
                  overflow: 'hidden',
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.45)',
                  border: isDark
                    ? '1.5px solid rgba(255,255,255,0.14)'
                    : '1.5px solid rgba(0,0,0,0.12)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <MultimodalInput
                  onSubmit={sendQuery}
                  onStop={abort}
                  isProcessing={isProcessing}
                  hero
                  onFocusChange={setSearchFocused}
                  inputStyle={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                    fontSize: '1.05rem',
                    fontWeight: 550,
                    letterSpacing: '-0.01em',
                  }}
                />
              </div>
            </motion.div>

            {/* Feature buttons — final stagger element */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.36, ease: CUPERTINO_EASE }}
            >
              {mounted && <FeatureButtons isDark={isDark} onSubmit={sendQuery} />}
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          Chat interface — simple fade-in
          ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {!isEmpty && (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.55, ease: CUPERTINO_EASE }}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              minHeight: 0,
              background: 'var(--chat-surface)',
            }}
          >
            <div style={{ margin: '0 auto', maxWidth: '56rem', width: '100%', padding: '0.75rem 1rem 0' }}>
              <ChatHeader />
            </div>
            <Messages />
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ margin: '0 auto', maxWidth: '48rem', width: '100%', padding: '0 1rem' }}>
                <SynthesisCard />
              </div>
              <LiveControls />
              <ConceptHierarchyPanel />
              <div style={{ margin: '0 auto', maxWidth: '48rem', width: '100%', padding: '0.5rem 1rem 1rem' }}>
                <MultimodalInput
                  onSubmit={sendQuery}
                  onStop={abort}
                  isProcessing={isProcessing}
                  showControlsToggle
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
