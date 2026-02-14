'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsDark } from '@/hooks/use-is-dark';
import { PillTabs, type TabItem } from '@/components/ui/pill-tabs';
import { ArchiveIcon, CompassIcon, NetworkIcon, BarChart3Icon, ActivityIcon } from 'lucide-react';

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
const VisualizerPage = dynamic(() => import('../visualizer/visualizer-content'), { ssr: false, loading: SubpageLoader });
const SteeringLabPage = dynamic(() => import('../steering-lab/page'), { ssr: false, loading: SubpageLoader });
const CortexArchivePage = dynamic(() => import('../cortex-archive/page'), { ssr: false, loading: SubpageLoader });
const PipelinePage = dynamic(() => import('../pipeline/page'), { ssr: false, loading: SubpageLoader });

/* ═══════════════════════════════════════════════════════════
   Tab definitions — local to analytics page (removed from nav)
   ═══════════════════════════════════════════════════════════ */

const TABS = [
  'archive', 'steering', 'pipeline',
  'signals', 'visualizer',
] as const;

type TabKey = (typeof TABS)[number];

const TAB_ITEMS: TabItem<TabKey>[] = [
  { id: 'archive', label: 'Archive', icon: ArchiveIcon },
  { id: 'steering', label: 'Steering', icon: CompassIcon },
  { id: 'pipeline', label: 'Pipeline', icon: NetworkIcon },
  { id: 'signals', label: 'Signals', icon: ActivityIcon },
  { id: 'visualizer', label: 'Visualizer', icon: BarChart3Icon },
];

const M3_EASE = [0.2, 0, 0, 1] as const;

/* ═══════════════════════════════════════════════════════════
   Analytics Hub — tab navigation lives inside the page now
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
  const { isDark } = useIsDark();
  const initialTab = (searchParams.get('tab') as TabKey | null);
  const [activeTab, setActiveTab] = useState<TabKey>(
    initialTab && TABS.includes(initialTab) ? initialTab : 'archive'
  );

  return (
    <div style={{
      height: '100vh',
      overflow: 'auto',
      paddingTop: '4.5rem',
      background: 'var(--m3-surface)',
      WebkitOverflowScrolling: 'touch',
    } as React.CSSProperties}>
      {/* ── Section tabs — replaces nav bar sub-bubbles ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '0 1rem 0.75rem',
      }}>
        <PillTabs
          tabs={TAB_ITEMS}
          active={activeTab}
          onSelect={setActiveTab}
          isDark={isDark}
        />
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
          {activeTab === 'steering' && <SteeringLabPage />}
          {activeTab === 'archive' && <CortexArchivePage />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
