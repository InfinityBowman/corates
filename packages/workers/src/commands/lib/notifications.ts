/**
 * Notification utilities for commands
 *
 * Consolidates user notification operations used across commands.
 */

import type { Env } from '@/types';

/**
 * Notification type constants
 */
export const NotificationTypes = {
  PROJECT_DELETED: 'project-deleted',
  PROJECT_MEMBERSHIP_ADDED: 'project-membership-added',
  PROJECT_MEMBERSHIP_UPDATED: 'project-membership-updated',
  PROJECT_MEMBERSHIP_REMOVED: 'project-membership-removed',
} as const;

export type NotificationType = (typeof NotificationTypes)[keyof typeof NotificationTypes];

export interface Notification {
  type: NotificationType | string;
  [key: string]: unknown;
}

/**
 * Send a notification to a single user via their UserSession Durable Object
 */
export async function notifyUser(
  env: Env,
  userId: string,
  notification: Notification,
): Promise<void> {
  const userSessionId = env.USER_SESSION.idFromName(userId);
  const userSession = env.USER_SESSION.get(userSessionId);

  await userSession.notify({
    ...notification,
    timestamp: Date.now(),
  });
}

/**
 * Send a notification to multiple users
 *
 * @returns Number of users successfully notified
 */
export async function notifyUsers(
  env: Env,
  userIds: string[],
  notification: Notification,
  excludeUserId: string | null = null,
): Promise<number> {
  let notifiedCount = 0;

  for (const userId of userIds) {
    if (excludeUserId && userId === excludeUserId) {
      continue;
    }

    try {
      await notifyUser(env, userId, notification);
      notifiedCount++;
    } catch (err) {
      console.error(`Failed to send notification to user ${userId}:`, err);
    }
  }

  return notifiedCount;
}
