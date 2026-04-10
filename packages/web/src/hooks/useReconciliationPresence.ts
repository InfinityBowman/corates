/**
 * useReconciliationPresence - Manages presence state for reconciliation views
 *
 * Provides:
 * - Local awareness state broadcasting (current page, cursor position)
 * - Remote user presence tracking
 * - Derived state (users by page, cursor positions)
 *
 * Uses Yjs awareness protocol for real-time sync.
 */

import { useState, useEffect, useMemo, useCallback, useRef, useSyncExternalStore } from 'react';
import { getUserColor } from '@/lib/userColors.js';

// Throttle mouse position updates to 50ms (20 updates/second)
const MOUSE_THROTTLE_MS = 50;

interface PresenceUser {
  id: string;
  name: string;
  image?: string | null;
}

interface CursorData {
  x: number;
  y: number;
  scrollY: number;
  timestamp: number;
}

interface RemoteUser {
  clientId: number;
  userId: string;
  name: string;
  image: string | null;
  currentPage: number;
  cursor: CursorData | null;
  color: ReturnType<typeof getUserColor>;
}

const EMPTY_USERS: RemoteUser[] = [];

/** Build the remote users array from awareness states (pure function for useSyncExternalStore) */
function buildRemoteUsers(
  aw: any,
  currentUserRef: React.RefObject<PresenceUser | null>,
  checklistTypeRef: React.RefObject<string>,
): RemoteUser[] {
  const states: RemoteUser[] = [];
  const localClientId = aw.clientID;
  const user = currentUserRef.current;
  const localChecklistType = checklistTypeRef.current;

  aw.getStates().forEach((state: any, clientId: number) => {
    if (clientId === localClientId) return;
    if (!state.user?.userId) return;

    const remoteChecklistType = state.reconciliation?.checklistType;
    if (localChecklistType && remoteChecklistType && remoteChecklistType !== localChecklistType) {
      return;
    }

    if (user?.id && state.user.userId === user.id) return;

    states.push({
      clientId,
      userId: state.user.userId,
      name: state.user.name || 'Unknown',
      image: state.user.image,
      currentPage: state.reconciliation?.currentPage ?? 0,
      cursor: state.cursor || null,
      color: getUserColor(state.user.userId),
    });
  });

  return states;
}

interface UseReconciliationPresenceOptions {
  getAwareness: (() => any) | undefined;
  getCurrentPage: number;
  checklistType: string;
  currentUser: PresenceUser | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Simple throttle that delays calls to at most once per `ms` milliseconds.
 */
function createThrottle(fn: (..._args: any[]) => void, ms: number) {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const throttled = (..._args: any[]) => {
    const now = Date.now();
    const remaining = ms - (now - lastCall);

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastCall = now;
      fn(..._args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn(..._args);
      }, remaining);
    }
  };

  throttled.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return throttled;
}

export function useReconciliationPresence({
  getAwareness,
  getCurrentPage,
  checklistType,
  currentUser,
  containerRef,
}: UseReconciliationPresenceOptions) {
  // Refresh tick for stale cursor detection (updates every second)
  const [refreshTick, setRefreshTick] = useState(0);

  // Refs to avoid stale closures in event handlers
  const currentPageRef = useRef(getCurrentPage);
  currentPageRef.current = getCurrentPage;
  const checklistTypeRef = useRef(checklistType);
  checklistTypeRef.current = checklistType;
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // Periodic refresh for stale cursor detection
  useEffect(() => {
    const intervalId = setInterval(() => {
      setRefreshTick(Date.now());
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  // Broadcast local awareness state when page/user changes
  useEffect(() => {
    const aw = getAwareness?.();
    if (!aw || !currentUser?.id) return;

    const existingState = aw.getLocalState() || {};

    aw.setLocalState({
      ...existingState,
      user: {
        userId: currentUser.id,
        name: currentUser.name || 'Unknown',
        image: currentUser.image || null,
      },
      reconciliation: {
        currentPage: getCurrentPage ?? 0,
        checklistType: checklistType || 'AMSTAR2',
        timestamp: Date.now(),
      },
    });
  }, [
    getAwareness,
    currentUser?.id,
    currentUser?.name,
    currentUser?.image,
    getCurrentPage,
    checklistType,
  ]);

  // Throttled cursor position update - Date.now() is called inside the throttled
  // callback (on mouse move), not during render, so the purity lint is a false positive
  const updateCursorPosition = useMemo(
    () =>
      createThrottle((x: number, y: number, scrollY: number) => {
        const aw = getAwareness?.();
        if (!aw) return;

        const existingState = aw.getLocalState() || {};
        aw.setLocalState({
          ...existingState,
          cursor: {
            x,
            y,
            scrollY,
            // eslint-disable-next-line react-hooks/purity -- called in throttled callback, not during render
            timestamp: Date.now(),
          },
        });
      }, MOUSE_THROTTLE_MS),
    [getAwareness],
  );

  // Mouse tracking on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleMouseMove(event: MouseEvent) {
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top + el.scrollTop;
      const scrollY = el.scrollTop;

      updateCursorPosition(x, y, scrollY);
    }

    function handleMouseLeave() {
      const aw = getAwareness?.();
      if (!aw) return;

      const existingState = aw.getLocalState() || {};
      aw.setLocalState({
        ...existingState,
        cursor: null,
      });
    }

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      updateCursorPosition.cancel();
    };
  }, [containerRef, getAwareness, updateCursorPosition]);

  // Subscribe to awareness changes via useSyncExternalStore for tearing prevention.
  // We cache the snapshot and only rebuild when the awareness 'change' event fires,
  // which bumps a version counter. getSnapshot returns a stable reference between changes.
  const snapshotVersion = useRef(0);
  const cachedSnapshot = useRef<RemoteUser[]>(EMPTY_USERS);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const aw = getAwareness?.();
      if (!aw) return () => {};

      const handleChange = () => {
        snapshotVersion.current += 1;
        onStoreChange();
      };

      // Build initial snapshot
      snapshotVersion.current += 1;
      cachedSnapshot.current = buildRemoteUsers(aw, currentUserRef, checklistTypeRef);

      aw.on('change', handleChange);
      return () => {
        aw.off('change', handleChange);
        // Clear local awareness state on unsubscribe
        const localState = aw.getLocalState();
        if (localState) {
          aw.setLocalState(null);
        }
      };
    },
    [getAwareness],
  );

  const lastVersion = useRef(0);

  const getSnapshot = useCallback(() => {
    const aw = getAwareness?.();
    if (!aw) return EMPTY_USERS;
    // Only rebuild when version changed (awareness 'change' event fired)
    if (snapshotVersion.current !== lastVersion.current) {
      lastVersion.current = snapshotVersion.current;
      cachedSnapshot.current = buildRemoteUsers(aw, currentUserRef, checklistTypeRef);
    }
    return cachedSnapshot.current;
  }, [getAwareness]);

  const remoteUsers = useSyncExternalStore(subscribe, getSnapshot);

  // Users grouped by page
  const usersByPage = useMemo(() => {
    const byPage = new Map<number, RemoteUser[]>();

    for (const user of remoteUsers) {
      const page = user.currentPage;
      if (!byPage.has(page)) {
        byPage.set(page, []);
      }
      byPage.get(page)!.push(user);
    }

    return byPage;
  }, [remoteUsers]);

  // Users with active cursors on the same page
  const usersWithCursors = useMemo(() => {
    // refreshTick forces periodic re-evaluation for stale cursor detection
    void refreshTick;
    return remoteUsers.filter(user => user.cursor != null && user.currentPage === getCurrentPage);
  }, [remoteUsers, getCurrentPage, refreshTick]);

  // Helper: get users on a specific page
  const getUsersOnPage = useCallback(
    (pageIndex: number) => {
      return usersByPage.get(pageIndex) || [];
    },
    [usersByPage],
  );

  return {
    remoteUsers,
    usersByPage,
    usersWithCursors,
    getUsersOnPage,
  };
}

export type { RemoteUser };
