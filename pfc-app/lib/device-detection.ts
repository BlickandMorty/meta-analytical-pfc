// ═══════════════════════════════════════════════════════════════════
// Device Detection — Smart Suite Tier Recommendation
// ═══════════════════════════════════════════════════════════════════

import type { SuiteTier } from '@/lib/research/types';

export interface DeviceProfile {
  /** Detected device class */
  deviceClass: 'phone' | 'tablet' | 'laptop' | 'desktop' | 'unknown';
  /** Logical CPU cores */
  cpuCores: number;
  /** Device memory in GB (if available, 0 = unknown) */
  memoryGB: number;
  /** Screen width in logical pixels */
  screenWidth: number;
  /** Whether the device supports touch */
  hasTouch: boolean;
  /** Whether it's likely a mobile OS */
  isMobileOS: boolean;
  /** Recommended suite tier based on hardware */
  recommendedTier: SuiteTier;
  /** Can the device handle the next tier up? */
  canUpgrade: boolean;
  /** Human-readable summary */
  summary: string;
}

/**
 * Detect device capabilities and recommend a suite tier.
 * Runs client-side only.
 */
export function detectDevice(): DeviceProfile {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return fallbackProfile();
  }

  const cpuCores = navigator.hardwareConcurrency || 0;
  const memoryGB = (navigator as { deviceMemory?: number }).deviceMemory || 0;
  const screenWidth = window.screen?.width || window.innerWidth || 0;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const ua = navigator.userAgent.toLowerCase();

  // Mobile OS detection
  const isMobileOS = /android|iphone|ipad|ipod|mobile|webos|opera mini|iemobile/i.test(ua);
  const isTablet = /ipad|tablet|playbook|silk/i.test(ua)
    || (hasTouch && screenWidth >= 768 && screenWidth < 1200);

  // Device classification
  let deviceClass: DeviceProfile['deviceClass'] = 'unknown';

  if (isMobileOS && !isTablet) {
    deviceClass = 'phone';
  } else if (isTablet) {
    deviceClass = 'tablet';
  } else if (screenWidth < 1440 || (cpuCores > 0 && cpuCores <= 4)) {
    deviceClass = 'laptop';
  } else {
    deviceClass = 'desktop';
  }

  // Tier recommendation logic
  let recommendedTier: SuiteTier = 'notes';
  let canUpgrade = false;

  if (deviceClass === 'phone') {
    // Phones: always notes tier, no upgrade
    recommendedTier = 'notes';
    canUpgrade = false;
  } else if (deviceClass === 'tablet') {
    // Tablets: notes by default, can upgrade to programming if strong hardware
    recommendedTier = 'notes';
    canUpgrade = cpuCores >= 4 || memoryGB >= 4;
  } else if (deviceClass === 'laptop') {
    // Laptops: programming by default
    recommendedTier = 'programming';
    canUpgrade = cpuCores >= 8 || memoryGB >= 16;
  } else {
    // Desktops: programming default, can go full if powerful
    if (cpuCores >= 8 || memoryGB >= 16) {
      recommendedTier = 'full';
      canUpgrade = false;
    } else {
      recommendedTier = 'programming';
      canUpgrade = true;
    }
  }

  // Build summary
  const coreStr = cpuCores > 0 ? `${cpuCores} cores` : 'unknown cores';
  const memStr = memoryGB > 0 ? `${memoryGB}GB RAM` : 'unknown RAM';
  const summary = `${deviceClass} (${coreStr}, ${memStr}, ${screenWidth}px)`;

  return {
    deviceClass,
    cpuCores,
    memoryGB,
    screenWidth,
    hasTouch,
    isMobileOS,
    recommendedTier,
    canUpgrade,
    summary,
  };
}

function fallbackProfile(): DeviceProfile {
  return {
    deviceClass: 'unknown',
    cpuCores: 0,
    memoryGB: 0,
    screenWidth: 0,
    hasTouch: false,
    isMobileOS: false,
    recommendedTier: 'programming',
    canUpgrade: true,
    summary: 'Server-side render — defaults to programming tier',
  };
}

/** Storage key for persisted device profile */
export const DEVICE_PROFILE_KEY = 'pfc-device-profile';

/** Cache device profile to localStorage */
export function cacheDeviceProfile(profile: DeviceProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEVICE_PROFILE_KEY, JSON.stringify(profile));
  } catch { /* quota exceeded — ignore */ }
}

/** Load cached device profile */
export function loadCachedDeviceProfile(): DeviceProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEVICE_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
