/**
 * Email queue consumer — extracted from the retired Hono entry. The web
 * worker (`packages/web/src/server.ts`) wires this into its Cloudflare
 * Workers `queue()` handler.
 */
import { createEmailService } from './auth/email';
import type { EmailPayload } from './lib/email-queue';
import type { Env } from './types';

export async function handleEmailQueue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
  const emailService = createEmailService(env);
  const messages = batch.messages as Message<EmailPayload>[];

  for (const msg of messages) {
    try {
      const result = await emailService.sendEmail(
        msg.body as Parameters<typeof emailService.sendEmail>[0],
      );

      if (result.success) {
        msg.ack();
      } else {
        const masked = msg.body.to?.replace(/^(..).*@/, '$1***@');
        console.error(`[EmailQueue] Send returned error for ${masked}:`, result.error);
        const delay = Math.min(30 * 2 ** msg.attempts, 1800);
        msg.retry({ delaySeconds: delay });
      }
    } catch (error) {
      const masked = msg.body.to?.replace(/^(..).*@/, '$1***@');
      console.error(`[EmailQueue] Exception sending to ${masked}:`, error);
      const delay = Math.min(30 * 2 ** msg.attempts, 1800);
      msg.retry({ delaySeconds: delay });
    }
  }
}
