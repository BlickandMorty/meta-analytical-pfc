'use client';

import { useEffect } from 'react';

/**
 * Global error boundary that catches errors in the root layout.
 * This is the last line of defense -- it renders a completely
 * self-contained error UI without depending on any layout,
 * theme provider, or CSS variables (since those may have failed).
 *
 * Next.js requires global-error to define its own <html> and <body> tags.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError] Critical error in root layout:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#050508',
          color: '#EDE0D4',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
            maxWidth: '26rem',
            width: '100%',
            padding: '2rem 1.75rem',
            borderRadius: '1.5rem',
            background: 'rgba(12,12,16,0.88)',
            border: '1px solid rgba(79,69,57,0.3)',
            textAlign: 'center',
          }}
        >
          {/* Icon - inline SVG to avoid any dependency on lucide-react */}
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
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#C75E5E"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>

          <h2
            style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Application Error
          </h2>

          <p
            style={{
              fontSize: '0.8125rem',
              lineHeight: 1.6,
              color: 'rgba(156,143,128,0.7)',
              margin: 0,
              maxWidth: '22rem',
            }}
          >
            {error.message || 'A critical error occurred. The application could not render.'}
          </p>

          {error.digest && (
            <p
              style={{
                fontSize: '0.625rem',
                fontFamily: 'monospace',
                color: 'rgba(156,143,128,0.4)',
                margin: 0,
              }}
            >
              Error ID: {error.digest}
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', width: '100%' }}>
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
                background: '#C4956A',
                color: '#fff',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
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
                border: '1px solid rgba(79,69,57,0.3)',
                background: 'transparent',
                color: 'rgba(156,143,128,0.7)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              Go Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
