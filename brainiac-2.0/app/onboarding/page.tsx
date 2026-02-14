'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { GlassBubbleButton } from '@/components/chat/glass-bubble-button';
import {
  KeyIcon,
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  CheckCircle2Icon,
  CpuIcon,
} from 'lucide-react';
import { readString, writeString } from '@/lib/storage-versioning';
import { detectDevice, cacheDeviceProfile } from '@/lib/device-detection';

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
  { text: 'DETECTING DEVICE CAPABILITIES', type: 'title' },
  { text: 'ALL SYSTEMS NOMINAL', type: 'success' },
];

const LINE_DELAY_MS = 55;

// ═══════════════════════════════════════════════════════════════════════
// Main page — bubble-style onboarding (single mode, skip tier selection)
// ═══════════════════════════════════════════════════════════════════════

type Phase = 'boot' | 'apikey' | 'launching';

export default function OnboardingPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [phase, setPhase] = useState<Phase>('boot');
  const [visibleCount, setVisibleCount] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const mounted = typeof window !== 'undefined';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const done = readString('pfc-setup-done');
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
      writeString('pfc-api-key', apiKey.trim());
    }
    // Single mode — always programming with all features
    writeString('pfc-suite-tier', 'programming');
    writeString('pfc-measurement-enabled', 'true');
    writeString('pfc-setup-done', 'true');
    setPhase('launching');
    setTimeout(() => router.push('/'), 1200);
  }, [apiKey, router]);

  const handleSkip = useCallback(() => {
    writeString('pfc-setup-done', 'true');
    router.push('/');
  }, [router]);

  const isDark = mounted ? (resolvedTheme === 'dark' || resolvedTheme === 'oled' || resolvedTheme === 'cosmic' || resolvedTheme === 'sunset') : true;

  const bubbleGlass: React.CSSProperties = {
    background: isDark ? 'rgba(12,12,16,0.88)' : 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(12px) saturate(1.3)',
    WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
    borderRadius: '1.5rem',
    border: isDark ? '1px solid rgba(79,69,57,0.3)' : '1px solid rgba(0,0,0,0.06)',
  };

  const textDim = isDark ? 'rgba(156,143,128,0.7)' : 'rgba(0,0,0,0.4)';
  const textFaint = isDark ? 'rgba(156,143,128,0.4)' : 'rgba(0,0,0,0.2)';

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
      <button
        onClick={handleSkip}
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 'var(--z-sticky)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6875rem',
          cursor: 'pointer',
          border: 'none',
          background: 'transparent',
          color: textFaint,
          padding: '0.375rem 0.75rem',
          borderRadius: '9999px',
          transition: 'color 0.2s, background 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = isDark ? 'rgba(237,224,212,0.95)' : 'rgba(0,0,0,0.5)';
          e.currentTarget.style.background = isDark ? 'rgba(244,189,111,0.05)' : 'rgba(0,0,0,0.03)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = textFaint;
          e.currentTarget.style.background = 'transparent';
        }}
      >
        Skip &gt;&gt;
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        style={{
          ...bubbleGlass,
          position: 'relative',
          zIndex: 'var(--z-dropdown)',
          width: '100%',
          maxWidth: '32rem',
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
                      border: isDark ? '1px solid rgba(79,69,57,0.3)' : '1px solid rgba(0,0,0,0.05)',
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
                <h1 style={{ fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em', color: isDark ? 'rgba(237,224,212,0.95)' : 'var(--foreground)' }}>
                  Brainiac
                </h1>
                <p style={{ fontSize: '0.6875rem', color: textDim }}>
                  Connect an API key for AI-powered analysis, or configure in Settings
                </p>
              </div>

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
                      background: isDark ? 'rgba(244,189,111,0.05)' : 'rgba(0,0,0,0.02)',
                      border: isDark ? '1px solid rgba(79,69,57,0.3)' : '1px solid rgba(0,0,0,0.1)',
                      color: isDark ? 'rgba(237,224,212,0.95)' : 'var(--foreground)',
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
                  Stored locally in your browser. Without a key or local model the engine cannot process queries.
                  For full control, use local inference (Ollama) — configurable in Settings.
                </p>
              </div>

              <GlassBubbleButton
                onClick={handleSaveKey}
                color="ember"
                size="lg"
                fullWidth
              >
                {apiKey.trim() ? 'Save & Launch' : 'Continue without API Key'}
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
