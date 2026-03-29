/**
 * Hook to reset loading state when page is restored from bfcache
 *
 * After an OAuth redirect, the browser may restore the page from the
 * back-forward cache with stale loading states. This hook listens for
 * pageshow, focus, and visibilitychange events to reset them.
 */

import { useEffect } from 'react';

export function useBfcacheReset(resetFn: () => void) {
  useEffect(() => {
    const handleReturn = () => resetFn();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') resetFn();
    };

    window.addEventListener('pageshow', handleReturn);
    window.addEventListener('focus', handleReturn);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', handleReturn);
      window.removeEventListener('focus', handleReturn);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [resetFn]);
}
