/**
 * Back-Forward Cache (bfcache) Handler
 *
 * Detects when a page is restored from the browser's back-forward cache
 * and triggers state refresh to ensure auth session and project data are current.
 */

import { useBetterAuth } from '@api/better-auth-store.js';
import { queryClient } from '@lib/queryClient.js';
import { queryKeys } from '@lib/queryKeys.js';

/**
 * Initialize bfcache restoration handler
 * Should be called once on app initialization
 */
export function initBfcacheHandler() {
  if (typeof window === 'undefined') return;

  // Get auth instance once (it's a singleton)
  const auth = useBetterAuth();

  const handlePageshow = async event => {
    // event.persisted === true means the page was restored from bfcache
    if (!event.persisted) return;

    console.info('[bfcache] Page restored from back-forward cache, refreshing state...');

    // Wait for auth to finish loading if it's currently loading
    // This ensures we have the current user before validating project cache
    if (auth.authLoading()) {
      // Wait for auth to complete (with timeout)
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Auth loading timeout'));
        }, 5000);

        const checkAuth = () => {
          if (!auth.authLoading()) {
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(checkAuth, 100);
          }
        };

        checkAuth();
      }).catch(err => {
        console.warn('[bfcache] Auth loading timeout:', err);
      });
    }

    // Force refresh the auth session to ensure it's current
    try {
      await auth.forceRefreshSession();
    } catch (err) {
      console.warn('[bfcache] Failed to refresh auth session:', err);
    }

    // Wait a bit for session to update
    await new Promise(resolve => setTimeout(resolve, 100));

    // Invalidate project list query if user is authenticated
    const currentUser = auth.user();
    if (currentUser?.id) {
      // Invalidate and refetch project list queries to ensure they're current
      try {
        await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
        // Also invalidate legacy query key for backward compatibility
        await queryClient.invalidateQueries({
          queryKey: queryKeys.projects.list(currentUser.id),
        });
      } catch (err) {
        console.warn('[bfcache] Failed to refresh project list:', err);
      }
    } else {
      // User is not authenticated, clear query cache for all projects
      queryClient.removeQueries({ queryKey: queryKeys.projects.all });
    }
  };

  window.addEventListener('pageshow', handlePageshow);

  // Return cleanup function (though typically not needed for singleton)
  return () => {
    window.removeEventListener('pageshow', handlePageshow);
  };
}
