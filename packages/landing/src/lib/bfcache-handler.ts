/**
 * Back-Forward Cache (bfcache) Handler
 *
 * Detects when a page is restored from the browser's back-forward cache
 * and triggers state refresh to ensure auth session and project data are current.
 */

import { useAuthStore, selectIsAuthLoading, selectUser } from '@/stores/authStore';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Initialize bfcache restoration handler.
 * Should be called once on app initialization.
 */
export function initBfcacheHandler(): (() => void) | undefined {
  if (typeof window === 'undefined') return;

  const handlePageshow = async (event: { persisted: boolean }) => {
    if (!event.persisted) return;

    console.info('[bfcache] Page restored from back-forward cache, refreshing state...');

    const state = useAuthStore.getState();

    // Wait for auth to finish loading if it's currently loading
    if (selectIsAuthLoading(state)) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Auth loading timeout'));
        }, 5000);

        const checkAuth = () => {
          if (!selectIsAuthLoading(useAuthStore.getState())) {
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

    // Force refresh the auth session
    try {
      const { sessionRefetch } = useAuthStore.getState();
      if (sessionRefetch) await sessionRefetch();
    } catch (err) {
      console.warn('[bfcache] Failed to refresh auth session:', err);
    }

    // Wait a bit for session to update
    await new Promise(resolve => setTimeout(resolve, 100));

    // Invalidate project list query if user is authenticated
    const currentUser = selectUser(useAuthStore.getState());
    if (currentUser?.id) {
      try {
        await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.projects.list(currentUser.id),
        });
      } catch (err) {
        console.warn('[bfcache] Failed to refresh project list:', err);
      }
    } else {
      queryClient.removeQueries({ queryKey: queryKeys.projects.all });
    }
  };

  window.addEventListener('pageshow', handlePageshow);

  return () => {
    window.removeEventListener('pageshow', handlePageshow);
  };
}
