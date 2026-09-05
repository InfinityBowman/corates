/**
 * Turns a stored notification into display copy and a destination. Copy lives
 * here rather than in the row so wording can change without touching D1.
 *
 * Rows read object first, actor second: line one is the project that changed,
 * line two is who did what to it.
 */

import {
  BellIcon,
  Trash2Icon,
  UserCheckIcon,
  UserMinusIcon,
  UserPlusIcon,
  type LucideIcon,
} from 'lucide-react';
import type { NotificationRecord } from '@corates/shared/notifications';

export interface RenderedNotification {
  title: string;
  /** Emphasised at the start of the second line; null when nobody in particular acted */
  actor: string | null;
  action: string;
  icon: LucideIcon;
  destructive: boolean;
  href: string | null;
}

function roleLabel(role: string): string {
  return role === 'owner' ? 'an owner' : 'a member';
}

export function renderNotification(notification: NotificationRecord): RenderedNotification {
  switch (notification.type) {
    case 'invitation.received': {
      const { inviterName, projectName, role, token } = notification.data;
      return {
        title: projectName,
        actor: inviterName,
        action: `invited you to join as ${roleLabel(role)}`,
        icon: UserPlusIcon,
        destructive: false,
        href: `/invite/${token}`,
      };
    }
    case 'invitation.accepted': {
      const { acceptedByName, projectName, projectId } = notification.data;
      return {
        title: projectName,
        actor: acceptedByName,
        action: 'joined the project',
        icon: UserCheckIcon,
        destructive: false,
        href: `/projects/${projectId}`,
      };
    }
    case 'project.removed': {
      const { projectName, actorName } = notification.data;
      return {
        title: projectName,
        actor: actorName,
        action: 'removed you from the project',
        icon: UserMinusIcon,
        destructive: true,
        href: null,
      };
    }
    case 'project.deleted': {
      const { projectName, actorName } = notification.data;
      return {
        title: projectName,
        actor: actorName,
        action: 'deleted the project',
        icon: Trash2Icon,
        destructive: true,
        href: null,
      };
    }
    default:
      // A server ahead of a cached client may send a type this build does not
      // know. Show something rather than crash the popover.
      return {
        title: 'New notification',
        actor: null,
        action: '',
        icon: BellIcon,
        destructive: false,
        href: null,
      };
  }
}
