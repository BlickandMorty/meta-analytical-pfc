'use client';

import dynamic from 'next/dynamic';

// ---------------------------------------------------------------------------
// Loading fallback — lightweight skeleton for the research hub
// ---------------------------------------------------------------------------

function ResearchHubLoading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '80vh',
        gap: '1rem',
        opacity: 0.4,
      }}
    >
      <div
        style={{
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '50%',
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          animation: 'pfc-spin 0.8s linear infinite',
        }}
      />
      <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
        Loading research hub...
      </span>
      <style>{`@keyframes pfc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dynamic import — code-split the research hub (multiple tool tabs)
// ---------------------------------------------------------------------------

const ResearchHubContent = dynamic(
  () => import('./research-copilot-content'),
  { ssr: false, loading: ResearchHubLoading },
);

// ---------------------------------------------------------------------------
// Page — thin wrapper that lazy-loads the heavy research hub
// ---------------------------------------------------------------------------

export default function ResearchHubPage() {
  return <ResearchHubContent />;
}
