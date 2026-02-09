'use client';

import { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import {
  FlaskConicalIcon,
  EyeIcon,
  NetworkIcon,
  MessageSquareIcon,
  BookOpenIcon,
  SparklesIcon,
  SettingsIcon,
  CpuIcon,
  CloudIcon,
  MonitorIcon,
} from 'lucide-react';
import type { ChatViewMode } from '@/lib/research/types';
import { getInferenceModeFeatures } from '@/lib/research/types';

interface ResearchModeBarProps {
  isDark: boolean;
}

const MODE_ICON: Record<string, typeof CpuIcon> = {
  local: CpuIcon,
  api: CloudIcon,
  simulation: MonitorIcon,
};

export const ResearchModeBar = memo(function ResearchModeBar({ isDark }: ResearchModeBarProps) {
  const researchChatMode = usePFCStore((s) => s.researchChatMode);
  const toggleResearchChatMode = usePFCStore((s) => s.toggleResearchChatMode);
  const chatViewMode = usePFCStore((s) => s.chatViewMode);
  const setChatViewMode = usePFCStore((s) => s.setChatViewMode);
  const researchModeControls = usePFCStore((s) => s.researchModeControls);
  const setResearchModeControls = usePFCStore((s) => s.setResearchModeControls);
  const inferenceMode = usePFCStore((s) => s.inferenceMode);
  const [showControls, setShowControls] = useState(false);

  const features = useMemo(() => getInferenceModeFeatures(inferenceMode), [inferenceMode]);
  const ModeIcon = MODE_ICON[inferenceMode] || MonitorIcon;

  const toggleBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const activeBg = isDark ? 'rgba(52,211,153,0.15)' : 'rgba(52,211,153,0.1)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.375rem 0.625rem',
        borderRadius: '0.75rem',
        background: toggleBg,
        border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
      }}
    >
      {/* Research Mode Toggle */}
      <button
        onClick={toggleResearchChatMode}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.25rem 0.5rem',
          borderRadius: '0.5rem',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.6875rem',
          fontWeight: researchChatMode ? 600 : 500,
          background: researchChatMode ? activeBg : 'transparent',
          color: researchChatMode
            ? 'var(--color-pfc-green)'
            : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'),
          transition: 'all 0.2s',
        }}
      >
        <FlaskConicalIcon style={{ height: '0.75rem', width: '0.75rem' }} />
        Research Mode
      </button>

      {/* Divider */}
      {researchChatMode && (
        <div
          style={{
            width: '1px',
            height: '1rem',
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        />
      )}

      {/* View Mode Toggle (only in research mode) */}
      <AnimatePresence>
        {researchChatMode && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.125rem', overflow: 'hidden' }}
          >
            {([
              { mode: 'chat' as ChatViewMode, icon: MessageSquareIcon, label: 'Chat' },
              { mode: 'visualize-thought' as ChatViewMode, icon: NetworkIcon, label: 'Visualize' },
            ]).map((opt) => {
              const Icon = opt.icon;
              const isActive = chatViewMode === opt.mode;
              return (
                <button
                  key={opt.mode}
                  onClick={() => setChatViewMode(opt.mode)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.375rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.625rem',
                    fontWeight: isActive ? 600 : 400,
                    background: isActive ? (isDark ? 'rgba(139,124,246,0.15)' : 'rgba(139,124,246,0.1)') : 'transparent',
                    color: isActive
                      ? '#C4956A'
                      : (isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'),
                    transition: 'all 0.15s',
                  }}
                >
                  <Icon style={{ height: '0.6875rem', width: '0.6875rem' }} />
                  {opt.label}
                </button>
              );
            })}

            {/* Divider */}
            <div
              style={{
                width: '1px',
                height: '1rem',
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                margin: '0 0.125rem',
              }}
            />

            {/* Inference Mode Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.1875rem',
                padding: '0.125rem 0.3rem',
                borderRadius: '0.3rem',
                background: inferenceMode === 'local'
                  ? (isDark ? 'rgba(52,211,153,0.1)' : 'rgba(52,211,153,0.08)')
                  : inferenceMode === 'api'
                    ? (isDark ? 'rgba(139,124,246,0.1)' : 'rgba(139,124,246,0.08)')
                    : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                fontSize: '0.5rem',
                fontWeight: 600,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.05em',
                color: inferenceMode === 'local'
                  ? 'var(--color-pfc-green)'
                  : inferenceMode === 'api'
                    ? '#C4956A'
                    : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'),
              }}
              title={features.modeHint}
            >
              <ModeIcon style={{ height: '0.5rem', width: '0.5rem' }} />
              {features.modeLabel}
            </div>

            {/* Divider */}
            <div
              style={{
                width: '1px',
                height: '1rem',
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                margin: '0 0.125rem',
              }}
            />

            {/* Research Controls Toggle */}
            <button
              onClick={() => setShowControls(!showControls)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.25rem 0.375rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.625rem',
                background: showControls ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
                color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)',
                transition: 'all 0.15s',
              }}
            >
              <SettingsIcon style={{ height: '0.625rem', width: '0.625rem' }} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Research Controls Popover */}
      <AnimatePresence>
        {showControls && researchChatMode && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              right: 0,
              marginBottom: '0.5rem',
              padding: '0.75rem',
              borderRadius: '0.75rem',
              background: isDark ? 'rgba(20,20,24,0.95)' : 'rgba(255,255,255,0.95)',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              minWidth: '14rem',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <p style={{
              fontSize: '0.625rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
            }}>
              Research Controls
            </p>

            {/* Auto-extract citations — always available */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <BookOpenIcon style={{ height: '0.75rem', width: '0.75rem', color: 'var(--color-pfc-green)' }} />
                <span style={{ fontSize: '0.6875rem', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}>
                  Auto-extract citations
                </span>
              </div>
              <div
                onClick={() =>
                  setResearchModeControls({
                    autoExtractCitations: !researchModeControls.autoExtractCitations,
                  })
                }
                style={{
                  width: '2rem',
                  height: '1.125rem',
                  borderRadius: '9999px',
                  background: researchModeControls.autoExtractCitations
                    ? 'var(--color-pfc-green)'
                    : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'),
                  position: 'relative',
                  transition: 'background 0.2s',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '0.125rem',
                  left: researchModeControls.autoExtractCitations ? '1rem' : '0.125rem',
                  width: '0.875rem',
                  height: '0.875rem',
                  borderRadius: '50%',
                  background: 'white',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
            </label>

            {/* Preview visualizations — always available */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <EyeIcon style={{ height: '0.75rem', width: '0.75rem', color: '#C4956A' }} />
                <span style={{ fontSize: '0.6875rem', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}>
                  Preview visualizations
                </span>
              </div>
              <div
                onClick={() =>
                  setResearchModeControls({
                    showVisualizationPreview: !researchModeControls.showVisualizationPreview,
                  })
                }
                style={{
                  width: '2rem',
                  height: '1.125rem',
                  borderRadius: '9999px',
                  background: researchModeControls.showVisualizationPreview
                    ? '#C4956A'
                    : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'),
                  position: 'relative',
                  transition: 'background 0.2s',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '0.125rem',
                  left: researchModeControls.showVisualizationPreview ? '1rem' : '0.125rem',
                  width: '0.875rem',
                  height: '0.875rem',
                  borderRadius: '50%',
                  background: 'white',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
            </label>

            {/* Deep research — gated by inference mode */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              cursor: features.deepResearch ? 'pointer' : 'not-allowed',
              opacity: features.deepResearch ? 1 : 0.4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <SparklesIcon style={{ height: '0.75rem', width: '0.75rem', color: 'var(--color-pfc-ember)' }} />
                <div>
                  <span style={{ fontSize: '0.6875rem', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}>
                    Deep research mode
                  </span>
                  {!features.deepResearch && (
                    <p style={{
                      fontSize: '0.5rem',
                      color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
                      marginTop: '0.0625rem',
                    }}>
                      Requires API or local model
                    </p>
                  )}
                </div>
              </div>
              <div
                onClick={() => {
                  if (!features.deepResearch) return;
                  setResearchModeControls({
                    deepResearchEnabled: !researchModeControls.deepResearchEnabled,
                  });
                }}
                style={{
                  width: '2rem',
                  height: '1.125rem',
                  borderRadius: '9999px',
                  background: researchModeControls.deepResearchEnabled && features.deepResearch
                    ? 'var(--color-pfc-ember)'
                    : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'),
                  position: 'relative',
                  transition: 'background 0.2s',
                  cursor: features.deepResearch ? 'pointer' : 'not-allowed',
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '0.125rem',
                  left: researchModeControls.deepResearchEnabled && features.deepResearch ? '1rem' : '0.125rem',
                  width: '0.875rem',
                  height: '0.875rem',
                  borderRadius: '50%',
                  background: 'white',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
            </label>

            {/* Mode hint at bottom */}
            <div style={{
              marginTop: '0.25rem',
              padding: '0.375rem 0.5rem',
              borderRadius: '0.375rem',
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}>
              <ModeIcon style={{
                height: '0.625rem',
                width: '0.625rem',
                color: inferenceMode === 'local'
                  ? 'var(--color-pfc-green)'
                  : inferenceMode === 'api'
                    ? '#C4956A'
                    : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'),
              }} />
              <span style={{
                fontSize: '0.5625rem',
                color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)',
                lineHeight: 1.4,
              }}>
                {features.modeHint}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
