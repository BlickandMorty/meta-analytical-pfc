'use client';

import { motion } from 'framer-motion';

/**
 * Animated pixel-art sun mascot — replaces BrainMascot.
 * Gentle wobble + pulse animation, crispEdges for pixel look.
 */
export function PixelSun({ size = 40 }: { size?: number }) {
  return (
    <motion.div
      animate={{ rotate: [0, 3, -3, 0], scale: [1, 1.05, 1] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <svg viewBox="0 0 32 32" width={size} height={size} shapeRendering="crispEdges">
        {/* Rays — warm orange */}
        <rect x="14" y="0" width="4" height="5" fill="#EA580C" />
        <rect x="14" y="27" width="4" height="5" fill="#EA580C" />
        <rect x="0" y="14" width="5" height="4" fill="#EA580C" />
        <rect x="27" y="14" width="5" height="4" fill="#EA580C" />
        {/* Diagonal rays */}
        <rect x="3" y="3" width="4" height="4" rx="1" fill="#F97316" />
        <rect x="25" y="3" width="4" height="4" rx="1" fill="#F97316" />
        <rect x="3" y="25" width="4" height="4" rx="1" fill="#F97316" />
        <rect x="25" y="25" width="4" height="4" rx="1" fill="#F97316" />
        {/* Face — yellow circle */}
        <circle cx="16" cy="16" r="10" fill="#FACC15" />
        {/* Top highlight */}
        <ellipse cx="14" cy="11" rx="5" ry="3" fill="#FDE047" opacity="0.5" />
        {/* Eyes — happy squint */}
        <rect x="10" y="13" width="4" height="2" rx="1" fill="#78350F" />
        <rect x="18" y="13" width="4" height="2" rx="1" fill="#78350F" />
        {/* Smile */}
        <path d="M11,19 Q16,24 21,19" fill="none" stroke="#78350F" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </motion.div>
  );
}
