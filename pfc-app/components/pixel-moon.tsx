'use client';

/**
 * Pixel-art crescent moon — dark mode companion to PixelSun.
 * Rendered as inline SVG for crisp rendering at any size.
 */
export function PixelMoon({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        flexShrink: 0,
        imageRendering: 'pixelated',
      }}
      aria-label="Moon mascot"
      role="img"
    >
      {/* Outline */}
      <rect x="5" y="0" width="6" height="1" fill="#50381E" />
      <rect x="3" y="1" width="2" height="1" fill="#50381E" />
      <rect x="11" y="1" width="2" height="1" fill="#50381E" />
      <rect x="2" y="2" width="1" height="1" fill="#50381E" />
      <rect x="12" y="2" width="1" height="1" fill="#50381E" />
      <rect x="1" y="3" width="1" height="2" fill="#50381E" />
      <rect x="12" y="3" width="1" height="2" fill="#50381E" />
      <rect x="0" y="5" width="1" height="6" fill="#50381E" />
      <rect x="1" y="11" width="1" height="2" fill="#50381E" />
      <rect x="2" y="13" width="1" height="1" fill="#50381E" />
      <rect x="3" y="14" width="2" height="1" fill="#50381E" />
      <rect x="5" y="15" width="6" height="1" fill="#50381E" />
      <rect x="11" y="14" width="2" height="1" fill="#50381E" />
      <rect x="12" y="13" width="1" height="1" fill="#50381E" />

      {/* Shadow crescent cutout edges */}
      <rect x="9" y="3" width="3" height="1" fill="#785A3C" />
      <rect x="10" y="4" width="2" height="1" fill="#785A3C" />
      <rect x="9" y="5" width="2" height="1" fill="#785A3C" />
      <rect x="8" y="6" width="2" height="1" fill="#785A3C" />
      <rect x="7" y="7" width="2" height="3" fill="#785A3C" />
      <rect x="8" y="10" width="2" height="1" fill="#785A3C" />
      <rect x="9" y="11" width="2" height="1" fill="#785A3C" />
      <rect x="10" y="12" width="2" height="1" fill="#785A3C" />
      <rect x="9" y="13" width="3" height="1" fill="#785A3C" />
      <rect x="11" y="5" width="1" height="1" fill="#785A3C" />
      <rect x="12" y="5" width="1" height="3" fill="#50381E" />
      <rect x="11" y="8" width="1" height="3" fill="#50381E" />
      <rect x="10" y="11" width="1" height="1" fill="#50381E" />
      <rect x="12" y="12" width="1" height="1" fill="#50381E" />

      {/* Main body — warm gold */}
      <rect x="5" y="1" width="6" height="1" fill="#F4BD6F" />
      <rect x="3" y="2" width="9" height="1" fill="#F4BD6F" />
      <rect x="2" y="3" width="7" height="1" fill="#F4BD6F" />
      <rect x="2" y="4" width="8" height="1" fill="#F4BD6F" />
      <rect x="1" y="5" width="8" height="1" fill="#F4BD6F" />
      <rect x="1" y="6" width="7" height="1" fill="#F4BD6F" />
      <rect x="1" y="7" width="6" height="3" fill="#F4BD6F" />
      <rect x="1" y="10" width="7" height="1" fill="#F4BD6F" />
      <rect x="1" y="11" width="8" height="1" fill="#F4BD6F" />
      <rect x="2" y="12" width="8" height="1" fill="#F4BD6F" />
      <rect x="3" y="13" width="6" height="1" fill="#F4BD6F" />
      <rect x="5" y="14" width="6" height="1" fill="#F4BD6F" />

      {/* Highlight — light glow on left side */}
      <rect x="3" y="3" width="2" height="1" fill="#FFE0AA" />
      <rect x="2" y="4" width="3" height="1" fill="#FFE0AA" />
      <rect x="1" y="5" width="3" height="1" fill="#FFE0AA" />
      <rect x="1" y="6" width="2" height="1" fill="#FFE0AA" />
      <rect x="1" y="7" width="1" height="2" fill="#FFE0AA" />

      {/* Tiny sparkle dots */}
      <rect x="13" y="1" width="1" height="1" fill="rgba(255,224,170,0.5)" />
      <rect x="14" y="4" width="1" height="1" fill="rgba(255,224,170,0.35)" />
      <rect x="15" y="7" width="1" height="1" fill="rgba(255,224,170,0.25)" />
    </svg>
  );
}
