/**
 * Email queue consumer — extracted from the retired Hono entry. The web
 * worker (`packages/web/src/server.ts`) wires this into its Cloudflare
 * Workers `queue()` handler.
 */
import { captureError } from './lib/logger';
import { createEmailService } from './auth/email';
import type { EmailPayload } from '@corates/shared/email';
import type { Env } from './types';

async function isAlreadyProcessed(db: D1Database, messageId: string): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO processed_emails (queueMessageId, processedAt) VALUES (?, unixepoch()) ON CONFLICT (queueMessageId) DO NOTHING`,
    )
    .bind(messageId)
    .run();
  return result.meta.changes === 0;
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

        if (result.success) {
          msg.ack();
        } else {
          const masked = msg.body.to?.replace(/^(..).*@/, '$1***@');
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
