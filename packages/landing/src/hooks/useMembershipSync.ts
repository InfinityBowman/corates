/**
 * useMembershipSync - Real-time cache invalidation via WebSocket
 * Invalidates TanStack Query cache when membership or subscription changes occur.
 */

import { useCallback } from 'react';
import { useAuthStore, selectUser, selectIsLoggedIn } from '@/stores/authStore';
import { useNotifications } from './useNotifications';
import { queryClient } from '@/lib/queryClient.js';
import { queryKeys } from '@/lib/queryKeys.js';

interface NotificationData {
  type: string;
  orgId?: string;
  [key: string]: unknown;
}

export function useMembershipSync() {
  const user = useAuthStore(selectUser);
  const isLoggedIn = useAuthStore(selectIsLoggedIn);

  const handleNotification = useCallback(
    (notification: NotificationData) => {
      const notificationType = notification.type;
      const userId = user?.id;

      // Project membership changes
      if (
        notificationType === 'project-membership-added' ||
        notificationType === 'project-membership-removed' ||
        notificationType === 'project-membership-updated'
      ) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
        if (userId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(userId) });
        }
        if (notification.orgId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.byOrg(notification.orgId) });
        }
      }

      // Subscription changes (from Stripe webhooks)
      if (
        notificationType === 'subscription:updated' ||
        notificationType === 'subscription:canceled'
      ) {
        queryClient.invalidateQueries({ queryKey: queryKeys.subscription.current });
        queryClient.invalidateQueries({ queryKey: queryKeys.billing.invoices });
      }

      // Org membership events
      if (
        notificationType === 'org:member-added' ||
        notificationType === 'org:member-removed' ||
        notificationType === 'org:role-changed'
      ) {
        if (notification.orgId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.orgs.detail(notification.orgId) });
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.orgs.list });
      }
    },
    [user?.id],
  );

  const { connected } = useNotifications(isLoggedIn ? user?.id : null, {
    onNotification: handleNotification,
  });

  return { connected };
}
