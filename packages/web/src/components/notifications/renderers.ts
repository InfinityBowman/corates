/**
 * Turns a stored notification into display copy and a destination. Copy lives
 * here rather than in the row so wording can change without touching D1.
 */

import type { NotificationRecord } from '@corates/shared/notifications';

export interface RenderedNotification {
  title: string;
  body: string;
  href: string | null;
}

export function renderNotification(notification: NotificationRecord): RenderedNotification {
  switch (notification.type) {
    case 'invitation.received': {
      const { inviterName, projectName, role, token } = notification.data;
      return {
        title: `${inviterName} invited you to ${projectName}`,
        body: `Join as ${role} to start appraising.`,
        href: `/invite/${token}`,
      };
    }
    case 'invitation.accepted': {
      const { acceptedByName, projectName, projectId } = notification.data;
      return {
        title: `${acceptedByName} joined ${projectName}`,
        body: 'They accepted your invitation and can now see the project.',
        href: `/projects/${projectId}`,
      };
    }
    default:
      // A server ahead of a cached client may send a type this build does not
      // know. Show something rather than crash the popover.
      return { title: 'New notification', body: '', href: null };
  }
}
