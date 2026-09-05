/**
 * Push events to users through their UserSession Durable Object.
 */

import type { UserSessionEvent } from '@corates/shared/notifications';
import { captureError } from '../../lib/logger';
import type { Env } from '../../types';

export async function notifyUser(env: Env, userId: string, event: UserSessionEvent): Promise<void> {
  const userSessionId = env.USER_SESSION.idFromName(userId);
  const userSession = env.USER_SESSION.get(userSessionId);

  await userSession.notify({
    ...event,
    timestamp: Date.now(),
  });
}

/**
 * @returns Number of users successfully notified
 */
export async function notifyUsers(
  env: Env,
  userIds: string[],
  event: UserSessionEvent,
  excludeUserId: string | null = null,
): Promise<number> {
  let notifiedCount = 0;

  for (const userId of userIds) {
    if (excludeUserId && userId === excludeUserId) {
      continue;
    }

    try {
      await notifyUser(env, userId, event);
      notifiedCount++;
    } catch (err) {
      captureError(err, { tags: { component: 'notifications' }, extra: { userId } });
    }
  }

  return notifiedCount;
}
