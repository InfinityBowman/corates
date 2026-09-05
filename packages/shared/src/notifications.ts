/**
 * Contract for the USER_SESSION push channel and the persisted notification
 * center. Both the workers that emit and the web client that consumes import
 * from here, so an event cannot be added on one side and dropped on the other.
 *
 * Events are ephemeral cache-invalidation signals. Notifications are D1 rows
 * addressed to one user; creating one also pushes a `notification:new` event
 * carrying the row so the client can prepend it without a refetch.
 */

import type { NotificationId } from './ids.js';

export interface NotificationPayloads {
  'invitation.received': {
    invitationId: string;
    token: string;
    projectId: string;
    projectName: string;
    inviterName: string;
    role: string;
  };
  'invitation.accepted': {
    projectId: string;
    projectName: string;
    acceptedByName: string;
    acceptedByEmail: string;
  };
}

export type NotificationType = keyof NotificationPayloads;

/** Wire shape of one notification, as returned by server functions and pushed over the socket. */
export type NotificationRecord = {
  [K in NotificationType]: {
    id: NotificationId;
    type: K;
    data: NotificationPayloads[K];
    readAt: number | null;
    createdAt: number;
  };
}[NotificationType];

export type UserSessionEvent =
  | {
      type: 'project-membership-added';
      orgId: string;
      projectId: string;
      projectName: string;
      role: string;
    }
  | { type: 'project-membership-updated'; orgId: string; projectId: string; role: string }
  | {
      type: 'project-membership-removed';
      orgId: string;
      projectId: string;
      projectName: string;
      removedBy: string;
    }
  | { type: 'project-deleted'; projectId: string; projectName: string; deletedBy: string }
  // Subscription payloads are informational only; the client just refetches.
  | { type: 'subscription:updated'; data: Record<string, unknown> }
  | { type: 'subscription:canceled'; data: Record<string, unknown> }
  | { type: 'notification:new'; notification: NotificationRecord };
