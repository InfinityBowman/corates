/**
 * Email queue consumer — extracted from the retired Hono entry. The web
 * worker (`packages/web/src/server.ts`) wires this into its Cloudflare
 * Workers `queue()` handler.
 */
import { captureError } from './lib/logger';
import { createEmailService } from './auth/email';
import type { EmailPayload } from '@corates/shared/email';
import type { Env } from './types';

export async function handleEmailQueue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
  const emailService = createEmailService(env);
  const messages = batch.messages as Message<EmailPayload>[];

  await Promise.allSettled(
    messages.map(async msg => {
      try {
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
