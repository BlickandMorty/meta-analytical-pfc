'use client';

/**
 * Pixel-art book — loading indicator throughout the app.
 * Uses the actual GIF image directly.
 */
export function PixelBook({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/pixel-book.gif"
      alt="Loading"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        imageRendering: 'pixelated',
      }}
    />
  );
}
