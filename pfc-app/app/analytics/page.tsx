'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassBubbleButton } from '@/components/glass-bubble-button';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import {
  ActivityIcon,
  BarChart3Icon,
  MicroscopeIcon,
  BrainIcon,
  CompassIcon,
  ArchiveIcon,
  FlaskConicalIcon,
  NetworkIcon,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   Dynamic imports — lazy-load each analytics sub-page
   ═══════════════════════════════════════════════════════════ */

const DiagnosticsPage = dynamic(() => import('../diagnostics/page'), { ssr: false });
const VisualizerPage = dynamic(() => import('../visualizer/page'), { ssr: false });
const EvaluatePage = dynamic(() => import('../evaluate/page'), { ssr: false });
const ConceptAtlasPage = dynamic(() => import('../concept-atlas/page'), { ssr: false });
const SteeringLabPage = dynamic(() => import('../steering-lab/page'), { ssr: false });
const CortexArchivePage = dynamic(() => import('../cortex-archive/page'), { ssr: false });
const ResearchCopilotPage = dynamic(() => import('../research-copilot/page'), { ssr: false });
const PipelinePage = dynamic(() => import('../pipeline/page'), { ssr: false });

/* ═══════════════════════════════════════════════════════════
   Tab definitions
   ═══════════════════════════════════════════════════════════ */

type MinTier = 'notes' | 'programming' | 'full';
const TIER_ORDER: Record<string, number> = { notes: 0, programming: 1, full: 2 };

const TABS = [
  { key: 'research', label: 'Research', icon: FlaskConicalIcon, minTier: 'notes' as MinTier },
  { key: 'archive', label: 'Archive', icon: ArchiveIcon, minTier: 'notes' as MinTier },
  { key: 'steering', label: 'Steering', icon: CompassIcon, minTier: 'programming' as MinTier },
  { key: 'pipeline', label: 'Pipeline', icon: NetworkIcon, minTier: 'full' as MinTier },
  { key: 'signals', label: 'Signals', icon: ActivityIcon, minTier: 'full' as MinTier },
  { key: 'visualizer', label: 'Visualizer', icon: BarChart3Icon, minTier: 'full' as MinTier },
  { key: 'evaluate', label: 'Evaluate', icon: MicroscopeIcon, minTier: 'full' as MinTier },
  { key: 'concepts', label: 'Concepts', icon: BrainIcon, minTier: 'full' as MinTier },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const M3_EASE = [0.2, 0, 0, 1] as const;

/* ═══════════════════════════════════════════════════════════
   Analytics Hub — single page with all analytical tools
   ═══════════════════════════════════════════════════════════ */

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('research');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const suiteTier = usePFCStore((s) => s.suiteTier);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  // Listen for tab changes from nav bar sub-bubbles
  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent).detail as TabKey;
      if (TABS.some((t) => t.key === key)) setActiveTab(key);
    };
    window.addEventListener('pfc-analytics-tab', handler);
    return () => window.removeEventListener('pfc-analytics-tab', handler);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--m3-surface)' }}>
      {/* ── Sticky tab bar (secondary, below nav sub-bubbles) ── */}
      <div
        style={{
          position: 'sticky',
          top: '2.625rem',
          zIndex: 20,
          padding: '0.75rem 1rem 0',
          background: 'var(--m3-surface)',
          contain: 'layout paint',
          transform: 'translateZ(0)',
        }}
      >
        <div
          style={{
            maxWidth: '56rem',
            margin: '0 auto',
            display: 'flex',
            gap: '0.25rem',
            overflowX: 'auto',
            paddingBottom: '0.75rem',
            borderBottom: `1px solid ${isDark ? 'rgba(79,69,57,0.3)' : 'rgba(0,0,0,0.06)'}`,
            scrollbarWidth: 'none',
          }}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const disabled = (TIER_ORDER[suiteTier] ?? 0) < (TIER_ORDER[tab.minTier] ?? 0);
            return (
              <GlassBubbleButton
                key={tab.key}
                onClick={() => !disabled && setActiveTab(tab.key)}
                active={isActive && !disabled}
                color="violet"
                size="sm"
                disabled={disabled}
                className={disabled ? 'opacity-35 cursor-not-allowed' : ''}
              >
                <Icon style={{ height: '0.8125rem', width: '0.8125rem' }} />
                {tab.label}
              </GlassBubbleButton>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3, ease: M3_EASE }}
          style={{ transform: 'translateZ(0)' }}
        >
          {activeTab === 'pipeline' && <PipelinePage />}
          {activeTab === 'signals' && <DiagnosticsPage />}
          {activeTab === 'visualizer' && <VisualizerPage />}
          {activeTab === 'evaluate' && <EvaluatePage />}
          {activeTab === 'concepts' && <ConceptAtlasPage />}
          {activeTab === 'steering' && <SteeringLabPage />}
          {activeTab === 'research' && <ResearchCopilotPage />}
          {activeTab === 'archive' && <CortexArchivePage />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
