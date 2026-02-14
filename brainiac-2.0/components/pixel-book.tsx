'use client';

/**
 * Simple CSS loading spinner — replaces the old pixel-book GIF.
 */
export function PixelBook({ size = 32 }: { size?: number }) {
  const borderWidth = Math.max(2, Math.round(size / 12));
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        border: `${borderWidth}px solid var(--pfc-accent-border)`,
        borderTopColor: 'var(--pfc-accent)',
        animation: 'spin 0.7s linear infinite',
      }}
    />
  );
}
