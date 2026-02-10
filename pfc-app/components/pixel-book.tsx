'use client';

import { motion } from 'framer-motion';

/**
 * Animated pixel-art book — loading indicator throughout the app.
 * Gentle bounce animation with twinkling sparkles.
 */
export function PixelBook({ size = 32 }: { size?: number }) {
  return (
    <motion.div
      animate={{ y: [0, -3, 0] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      style={{ width: size, height: size, flexShrink: 0, position: 'relative' }}
    >
      <svg viewBox="0 0 32 32" width={size} height={size} shapeRendering="crispEdges">
        {/* Book binding — purple */}
        <rect x="6" y="22" width="20" height="6" rx="1" fill="#7C3AED" />
        <rect x="4" y="24" width="24" height="4" fill="#6D28D9" />
        {/* Left page — pink */}
        <rect x="3" y="6" width="13" height="18" fill="#F472B6" />
        <rect x="4" y="7" width="11" height="16" fill="#FBCFE8" />
        {/* Right page — pink */}
        <rect x="16" y="6" width="13" height="18" fill="#F472B6" />
        <rect x="17" y="7" width="11" height="16" fill="#FBCFE8" />
        {/* Spine */}
        <rect x="15" y="5" width="2" height="20" fill="#BE185D" />
        {/* Page lines — left */}
        <rect x="6" y="10" width="8" height="1" fill="#F9A8D4" />
        <rect x="6" y="13" width="8" height="1" fill="#F9A8D4" />
        <rect x="6" y="16" width="6" height="1" fill="#F9A8D4" />
        {/* Star symbol — right page */}
        <circle cx="23" cy="14" r="3" fill="none" stroke="#BE185D" strokeWidth="1.5" shapeRendering="auto" />
        <circle cx="23" cy="14" r="1" fill="#BE185D" shapeRendering="auto" />
        {/* Sparkles — twinkling via CSS */}
        <rect className="sparkle-1" x="1" y="2" width="2" height="2" fill="#FDE047" />
        <rect className="sparkle-2" x="29" y="3" width="2" height="2" fill="#FDE047" />
        <rect className="sparkle-3" x="0" y="14" width="2" height="2" fill="#FDE047" />
        <rect className="sparkle-4" x="30" y="11" width="2" height="2" fill="#FDE047" />
      </svg>
    </motion.div>
  );
}
