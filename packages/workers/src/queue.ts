/**
 * Email queue consumer — extracted from the retired Hono entry. The web
 * worker (`packages/web/src/server.ts`) wires this into its Cloudflare
 * Workers `queue()` handler.
 */
import { captureError, info, runWithContext, warn } from './lib/logger';
import { createEmailService } from './auth/email';
import { createDb } from '@corates/db/client';
import { projectInvitations } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import type { EmailPayload } from '@corates/shared/email';
import type { Env } from './types';

async function isAlreadyProcessed(db: D1Database, messageId: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 FROM processed_emails WHERE queueMessageId = ?`)
    .bind(messageId)
    .first();
  return row !== null;
}

// The marker must only be written after a successful send. Writing it up front
// meant a failed send's retry saw the marker and was ack'd without ever
// sending. Worst case now is a duplicate email if we die between the send and
// the marker write, which is preferable to silently dropping mail.
async function markProcessed(db: D1Database, messageId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO processed_emails (queueMessageId, processedAt) VALUES (?, unixepoch()) ON CONFLICT (queueMessageId) DO NOTHING`,
    )
    .bind(messageId)
    .run();
}

// Surfaces the failure on the pending-invitations list, since nothing else
// tells the inviter that the address never received anything.
async function markInvitationUndeliverable(env: Env, payload: EmailPayload): Promise<void> {
  if (!payload.invitationId) return;
  await createDb(env.DB)
    .update(projectInvitations)
    .set({ emailStatus: 'undeliverable' })
    .where(eq(projectInvitations.id, payload.invitationId));
}

export async function handleEmailQueue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
  const emailService = createEmailService(env);
  const messages = batch.messages as Message<EmailPayload>[];

  // The batch's scope is shared by every message in it, so without this a
  // failed send cannot be told apart from its neighbours in the same batch.
  await Promise.allSettled(
    messages.map(msg =>
      runWithContext({ messageId: msg.id }, async () => {
        try {
          if (await isAlreadyProcessed(env.DB, msg.id)) {
            msg.ack();
            return;
          }

          const result = await emailService.sendEmail(
            msg.body as Parameters<typeof emailService.sendEmail>[0],
          );

          if (result.success) {
            await markProcessed(env.DB, msg.id);
            info('email.sent', {
              to: msg.body.to,
              subject: msg.body.subject,
              attempt: msg.attempts,
            });
            msg.ack();
          } else {
            captureError(new Error(`Email send failed for ${msg.body.to}: ${result.error}`), {
              tags: { component: 'email-queue' },
              // subject is all that tells an invitation from a magic link here
              extra: {
                attempt: msg.attempts,
                to: msg.body.to,
                subject: msg.body.subject,
                permanent: result.permanent,
              },
            });
            if (result.permanent) {
              await markInvitationUndeliverable(env, msg.body);
              msg.ack();
            } else {
              const delay = Math.min(30 * 2 ** msg.attempts, 1800);
              msg.retry({ delaySeconds: delay });
            }
          }
        } catch (error) {
          captureError(error, {
            tags: { component: 'email-queue' },
            extra: { attempt: msg.attempts, to: msg.body.to, subject: msg.body.subject },
          });
          const delay = Math.min(30 * 2 ** msg.attempts, 1800);
          msg.retry({ delaySeconds: delay });
        }
      }),
    ),
  );
}

// A dead-lettered message has exhausted its retries; record it and flag the invitation
export async function handleEmailDeadLetter(batch: MessageBatch<unknown>, env: Env): Promise<void> {
  for (const msg of batch.messages as Message<EmailPayload>[]) {
    warn('email.dead_lettered', {
      to: msg.body.to,
      subject: msg.body.subject,
      queueMessageId: msg.id,
      enqueuedAt: msg.timestamp.toISOString(),
    });
    try {
      await markInvitationUndeliverable(env, msg.body);
    } catch (error) {
      captureError(error, { tags: { component: 'email-dlq' }, extra: { to: msg.body.to } });
    }
    msg.ack();
  }
}
