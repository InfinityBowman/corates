import { env } from 'cloudflare:workers';
import { throwDomainError, AUTH_ERRORS } from '@corates/shared';
import type { NotificationPayloads } from '@corates/shared/notifications';
import { isAdminUser } from '@corates/workers/auth-admin';
import { sendAnnouncement as sendAnnouncementImpl } from '@corates/workers/commands/notifications';
import type { Session } from '@/server/middleware/auth';

export type AnnouncementInput = NotificationPayloads['announcement'];

export async function sendAnnouncement(
  session: Session,
  data: AnnouncementInput,
): Promise<{ sent: number }> {
  if (!isAdminUser(session.user as { role?: string | null })) {
    throwDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'admin_required' });
  }
  return sendAnnouncementImpl(env, data);
}
