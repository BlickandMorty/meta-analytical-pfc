'use client';

import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, CodeIcon, TerminalIcon, EyeIcon, ChevronLeftIcon, CopyIcon, CheckIcon } from 'lucide-react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useState } from 'react';

const CUPERTINO: [number, number, number, number] = [0.32, 0.72, 0, 1];

export const PortalSidebar = memo(function PortalSidebar() {
  const showPortal = usePFCStore((s) => s.showPortal);
  const portalStack = usePFCStore((s) => s.portalStack);
  const displayMode = usePFCStore((s) => s.portalDisplayMode);
  const closePortal = usePFCStore((s) => s.closePortal);
  const goBack = usePFCStore((s) => s.goBack);
  const setPortalDisplayMode = usePFCStore((s) => s.setPortalDisplayMode);

  const currentView = useMemo(() => portalStack[portalStack.length - 1], [portalStack]);
  const canGoBack = portalStack.length > 1;

  if (!showPortal || !currentView) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ duration: 0.35, ease: CUPERTINO }}
        className="fixed top-0 right-0 h-full w-[420px] max-w-[90vw] z-50
                   flex flex-col
                   backdrop-blur-2xl bg-black/80 dark:bg-black/90
                   border-l border-white/[0.06]
                   shadow-[-8px_0_32px_rgba(0,0,0,0.3)]"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
          {canGoBack && (
            <button
              onClick={goBack}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4 text-muted-foreground" />
            </button>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground/90 truncate">
              {currentView.artifact?.title || 'Portal'}
            </h3>
            {currentView.artifact?.language && (
              <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                {currentView.artifact.language}
              </span>
            )}
          </div>

          {/* Display mode toggle */}
          {currentView.type === 'artifact' && (
            <div className="flex items-center rounded-lg bg-white/[0.04] p-0.5">
              <button
                onClick={() => setPortalDisplayMode('preview')}
                className={`p-1.5 rounded-md transition-colors ${
                  displayMode === 'preview'
                    ? 'bg-pfc-violet/20 text-pfc-violet'
                    : 'text-muted-foreground/40 hover:text-muted-foreground/60'
                }`}
              >
                <EyeIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPortalDisplayMode('code')}
                className={`p-1.5 rounded-md transition-colors ${
                  displayMode === 'code'
                    ? 'bg-pfc-violet/20 text-pfc-violet'
                    : 'text-muted-foreground/40 hover:text-muted-foreground/60'
                }`}
              >
                <CodeIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={closePortal}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <XIcon className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {currentView.type === 'artifact' && currentView.artifact && (
            <ArtifactView
              artifact={currentView.artifact}
              displayMode={displayMode}
            />
          )}
          {currentView.type === 'terminal' && (
            <TerminalPlaceholder />
          )}
          {currentView.type === 'home' && (
            <PortalHome />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

// ── Artifact View ─────────────────────────────────────────────

interface ArtifactViewProps {
  artifact: {
    messageId: string;
    identifier: string;
    title: string;
    type: string;
    language?: string;
    content: string;
  };
  displayMode: 'code' | 'preview';
}

const ArtifactView = memo<ArtifactViewProps>(function ArtifactView({ artifact, displayMode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Copy button bar */}
      <div className="flex items-center justify-end px-3 py-1.5 border-b border-white/[0.04]">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px]
                     text-muted-foreground/50 hover:text-muted-foreground/80
                     hover:bg-white/[0.04] transition-colors"
        >
          {copied ? (
            <>
              <CheckIcon className="w-3 h-3 text-pfc-green" />
              <span className="text-pfc-green">Copied</span>
            </>
          ) : (
            <>
              <CopyIcon className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 scrollbar-thin scrollbar-thumb-white/10">
        {displayMode === 'code' ? (
          <pre className="text-xs leading-relaxed font-mono text-foreground/80 whitespace-pre-wrap break-words">
            <code>{artifact.content}</code>
          </pre>
        ) : (
          <div className="text-sm text-foreground/80 leading-relaxed">
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                {artifact.content}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// ── Terminal Placeholder ──────────────────────────────────────

function TerminalPlaceholder() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
        <TerminalIcon className="w-6 h-6 text-pfc-green/60" />
      </div>
      <h4 className="text-sm font-medium text-foreground/70 mb-1">Terminal</h4>
      <p className="text-xs text-muted-foreground/40 max-w-[240px]">
        Terminal integration coming soon. Execute code suggestions directly.
      </p>
    </div>
  );
}

// ── Portal Home ──────────────────────────────────────────────

function PortalHome() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
        <CodeIcon className="w-6 h-6 text-pfc-violet/60" />
      </div>
      <h4 className="text-sm font-medium text-foreground/70 mb-1">Code Portal</h4>
      <p className="text-xs text-muted-foreground/40 max-w-[240px]">
        Code suggestions and artifacts from the AI will appear here automatically.
      </p>
    </div>
  );
}
