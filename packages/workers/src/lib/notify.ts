import type { Env } from '../types';
import type { Database } from '../db/client';

interface NotifyEvent {
  type: string;
  data?: Record<string, unknown>;
  timestamp?: number;
}

interface NotifyResult {
  success: boolean;
  delivered: boolean;
}

interface NotifyOrgResult {
  notified: number;
  failed: number;
}

interface NotifyOrgOptions {
  excludeUserIds?: string[];
}

export async function notifyUser(
  env: Env,
  userId: string,
  event: NotifyEvent,
): Promise<NotifyResult> {
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

    const result = await stub.notify({
      ...event,
      timestamp: event.timestamp || Date.now(),
    });

    return result;
  } catch (error) {
    console.error('[notify] Error sending notification:', error);
    return { success: false, delivered: false };
  }
}

export async function notifyOrgMembers(
  env: Env,
  db: Database,
  orgId: string,
  event: NotifyEvent,
  options: NotifyOrgOptions = {},
): Promise<NotifyOrgResult> {
  const { excludeUserIds = [] } = options;

  try {
    const { member } = await import('../db/schema');
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

export const EventTypes = {
  SUBSCRIPTION_UPDATED: 'subscription:updated',
  SUBSCRIPTION_CANCELED: 'subscription:canceled',
  ORG_MEMBER_ADDED: 'org:member-added',
  ORG_MEMBER_REMOVED: 'org:member-removed',
  ORG_ROLE_CHANGED: 'org:role-changed',
  PROJECT_SHARED: 'project:shared',
  PROJECT_UNSHARED: 'project:unshared',
} as const;
