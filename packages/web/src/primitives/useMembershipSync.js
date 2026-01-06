/**
 * useMembershipSync primitive - Handles real-time updates via WebSocket
 * Invalidates TanStack Query cache when membership or subscription changes occur
 */

import { createEffect, onCleanup } from 'solid-js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useNotifications } from './useNotifications.js';
import { queryClient } from '@lib/queryClient.js';
import { queryKeys } from '@lib/queryKeys.js';

/**
 * Sets up real-time sync for the current user
 * Invalidates relevant queries when changes occur via WebSocket notifications
 */
export function useMembershipSync() {
  const { user, isLoggedIn } = useBetterAuth();

  // Create notification handler that invalidates queries
  const handleNotification = notification => {
    const notificationType = notification.type;
    const userId = user()?.id;

    // Handle project membership change events
    if (
      notificationType === 'project-membership-added' ||
      notificationType === 'project-membership-removed' ||
      notificationType === 'project-membership-updated'
    ) {
      // Invalidate all project list queries
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });

      // Also invalidate legacy query keys for backward compatibility
      if (userId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.list(userId),
        });
      }

      // If orgId is provided, also invalidate org-scoped project list
      if (notification.orgId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.byOrg(notification.orgId),
        });
      }
    }

    // Handle subscription change events (from Stripe webhooks)
    if (
      notificationType === 'subscription:updated' ||
      notificationType === 'subscription:canceled'
    ) {
      console.log('[useMembershipSync] Subscription event received, invalidating cache');
      // Invalidate subscription query to fetch fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription.current });
      // Also invalidate invoices so billing UI refreshes after webhook-initiated changes
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.invoices });
    }

    // Handle org membership events
    if (
      notificationType === 'org:member-added' ||
      notificationType === 'org:member-removed' ||
      notificationType === 'org:role-changed'
    ) {
      // Invalidate org-related queries
      if (notification.orgId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.orgs.detail(notification.orgId),
        });
      }
      // Also invalidate the user's org list
      queryClient.invalidateQueries({ queryKey: queryKeys.orgs.list });
    }
  };

  const notifications = useNotifications(() => user()?.id, {
    onNotification: handleNotification,
  });

  // Handle connection lifecycle reactively when user ID changes
  createEffect(() => {
    const userId = user()?.id;
    if (isLoggedIn() && userId) {
      notifications.connect();
    } else {
      notifications.disconnect();
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    notifications.disconnect();
  });

  // Return connection status for UI indicators
  return {
    connected: notifications.connected,
  };
}
