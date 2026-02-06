'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  KeyIcon,
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  CheckCircle2Icon,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════
// Code tokens for canvas rain — multicolor syntax highlighting
// ═══════════════════════════════════════════════════════════════════════

const TOKEN_POOL = [
  // Keywords (violet)
  { text: 'const', color: '#8B7CF6' },
  { text: 'async', color: '#8B7CF6' },
  { text: 'await', color: '#8B7CF6' },
  { text: 'function', color: '#8B7CF6' },
  { text: 'return', color: '#8B7CF6' },
  { text: 'import', color: '#8B7CF6' },
  { text: 'export', color: '#8B7CF6' },
  { text: 'yield', color: '#8B7CF6' },
  { text: 'class', color: '#8B7CF6' },
  { text: 'type', color: '#8B7CF6' },
  { text: 'interface', color: '#8B7CF6' },
  { text: 'if', color: '#8B7CF6' },
  { text: 'else', color: '#8B7CF6' },
  { text: 'for', color: '#8B7CF6' },
  { text: 'while', color: '#8B7CF6' },
  { text: 'new', color: '#8B7CF6' },
  { text: 'try', color: '#8B7CF6' },
  { text: 'catch', color: '#8B7CF6' },
  // Functions (ember)
  { text: 'runPipeline()', color: '#E07850' },
  { text: 'analyzeQuery()', color: '#E07850' },
  { text: 'calibrate()', color: '#E07850' },
  { text: 'synthesize()', color: '#E07850' },
  { text: 'arbitrate()', color: '#E07850' },
  { text: 'assessTruth()', color: '#E07850' },
  { text: 'updateBayesian()', color: '#E07850' },
  { text: 'computeTDA()', color: '#E07850' },
  { text: 'inferCausal()', color: '#E07850' },
  { text: 'parseEvidence()', color: '#E07850' },
  { text: 'generateReflection()', color: '#E07850' },
  { text: 'quantifyUncertainty()', color: '#E07850' },
  // Strings (green)
  { text: '"confidence"', color: '#4ADE80' },
  { text: '"entropy"', color: '#4ADE80' },
  { text: '"dissonance"', color: '#4ADE80' },
  { text: '"synthesis"', color: '#4ADE80' },
  { text: '"pipeline"', color: '#4ADE80' },
  { text: '"bayesian"', color: '#4ADE80' },
  { text: '"causal"', color: '#4ADE80' },
  { text: '"meta-analysis"', color: '#4ADE80' },
  // Numbers (cyan)
  { text: '0.95', color: '#22D3EE' },
  { text: '0.73', color: '#22D3EE' },
  { text: '14.3', color: '#22D3EE' },
  { text: '0.81', color: '#22D3EE' },
  { text: '256', color: '#22D3EE' },
  { text: '1024', color: '#22D3EE' },
  { text: '0.42', color: '#22D3EE' },
  { text: '3.14', color: '#22D3EE' },
  // Types (yellow)
  { text: 'PipelineEvent', color: '#FACC15' },
  { text: 'StageResult', color: '#FACC15' },
  { text: 'DualMessage', color: '#FACC15' },
  { text: 'TruthAssessment', color: '#FACC15' },
  { text: 'SignalUpdate', color: '#FACC15' },
  { text: 'TDASnapshot', color: '#FACC15' },
  { text: 'QueryAnalysis', color: '#FACC15' },
  // Operators (dim)
  { text: '=>', color: '#9CA3AF' },
  { text: '===', color: '#9CA3AF' },
  { text: '...', color: '#9CA3AF' },
  { text: '{ }', color: '#9CA3AF' },
  { text: '<T>', color: '#9CA3AF' },
  { text: '??', color: '#9CA3AF' },
  { text: '|>', color: '#9CA3AF' },
  // Comments (dim green)
  { text: '// meta-analysis', color: '#86EFAC' },
  { text: '// calibration', color: '#86EFAC' },
  { text: '// adversarial', color: '#86EFAC' },
  { text: '// truth-bot', color: '#86EFAC' },
  { text: '// reflection', color: '#86EFAC' },
  { text: '// bayesian update', color: '#86EFAC' },
];

// ═══════════════════════════════════════════════════════════════════════
// Canvas rain column
// ═══════════════════════════════════════════════════════════════════════

interface RainColumn {
  x: number;
  y: number;
  speed: number;
  fontSize: number;
  tokens: { text: string; color: string }[];
  tokenIndex: number;
  opacity: number;
  trail: { text: string; color: string; y: number; opacity: number }[];
}

function createColumn(canvasWidth: number, canvasHeight: number): RainColumn {
  const fontSize = 10 + Math.random() * 4;
  const tokenCount = 4 + Math.floor(Math.random() * 6);
  const tokens: { text: string; color: string }[] = [];
  for (let i = 0; i < tokenCount; i++) {
    tokens.push(TOKEN_POOL[Math.floor(Math.random() * TOKEN_POOL.length)]);
  }
  return {
    x: Math.random() * canvasWidth,
    y: -Math.random() * canvasHeight,
    speed: 0.4 + Math.random() * 1.2,
    fontSize,
    tokens,
    tokenIndex: 0,
    opacity: 0.15 + Math.random() * 0.45,
    trail: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Canvas rain component
// ═══════════════════════════════════════════════════════════════════════

function CodeRainCanvas({ isDark }: { isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const columnsRef = useRef<RainColumn[]>([]);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx!.scale(dpr, dpr);

      // Regenerate columns on resize
      const colCount = Math.floor(window.innerWidth / 28);
      columnsRef.current = [];
      for (let i = 0; i < colCount; i++) {
        columnsRef.current.push(createColumn(window.innerWidth, window.innerHeight));
      }
    }

    resize();
    window.addEventListener('resize', resize);

    function draw(timestamp: number) {
      if (!canvas || !ctx) return;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      const dt = Math.min(delta / 16.67, 3); // Normalize to ~60fps

      const w = window.innerWidth;
      const h = window.innerHeight;

      // Clear with semi-transparent background for trail effect
      if (isDark) {
        ctx.fillStyle = 'rgba(5, 5, 8, 0.12)';
      } else {
        ctx.fillStyle = 'rgba(252, 250, 248, 0.15)';
      }
      ctx.fillRect(0, 0, w, h);

      for (const col of columnsRef.current) {
        col.y += col.speed * dt;

        // Draw current token
        const token = col.tokens[col.tokenIndex % col.tokens.length];
        ctx.font = `${col.fontSize}px "Geist Mono", ui-monospace, monospace`;

        // Lead character is brighter
        const alpha = isDark ? col.opacity * 1.2 : col.opacity * 0.8;
        ctx.fillStyle = token.color;
        ctx.globalAlpha = Math.min(alpha, 1);
        ctx.fillText(token.text, col.x, col.y);

        // Advance token every few frames
        if (Math.random() < 0.02) {
          col.tokenIndex++;
        }

        // Reset when off screen
        if (col.y > h + 50) {
          col.y = -Math.random() * 200 - 50;
          col.x = Math.random() * w;
          col.speed = 0.4 + Math.random() * 1.2;
          col.tokenIndex = Math.floor(Math.random() * col.tokens.length);
          col.opacity = 0.15 + Math.random() * 0.45;
        }
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{ pointerEvents: 'none' }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Boot lines
// ═══════════════════════════════════════════════════════════════════════

const BOOT_LINES = [
  { text: 'INITIALIZING PFC META-ANALYTICAL ENGINE v2.0', type: 'title' },
  { text: 'LOADING COGNITIVE MODULES', type: 'title' },
  { text: '  \u251C\u2500 triage.module .............. [OK]', type: 'module' },
  { text: '  \u251C\u2500 memory.module .............. [OK]', type: 'module' },
  { text: '  \u251C\u2500 routing.module ............. [OK]', type: 'module' },
  { text: '  \u251C\u2500 statistical.module ......... [OK]', type: 'module' },
  { text: '  \u251C\u2500 causal.module .............. [OK]', type: 'module' },
  { text: '  \u251C\u2500 meta_analysis.module ....... [OK]', type: 'module' },
  { text: '  \u251C\u2500 bayesian.module ............ [OK]', type: 'module' },
  { text: '  \u251C\u2500 synthesis.module ........... [OK]', type: 'module' },
  { text: '  \u251C\u2500 adversarial.module ......... [OK]', type: 'module' },
  { text: '  \u2514\u2500 calibration.module ......... [OK]', type: 'module' },
  { text: 'ALL SYSTEMS NOMINAL', type: 'success' },
];

const LINE_DELAY_MS = 65;

function formatLine(text: string, type: string) {
  if (type === 'module') {
    const okIndex = text.lastIndexOf('[OK]');
    if (okIndex !== -1) {
      return (
        <>
          <span className="text-pfc-green/50">{text.slice(0, okIndex)}</span>
          <span className="text-pfc-green font-bold">[OK]</span>
        </>
      );
    }
  }
  return text;
}

// ═══════════════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════════════

type Phase = 'boot' | 'apikey' | 'launching';

export default function OnboardingPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [phase, setPhase] = useState<Phase>('boot');
  const [visibleCount, setVisibleCount] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // If already set up, redirect immediately
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const done = localStorage.getItem('pfc-setup-done');
      if (done) router.replace('/');
    }
  }, [router]);

  // Boot sequence auto-advance
  useEffect(() => {
    if (phase !== 'boot') return;
    if (visibleCount < BOOT_LINES.length) {
      const timer = setTimeout(() => setVisibleCount((v) => v + 1), LINE_DELAY_MS);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setPhase('apikey'), 400);
      return () => clearTimeout(timer);
    }
  }, [visibleCount, phase]);

  const handleSaveKey = useCallback(() => {
    if (apiKey.trim()) {
      localStorage.setItem('pfc-api-key', apiKey.trim());
    }
    localStorage.setItem('pfc-setup-done', 'true');
    setPhase('launching');
    setTimeout(() => router.push('/'), 1200);
  }, [apiKey, router]);

  const handleSkip = useCallback(() => {
    localStorage.setItem('pfc-setup-done', 'true');
    router.push('/');
  }, [router]);

  const isDark = mounted ? resolvedTheme === 'dark' : true;

  return (
    <div
      className={cn(
        'relative min-h-screen flex items-center justify-center p-4 overflow-hidden',
        isDark ? 'bg-[#050508]' : 'bg-[#FCFAF8]',
      )}
    >
      {/* Canvas code rain */}
      {mounted && <CodeRainCanvas isDark={isDark} />}

      {/* Vignette overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-[2]"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at center, transparent 30%, rgba(5,5,8,0.9) 100%)'
            : 'radial-gradient(ellipse at center, transparent 30%, rgba(252,250,248,0.92) 100%)',
        }}
      />

      {/* Scanlines */}
      <div
        className="pointer-events-none fixed inset-0 z-[3]"
        style={{
          background: isDark
            ? 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)'
            : 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.015) 2px, rgba(0,0,0,0.015) 4px)',
        }}
      />

      {/* Skip button */}
      <Button
        variant="ghost"
        onClick={handleSkip}
        className={cn(
          'fixed top-4 right-4 z-20 font-mono text-xs',
          isDark
            ? 'text-white/20 hover:text-white/50 hover:bg-white/5'
            : 'text-black/20 hover:text-black/50 hover:bg-black/5',
        )}
      >
        Skip &gt;&gt;
      </Button>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className={cn(
          'relative z-10 w-full max-w-lg rounded-2xl p-6 sm:p-8',
          isDark
            ? 'bg-[#0a0a0f]/80 backdrop-blur-2xl border border-white/[0.06] shadow-[0_0_80px_rgba(107,92,231,0.06),0_0_160px_rgba(193,95,60,0.04)]'
            : 'bg-white/80 backdrop-blur-2xl border border-black/[0.06] shadow-[0_8px_60px_rgba(0,0,0,0.08)]',
        )}
      >
        <AnimatePresence mode="wait">
          {/* ─── Boot ─── */}
          {phase === 'boot' && (
            <motion.div
              key="boot"
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="font-mono text-xs sm:text-sm leading-relaxed space-y-0.5 min-h-[280px]"
            >
              {BOOT_LINES.slice(0, visibleCount).map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.1 }}
                  className={cn(
                    'whitespace-pre',
                    line.type === 'title' && 'text-pfc-ember',
                    line.type === 'module' && 'text-pfc-green/50',
                    line.type === 'success' && 'text-pfc-green font-bold mt-2',
                  )}
                >
                  {formatLine(line.text, line.type)}
                </motion.div>
              ))}
              {visibleCount > 0 && visibleCount < BOOT_LINES.length && (
                <span className="text-pfc-green animate-blink">{'\u2588'}</span>
              )}
            </motion.div>
          )}

          {/* ─── API Key ─── */}
          {phase === 'apikey' && (
            <motion.div
              key="apikey"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.35 }}
              className="space-y-6"
            >
              {/* Logo */}
              <div className="text-center space-y-3">
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.08, duration: 0.35 }}
                  className="flex justify-center"
                >
                  <div
                    className={cn(
                      'h-14 w-14 rounded-2xl border flex items-center justify-center',
                      isDark
                        ? 'bg-gradient-to-br from-pfc-ember/20 to-pfc-violet/20 border-white/10'
                        : 'bg-gradient-to-br from-pfc-ember/10 to-pfc-violet/10 border-black/5',
                    )}
                  >
                    <span className="text-2xl font-bold bg-gradient-to-r from-pfc-ember to-pfc-violet bg-clip-text text-transparent font-mono">
                      PFC
                    </span>
                  </div>
                </motion.div>
                <h1 className={cn('text-lg font-bold tracking-tight', isDark ? 'text-white' : 'text-foreground')}>
                  Meta-Analytical PFC Engine
                </h1>
                <p className={cn('text-xs', isDark ? 'text-white/35' : 'text-muted-foreground')}>
                  10-stage analytical pipeline for stress-testing claims
                </p>
              </div>

              {/* Key input */}
              <div className="space-y-3">
                <div className={cn('flex items-center gap-2 text-xs', isDark ? 'text-white/45' : 'text-muted-foreground')}>
                  <KeyIcon className="h-3.5 w-3.5" />
                  <span>OpenAI API Key</span>
                  <span className={cn('ml-auto', isDark ? 'text-white/20' : 'text-muted-foreground/50')}>(optional)</span>
                </div>

                <div className="relative">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className={cn(
                      'font-mono text-sm pr-10',
                      isDark
                        ? 'bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-pfc-ember/50 focus:ring-pfc-ember/20'
                        : 'bg-black/[0.02] border-black/10 text-foreground placeholder:text-muted-foreground/30 focus:border-pfc-ember/50 focus:ring-pfc-ember/20',
                    )}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveKey();
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7',
                      isDark ? 'text-white/25 hover:text-white/50' : 'text-muted-foreground/40 hover:text-muted-foreground',
                    )}
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOffIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                <p className={cn('text-[10px] leading-relaxed', isDark ? 'text-white/20' : 'text-muted-foreground/50')}>
                  Stored locally in your browser. Without a key the engine runs in simulation mode.
                </p>
              </div>

              {/* Action */}
              <Button
                onClick={handleSaveKey}
                className={cn(
                  'w-full gap-2 font-mono text-sm',
                  'bg-gradient-to-r from-pfc-ember to-pfc-ember/80 hover:from-pfc-ember/90 hover:to-pfc-ember/70',
                  'text-white border-0',
                  'shadow-[0_0_24px_rgba(193,95,60,0.15)]',
                )}
              >
                {apiKey.trim() ? 'Save & Launch' : 'Continue in Simulation Mode'}
                <ArrowRightIcon className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {/* ─── Launching ─── */}
          {phase === 'launching' && (
            <motion.div
              key="launching"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center justify-center py-16 space-y-4"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                className="h-10 w-10 rounded-full border-2 border-pfc-ember/30 border-t-pfc-ember"
              />
              <div className={cn('flex items-center gap-2 text-sm font-mono', isDark ? 'text-white/50' : 'text-muted-foreground')}>
                <CheckCircle2Icon className="h-4 w-4 text-pfc-green" />
                Launching PFC Engine...
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
