'use client';

import { useRef, useState, useCallback, useEffect, type KeyboardEvent } from 'react';
import { ArrowUpIcon, StopCircleIcon, SlidersHorizontalIcon, SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useTheme } from 'next-themes';

// Obsidian Cupertino motion curve
const CUPERTINO_EASE = [0.32, 0.72, 0, 1] as const;

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
  const { setTheme } = useTheme();

  const handlePress = () => {
    // Toggle theme: brain "lights up" → dark mode, "dims" → light mode
    setTheme(isDark ? 'light' : 'dark');
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
          background: isDark ? 'rgba(196,149,106,0.08)' : 'rgba(0,0,0,0.04)',
          color: isDark ? 'rgba(232,228,222,0.9)' : 'rgba(0,0,0,0.35)',
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
                '0 0 8px rgba(196,149,106,0.7), inset 0 0 4px rgba(196,149,106,0.3)',
                '0 0 14px rgba(34,211,238,0.7), inset 0 0 6px rgba(34,211,238,0.3)',
                '0 0 14px rgba(52,211,153,0.7), inset 0 0 6px rgba(52,211,153,0.3)',
                '0 0 14px rgba(224,120,80,0.7), inset 0 0 6px rgba(224,120,80,0.3)',
                '0 0 14px rgba(251,191,36,0.7), inset 0 0 6px rgba(251,191,36,0.3)',
                '0 0 0px rgba(196,149,106,0), inset 0 0 0px rgba(196,149,106,0)',
              ],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: '-3px',
              borderRadius: '50%',
              border: '2px solid rgba(196,149,106,0.4)',
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
            border: '1.5px solid rgba(196,149,106,0.1)',
            boxShadow: '0 0 8px rgba(196,149,106,0.06)',
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
  onFocusChange?: (focused: boolean) => void;
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
  onFocusChange,
}: MultimodalInputProps) {
  const toggleLiveControls = usePFCStore(selectToggleLiveControls);
  const liveControlsOpen = usePFCStore(selectLiveControlsOpen);
  const { resolvedTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [typingSuggestions, setTypingSuggestions] = useState<string[]>([]);
  const [brainGlow, setBrainGlow] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setThemeMounted(true); }, []);
  const isDark = themeMounted ? resolvedTheme === 'dark' : true;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setTypingSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      setTypingSuggestions(generateRealtimeSuggestions(trimmed));
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isProcessing) return;

    onSubmit(trimmed);
    setValue('');
    setFocused(false);
    setTypingSuggestions([]);
    onFocusChange?.(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.blur();
    }
  }, [value, isProcessing, onSubmit, onFocusChange]);

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
    onFocusChange?.(false);
    if (textareaRef.current) textareaRef.current.blur();
  };

  const handleFocus = () => {
    setFocused(true);
    onFocusChange?.(true);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setFocused(false);
      onFocusChange?.(false);
    }, 200);
  };

  const handleBrainTap = useCallback(() => {
    setBrainGlow(true);
    setTimeout(() => setBrainGlow(false), 800);
  }, []);

  const trimmedValue = value.trim();
  const showTyping = focused && trimmedValue.length >= 3 && typingSuggestions.length > 0 && !isProcessing;

  return (
    <div className="relative">
      {/* Input container */}
      <motion.div
        transition={{ duration: 0.32, ease: CUPERTINO_EASE }}
        className={cn(
          'relative flex w-full flex-col transition-shadow duration-200',
          hero ? 'p-3 pr-2' : 'p-3',
          hero ? 'rounded-3xl' : 'rounded-2xl',
          !hero && !className?.includes('glass') && 'border bg-card/80',
          !hero && (focused
            ? ''
            : ''),
          className,
        )}
        style={!hero && !className?.includes('glass') ? {
          backdropFilter: 'blur(12px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
        } : undefined}
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
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Ask a research question..."
            className={cn(
              'flex-1 resize-none bg-transparent leading-relaxed text-foreground placeholder:text-muted-foreground/40 outline-none ring-0 border-0 focus:outline-none focus:ring-0 focus:border-0 focus-visible:outline-none focus-visible:ring-0 p-0',
              hero ? 'text-[0.9rem] min-h-[36px] max-h-[200px]' : 'text-sm min-h-[24px] max-h-[200px]',
            )}
            rows={1}
            disabled={isProcessing}
            style={{ boxShadow: 'none', ...inputStyle }}
          />

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
                background: isDark ? '#FFFFFF' : '#7A3B4E',
                color: isDark ? '#000000' : '#FFFFFF',
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
              transition={{ duration: 0.25, ease: CUPERTINO_EASE }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                borderTop: `1px solid ${isDark ? 'rgba(62,61,57,0.3)' : 'rgba(0,0,0,0.06)'}`,
                paddingTop: '0.375rem',
                marginTop: '0.5rem',
              }}>
                {typingSuggestions.map((s, i) => (
                  <motion.button
                    key={`t-${i}-${s.slice(0, 20)}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.035, duration: 0.18 }}
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
                      color: isDark ? 'rgba(232,228,222,0.8)' : 'rgba(0,0,0,0.55)',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDark ? 'rgba(196,149,106,0.06)' : 'rgba(0,0,0,0.03)';
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
                        color: isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.85)',
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
      </motion.div>
    </div>
  );
}
