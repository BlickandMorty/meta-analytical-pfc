'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelSun } from './pixel-sun';
import { PixelBook } from './pixel-book';

/**
 * Landing page mascot — PixelSun that briefly morphs into PixelBook
 * every ~30 seconds as a preview of the loading animation.
 * Quick pixelated crossfade transition.
 */
export function LandingMascot({ size = 52 }: { size?: number }) {
  const [showBook, setShowBook] = useState(false);

  useEffect(() => {
    // Every ~30s, show the book for 3 seconds
    const interval = setInterval(() => {
      setShowBook(true);
      const timer = setTimeout(() => setShowBook(false), 3000);
      return () => clearTimeout(timer);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <AnimatePresence mode="wait">
        {showBook ? (
          <motion.div
            key="book"
            initial={{ opacity: 0, scale: 0.7, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.7, filter: 'blur(4px)' }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <PixelBook size={size} />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ opacity: 0, scale: 0.7, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.7, filter: 'blur(4px)' }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <PixelSun size={size} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
