'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useChatStream } from '@/hooks/use-chat-stream';
import { Messages } from './messages';
import { MultimodalInput } from './multimodal-input';
import { SynthesisCard } from './synthesis-card';
import { CodeRainCanvas, CodeRainOverlays } from './code-rain-canvas';
import { PixelSun } from './pixel-sun';
import { FeatureButtons } from './feature-buttons';
import { RecentChats } from './recent-chats';
import { ResearchModeBar } from './research-mode-bar';
import { ThinkingControls } from './thinking-controls';
import { ChatTOC } from './chat-toc';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { getInferenceModeFeatures } from '@/lib/research/types';
import { CloudIcon, MonitorIcon } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// Dynamic imports — only loaded when the tier enables them
// ═══════════════════════════════════════════════════════════════════

const LiveControls = dynamic(() => import('./live-controls').then((m) => ({ default: m.LiveControls })), { ssr: false });
const ConceptHierarchyPanel = dynamic(() => import('./concept-hierarchy-panel').then((m) => ({ default: m.ConceptHierarchyPanel })), { ssr: false });
const ThoughtVisualizer = dynamic(() => import('./thought-visualizer').then((m) => ({ default: m.ThoughtVisualizer })), { ssr: false });
const PortalSidebar = dynamic(() => import('./portal-sidebar').then((m) => ({ default: m.PortalSidebar })), { ssr: false });

/* Harmonoid-inspired spring configs */
const PANEL_SPRING = { type: 'spring' as const, stiffness: 500, damping: 35, mass: 1.0 };
const ENTER_SPRING = { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.6 };

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

  const fontSize = isCode ? '2rem' : '2.5rem';
  const cursorHeight = isCode ? '2rem' : '2.375rem';

  return (
    <h1
      style={{
        fontFamily: isCode
          ? 'var(--font-mono)'
          : 'var(--font-display)',
        fontSize,
        letterSpacing: isCode ? '0em' : '-0.03em',
        lineHeight: 1.15,
        fontWeight: isCode ? 400 : 600,
        whiteSpace: 'nowrap',
        minHeight: '2.5rem',
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
            ? 'var(--m3-primary)'
            : isDark ? 'rgba(232,228,222,0.5)' : 'rgba(0,0,0,0.4)',
          marginLeft: '1px',
          opacity: cursorOn ? 1 : 0,
          transition: 'opacity 0.1s',
        }}
      />
    </h1>
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
  const chatViewMode = usePFCStore((s) => s.chatViewMode);
  const tierFeatures = usePFCStore((s) => s.tierFeatures);
  const inferenceMode = usePFCStore((s) => s.inferenceMode);
  const { sendQuery, abort, pause, resume } = useChatStream();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [modeHintDismissed, setModeHintDismissed] = useState(false);

  // Ref for the messages scroll container — shared with ChatTOC
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const isEmpty = messages.length === 0;
  const isDark = mounted ? (resolvedTheme === 'dark' || resolvedTheme === 'oled') : true;
  const showThoughtViz = researchChatMode && chatViewMode === 'visualize-thought' && tierFeatures.thoughtVisualizer !== 'off' && !isEmpty;
  const features = useMemo(() => getInferenceModeFeatures(inferenceMode), [inferenceMode]);
  const showModeHint = researchChatMode && !features.playPause && !modeHintDismissed && !isEmpty;

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
            background: 'var(--m3-surface)',
            transform: 'translateZ(0)',
          }}
        >
          {/* Code rain background — clears on search focus, resets periodically */}
          <div style={{ position: 'absolute', inset: 0 }}>
            {mounted && <CodeRainCanvas isDark={isDark} searchFocused={searchFocused} />}
            <CodeRainOverlays isDark={isDark} />
          </div>

          {/* Elegant backdrop blur + shadow — light mode only */}
          {!isDark && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '48rem',
                height: '32rem',
                borderRadius: '2.5rem',
                pointerEvents: 'none',
                zIndex: 1,
                backdropFilter: 'blur(32px) saturate(1.3)',
                WebkitBackdropFilter: 'blur(32px) saturate(1.3)',
                background: 'radial-gradient(ellipse at center, rgba(250,248,244,0.55) 0%, rgba(250,248,244,0.3) 50%, transparent 80%)',
                boxShadow: '0 0 60px 15px rgba(0,0,0,0.03), inset 0 0 30px rgba(255,255,255,0.15)',
                maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
                WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
              }}
            />
          )}

          <div style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            maxWidth: '38rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}>

            {/* Greeting section — Harmonoid spring entrance */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...ENTER_SPRING, delay: 0.05 }}
              style={{
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                transform: 'translateZ(0)',
              }}
            >
              {mounted && <PixelSun size={52} />}
              {mounted && <GreetingTypewriter isDark={isDark} />}
            </motion.div>

            {/* Search bar — M3 surface container with tonal elevation */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...ENTER_SPRING, delay: 0.12 }}
              style={{ transform: 'translateZ(0)' }}
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
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: 'none',
                }}
              >
                <MultimodalInput
                  onSubmit={sendQuery}
                  onStop={abort}
                  isProcessing={isProcessing}
                  hero
                  onFocusChange={setSearchFocused}
                  inputStyle={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1rem',
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                  }}
                />
              </div>
            </motion.div>

            {/* Feature buttons — M3 tonal pills */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ENTER_SPRING, delay: 0.2 }}
              style={{ transform: 'translateZ(0)' }}
            >
              {mounted && <FeatureButtons isDark={isDark} onSubmit={sendQuery} />}
            </motion.div>

            {/* Recent chat sessions */}
            {mounted && <RecentChats isDark={isDark} />}
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          Chat interface — messages + TOC sidebar
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
            {/* Main chat column */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {/* Thought Visualizer (mind-map mode) */}
              {showThoughtViz ? (
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <ThoughtVisualizer isDark={isDark} />
                </div>
              ) : (
                <Messages scrollContainerRef={scrollContainerRef} />
              )}

              {/* Bottom controls area */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ margin: '0 auto', maxWidth: '48rem', width: '100%', padding: '0 1rem' }}>
                  <SynthesisCard />
                </div>

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
                  <div style={{ position: 'relative', marginBottom: '0.375rem' }}>
                    <ResearchModeBar isDark={isDark} />
                  </div>
                  <MultimodalInput
                    onSubmit={sendQuery}
                    onStop={abort}
                    isProcessing={isProcessing}
                    showControlsToggle={tierFeatures.liveControls}
                  />
                </div>
              </div>
            </div>

            {/* TOC sidebar — right side, only on wider screens */}
            <div
              style={{
                borderLeft: `1px solid ${isDark ? 'rgba(50,49,45,0.2)' : 'rgba(190,183,170,0.15)'}`,
              }}
              className="hidden lg:block"
            >
              <ChatTOC scrollContainerRef={scrollContainerRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Portal sidebar — code suggestions and artifacts */}
      {mounted && <PortalSidebar />}
    </div>
  );
}
