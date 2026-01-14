/**
 * Notification utilities for commands
 *
 * Consolidates user notification operations used across commands.
 */

/**
 * Send a notification to a single user via their UserSession Durable Object
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} userId - User ID to notify
 * @param {Object} notification - Notification payload
 * @param {string} notification.type - Notification type
 * @param {Object} [notification.data] - Additional notification data
 * @returns {Promise<void>}
 */
export async function notifyUser(env, userId, notification) {
  const userSessionId = env.USER_SESSION.idFromName(userId);
  const userSession = env.USER_SESSION.get(userSessionId);

  await userSession.fetch(
    new Request('https://internal/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...notification,
        timestamp: Date.now(),
      }),
    }),
  );
}

/**
 * Send a notification to multiple users
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {string[]} userIds - Array of user IDs to notify
 * @param {Object} notification - Notification payload
 * @param {string} [excludeUserId] - Optional user ID to exclude from notifications
 * @returns {Promise<number>} Number of users successfully notified
 */
export async function notifyUsers(env, userIds, notification, excludeUserId = null) {
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

/**
 * Notification type constants
 */
export const NotificationTypes = {
  PROJECT_DELETED: 'project-deleted',
  PROJECT_MEMBERSHIP_ADDED: 'project-membership-added',
  PROJECT_MEMBERSHIP_UPDATED: 'project-membership-updated',
  PROJECT_MEMBERSHIP_REMOVED: 'project-membership-removed',
};
