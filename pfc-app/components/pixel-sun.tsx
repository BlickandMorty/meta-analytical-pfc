'use client';

/**
 * Pixel-art sun mascot — uses the image file directly.
 * Simple CSS animation for gentle wobble.
 */
export function PixelSun({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/pixel-sun.svg"
      alt="Sun mascot"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        imageRendering: 'pixelated',
        animation: 'mascot-wobble 3.5s ease-in-out infinite',
      }}
    />
  );
}
