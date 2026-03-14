/**
 * AuthProvider - Syncs Better Auth's useSession() into the Zustand auth store
 *
 * Must be mounted inside a React tree (typically in _app.tsx layout route).
 * Handles:
 * - Session -> Zustand sync
 * - localStorage cache updates
 * - Avatar caching
 * - Visibility change session refresh
 * - Query cache invalidation on auth changes
 */

import { useEffect, useRef } from 'react';
import { useSession } from '@/api/auth-client';
import { useAuthStore, saveCachedAuth } from '@/stores/authStore';
import { fetchAndCacheAvatar } from '@/primitives/avatarCache.js';
import { queryClient } from '@/lib/queryClient.js';
import { queryKeys } from '@/lib/queryKeys.js';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const session = useSession();
  const prevUserIdRef = useRef<string | null>(null);

  const isOnline = useAuthStore(state => state.isOnline);
  const setSessionData = useAuthStore(state => state.setSessionData);
  const setCachedUser = useAuthStore(state => state.setCachedUser);
  const setCachedAvatarUrl = useAuthStore(state => state.setCachedAvatarUrl);

  // Sync Better Auth session into Zustand store
  useEffect(() => {
    const rawUser = session.data?.user;
    const user = rawUser ? { ...rawUser, image: rawUser.image ?? undefined } : null;
    const loading = session.isPending;
    const refetch = session.refetch ? async () => { await session.refetch(); } : null;

    setSessionData(user, loading, refetch);
  }, [session.data, session.isPending, session.refetch, setSessionData]);

  // Cache user data when session is fetched (only when online)
  useEffect(() => {
    const loading = session.isPending;

    if (!isOnline) return;

    const cacheRawUser = session.data?.user;
    const cacheUser = cacheRawUser ? { ...cacheRawUser, image: cacheRawUser.image ?? undefined } : null;

    if (cacheUser) {
      saveCachedAuth(cacheUser);
      setCachedUser(cacheUser);

      // Cache avatar for offline use (only when user changes)
      if (cacheUser.image && cacheUser.id && cacheUser.id !== prevUserIdRef.current) {
        prevUserIdRef.current = cacheUser.id;
        fetchAndCacheAvatar(cacheUser.id, cacheUser.image).then((dataUrl: string | null) => {
          if (dataUrl) setCachedAvatarUrl(dataUrl);
        });
      }
    } else if (!loading) {
      saveCachedAuth(null);
      setCachedUser(null);
    }
  }, [session.data, session.isPending, isOnline, setCachedUser, setCachedAvatarUrl]);

  // Force session refresh on initial mount when online
  useEffect(() => {
    if (navigator.onLine && session.refetch) {
      const timer = setTimeout(() => {
        session.refetch();
        console.info('[auth] Refreshing session on page load');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Visibility change: refresh session when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (
        document.visibilityState === 'visible' &&
        !session.isPending &&
        navigator.onLine &&
        session.refetch
      ) {
        try {
          await session.refetch();
          await new Promise(resolve => setTimeout(resolve, 100));

          const currentUser = session.data?.user;
          if (currentUser?.id) {
            await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
            await queryClient.invalidateQueries({
              queryKey: queryKeys.projects.list(currentUser.id),
            });
          } else {
            queryClient.removeQueries({ queryKey: queryKeys.projects.all });
          }
        } catch (err) {
          console.warn('[auth] Failed to refresh session on visibility change:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session]);

  return <>{children}</>;
}
