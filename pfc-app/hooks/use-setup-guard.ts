'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Checks if PFC setup has been completed (localStorage).
 * Returns `true` when the user is cleared to view the page.
 * Redirects to /onboarding if setup isn't done.
 */
export function useSetupGuard(): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem('pfc-setup-done');
    if (!done) {
      router.replace('/onboarding');
    } else {
      setReady(true);
    }
  }, [router]);

  return ready;
}
