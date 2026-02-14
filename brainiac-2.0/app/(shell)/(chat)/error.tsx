'use client';

import { useEffect } from 'react';
import { AlertTriangleIcon, RefreshCwIcon, HomeIcon } from 'lucide-react';

/**
 * Error boundary for the (chat) route group.
 * Catches errors in app/(shell)/(chat)/page.tsx and app/(shell)/(chat)/chat/[id]/page.tsx.
 * This is a safety net in addition to the ErrorBoundary in ChatLayoutShell.
 */
export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ChatError] Error in chat route:', error);
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        padding: '1.5rem',
        background: 'var(--chat-surface, #050508)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
          maxWidth: '28rem',
          width: '100%',
          padding: '2rem 1.75rem',
          borderRadius: '1.5rem',
          background: 'var(--card, rgba(12,12,16,0.88))',
          backdropFilter: 'blur(12px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
          border: '1px solid var(--border, rgba(79,69,57,0.3))',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            height: '3.5rem',
            width: '3.5rem',
            borderRadius: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(199,94,94,0.1)',
            border: '1px solid rgba(199,94,94,0.2)',
          }}
        >
          <AlertTriangleIcon
            style={{ height: '1.5rem', width: '1.5rem', color: 'var(--color-pfc-red, #C75E5E)' }}
          />
        </div>

        <h2
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          Chat Error
        </h2>

        <p
          style={{
            fontSize: '0.8125rem',
            lineHeight: 1.6,
            color: 'var(--muted-foreground)',
            margin: 0,
            maxWidth: '22rem',
          }}
        >
          {error.message || 'The chat encountered an unexpected error.'}
        </p>

        {error.digest && (
          <p
            style={{
              fontSize: '0.625rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--muted-foreground)',
              opacity: 0.5,
              margin: 0,
            }}
          >
            Error ID: {error.digest}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            marginTop: '0.5rem',
            width: '100%',
          }}
        >
          <button
            onClick={reset}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: 'var(--color-pfc-ember, #C4956A)',
              color: '#fff',
              fontSize: '0.8125rem',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            <RefreshCwIcon style={{ height: '0.875rem', width: '0.875rem' }} />
            Try Again
          </button>

          <a
            href="/"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--border, rgba(79,69,57,0.3))',
              background: 'transparent',
              color: 'var(--muted-foreground)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            <HomeIcon style={{ height: '0.875rem', width: '0.875rem' }} />
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
