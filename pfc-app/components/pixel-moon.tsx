'use client';

/**
 * Landing moon mascot for dark/oled mode.
 * Uses the user-provided animated GIF asset.
 */
export function PixelMoon({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/moon-dark.gif"
      alt="Moon mascot"
      width={size}
      height={size}
      style={{
        flexShrink: 0,
        imageRendering: 'pixelated',
        borderRadius: '50%',
      }}
    />
  );
}

