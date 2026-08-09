/**
 * Email queue consumer — extracted from the retired Hono entry. The web
 * worker (`packages/web/src/server.ts`) wires this into its Cloudflare
 * Workers `queue()` handler.
 */
import { captureError, info } from './lib/logger';
import { createEmailService } from './auth/email';
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

export async function handleEmailQueue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
  const emailService = createEmailService(env);
  const messages = batch.messages as Message<EmailPayload>[];

  await Promise.allSettled(
    messages.map(async msg => {
      try {
        if (await isAlreadyProcessed(env.DB, msg.id)) {
          msg.ack();
          return;
        }

        const result = await emailService.sendEmail(
          msg.body as Parameters<typeof emailService.sendEmail>[0],
        );

        const masked = msg.body.to?.replace(/^(..).*@/, '$1***@');
        if (result.success) {
          await markProcessed(env.DB, msg.id);
          info('email.sent', { to: masked, subject: msg.body.subject, attempt: msg.attempts });
          msg.ack();
        } else {
          captureError(new Error(`Email send failed for ${masked}: ${result.error}`), {
            tags: { component: 'email-queue' },
            extra: { attempt: msg.attempts },
          });
          const delay = Math.min(30 * 2 ** msg.attempts, 1800);
          msg.retry({ delaySeconds: delay });
        }
      } catch (error) {
        captureError(error, {
          tags: { component: 'email-queue' },
          extra: { attempt: msg.attempts },
        });
        const delay = Math.min(30 * 2 ** msg.attempts, 1800);
        msg.retry({ delaySeconds: delay });
      }
    }),
  );
}
