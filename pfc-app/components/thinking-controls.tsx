'use client';

import { memo, useCallback, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import {
  PlayIcon,
  PauseIcon,
  SquareIcon,
  FastForwardIcon,
  RewindIcon,
  RouteIcon,
  FocusIcon,
  SearchIcon,
  SwordsIcon,
  MergeIcon,
  MinimizeIcon,
  CpuIcon,
  CloudIcon,
  MonitorIcon,
} from 'lucide-react';
import type { ThinkingPlayState, ThinkingSpeed, RerouteInstruction } from '@/lib/research/types';
import { getInferenceModeFeatures } from '@/lib/research/types';

const SPEED_OPTIONS: { value: ThinkingSpeed; label: string }[] = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
];

const REROUTE_OPTIONS: { type: RerouteInstruction['type']; label: string; icon: typeof FocusIcon; desc: string }[] = [
  { type: 'focus', label: 'Focus', icon: FocusIcon, desc: 'Narrow down on key evidence' },
  { type: 'explore', label: 'Explore', icon: SearchIcon, desc: 'Branch out to related areas' },
  { type: 'challenge', label: 'Challenge', icon: SwordsIcon, desc: 'Apply adversarial scrutiny' },
  { type: 'synthesize', label: 'Synthesize', icon: MergeIcon, desc: 'Combine findings into conclusion' },
  { type: 'simplify', label: 'Simplify', icon: MinimizeIcon, desc: 'Reduce complexity of reasoning' },
];

interface ThinkingControlsProps {
  isDark: boolean;
}

const MODE_ICON: Record<string, typeof CpuIcon> = {
  local: CpuIcon,
  api: CloudIcon,
  simulation: MonitorIcon,
};

export const ThinkingControls = memo(function ThinkingControls({ isDark }: ThinkingControlsProps) {
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const isStreaming = usePFCStore((s) => s.isStreaming);
  const inferenceMode = usePFCStore((s) => s.inferenceMode);
  const thinkingPlayState = usePFCStore((s) => s.thinkingPlayState);
  const setThinkingPlayState = usePFCStore((s) => s.setThinkingPlayState);
  const thinkingSpeed = usePFCStore((s) => s.thinkingSpeed);
  const setThinkingSpeed = usePFCStore((s) => s.setThinkingSpeed);
  const setPendingReroute = usePFCStore((s) => s.setPendingReroute);
  const [showReroute, setShowReroute] = useState(false);

  const features = useMemo(() => getInferenceModeFeatures(inferenceMode), [inferenceMode]);
  const isActive = isProcessing || isStreaming;

  const handlePlay = useCallback(() => {
    setThinkingPlayState('playing');
  }, [setThinkingPlayState]);

  const handlePause = useCallback(() => {
    setThinkingPlayState('paused');
  }, [setThinkingPlayState]);

  const handleStop = useCallback(() => {
    setThinkingPlayState('stopped');
  }, [setThinkingPlayState]);

  const handleReroute = useCallback(
    (type: RerouteInstruction['type']) => {
      setPendingReroute({ type });
      setShowReroute(false);
    },
    [setPendingReroute],
  );

  if (!isActive) return null;

  const ModeIcon = MODE_ICON[inferenceMode] || MonitorIcon;

  const btnBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '9999px',
    cursor: 'pointer',
    transition: 'background 0.15s, transform 0.1s',
    padding: '0.375rem',
    background: isDark ? 'rgba(244,189,111,0.05)' : 'rgba(0,0,0,0.04)',
    color: isDark ? 'rgba(156,143,128,0.7)' : 'rgba(0,0,0,0.45)',
  };

  const activeBtnStyle: React.CSSProperties = {
    ...btnBase,
    background: 'rgba(244,189,111,0.12)',
    color: '#C4956A',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.375rem 0.5rem',
        borderRadius: '9999px',
        background: isDark ? 'rgba(244,189,111,0.03)' : 'rgba(0,0,0,0.02)',
        border: isDark ? '1px solid rgba(79,69,57,0.3)' : '1px solid rgba(0,0,0,0.06)',
        transform: 'translateZ(0)',
      }}
    >
      {/* Mode Indicator Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.125rem 0.375rem',
          borderRadius: '9999px',
          background: inferenceMode === 'local'
            ? (isDark ? 'rgba(52,211,153,0.1)' : 'rgba(52,211,153,0.08)')
            : inferenceMode === 'api'
              ? (isDark ? 'rgba(244,189,111,0.1)' : 'rgba(244,189,111,0.08)')
              : (isDark ? 'rgba(244,189,111,0.04)' : 'rgba(0,0,0,0.03)'),
          fontSize: '0.5rem',
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.06em',
          color: inferenceMode === 'local'
            ? 'var(--color-pfc-green)'
            : inferenceMode === 'api'
              ? '#C4956A'
              : (isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)'),
        }}
        title={features.modeHint}
      >
        <ModeIcon style={{ height: '0.5625rem', width: '0.5625rem' }} />
        {features.modeLabel}
      </div>

      {/* Divider */}
      <div
        style={{
          width: '1px',
          height: '1rem',
          background: isDark ? 'rgba(79,69,57,0.3)' : 'rgba(0,0,0,0.06)',
          margin: '0 0.125rem',
        }}
      />

      {/* Playback Controls — only on local */}
      {features.playPause && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
            {thinkingPlayState === 'paused' ? (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handlePlay}
                style={activeBtnStyle}
                title="Resume thinking"
              >
                <PlayIcon style={{ height: '0.875rem', width: '0.875rem' }} />
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handlePause}
                style={thinkingPlayState === 'playing' ? activeBtnStyle : btnBase}
                title="Pause thinking"
              >
                <PauseIcon style={{ height: '0.875rem', width: '0.875rem' }} />
              </motion.button>
            )}
          </div>
        </>
      )}

      {/* Stop — always available */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={handleStop}
        style={thinkingPlayState === 'stopped' ? { ...btnBase, color: 'var(--color-pfc-red)' } : btnBase}
        title="Stop thinking"
      >
        <SquareIcon style={{ height: '0.75rem', width: '0.75rem' }} />
      </motion.button>

      {/* Speed Control — only on local */}
      {features.speedControl && (
        <>
          <div
            style={{
              width: '1px',
              height: '1rem',
              background: isDark ? 'rgba(79,69,57,0.3)' : 'rgba(0,0,0,0.06)',
              margin: '0 0.25rem',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
            <RewindIcon
              style={{
                height: '0.625rem',
                width: '0.625rem',
                color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.25)',
              }}
            />
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setThinkingSpeed(opt.value)}
                style={{
                  fontSize: '0.5625rem',
                  fontFamily: 'var(--font-mono)',
                  padding: '0.125rem 0.25rem',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: thinkingSpeed === opt.value ? 700 : 600,
                  background: thinkingSpeed === opt.value
                    ? (isDark ? 'rgba(244,189,111,0.12)' : 'rgba(244,189,111,0.08)')
                    : 'transparent',
                  color: thinkingSpeed === opt.value
                    ? '#C4956A'
                    : (isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)'),
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
            <FastForwardIcon
              style={{
                height: '0.625rem',
                width: '0.625rem',
                color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.25)',
              }}
            />
          </div>
        </>
      )}

      {/* Divider before reroute */}
      {features.rerouteThinking && (
        <div
          style={{
            width: '1px',
            height: '1rem',
            background: isDark ? 'rgba(79,69,57,0.3)' : 'rgba(0,0,0,0.06)',
            margin: '0 0.25rem',
          }}
        />
      )}

      {/* Reroute — available on all modes */}
      {features.rerouteThinking && (
        <div style={{ position: 'relative' }}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setShowReroute(!showReroute)}
            style={{
              ...btnBase,
              gap: '0.25rem',
              padding: '0.25rem 0.5rem',
              fontSize: '0.625rem',
              fontWeight: 500,
            }}
            title="Reroute thinking"
          >
            <RouteIcon style={{ height: '0.75rem', width: '0.75rem' }} />
            <span>Reroute</span>
          </motion.button>

          <AnimatePresence>
            {showReroute && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%) translateZ(0)',
                  marginBottom: '0.5rem',
                  padding: '0.5rem',
                  borderRadius: '1rem',
                  background: isDark ? 'rgba(28,27,25,0.95)' : 'rgba(255,255,255,0.95)',
                  border: isDark ? '1px solid rgba(79,69,57,0.3)' : '1px solid rgba(0,0,0,0.1)',
                  backdropFilter: 'blur(12px) saturate(1.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  minWidth: '12rem',
                  zIndex: 50,
                }}
              >
                <p
                  style={{
                    fontSize: '0.5625rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)',
                    padding: '0.25rem 0.375rem',
                  }}
                >
                  Redirect Thinking
                </p>
                {REROUTE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.type}
                      onClick={() => handleReroute(opt.type)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.375rem',
                        borderRadius: '9999px',
                        border: 'none',
                        cursor: 'pointer',
                        background: 'transparent',
                        color: isDark ? 'rgba(237,224,212,0.8)' : 'rgba(0,0,0,0.6)',
                        textAlign: 'left',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isDark
                          ? 'rgba(244,189,111,0.06)'
                          : 'rgba(0,0,0,0.04)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <Icon style={{ height: '0.875rem', width: '0.875rem', flexShrink: 0, color: '#C4956A' }} />
                      <div>
                        <p style={{ fontSize: '0.6875rem', fontWeight: 600 }}>{opt.label}</p>
                        <p style={{ fontSize: '0.5625rem', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.35)' }}>
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
});
