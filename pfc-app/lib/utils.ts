import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Safe localStorage.setItem — catches QuotaExceededError instead of crashing.
 * Returns true on success, false on failure.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn(`[localStorage] Quota exceeded for key "${key}" (${(value.length / 1024).toFixed(1)}KB)`);
    }
    return false;
  }
}

