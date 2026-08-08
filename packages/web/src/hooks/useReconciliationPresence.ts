/**
 * useReconciliationPresence - who else is in this reconciliation session.
 *
 * Rebuilt over the sync engine's presence frames (`client.presence`): the
 * library owns transport, throttling (`presenceThrottleMs`), reconnect
 * re-announcement, and peer lifecycle (peers reset to empty on disconnect).
 * This hook owns the corates payload — `{ user, reconciliation, cursor }`,
 * validated by `presenceSchema` in @corates/shared/sync — and the derived
 * render state (users by page, cursors on the current page).
 *
 * Local practice has no engine session: pass `client: null` and every
 * consumer sees empty presence.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { getUserColor } from '@/lib/userColors.js';
import type { ProjectWorkspace } from '@/project/ConnectionPool';

type SyncClient = ProjectWorkspace['client'];

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
  /** The engine's per-tab client id (server-attested, stable per session). */
  clientId: string;
  userId: string;
  name: string;
  image: string | null;
  currentPage: number;
  cursor: CursorData | null;
  color: ReturnType<typeof getUserColor>;
}

const EMPTY_USERS: RemoteUser[] = [];
const EMPTY_PEERS: SyncClient['presence']['peers'] = [];

interface UseReconciliationPresenceOptions {
  /** The project's engine client; null in local practice (presence is empty). */
  client: SyncClient | null;
  getCurrentPage: number;
  checklistType: string;
  currentUser: PresenceUser | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useReconciliationPresence({
  client,
  getCurrentPage,
  checklistType,
  currentUser,
  containerRef,
}: UseReconciliationPresenceOptions) {
  const presence = client?.presence ?? null;

  // Announce identity + position whenever they change. `update` merges into
  // the last-sent state, so the cursor effect below never clobbers this.
  useEffect(() => {
    if (!presence || !currentUser?.id) return;
    presence.update({
      user: {
        userId: currentUser.id,
        name: currentUser.name || 'Unknown',
        image: currentUser.image ?? null,
      },
      reconciliation: {
        currentPage: getCurrentPage ?? 0,
        checklistType: (checklistType || 'AMSTAR2') as 'AMSTAR2' | 'ROB2' | 'ROBINS_I',
      },
    });
  }, [
    presence,
    currentUser?.id,
    currentUser?.name,
    currentUser?.image,
    getCurrentPage,
    checklistType,
  ]);

  // Leaving the session clears our presence; peers see us disappear instead
  // of lingering on the page we left from.
  useEffect(() => {
    if (!presence) return;
    return () => presence.clear();
  }, [presence]);

  // Cursor tracking on the container. Updates go out at input frequency —
  // the client throttles trailing-edge at presenceThrottleMs, so no local
  // throttle is needed and the final position always lands.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !presence) return;

    function handleMouseMove(event: MouseEvent) {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      presence!.update({
        cursor: {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top + el.scrollTop,
          scrollY: el.scrollTop,
          timestamp: Date.now(),
        },
      });
    }

    function handleMouseLeave() {
      presence!.update({ cursor: null });
    }

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [containerRef, presence]);

  // Peers as React state. `presence.peers` keeps a stable identity between
  // changes, so useSyncExternalStore sees clean snapshots.
  const subscribe = useCallback(
    (onStoreChange: () => void) => (presence ? presence.subscribe(onStoreChange) : () => {}),
    [presence],
  );
  const getPeers = useCallback(() => (presence ? presence.peers : EMPTY_PEERS), [presence]);
  const peers = useSyncExternalStore(subscribe, getPeers, () => EMPTY_PEERS);

  const remoteUsers = useMemo(() => {
    const users: RemoteUser[] = [];
    for (const peer of peers) {
      const state = peer.state;
      if (!state?.user?.userId) continue;
      // Another checklist type means another reconciliation session entirely.
      const remoteType = state.reconciliation?.checklistType;
      if (checklistType && remoteType && remoteType !== checklistType) continue;
      // The engine already excludes this tab; also skip our own other tabs.
      if (currentUser?.id && state.user.userId === currentUser.id) continue;

      users.push({
        clientId: peer.clientId,
        userId: state.user.userId,
        name: state.user.name || 'Unknown',
        image: state.user.image ?? null,
        currentPage: state.reconciliation?.currentPage ?? 0,
        cursor: state.cursor ?? null,
        color: getUserColor(state.user.userId),
      });
    }
    return users.length > 0 ? users : EMPTY_USERS;
  }, [peers, checklistType, currentUser?.id]);

  // Users grouped by page
  const usersByPage = useMemo(() => {
    const byPage = new Map<number, RemoteUser[]>();
    for (const user of remoteUsers) {
      const list = byPage.get(user.currentPage) ?? [];
      list.push(user);
      byPage.set(user.currentPage, list);
    }
    return byPage;
  }, [remoteUsers]);

  // Users with active cursors on the same page
  const usersWithCursors = useMemo(
    () => remoteUsers.filter(user => user.cursor != null && user.currentPage === getCurrentPage),
    [remoteUsers, getCurrentPage],
  );

  const getUsersOnPage = useCallback(
    (pageIndex: number) => usersByPage.get(pageIndex) || [],
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
