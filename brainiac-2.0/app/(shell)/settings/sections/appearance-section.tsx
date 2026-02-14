'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SunIcon,
  MoonIcon,
  MonitorIcon,
  SmartphoneIcon,
  SparklesIcon,
  ImageIcon,
  CloudSunIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { readString, writeString } from '@/lib/storage-versioning';
import { GlassBubbleButton } from '@/components/chat/glass-bubble-button';
import { GlassSection } from '@/components/layout/page-shell';

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [systemAuto, setSystemAuto] = useState(false);
  const [systemDarkVariant, setSystemDarkVariant] = useState<string>('dark');
  const [systemLightVariant, setSystemLightVariant] = useState<string>('light');

  useEffect(() => {
    setMounted(true);
    setSystemAuto(readString('pfc-system-auto') === 'true');
    const storedVariant = readString('pfc-system-dark-variant');
    if (storedVariant && ['dark', 'cosmic', 'sunset', 'oled'].includes(storedVariant)) {
      setSystemDarkVariant(storedVariant);
    }
    const storedLightVariant = readString('pfc-system-light-variant');
    if (storedLightVariant && ['light', 'sunny'].includes(storedLightVariant)) {
      setSystemLightVariant(storedLightVariant);
    }
  }, []);

  return (
    <GlassSection title="Appearance">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-8">
        {([
          { value: 'light', label: 'White', Icon: SunIcon },
          { value: 'sunny', label: 'Sunny', Icon: CloudSunIcon },
          { value: 'dark', label: 'Ember', Icon: MoonIcon },
          { value: 'cosmic', label: 'Cosmic', Icon: SparklesIcon },
          { value: 'sunset', label: 'Sunset', Icon: ImageIcon },
          { value: 'oled', label: 'Black', Icon: SmartphoneIcon },
          { value: 'system', label: 'System', Icon: MonitorIcon },
        ] as const).map(({ value, label, Icon }) => {
          const isSystem = value === 'system';
          const isActive = mounted && (isSystem ? systemAuto : (!systemAuto && theme === value));
          return (
            <GlassBubbleButton
              key={value}
              onClick={() => {
                if (isSystem) {
                  // Enable system auto mode
                  writeString('pfc-system-auto', 'true');
                  setSystemAuto(true);
                  // Apply immediately
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  const darkV = readString('pfc-system-dark-variant') || 'dark';
                  const lightV = readString('pfc-system-light-variant') || 'light';
                  setTheme(prefersDark ? darkV : lightV);
                  window.dispatchEvent(new CustomEvent('pfc-system-theme-update'));
                } else {
                  // Disable system auto mode, apply direct theme
                  writeString('pfc-system-auto', 'false');
                  setSystemAuto(false);
                  setTheme(value);
                }
              }}
              active={isActive}
              color="ember"
              size="lg"
              fullWidth
              className="flex-col"
            >
              <Icon style={{ height: 20, width: 20 }} />
              <span style={{ fontFamily: 'var(--font-secondary)', fontSize: '0.5625rem', fontWeight: 500 }}>{label}</span>
            </GlassBubbleButton>
          );
        })}
      </div>

      {/* System dark variant picker — shown when system auto is active */}
      <AnimatePresence>
        {mounted && systemAuto && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <p className="text-xs text-muted-foreground/60 mt-3 mb-2">
              When your system is in dark mode, use:
            </p>
            <div className="grid grid-cols-4 gap-2" style={{ maxWidth: '28rem' }}>
              {([
                { value: 'dark', label: 'Ember', Icon: MoonIcon },
                { value: 'cosmic', label: 'Cosmic', Icon: SparklesIcon },
                { value: 'sunset', label: 'Sunset', Icon: ImageIcon },
                { value: 'oled', label: 'Black', Icon: SmartphoneIcon },
              ] as const).map(({ value, label, Icon }) => (
                <GlassBubbleButton
                  key={value}
                  onClick={() => {
                    writeString('pfc-system-dark-variant', value);
                    setSystemDarkVariant(value);
                    // If system is currently in dark mode, apply immediately
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (prefersDark) setTheme(value);
                    window.dispatchEvent(new CustomEvent('pfc-system-theme-update'));
                  }}
                  active={systemDarkVariant === value}
                  color="ember"
                  size="sm"
                  fullWidth
                  className="flex-col"
                >
                  <Icon style={{ height: 16, width: 16 }} />
                  <span style={{ fontFamily: 'var(--font-secondary)', fontSize: '0.5rem', fontWeight: 500 }}>{label}</span>
                </GlassBubbleButton>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* System light variant picker — shown when system auto is active */}
      <AnimatePresence>
        {mounted && systemAuto && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <p className="text-xs text-muted-foreground/60 mt-3 mb-2">
              When your system is in light mode, use:
            </p>
            <div className="grid grid-cols-2 gap-2" style={{ maxWidth: '14rem' }}>
              {([
                { value: 'light', label: 'White', Icon: SunIcon },
                { value: 'sunny', label: 'Sunny', Icon: CloudSunIcon },
              ] as const).map(({ value, label, Icon }) => (
                <GlassBubbleButton
                  key={value}
                  onClick={() => {
                    writeString('pfc-system-light-variant', value);
                    setSystemLightVariant(value);
                    // If system is currently in light mode, apply immediately
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (!prefersDark) setTheme(value);
                    window.dispatchEvent(new CustomEvent('pfc-system-theme-update'));
                  }}
                  active={systemLightVariant === value}
                  color="ember"
                  size="sm"
                  fullWidth
                  className="flex-col"
                >
                  <Icon style={{ height: 16, width: 16 }} />
                  <span style={{ fontFamily: 'var(--font-secondary)', fontSize: '0.5rem', fontWeight: 500 }}>{label}</span>
                </GlassBubbleButton>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-xs text-muted-foreground/50 mt-3">
        Sunny — animated sky wallpaper. Ember — warm brown tones. Cosmic — animated space wallpaper. Sunset — animated mountain sunset. Black — true black.
      </p>
    </GlassSection>
  );
}
