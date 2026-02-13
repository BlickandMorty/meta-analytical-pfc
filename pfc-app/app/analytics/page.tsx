'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════
   Dynamic imports — lazy-load each analytics sub-page
   ═══════════════════════════════════════════════════════════ */

const DiagnosticsPage = dynamic(() => import('../diagnostics/page'), { ssr: false });
const VisualizerPage = dynamic(() => import('../visualizer/page'), { ssr: false });
const EvaluatePage = dynamic(() => import('../evaluate/page'), { ssr: false });
const ConceptAtlasPage = dynamic(() => import('../concept-atlas/page'), { ssr: false });
const SteeringLabPage = dynamic(() => import('../steering-lab/page'), { ssr: false });
const CortexArchivePage = dynamic(() => import('../cortex-archive/page'), { ssr: false });
const PipelinePage = dynamic(() => import('../pipeline/page'), { ssr: false });
const ResearchHubPage = dynamic(() => import('../research-copilot/page'), { ssr: false });

/* ═══════════════════════════════════════════════════════════
   Tab definitions (shared with top-nav analytics sub-bubbles)
   ═══════════════════════════════════════════════════════════ */

const TABS = [
  'archive', 'research', 'steering', 'pipeline',
  'signals', 'visualizer', 'evaluate', 'concepts',
] as const;

type TabKey = (typeof TABS)[number];

const M3_EASE = [0.2, 0, 0, 1] as const;

/* ═══════════════════════════════════════════════════════════
   Analytics Hub — navigation lives in TopNav, content here
   ═══════════════════════════════════════════════════════════ */

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('archive');

  // Listen for tab changes from nav bar sub-bubbles
  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent).detail as TabKey;
      if (TABS.includes(key)) setActiveTab(key);
    };
    window.addEventListener('pfc-analytics-tab', handler);
    return () => window.removeEventListener('pfc-analytics-tab', handler);
  }, []);

  // Broadcast active tab to nav bar so it can highlight the right sub-bubble
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('pfc-analytics-active', { detail: activeTab }));
  }, [activeTab]);

  return (
    <div style={{ minHeight: '100vh', paddingTop: '3rem', background: 'var(--m3-surface)' }}>
      {/* ── Tab content — nav lives in TopNav ── */}
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
          {activeTab === 'archive' && <CortexArchivePage />}
          {activeTab === 'research' && <ResearchHubPage />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
