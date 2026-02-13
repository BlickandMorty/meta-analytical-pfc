'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Checks if PFC setup has been completed (localStorage).
 * Returns `true` when the user is cleared to view the page.
 * Redirects to /onboarding if setup isn't done.
 */
export function useSetupGuard(): boolean {
  const router = useRouter();
  const ready = typeof window !== 'undefined' && Boolean(localStorage.getItem('pfc-setup-done'));

  useEffect(() => {
    if (!ready) {
      router.replace('/onboarding');
    }
  }, [ready, router]);

  return ready;
}
