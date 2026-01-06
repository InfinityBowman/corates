/**
 * Notification utilities for sending real-time events to users via UserSession DO
 */

/**
 * Send a notification event to a user's UserSession Durable Object
 * The DO will broadcast to all connected WebSocket clients or queue for later delivery
 *
 * @param {Object} env - Worker environment with USER_SESSION binding
 * @param {string} userId - The user ID to notify
 * @param {Object} event - The event to send
 * @param {string} event.type - Event type (e.g., 'subscription:updated')
 * @param {Object} event.data - Event payload
 * @returns {Promise<{success: boolean, delivered: boolean}>}
 */
export async function notifyUser(env, userId, event) {
  if (!env.USER_SESSION) {
    console.warn('[notify] USER_SESSION binding not available');
    return { success: false, delivered: false };
  }

  if (!userId) {
    console.warn('[notify] No userId provided');
    return { success: false, delivered: false };
  }

  try {
    const id = env.USER_SESSION.idFromName(userId);
    const stub = env.USER_SESSION.get(id);

    const response = await stub.fetch(
      new Request('https://internal/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...event,
          timestamp: event.timestamp || Date.now(),
        }),
      }),
    );

    if (!response.ok) {
      console.error('[notify] Failed to send notification:', response.status);
      return { success: false, delivered: false };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[notify] Error sending notification:', error);
    return { success: false, delivered: false };
  }
}

/**
 * Notify all members of an organization
 * Useful for org-level events like membership changes
 *
 * @param {Object} env - Worker environment
 * @param {Object} db - Drizzle database instance
 * @param {string} orgId - The organization ID
 * @param {Object} event - The event to send
 * @param {Object} options - Options
 * @param {string[]} [options.excludeUserIds] - User IDs to exclude from notification
 * @returns {Promise<{notified: number, failed: number}>}
 */
export async function notifyOrgMembers(env, db, orgId, event, options = {}) {
  const { excludeUserIds = [] } = options;

  try {
    const { member } = await import('../db/schema.js');
    const { eq } = await import('drizzle-orm');

    const members = await db
      .select({ userId: member.userId })
      .from(member)
      .where(eq(member.organizationId, orgId))
      .all();

    let notified = 0;
    let failed = 0;

    for (const m of members) {
      if (excludeUserIds.includes(m.userId)) continue;

      const result = await notifyUser(env, m.userId, event);
      if (result.success) {
        notified++;
      } else {
        failed++;
      }
    }

    return { notified, failed };
  } catch (error) {
    console.error('[notify] Error notifying org members:', error);
    return { notified: 0, failed: 0 };
  }
}

/**
 * Event type constants for type safety
 */
export const EventTypes = {
  // Subscription events
  SUBSCRIPTION_UPDATED: 'subscription:updated',
  SUBSCRIPTION_CANCELED: 'subscription:canceled',

  // Organization events
  ORG_MEMBER_ADDED: 'org:member-added',
  ORG_MEMBER_REMOVED: 'org:member-removed',
  ORG_ROLE_CHANGED: 'org:role-changed',

  // Project events
  PROJECT_SHARED: 'project:shared',
  PROJECT_UNSHARED: 'project:unshared',
};
