'use client';

import { useRef, useState, useCallback, useEffect, useMemo, type KeyboardEvent } from 'react';
import { ArrowUpIcon, StopCircleIcon, SlidersHorizontalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePFCStore } from '@/lib/store/use-pfc-store';

// ---------------------------------------------------------------------------
// Research-ready prompt generation engine
// ---------------------------------------------------------------------------

interface PromptTemplate {
  pattern: RegExp;
  templates: string[];
}

// Templates keyed by detected intent fragments
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

// Domain-specific concept expansions triggered by keywords
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

// Analytical framing starters for when the user types a noun/topic phrase
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

// Idle suggestions — shown when input is empty, always fresh
function generateIdleSuggestions(seed: number): string[] {
  const pools = [
    'Is intermittent fasting effective for weight loss?',
    'What does the evidence say about screen time and children?',
    'How reliable are polygraph tests as evidence?',
    'Does meditation actually reduce anxiety long-term?',
    'Is nuclear energy safer than fossil fuels overall?',
    'What causes antibiotic resistance to accelerate?',
    'Are standardized tests systematically biased?',
    'What is the strongest evidence for dark matter?',
    'Does CBT outperform medication for depression?',
    'How effective is spaced repetition for learning?',
    'Is the replication crisis overstated or understated?',
    'What drives vaccine hesitancy across demographics?',
    'Does cold exposure have proven health benefits?',
    'Are organic foods measurably healthier?',
    'What is the actual effect size of therapy for PTSD?',
    'How strong is the evidence for neuroplasticity in adults?',
    'Does social media causally affect teen mental health?',
    'What are the real cognitive effects of bilingualism?',
    'Is the gut-brain axis clinically actionable yet?',
    'How accurate are AI models at medical diagnosis?',
  ];

  // Pick 3 unique items using a deterministic-ish but fresh selection
  const shuffled = [...pools].sort(() => Math.sin(seed++) - 0.5);
  return shuffled.slice(0, 3);
}

function generateRealtimeSuggestions(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const results: string[] = [];

  // 1. Check intent patterns first
  for (const { pattern, templates } of INTENT_TEMPLATES) {
    if (pattern.test(trimmed)) {
      const picked = templates[Math.floor(Math.random() * templates.length)];
      results.push(picked.replace('{input}', trimmed));
      break;
    }
  }

  // 2. Check domain-specific expansions
  for (const { trigger, expansions } of DOMAIN_EXPANSIONS) {
    if (trigger.test(trimmed)) {
      const picked = expansions[Math.floor(Math.random() * expansions.length)];
      results.push(trimmed + ' ' + picked);
      break;
    }
  }

  // 3. If we have fewer than 3, use analytical frames
  if (results.length < 3) {
    const shuffledFrames = [...ANALYTICAL_FRAMES].sort(() => Math.random() - 0.5);
    for (const frame of shuffledFrames) {
      if (results.length >= 3) break;
      const suggestion = frame.replace('{input}', trimmed);
      // Avoid duplicating what's already generated
      if (!results.some((r) => r.startsWith(suggestion.slice(0, 30)))) {
        results.push(suggestion);
      }
    }
  }

  return results.slice(0, 3);
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
}

export function MultimodalInput({
  onSubmit,
  onStop,
  isProcessing,
  className,
  hero,
  showControlsToggle,
}: MultimodalInputProps) {
  const toggleLiveControls = usePFCStore((s) => s.toggleLiveControls);
  const liveControlsOpen = usePFCStore((s) => s.liveControlsOpen);
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [idleSuggestions, setIdleSuggestions] = useState<string[]>([]);
  const [typingSuggestions, setTypingSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Generate idle suggestions on mount with unique seed
  useEffect(() => {
    setIdleSuggestions(generateIdleSuggestions(Date.now()));
  }, []);

  // Debounced real-time suggestion generation as user types
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

  // Show idle suggestions when empty + focused, typing suggestions when typing
  const trimmedValue = value.trim();
  const showIdle = focused && !trimmedValue && !isProcessing;
  const showTyping = focused && trimmedValue.length >= 3 && typingSuggestions.length > 0 && !isProcessing;
  const activeSuggestions = showTyping ? typingSuggestions : showIdle ? idleSuggestions : [];
  const showSuggestions = activeSuggestions.length > 0;

  return (
    <div className="relative">
      {/* Input container — expands to hold suggestions inline */}
      <motion.div
        layout
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={cn(
          'relative flex w-full flex-col rounded-2xl border bg-card transition-colors duration-200',
          hero ? 'p-4' : 'p-3',
          focused
            ? 'border-border shadow-md'
            : 'border-border/50 shadow-sm',
          className,
        )}
      >
        {/* Text row */}
        <div className="flex w-full items-end gap-2">
          {showControlsToggle && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7 shrink-0 rounded-full transition-colors',
                liveControlsOpen
                  ? 'text-pfc-ember bg-pfc-ember/10'
                  : 'text-muted-foreground/50 hover:text-muted-foreground',
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
            onFocus={() => setFocused(true)}
            onBlur={() => {
              // Delay so suggestion clicks register
              setTimeout(() => setFocused(false), 200);
            }}
            placeholder="Ask a research question…"
            className={cn(
              'flex-1 resize-none bg-transparent leading-relaxed text-foreground placeholder:text-muted-foreground/60 outline-none ring-0 border-0 focus:outline-none focus:ring-0 focus:border-0 focus-visible:outline-none focus-visible:ring-0 p-0',
              hero ? 'text-base min-h-[32px] max-h-[200px]' : 'text-sm min-h-[24px] max-h-[200px]',
            )}
            rows={1}
            disabled={isProcessing}
            style={{ boxShadow: 'none' }}
          />
          {isProcessing ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full"
              onClick={onStop}
            >
              <StopCircleIcon className="h-4 w-4 text-destructive" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="icon"
              className={cn(
                'h-8 w-8 shrink-0 rounded-full transition-all duration-200',
                value.trim()
                  ? 'bg-pfc-ember hover:bg-pfc-ember/90 scale-100'
                  : 'bg-muted hover:bg-muted scale-95 opacity-40',
              )}
              onClick={handleSubmit}
              disabled={!value.trim()}
            >
              <ArrowUpIcon className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Inline suggestions — real-time as you type or idle when empty */}
        <AnimatePresence mode="wait">
          {showSuggestions && (
            <motion.div
              key={showTyping ? 'typing' : 'idle'}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-3 border-t border-border/30 space-y-1.5">
                {showTyping && (
                  <p className="text-[9px] uppercase tracking-wider text-pfc-violet/50 font-medium mb-1">
                    Research-ready completions
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {activeSuggestions.map((s, i) => (
                    <motion.button
                      key={`${showTyping ? 't' : 'i'}-${i}-${s.slice(0, 20)}`}
                      initial={{ opacity: 0, scale: 0.95, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ delay: i * 0.04, duration: 0.15 }}
                      onClick={() => handleSuggestionClick(s)}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-full border text-left',
                        showTyping ? 'bg-pfc-violet/5 border-pfc-violet/20 text-pfc-violet/80 hover:bg-pfc-violet/10 hover:text-pfc-violet' : 'bg-muted/40 border-border/40 text-muted-foreground hover:text-foreground hover:border-pfc-ember/40 hover:bg-pfc-ember/5',
                        'transition-all duration-150 cursor-pointer',
                        'max-w-full',
                      )}
                    >
                      {showTyping ? (
                        <span>
                          <span className="font-medium text-foreground/80">{trimmedValue}</span>
                          <span className="text-pfc-violet/60">{s.slice(trimmedValue.length)}</span>
                        </span>
                      ) : (
                        s
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
