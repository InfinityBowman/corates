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

import { createSignal, createEffect, onCleanup, createMemo } from 'solid-js';
import { throttle } from '@solid-primitives/scheduled';
import { getUserColor } from '@lib/userColors.js';

// Throttle mouse position updates to 50ms (20 updates/second)
const MOUSE_THROTTLE_MS = 50;

/**
 * Hook to manage presence in reconciliation views
 *
 * @param {Object} options
 * @param {Function} options.getAwareness - Function that returns Yjs awareness instance
 * @param {Function} options.getCurrentPage - Reactive getter for current question page
 * @param {Function|string} options.checklistType - Type of checklist (AMSTAR2, ROB2, ROBINS_I) - can be getter or string
 * @param {Function} options.currentUser - Reactive getter for current user object { id, name, image }
 * @param {Function} options.containerRef - Reactive getter for container element reference
 * @returns {Object} Presence state and helpers
 */
export function useReconciliationPresence(options) {
  const { getAwareness, getCurrentPage, currentUser, containerRef } = options;

  // Handle checklistType as either a getter function or static string
  const getChecklistType = () => {
    const ct = options.checklistType;
    return typeof ct === 'function' ? ct() : ct || 'AMSTAR2';
  };

  // Local state for remote users
  const [remoteUsers, setRemoteUsers] = createSignal([]);

  // Refresh tick for stale cursor detection (updates every second)
  const [refreshTick, setRefreshTick] = createSignal(Date.now());

  // Set up periodic refresh for stale cursor detection
  if (typeof window !== 'undefined') {
    const intervalId = setInterval(() => {
      setRefreshTick(Date.now());
    }, 1000);

    onCleanup(() => clearInterval(intervalId));
  }

  // Track if awareness is available
  const awareness = () => getAwareness?.();

  // Update local awareness state when page changes
  createEffect(() => {
    const aw = awareness();
    const user = currentUser?.();
    const page = getCurrentPage?.();
    const ct = getChecklistType();

    if (!aw || !user?.id) return;

    // Get existing local state to preserve cursor position
    const existingState = aw.getLocalState() || {};

    aw.setLocalState({
      ...existingState,
      user: {
        userId: user.id,
        name: user.name || user.email || 'Unknown',
        image: user.image || null,
      },
      reconciliation: {
        currentPage: page ?? 0,
        checklistType: ct || 'AMSTAR2',
        timestamp: Date.now(),
      },
    });
  });

  // Throttled mouse position update
  const updateCursorPosition = throttle((x, y, scrollY) => {
    const aw = awareness();
    if (!aw) return;

    const existingState = aw.getLocalState() || {};

    aw.setLocalState({
      ...existingState,
      cursor: {
        x,
        y,
        scrollY,
        timestamp: Date.now(),
      },
    });
  }, MOUSE_THROTTLE_MS);

  // Mouse move handler
  function handleMouseMove(event) {
    const container = containerRef?.();
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top + container.scrollTop;
    const scrollY = container.scrollTop;

    updateCursorPosition(x, y, scrollY);
  }

  // Mouse leave handler - clear cursor position
  function handleMouseLeave() {
    const aw = awareness();
    if (!aw) return;

    const existingState = aw.getLocalState() || {};
    aw.setLocalState({
      ...existingState,
      cursor: null,
    });
  }

  // Set up mouse tracking
  createEffect(() => {
    const container = containerRef?.();
    if (!container) return;

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    onCleanup(() => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    });
  });

  // Listen to awareness changes and update remote users
  createEffect(() => {
    const aw = awareness();
    if (!aw) return;

    // Capture awareness reference for cleanup (ensures cleanup works even if awareness() changes)
    const awarenessRef = aw;

    function updateRemoteUsers() {
      const states = [];
      const localClientId = awarenessRef.clientID;
      const user = currentUser?.();
      const localChecklistType = getChecklistType();

      awarenessRef.getStates().forEach((state, clientId) => {
        // Skip local user
        if (clientId === localClientId) return;

        // Skip users without valid data
        if (!state.user?.userId) return;

        // Skip users in different checklist types (if filtering)
        const remoteChecklistType = state.reconciliation?.checklistType;
        if (
          localChecklistType &&
          remoteChecklistType &&
          remoteChecklistType !== localChecklistType
        ) {
          return;
        }

        // Skip if this is actually the current user (edge case with multiple tabs)
        if (user?.id && state.user.userId === user.id) return;

        const color = getUserColor(state.user.userId);

        states.push({
          clientId,
          userId: state.user.userId,
          name: state.user.name || 'Unknown',
          image: state.user.image,
          currentPage: state.reconciliation?.currentPage ?? 0,
          cursor: state.cursor || null,
          color,
        });
      });

      setRemoteUsers(states);
    }

    // Initial update
    updateRemoteUsers();

    // Subscribe to changes
    awarenessRef.on('change', updateRemoteUsers);

    onCleanup(() => {
      awarenessRef.off('change', updateRemoteUsers);

      // Clear local awareness state on unmount
      const localState = awarenessRef.getLocalState();
      if (localState) {
        awarenessRef.setLocalState(null);
      }
    });
  });

  // Derived: users grouped by page
  const usersByPage = createMemo(() => {
    const users = remoteUsers();
    const byPage = new Map();

    for (const user of users) {
      const page = user.currentPage;
      if (!byPage.has(page)) {
        byPage.set(page, []);
      }
      byPage.get(page).push(user);
    }

    return byPage;
  });

  // Derived: users with active cursors on the same page
  const usersWithCursors = createMemo(() => {
    // Track refreshTick to force periodic re-evaluation
    refreshTick();
    const currentPage = getCurrentPage?.() ?? 0;
    // Only show cursors from users on the same page
    return remoteUsers().filter(user => user.cursor != null && user.currentPage === currentPage);
  });

  // Helper: get users on a specific page
  function getUsersOnPage(pageIndex) {
    return usersByPage().get(pageIndex) || [];
  }

  return {
    // All remote users in this reconciliation
    remoteUsers,

    // Users grouped by page index
    usersByPage,

    // Users with active (non-stale) cursor positions
    usersWithCursors,

    // Helper to get users on a specific page
    getUsersOnPage,
  };
}

export default useReconciliationPresence;
