'use client';

import { useRef, useState, useCallback, useEffect, type KeyboardEvent } from 'react';
import { ArrowUpIcon, StopCircleIcon, SlidersHorizontalIcon, SearchIcon, PaperclipIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useTheme } from 'next-themes';
import { useIsDark } from '@/hooks/use-is-dark';

// M3 emphasized easing
const M3_EASE = [0.2, 0, 0, 1] as const;

// ---------------------------------------------------------------------------
// Research-ready prompt generation engine
// ---------------------------------------------------------------------------

interface PromptTemplate {
  pattern: RegExp;
  templates: string[];
}

const INTENT_TEMPLATES: PromptTemplate[] = [
  {
    pattern: /^(is|are|does|do|can|could|should|would)\b/i,
    templates: [
      '{input} — what does the meta-analytic evidence show?',
      '{input} — evaluate the causal mechanisms',
      '{input} across different populations and contexts?',
    ],
  },
  {
    pattern: /^(what|how|why|where|when|which)\b/i,
    templates: [
      '{input} — synthesize the strongest available evidence',
      '{input} from a Bayesian perspective?',
      '{input} — compare competing theoretical frameworks',
    ],
  },
  {
    pattern: /^(compare|versus|vs|difference|better|worse)\b/i,
    templates: [
      '{input} — systematic comparison with effect sizes',
      '{input} — what do head-to-head trials show?',
      '{input} controlling for confounding variables',
    ],
  },
  {
    pattern: /^(evidence|research|studies|data|literature)\b/i,
    templates: [
      '{input} — assess study quality and replication rates',
      '{input} — identify publication bias risks',
      '{input} — Bayesian synthesis across heterogeneous designs',
    ],
  },
  {
    pattern: /^(effect|impact|influence|cause|relationship)\b/i,
    templates: [
      '{input} — Bradford Hill causal criteria assessment',
      '{input} — what is the estimated effect size?',
      '{input} with potential confounders controlled?',
    ],
  },
];

const DOMAIN_EXPANSIONS: Array<{ trigger: RegExp; expansions: string[] }> = [
  { trigger: /\b(sleep|insomnia|circadian|rest)\b/i, expansions: [
    'on cognitive performance and decision-making?',
    'compared to pharmacological interventions?',
    'and its dose-response relationship with health outcomes?',
  ]},
  { trigger: /\b(diet|nutrition|food|eating|fasting|calori)\b/i, expansions: [
    'controlling for genetic and lifestyle confounders?',
    'in randomized versus observational study designs?',
    'and metabolic adaptation over time?',
  ]},
  { trigger: /\b(anxiety|depression|mental|therapy|cbt|ssri|psych)\b/i, expansions: [
    'with long-term follow-up data beyond 12 months?',
    'and placebo response rates in clinical trials?',
    'across different severity levels and comorbidities?',
  ]},
  { trigger: /\b(ai|machine.?learn|algorithm|model|neural|gpt|llm)\b/i, expansions: [
    'and benchmark reproducibility across hardware configurations?',
    'compared to human expert performance on equivalent tasks?',
    'accounting for data contamination and training set overlap?',
  ]},
  { trigger: /\b(climate|environment|carbon|emission|pollution|eco)\b/i, expansions: [
    'with uncertainty quantification from IPCC-class models?',
    'comparing observational data with simulation predictions?',
    'and the economic cost-benefit under different scenarios?',
  ]},
  { trigger: /\b(drug|medic|treat|vaccine|pharma|dose|clinical)\b/i, expansions: [
    'with number-needed-to-treat and adverse event profiles?',
    'in phase III trials versus real-world effectiveness?',
    'stratified by age, sex, and comorbidity subgroups?',
  ]},
  { trigger: /\b(education|school|student|learn|teach|test)\b/i, expansions: [
    'controlling for socioeconomic and cultural variables?',
    'with longitudinal tracking of academic outcomes?',
    'and the replication status of foundational studies?',
  ]},
  { trigger: /\b(exercise|fitness|workout|physical|sport|train)\b/i, expansions: [
    'and dose-response curves across intensity levels?',
    'in randomized trials with active control groups?',
    'for different age groups and baseline fitness levels?',
  ]},
];

const ANALYTICAL_FRAMES = [
  'What does the strongest evidence show about {input}?',
  'Is the research on {input} replicable and robust?',
  'Evaluate the causal evidence for {input}',
  'Compare competing explanations for {input}',
  'What are the key methodological concerns in {input} research?',
  'Synthesize the meta-analytic evidence on {input}',
  'How confident should we be about claims regarding {input}?',
  'What would change our understanding of {input}?',
];

function generateRealtimeSuggestions(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const results: string[] = [];

  for (const { pattern, templates } of INTENT_TEMPLATES) {
    if (pattern.test(trimmed)) {
      const picked = templates[Math.floor(Math.random() * templates.length)];
      results.push(picked.replace('{input}', trimmed));
      break;
    }
  }

  for (const { trigger, expansions } of DOMAIN_EXPANSIONS) {
    if (trigger.test(trimmed)) {
      const picked = expansions[Math.floor(Math.random() * expansions.length)];
      results.push(trimmed + ' ' + picked);
      break;
    }
  }

  if (results.length < 4) {
    const shuffledFrames = [...ANALYTICAL_FRAMES].sort(() => Math.random() - 0.5);
    for (const frame of shuffledFrames) {
      if (results.length >= 5) break;
      const suggestion = frame.replace('{input}', trimmed);
      if (!results.some((r) => r.startsWith(suggestion.slice(0, 30)))) {
        results.push(suggestion);
      }
    }
  }

  return results.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Mini PFC Brain icon for send button resting state
// ---------------------------------------------------------------------------

function MiniPFCBrain() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
      <path
        d="M10 3C7 3 5 5.5 5 8c0 1.5.5 2.5 1.5 3.3.3.3.5.7.5 1.2V14c0 .6.4 1 1 1h4c.6 0 1-.4 1-1v-1.5c0-.5.2-.9.5-1.2C14.5 10.5 15 9.5 15 8c0-2.5-2-5-5-5z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M10 4.5v9M7.5 6.5c1 .7 2 .7 2.5 0M10 6.5c.5.7 1.5.7 2.5 0M8 9.5c.8.5 1.5.5 2 0M10 9.5c.5.5 1.2.5 2 0"
        stroke="white"
        strokeWidth="0.6"
        fill="none"
        opacity="0.25"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Brain button with embedded theme toggle — replaces "what's up?" tooltip
// ---------------------------------------------------------------------------

function BrainButtonWithToggle({
  isDark,
  brainGlow,
  onBrainTap,
}: {
  isDark: boolean;
  brainGlow: boolean;
  onBrainTap: () => void;
}) {
  const { theme, setTheme } = useTheme();

  const handlePress = () => {
    // Cycle: light → dark → oled → light
    const current = theme || 'light';
    const next = current === 'light' ? 'dark' : current === 'dark' ? 'oled' : 'light';
    setTheme(next);
    onBrainTap();
  };

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* PFC Brain logo — IS the theme toggle. Glowing = dark mode, dim = light mode */}
      <motion.button
        onClick={handlePress}
        animate={{
          rotate: brainGlow ? [0, -10, 10, -5, 5, 0] : 0,
        }}
        transition={brainGlow ? { duration: 0.6, ease: 'easeInOut' } : { duration: 0.3 }}
        style={{
          height: '2.5rem',
          width: '2.5rem',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: 'none',
          /* Dark mode: brain is white with a glow. Light mode: dim, no glow */
          background: isDark ? 'rgba(244,189,111,0.08)' : 'rgba(128,86,16,0.04)',
          color: isDark ? 'rgba(237,224,212,0.9)' : 'rgba(29,27,22,0.35)',
          boxShadow: 'none',
          transition: 'background 0.3s, color 0.3s, box-shadow 0.3s',
        }}
      >
        <MiniPFCBrain />
      </motion.button>

      {/* RGB chromatic ring flash on tap — gaming laptop style */}
      <AnimatePresence>
        {brainGlow && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: [0, 1, 1, 1, 1, 0],
              scale: [0.8, 1.02, 1.02, 1.02, 1.02, 1.12],
              boxShadow: [
                '0 0 8px rgba(244,189,111,0.7), inset 0 0 4px rgba(244,189,111,0.3)',
                '0 0 14px rgba(34,211,238,0.7), inset 0 0 6px rgba(34,211,238,0.3)',
                '0 0 14px rgba(52,211,153,0.7), inset 0 0 6px rgba(52,211,153,0.3)',
                '0 0 14px rgba(224,120,80,0.7), inset 0 0 6px rgba(224,120,80,0.3)',
                '0 0 14px rgba(251,191,36,0.7), inset 0 0 6px rgba(251,191,36,0.3)',
                '0 0 0px rgba(244,189,111,0), inset 0 0 0px rgba(244,189,111,0)',
              ],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: '-3px',
              borderRadius: '50%',
              border: '2px solid rgba(244,189,111,0.4)',
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Persistent glow halo in dark mode */}
      {isDark && !brainGlow && (
        <div
          style={{
            position: 'absolute',
            inset: '-2px',
            borderRadius: '50%',
            border: '1.5px solid rgba(244,189,111,0.1)',
            boxShadow: '0 0 8px rgba(244,189,111,0.06)',
            pointerEvents: 'none',
            transition: 'opacity 0.3s',
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MultimodalInputProps {
  onSubmit: (query: string) => void;
  onStop?: () => void;
  isProcessing: boolean;
  className?: string;
  hero?: boolean;
  showControlsToggle?: boolean;
  inputStyle?: React.CSSProperties;
  onExpandChange?: (expanded: boolean) => void;
  /** Called when the textarea focus state changes */
  onFocusChange?: (focused: boolean) => void;
  /** Optional animated placeholder overlay shown when input is empty & not focused */
  placeholderOverlay?: React.ReactNode;
}

// Stable selectors
const selectToggleLiveControls = (s: { toggleLiveControls: () => void }) => s.toggleLiveControls;
const selectLiveControlsOpen = (s: { liveControlsOpen: boolean }) => s.liveControlsOpen;

export function MultimodalInput({
  onSubmit,
  onStop,
  isProcessing,
  className,
  hero,
  showControlsToggle,
  inputStyle,
  onExpandChange,
  onFocusChange,
  placeholderOverlay,
}: MultimodalInputProps) {
  const toggleLiveControls = usePFCStore(selectToggleLiveControls);
  const liveControlsOpen = usePFCStore(selectLiveControlsOpen);
  const { isDark } = useIsDark();
  const { theme, setTheme } = useTheme();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [typingSuggestions, setTypingSuggestions] = useState<string[]>([]);
  const [brainGlow, setBrainGlow] = useState(false);
  const [themeCycleFlash, setThemeCycleFlash] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brainGlowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeCycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmitRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Triple-click theme cycling on search bar
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup all timers on unmount
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      if (brainGlowTimerRef.current) clearTimeout(brainGlowTimerRef.current);
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      if (themeCycleTimerRef.current) clearTimeout(themeCycleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (trimmed.length < 3) {
      return;
    }

    debounceRef.current = setTimeout(() => {
      setTypingSuggestions(generateRealtimeSuggestions(trimmed));
    }, 80);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isProcessing) return;
    // Debounce rapid submissions (300ms)
    if (Date.now() - lastSubmitRef.current < 300) return;
    lastSubmitRef.current = Date.now();

    onSubmit(trimmed);
    setValue('');
    setFocused(false);
    setTypingSuggestions([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.blur();
    }
  }, [value, isProcessing, onSubmit]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onSubmit(suggestion);
    setFocused(false);
    setValue('');
    setTypingSuggestions([]);
    if (textareaRef.current) textareaRef.current.blur();
  };

  const handleFocus = () => {
    setFocused(true);
    onFocusChange?.(true);
  };

  const handleBlur = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => {
      blurTimerRef.current = null;
      setFocused(false);
      onFocusChange?.(false);
    }, 200);
  };

  const handleBrainTap = useCallback(() => {
    setBrainGlow(true);
    if (brainGlowTimerRef.current) clearTimeout(brainGlowTimerRef.current);
    brainGlowTimerRef.current = setTimeout(() => {
      brainGlowTimerRef.current = null;
      setBrainGlow(false);
    }, 800);
  }, []);

  // Triple-click on search bar cycles theme: light → dark → oled → light
  const handleSearchBarClick = useCallback(() => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      // Cycle theme
      const current = theme || 'light';
      const next = current === 'light' ? 'dark' : current === 'dark' ? 'oled' : 'light';
      setTheme(next);
      // Visual flash feedback
      setThemeCycleFlash(true);
      if (themeCycleTimerRef.current) clearTimeout(themeCycleTimerRef.current);
      themeCycleTimerRef.current = setTimeout(() => {
        themeCycleTimerRef.current = null;
        setThemeCycleFlash(false);
      }, 600);
    } else {
      // Reset counter after 500ms if no further clicks
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
        clickTimerRef.current = null;
      }, 500);
    }
  }, [theme, setTheme]);

  const trimmedValue = value.trim();
  const visibleTypingSuggestions = trimmedValue.length >= 3 ? typingSuggestions : [];
  const showTyping = focused && visibleTypingSuggestions.length > 0 && !isProcessing;

  // Notify parent of expansion state (for border-radius animation on wrapper)
  useEffect(() => {
    onExpandChange?.(showTyping);
  }, [showTyping, onExpandChange]);

  // Label for the theme cycle flash
  const themeLabel = theme === 'oled' ? 'OLED' : theme === 'dark' ? 'Dark' : 'Light';

  return (
    <div className="relative">
      {/* Theme cycle flash indicator */}
      <AnimatePresence>
        {themeCycleFlash && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: -32, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.4 }}
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 'var(--z-modal)',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.6875rem',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.04em',
              color: isDark ? 'rgba(232,228,222,0.9)' : 'rgba(43,42,39,0.8)',
              background: isDark ? 'rgba(28,27,25,0.9)' : 'rgba(255,255,255,0.9)',
              border: `1px solid ${isDark ? 'rgba(var(--pfc-accent-rgb), 0.3)' : 'rgba(var(--pfc-accent-rgb), 0.25)'}`,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              pointerEvents: 'none',
            }}
          >
            {themeLabel} mode
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input container — border-radius controlled by parent wrapper in hero mode */}
      <div
        className={cn(
          'relative flex w-full flex-col',
          hero ? 'p-2.5 pr-2 pl-4' : 'p-3',
          !hero && 'rounded-2xl',
          !hero && !className?.includes('glass') && 'border bg-card/80',
          className,
        )}
        style={{
          ...(!hero && !className?.includes('glass') ? {
            backdropFilter: 'blur(12px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
          } : undefined),
        }}
      >
        {/* Text row */}
        <div className="flex w-full items-center gap-2">
          {showControlsToggle && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7 shrink-0 rounded-xl transition-all duration-200',
                liveControlsOpen
                  ? 'text-pfc-violet bg-pfc-violet/10'
                  : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/40',
              )}
              onClick={toggleLiveControls}
            >
              <SlidersHorizontalIcon className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* Upload file button — hero (landing) only */}
          {hero && (
            <button
              type="button"
              onClick={() => {
                // Create hidden file input and trigger click
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,.txt,.md,.csv,.json,.doc,.docx,.png,.jpg,.jpeg,.webp';
                input.style.display = 'none';
                input.onchange = () => {
                  // TODO: handle file upload — wire to store/API
                  if (input.files?.[0]) {
                    console.log('File selected:', input.files[0].name);
                  }
                  input.remove();
                };
                document.body.appendChild(input);
                input.click();
              }}
              style={{
                height: '2rem',
                width: '2rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: 'none',
                flexShrink: 0,
                background: 'transparent',
                color: isDark ? 'rgba(200,200,200,0.4)' : 'rgba(0,0,0,0.25)',
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = isDark ? 'rgba(230,230,230,0.7)' : 'rgba(0,0,0,0.5)';
                e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = isDark ? 'rgba(200,200,200,0.4)' : 'rgba(0,0,0,0.25)';
                e.currentTarget.style.background = 'transparent';
              }}
              aria-label="Upload file"
            >
              <PaperclipIcon style={{ height: '1rem', width: '1rem' }} />
            </button>
          )}
          <div style={{ flex: 1, position: 'relative' }}>
            {/* Animated placeholder overlay — shown when input empty; stays during focus for backspace animation */}
            {placeholderOverlay && !value && (
              <div
                onClick={() => textareaRef.current?.focus()}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'auto',
                  cursor: 'text',
                  zIndex: 1,
                }}
              >
                {placeholderOverlay}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onClick={handleSearchBarClick}
              placeholder={placeholderOverlay ? '' : 'Ask a research question...'}
              className={cn(
                'flex-1 resize-none bg-transparent leading-relaxed text-foreground placeholder:text-muted-foreground/40 outline-none border-0 focus:outline-none focus:border-0 focus-visible:outline-none px-0',
                hero ? 'text-[0.9rem] min-h-[36px] max-h-[200px] py-[6px]' : 'text-sm min-h-[24px] max-h-[200px] py-0',
              )}
              rows={1}
              maxLength={10000}
              disabled={isProcessing}
              style={{ boxShadow: 'none', width: '100%', ...inputStyle }}
            />
          </div>

          {/* Send / Stop / Brain button */}
          {isProcessing ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full"
              onClick={onStop}
            >
              <StopCircleIcon className="h-4 w-4 text-destructive" />
            </Button>
          ) : trimmedValue ? (
            /* Active send arrow */
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleSubmit}
              style={{
                height: '2.5rem',
                width: '2.5rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: 'none',
                flexShrink: 0,
                background: 'var(--m3-primary)',
                color: 'var(--m3-on-primary)',
                transition: 'background 0.15s',
              }}
            >
              <ArrowUpIcon style={{ height: '1.125rem', width: '1.125rem' }} />
            </motion.button>
          ) : (
            /* Brain resting state — PFC logo + theme toggle */
            <BrainButtonWithToggle isDark={isDark} brainGlow={brainGlow} onBrainTap={handleBrainTap} />
          )}
        </div>

        {/* Grok-style inline suggestions — only appear when typing */}
        <AnimatePresence>
          {showTyping && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              style={{ overflow: 'hidden', willChange: 'height, opacity', transform: 'translateZ(0)' }}
            >
              <div style={{
                borderTop: `1px solid ${isDark ? 'rgba(79,69,57,0.3)' : 'rgba(208,196,180,0.2)'}`,
                paddingTop: '0.375rem',
                marginTop: '0.5rem',
              }}>
                {visibleTypingSuggestions.map((s, i) => (
                  <motion.button
                    key={`t-${i}-${s.slice(0, 20)}`}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.025, duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
                    onClick={() => handleSuggestionClick(s)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      width: '100%',
                      padding: '0.5rem 0.375rem',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.8125rem',
                      borderRadius: '9999px',
                      color: isDark ? 'rgba(237,224,212,0.8)' : 'rgba(29,27,22,0.55)',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDark ? 'var(--m3-surface-container-high)' : 'rgba(0,0,0,0.03)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <SearchIcon style={{
                      height: '0.875rem',
                      width: '0.875rem',
                      flexShrink: 0,
                      opacity: 0.3,
                    }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontWeight: 600,
                        color: isDark ? 'rgba(237,224,212,0.95)' : 'rgba(29,27,22,0.85)',
                      }}>
                        {trimmedValue}
                      </span>
                      <span style={{ opacity: 0.45 }}>
                        {s.slice(trimmedValue.length)}
                      </span>
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
