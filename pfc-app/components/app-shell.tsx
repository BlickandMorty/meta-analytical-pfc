'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useIsDark } from '@/hooks/use-is-dark';
import { TopNav } from './top-nav';
import { StarField } from './star-field';
import { ThematicWallpaper } from './thematic-wallpaper';
import { SunnyWallpaper } from './sunny-wallpaper';
// SunsetWallpaper removed — sunset theme uses plain CSS background color only
import type { InferenceMode, ApiProvider } from '@/lib/engine/llm/config';
import type { SuiteTier, ResearchPaper } from '@/lib/research/types';
import { detectDevice, cacheDeviceProfile } from '@/lib/device-detection';
import { ToastContainer } from './toast-container';
import { MiniChat } from './mini-chat';
import { hydrateStore } from '@/lib/store/hydrate';

import { readString } from '@/lib/storage-versioning';

// Stable selector: derives a boolean "any thread streaming" from the threadIsStreaming map.
// Avoids subscribing to the entire object (which would re-render on every thread state change).
const selectAnyThreadStreaming = (s: { threadIsStreaming: Record<string, boolean> }) =>
  Object.values(s.threadIsStreaming).some(Boolean);

// Safe localStorage helper — never throws (delegates to versioned wrapper)
function ls(key: string): string | null {
  return readString(key);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isDark, isOled, isCosmic, isSunny, isThematic, mounted: themeMounted } = useIsDark();
  const { setTheme, theme } = useTheme();
  const pathname = usePathname();
  const chatMessages = usePFCStore((s) => s.messages);
  const chatMinimized = usePFCStore((s) => s.chatMinimized);
  const miniChatOpen = usePFCStore((s) => s.miniChatOpen);
  const toggleMiniChat = usePFCStore((s) => s.toggleMiniChat);
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const isStreaming = usePFCStore((s) => s.isStreaming);
  const anyThreadStreaming = usePFCStore(selectAnyThreadStreaming);
  const addToast = usePFCStore((s) => s.addToast);
  const setInferenceMode = usePFCStore((s) => s.setInferenceMode);
  const setApiKey = usePFCStore((s) => s.setApiKey);
  const setApiProvider = usePFCStore((s) => s.setApiProvider);
  const setOllamaBaseUrl = usePFCStore((s) => s.setOllamaBaseUrl);
  const setOllamaModel = usePFCStore((s) => s.setOllamaModel);
  const setSuiteTier = usePFCStore((s) => s.setSuiteTier);
  const setMeasurementEnabled = usePFCStore((s) => s.setMeasurementEnabled);
  const initScheduler = usePFCStore((s) => s.initScheduler);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); hydrateStore(); }, []);

  // ── Background AI processing indicator ──
  // True when any chat stream or pipeline is active (main chat, mini-chat threads)
  const aiWorking = isProcessing || isStreaming || anyThreadStreaming;
  // Track transitions from working → done to show toast when user is off-chat
  const wasWorkingRef = useRef(false);

  // Gate wallpapers behind themeMounted to prevent flash of wrong wallpaper during hydration
  const showStars = themeMounted && !isThematic && (pathname === '/' || (isOled && pathname === '/docs'));
  const showCosmic = themeMounted && isCosmic && (pathname === '/' || pathname === '/docs');
  const showSunny = themeMounted && isSunny && pathname === '/';
  const sunnyBlurred = showSunny && chatMessages.length > 0 && !chatMinimized;
  const starTheme = isOled ? 'oled' as const : isDark ? 'dark' as const : 'light' as const;

  useEffect(() => {
    initScheduler();
    return () => {
      import('@/lib/notes/learning-scheduler').then(({ stopScheduler }) => {
        stopScheduler();
      }).catch(() => {});
    };
  }, [initScheduler]);

  useEffect(() => {
    // --- Inference settings ---
    const storedMode = ls('pfc-inference-mode');
    if (storedMode && ['simulation', 'api', 'local'].includes(storedMode)) {
      setInferenceMode(storedMode as InferenceMode);
    }
    const storedKey = ls('pfc-api-key');
    if (storedKey) setApiKey(storedKey);
    const storedProvider = ls('pfc-api-provider') as ApiProvider | null;
    if (storedProvider) setApiProvider(storedProvider);
    const storedOllamaUrl = ls('pfc-ollama-url');
    if (storedOllamaUrl) setOllamaBaseUrl(storedOllamaUrl);
    const storedOllamaModel = ls('pfc-ollama-model');
    if (storedOllamaModel) setOllamaModel(storedOllamaModel);

    // --- Suite Tier (3-tier system) ---
    const storedTier = ls('pfc-suite-tier') as SuiteTier | null;
    const legacyMode = ls('pfc-suite-mode');

    if (storedTier && ['notes', 'programming', 'full'].includes(storedTier)) {
      setSuiteTier(storedTier);
    } else if (legacyMode) {
      if (legacyMode === 'research-only') {
        setSuiteTier('notes');
      } else if (legacyMode === 'full') {
        setSuiteTier('full');
      } else if (['notes', 'programming'].includes(legacyMode)) {
        setSuiteTier(legacyMode as SuiteTier);
      }
    }

    const storedMeasurement = ls('pfc-measurement-enabled');
    if (storedMeasurement !== null) setMeasurementEnabled(storedMeasurement === 'true');

    // --- Detect and cache device profile ---
    const profile = detectDevice();
    cacheDeviceProfile(profile);

    // --- Load research papers (batch to avoid per-paper re-renders) ---
    try {
      const storedPapers = ls('pfc-research-papers');
      if (storedPapers) {
        const papers = JSON.parse(storedPapers) as ResearchPaper[];
        if (papers.length > 0) {
          const store = usePFCStore.getState();
          for (const paper of papers) {
            store.addResearchPaper(paper);
          }
        }
      }
    } catch { /* ignore corrupt data */ }

    // SAFETY: One-time mount hydration from localStorage. All setters are stable
    // Zustand actions that never change identity. Re-running would overwrite user
    // changes made after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Background AI completion toast ──
  // When AI finishes while user is on a non-chat page, notify them
  useEffect(() => {
    if (aiWorking) {
      wasWorkingRef.current = true;
    } else if (wasWorkingRef.current) {
      wasWorkingRef.current = false;
      // Only toast if user is NOT on the main chat page (they'd already see the result)
      const isChatPage = pathname === '/' || pathname === '/chat';
      if (!isChatPage && !miniChatOpen) {
        addToast({ message: 'Research analysis complete', type: 'success', duration: 5000 });
      }
    }
  }, [aiWorking, pathname, miniChatOpen, addToast]);

  // ── System auto-theme: apply user's preferred dark variant ──
  useEffect(() => {
    const isSystemAuto = ls('pfc-system-auto') === 'true';
    if (!isSystemAuto) return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const applySystemTheme = () => {
      const darkVariant = ls('pfc-system-dark-variant') || 'dark';
      const lightVariant = ls('pfc-system-light-variant') || 'light';
      setTheme(mq.matches ? darkVariant : lightVariant);
    };

    applySystemTheme();

    mq.addEventListener('change', applySystemTheme);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pfc-system-dark-variant' || e.key === 'pfc-system-auto' || e.key === 'pfc-system-light-variant') {
        applySystemTheme();
      }
    };
    window.addEventListener('storage', handleStorage);
    const handleCustom = () => applySystemTheme();
    window.addEventListener('pfc-system-theme-update', handleCustom);

    return () => {
      mq.removeEventListener('change', applySystemTheme);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('pfc-system-theme-update', handleCustom);
    };
  }, [setTheme, theme]);

  // Gate rendering behind `mounted` — all hooks run unconditionally above
  if (!mounted) {
    return <div className="relative h-screen overflow-hidden bg-background" />;
  }

  return (
    <div className={`relative h-screen overflow-hidden ${isThematic ? '' : 'bg-background'}`}>
      {showStars && <StarField theme={starTheme} />}
      {showCosmic && <ThematicWallpaper />}
      {showSunny && <SunnyWallpaper blurred={sunnyBlurred} />}
      {/* Sunset uses plain CSS background — no wallpaper component */}
      <TopNav />
      {children}
      <MiniChat />

      {/* Floating GIF trigger — always visible in bottom-right (bare GIF, no bubble) */}
      {!miniChatOpen && (
        <button
          onClick={toggleMiniChat}
          title="Open Research Assistant"
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 9998,
            width: 44,
            height: 44,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            padding: 0,
            transition: 'transform 0.2s ease',
            animation: 'float-bob 3s ease-in-out infinite',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <img
            src={isDark ? '/pixel-robot.gif' : '/pixel-sun.gif'}
            alt="Open Assistant"
            style={{ width: 40, height: 40, imageRendering: 'pixelated' }}
          />
          {/* Pulsing dot when AI is processing in background */}
          {aiWorking && (
            <span
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#F59E0B',
                boxShadow: '0 0 6px 2px rgba(245,158,11,0.4)',
                animation: 'ai-pulse 1.5s ease-in-out infinite',
              }}
            />
          )}
        </button>
      )}

      <ToastContainer />

      <style>{`
        @keyframes float-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes ai-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
