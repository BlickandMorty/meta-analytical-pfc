'use client';

/**
 * Pixel-art book — loading indicator throughout the app.
 * Uses the image file directly with a CSS bounce animation.
 */
export function PixelBook({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/pixel-book.svg"
      alt="Loading"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        imageRendering: 'pixelated',
        animation: 'book-bounce 1.8s ease-in-out infinite',
      }}
    />
  );
}
