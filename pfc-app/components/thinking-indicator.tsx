'use client';

/**
 * ThinkingIndicator — a pixel brain icon that gently shakes
 * and pulses while the model is processing.
 */

export function ThinkingIndicator({ className }: { className?: string }) {
  return (
    <div className={`thinking-indicator ${className ?? ''}`}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className="h-full w-full"
      >
        {/* Pixel brain — simplified 8-bit style */}
        {/* Top of brain */}
        <rect x="10" y="4" width="4" height="2" fill="currentColor" opacity="0.9" rx="0.5" />
        <rect x="14" y="4" width="4" height="2" fill="currentColor" opacity="0.9" rx="0.5" />
        <rect x="18" y="4" width="4" height="2" fill="currentColor" opacity="0.7" rx="0.5" />
        {/* Second row */}
        <rect x="8" y="6" width="4" height="2" fill="currentColor" opacity="0.8" rx="0.5" />
        <rect x="12" y="6" width="4" height="2" fill="currentColor" opacity="1" rx="0.5" />
        <rect x="16" y="6" width="4" height="2" fill="currentColor" opacity="0.9" rx="0.5" />
        <rect x="20" y="6" width="4" height="2" fill="currentColor" opacity="0.7" rx="0.5" />
        {/* Third row — widest */}
        <rect x="6" y="8" width="4" height="2" fill="currentColor" opacity="0.7" rx="0.5" />
        <rect x="10" y="8" width="4" height="2" fill="currentColor" opacity="0.9" rx="0.5" />
        <rect x="14" y="8" width="4" height="2" fill="currentColor" opacity="1" rx="0.5" />
        <rect x="18" y="8" width="4" height="2" fill="currentColor" opacity="0.8" rx="0.5" />
        <rect x="22" y="8" width="4" height="2" fill="currentColor" opacity="0.6" rx="0.5" />
        {/* Fourth row */}
        <rect x="6" y="10" width="4" height="2" fill="currentColor" opacity="0.6" rx="0.5" />
        <rect x="10" y="10" width="4" height="2" fill="currentColor" opacity="0.8" rx="0.5" />
        <rect x="14" y="10" width="2" height="2" fill="currentColor" opacity="0.4" rx="0.5" />
        <rect x="16" y="10" width="4" height="2" fill="currentColor" opacity="0.9" rx="0.5" />
        <rect x="22" y="10" width="4" height="2" fill="currentColor" opacity="0.7" rx="0.5" />
        {/* Fifth row — center split */}
        <rect x="6" y="12" width="4" height="2" fill="currentColor" opacity="0.7" rx="0.5" />
        <rect x="10" y="12" width="4" height="2" fill="currentColor" opacity="0.9" rx="0.5" />
        <rect x="18" y="12" width="4" height="2" fill="currentColor" opacity="0.8" rx="0.5" />
        <rect x="22" y="12" width="4" height="2" fill="currentColor" opacity="0.6" rx="0.5" />
        {/* Sixth row */}
        <rect x="8" y="14" width="4" height="2" fill="currentColor" opacity="0.8" rx="0.5" />
        <rect x="12" y="14" width="4" height="2" fill="currentColor" opacity="0.7" rx="0.5" />
        <rect x="16" y="14" width="4" height="2" fill="currentColor" opacity="0.8" rx="0.5" />
        <rect x="20" y="14" width="4" height="2" fill="currentColor" opacity="0.7" rx="0.5" />
        {/* Bottom rows — stem */}
        <rect x="10" y="16" width="4" height="2" fill="currentColor" opacity="0.6" rx="0.5" />
        <rect x="14" y="16" width="4" height="2" fill="currentColor" opacity="0.7" rx="0.5" />
        <rect x="18" y="16" width="4" height="2" fill="currentColor" opacity="0.5" rx="0.5" />
        {/* Stem */}
        <rect x="13" y="18" width="6" height="2" fill="currentColor" opacity="0.5" rx="0.5" />
        <rect x="14" y="20" width="4" height="2" fill="currentColor" opacity="0.4" rx="0.5" />
      </svg>
    </div>
  );
}
