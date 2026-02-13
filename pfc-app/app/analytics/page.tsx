'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════
   Shared loading fallback for dynamic sub-pages
   ═══════════════════════════════════════════════════════════ */

function SubpageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '60vh', opacity: 0.4,
    }}>
      <div style={{
        width: '2rem', height: '2rem', borderRadius: '50%',
        border: '2px solid currentColor', borderTopColor: 'transparent',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Dynamic imports — lazy-load each analytics sub-page
   ═══════════════════════════════════════════════════════════ */

const DiagnosticsPage = dynamic(() => import('../diagnostics/page'), { ssr: false, loading: SubpageLoader });
const VisualizerPage = dynamic(() => import('../visualizer/page'), { ssr: false, loading: SubpageLoader });
const SteeringLabPage = dynamic(() => import('../steering-lab/page'), { ssr: false, loading: SubpageLoader });
const CortexArchivePage = dynamic(() => import('../cortex-archive/page'), { ssr: false, loading: SubpageLoader });
const PipelinePage = dynamic(() => import('../pipeline/page'), { ssr: false, loading: SubpageLoader });

/* ═══════════════════════════════════════════════════════════
   Tab definitions (shared with top-nav analytics sub-bubbles)
   ═══════════════════════════════════════════════════════════ */

const TABS = [
  'archive', 'steering', 'pipeline',
  'signals', 'visualizer',
] as const;

type TabKey = (typeof TABS)[number];

const M3_EASE = [0.2, 0, 0, 1] as const;

/* ═══════════════════════════════════════════════════════════
   Analytics Hub — navigation lives in TopNav, content here
   ═══════════════════════════════════════════════════════════ */

export default function AnalyticsPage() {
  return (
    <Suspense>
      <AnalyticsPageInner />
    </Suspense>
  );
}

function AnalyticsPageInner() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey | null);
  const [activeTab, setActiveTab] = useState<TabKey>(
    initialTab && TABS.includes(initialTab) ? initialTab : 'archive'
  );

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
    <div style={{
      height: '100vh',
      overflow: 'auto',
      paddingTop: '4rem',
      background: 'var(--m3-surface)',
      WebkitOverflowScrolling: 'touch',
    } as React.CSSProperties}>
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
          {activeTab === 'steering' && <SteeringLabPage />}
          {activeTab === 'archive' && <CortexArchivePage />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
