'use client';

/**
 * Pixel-art sun mascot — uses the actual GIF image directly.
 */
export function PixelSun({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/pixel-sun.gif"
      alt="Sun mascot"
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
