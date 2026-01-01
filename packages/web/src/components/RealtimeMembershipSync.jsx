/**
 * RealtimeMembershipSync - Handles real-time project membership updates via WebSocket
 * Invalidates TanStack Query cache when membership changes occur
 */

import { createEffect, onCleanup, Show } from 'solid-js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useNotifications } from '@/primitives/useNotifications.js';
import { queryClient } from '@lib/queryClient.js';
import { queryKeys } from '@lib/queryKeys.js';

/**
 * Internal component that handles notifications for a specific userId
 * This is recreated when userId changes, ensuring the hook uses the correct userId
 */
function MembershipSyncForUser(props) {
  // Create notification handler that invalidates queries
  const handleNotification = notification => {
    const notificationType = notification.type;

    // Handle project membership change events
    if (
      notificationType === 'project-membership-added' ||
      notificationType === 'project-membership-removed' ||
      notificationType === 'project-membership-updated'
    ) {
      // Invalidate all project list queries
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });

      // Also invalidate legacy query keys for backward compatibility
      if (props.userId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.list(props.userId),
        });
      }

      // If orgId is provided, also invalidate org-scoped project list
      if (notification.orgId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.byOrg(notification.orgId),
        });
      }
    }
  };

  const notifications = useNotifications(props.userId, {
    onNotification: handleNotification,
  });

  // Connect when component mounts
  createEffect(() => {
    if (props.userId) {
      notifications.connect();
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    notifications.disconnect();
  });

  return null;
}

export default function RealtimeMembershipSync() {
  const { user, isLoggedIn } = useBetterAuth();

  // This component recreates MembershipSyncForUser when userId changes
  // This ensures useNotifications is called with the correct userId
  return (
    <Show when={isLoggedIn() && user()?.id}>
      {userId => <MembershipSyncForUser userId={userId()} key={userId()} />}
    </Show>
  );
}
