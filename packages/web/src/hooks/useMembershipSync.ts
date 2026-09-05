/**
 * useMembershipSync - Real-time cache updates via the UserSession WebSocket.
 * Ephemeral events invalidate TanStack Query caches; `notification:new`
 * carries a persisted notification row that is prepended in place.
 */

import { useEffect, useRef } from 'react';
import type { UserSessionEvent, NotificationRecord } from '@corates/shared/notifications';
import { assertNever } from '@corates/shared';
import { useAuthStore, selectUser, selectIsLoggedIn } from '@/stores/authStore';
import { useNotifications } from './useNotifications';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

function invalidateProjectLists(userId: string | undefined, orgId?: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
  if (userId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(userId) });
  }
  if (orgId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.byOrg(orgId) });
  }
}

function prependNotification(notification: NotificationRecord) {
  queryClient.setQueryData<NotificationRecord[]>(queryKeys.notifications.list, prev =>
    prev ? [notification, ...prev.filter(n => n.id !== notification.id)] : prev,
  );
  queryClient.setQueryData<number>(queryKeys.notifications.unreadCount, prev => (prev ?? 0) + 1);
}

export function useMembershipSync() {
  const user = useAuthStore(selectUser);
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const userId = user?.id;

  function handleEvent(event: UserSessionEvent) {
    switch (event.type) {
      case 'project-membership-added':
      case 'project-membership-removed':
      case 'project-membership-updated':
        invalidateProjectLists(userId, event.orgId);
        break;
      case 'project-deleted':
        invalidateProjectLists(userId);
        break;
      case 'subscription:updated':
      case 'subscription:canceled':
        queryClient.invalidateQueries({ queryKey: queryKeys.subscription.current });
        queryClient.invalidateQueries({ queryKey: queryKeys.billing.invoices });
        break;
      case 'notification:new':
        prependNotification(event.notification);
        if (event.notification.type === 'invitation.received') {
          queryClient.invalidateQueries({ queryKey: queryKeys.invitations.pendingForMe });
        }
        break;
      default:
        assertNever(event);
    }
  }

  const { connected } = useNotifications(isLoggedIn ? userId : null, {
    onNotification: data => handleEvent(data as UserSessionEvent),
  });

  // Anything pushed while the socket was down is only in D1, so refetch on
  // reconnect rather than trusting the prepend path alone. The first connect
  // is skipped because the bell's own queries are already in flight.
  const hasConnectedRef = useRef(false);
  useEffect(() => {
    if (!connected) return;
    if (hasConnectedRef.current) {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    }
    hasConnectedRef.current = true;
  }, [connected]);

  return { connected };
}
