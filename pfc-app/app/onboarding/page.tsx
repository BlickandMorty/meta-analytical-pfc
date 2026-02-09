'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { GlassBubbleButton } from '@/components/glass-bubble-button';
import { CodeRainCanvas, CodeRainOverlays } from '@/components/code-rain-canvas';
import {
  KeyIcon,
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  CheckCircle2Icon,
  MonitorIcon,
  TerminalIcon,
} from 'lucide-react';

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

// ═══════════════════════════════════════════════════════════════════════
// Main page — bubble-style onboarding
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const done = localStorage.getItem('pfc-setup-done');
      if (done) router.replace('/');
    }
  }, [router]);

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

  // Shared bubble glass style
  const bubbleGlass: React.CSSProperties = {
    background: isDark ? 'rgba(12,12,16,0.88)' : 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(120px) saturate(2.4)',
    WebkitBackdropFilter: 'blur(120px) saturate(2.4)',
    boxShadow: isDark
      ? '0 8px 60px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.05), inset 0 0.5px 0 rgba(255,255,255,0.06)'
      : '0 8px 60px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.08), inset 0 0.5px 0 rgba(255,255,255,0.8)',
    borderRadius: '1.5rem',
    border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
  };

  const textDim = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)';
  const textFaint = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.2)';

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        overflow: 'hidden',
        background: isDark ? '#050508' : '#FCFAF8',
      }}
    >
      {/* Canvas code rain + overlays */}
      {mounted && <CodeRainCanvas isDark={isDark} />}
      <CodeRainOverlays isDark={isDark} />

      {/* Skip button */}
      <button
        onClick={handleSkip}
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 20,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6875rem',
          cursor: 'pointer',
          border: 'none',
          background: 'transparent',
          color: textFaint,
          padding: '0.375rem 0.75rem',
          borderRadius: '0.5rem',
          transition: 'color 0.2s, background 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = textFaint;
          e.currentTarget.style.background = 'transparent';
        }}
      >
        Skip &gt;&gt;
      </button>

      {/* Main bubble card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.8 }}
        style={{
          ...bubbleGlass,
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '28rem',
          padding: '1.5rem 1.75rem',
        }}
      >
        <AnimatePresence mode="wait">
          {/* ─── Boot ─── */}
          {phase === 'boot' && (
            <motion.div
              key="boot"
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                lineHeight: 1.8,
                minHeight: '280px',
              }}
            >
              {BOOT_LINES.slice(0, visibleCount).map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.1 }}
                  style={{
                    whiteSpace: 'pre',
                    color: line.type === 'title'
                      ? 'var(--color-pfc-ember)'
                      : line.type === 'success'
                        ? 'var(--color-pfc-green)'
                        : undefined,
                    fontWeight: line.type === 'success' ? 700 : undefined,
                    marginTop: line.type === 'success' ? '0.5rem' : undefined,
                  }}
                >
                  {line.type === 'module' ? (
                    <>
                      <span style={{ color: isDark ? 'rgba(74,222,128,0.5)' : 'rgba(74,222,128,0.6)' }}>
                        {line.text.slice(0, line.text.lastIndexOf('[OK]'))}
                      </span>
                      <span style={{ color: 'var(--color-pfc-green)', fontWeight: 700 }}>[OK]</span>
                    </>
                  ) : (
                    line.text
                  )}
                </motion.div>
              ))}
              {visibleCount > 0 && visibleCount < BOOT_LINES.length && (
                <span style={{ color: 'var(--color-pfc-green)' }}>{'\u2588'}</span>
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
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
              {/* Logo */}
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.08, duration: 0.35 }}
                >
                  <div
                    style={{
                      height: '3.5rem',
                      width: '3.5rem',
                      borderRadius: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isDark
                        ? 'linear-gradient(135deg, rgba(224,120,80,0.2), rgba(139,124,246,0.2))'
                        : 'linear-gradient(135deg, rgba(224,120,80,0.1), rgba(139,124,246,0.1))',
                      border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        background: 'linear-gradient(135deg, var(--color-pfc-ember), var(--color-pfc-violet))',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      PFC
                    </span>
                  </div>
                </motion.div>
                <h1 style={{ fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em', color: isDark ? 'rgba(255,255,255,0.95)' : 'var(--foreground)' }}>
                  Meta-Analytical PFC Engine
                </h1>
                <p style={{ fontSize: '0.6875rem', color: textDim }}>
                  10-stage analytical pipeline for stress-testing claims
                </p>
              </div>

              {/* Key input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.6875rem', color: textDim }}>
                  <KeyIcon style={{ height: '0.875rem', width: '0.875rem' }} />
                  <span>OpenAI API Key</span>
                  <span style={{ marginLeft: 'auto', color: textFaint }}>(optional)</span>
                </div>

                <div style={{ position: 'relative' }}>
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="font-mono text-sm pr-10"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                      color: isDark ? 'rgba(255,255,255,0.9)' : 'var(--foreground)',
                      borderRadius: '0.625rem',
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveKey(); }}
                  />
                  <button
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-md cursor-pointer border-none bg-transparent"
                    style={{ color: textDim }}
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOffIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
                  </button>
                </div>

                <p style={{ fontSize: '0.5625rem', lineHeight: 1.6, color: textFaint }}>
                  Stored locally in your browser. Without a key the engine runs in simulation mode.
                </p>
              </div>

              {/* Platform info bubble */}
              <div
                style={{
                  borderRadius: '0.75rem',
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <p style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, color: textFaint }}>
                  Works on all platforms
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {[
                    { label: 'macOS', icon: TerminalIcon, cmd: 'brew install node' },
                    { label: 'Linux', icon: TerminalIcon, cmd: 'apt install nodejs' },
                    { label: 'Windows', icon: MonitorIcon, cmd: 'winget install Node' },
                  ].map((platform) => (
                    <div
                      key={platform.label}
                      style={{
                        borderRadius: '0.5rem',
                        padding: '0.5rem',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.25rem',
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      }}
                    >
                      <platform.icon style={{ height: '0.875rem', width: '0.875rem', color: textDim }} />
                      <p style={{ fontSize: '0.5625rem', fontWeight: 500, color: textDim }}>{platform.label}</p>
                      <p style={{ fontSize: '0.4375rem', fontFamily: 'var(--font-mono)', color: isDark ? 'rgba(139,124,246,0.4)' : 'rgba(139,124,246,0.5)' }}>{platform.cmd}</p>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '0.5rem', lineHeight: 1.6, color: textFaint }}>
                  Requires Node.js 18+. Run <span style={{ fontFamily: 'var(--font-mono)' }}>npm run dev</span> to start.
                </p>
              </div>

              {/* Action */}
              <GlassBubbleButton
                onClick={handleSaveKey}
                color="ember"
                size="lg"
                fullWidth
              >
                {apiKey.trim() ? 'Save & Launch' : 'Continue in Simulation Mode'}
                <ArrowRightIcon style={{ height: '1rem', width: '1rem' }} />
              </GlassBubbleButton>
            </motion.div>
          )}

          {/* ─── Launching ─── */}
          {phase === 'launching' && (
            <motion.div
              key="launching"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4rem 0',
                gap: '1rem',
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                style={{
                  height: '2.5rem',
                  width: '2.5rem',
                  borderRadius: '50%',
                  border: '2px solid rgba(224,120,80,0.3)',
                  borderTopColor: 'var(--color-pfc-ember)',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: textDim }}>
                <CheckCircle2Icon style={{ height: '1rem', width: '1rem', color: 'var(--color-pfc-green)' }} />
                Launching PFC Engine...
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
