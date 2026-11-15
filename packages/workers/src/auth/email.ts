/**
 * Email service for BetterAuth
 * Sends through Cloudflare Email Sending, falling back to Postmark
 *
 * Note: Email composition (templates, subjects) is handled by better-auth plugin
 * callbacks in config.ts, which queue pre-rendered emails via email-queue.ts.
 * This service only handles the generic send operation for the queue consumer.
 */

import { captureError, warn } from '../lib/logger';
import { Client as PostmarkClient } from 'postmark';
import type { Env } from '../types';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
  /** The address itself is rejected; retrying can never succeed */
  permanent?: boolean;
  provider?: 'cloudflare' | 'postmark';
}

// Postmark API codes: 300 malformed recipient, 406 recipient on the suppression list
const PERMANENT_POSTMARK_CODES = new Set([300, 406]);

// A recipient Cloudflare suppressed after a hard bounce would bounce on Postmark
// too and cost its reputation, so it skips the fallback.
const PERMANENT_CLOUDFLARE_CODES = new Set(['E_RECIPIENT_SUPPRESSED']);

interface EmailService {
  sendEmail: (_params: SendEmailParams) => Promise<EmailResult>;
  isProduction: boolean;
}

/**
 * Create email service based on environment
 */
export function createEmailService(env: Env): EmailService {
  const isProduction = env.ENVIRONMENT === 'production';
  const fromAddress = env.EMAIL_FROM || 'noreply@corates.org';

  // Initialize Postmark client if API key is available
  const postmark = env.POSTMARK_SERVER_TOKEN ? new PostmarkClient(env.POSTMARK_SERVER_TOKEN) : null;

  async function sendWithCloudflare(
    binding: SendEmail,
    { to, subject, html, text, replyTo }: SendEmailParams,
  ): Promise<EmailResult> {
    try {
      const response = await binding.send({
        from: { name: 'CoRATES', email: fromAddress },
        to,
        subject,
        html,
        text,
        ...(replyTo ? { replyTo } : {}),
      });
      return { success: true, id: response.messageId, provider: 'cloudflare' };
    } catch (err) {
      const error = err as Error & { code?: unknown };
      const permanent =
        typeof error.code === 'string' && PERMANENT_CLOUDFLARE_CODES.has(error.code);
      captureError(err, {
        tags: { component: 'email', provider: 'cloudflare' },
        extra: { code: error.code, permanent },
      });
      return { success: false, error: error.message, permanent, provider: 'cloudflare' };
    }
  }

  async function sendWithPostmark(
    client: PostmarkClient,
    { to, subject, html, text, replyTo }: SendEmailParams,
  ): Promise<EmailResult> {
    try {
      const response = await client.sendEmail({
        From: `CoRATES <${fromAddress}>`,
        To: to,
        Subject: subject,
        HtmlBody: html,
        TextBody: text,
        ...(replyTo ? { ReplyTo: replyTo } : {}),
        MessageStream: 'outbound',
      });

      if (response.ErrorCode !== 0) {
        captureError(new Error(`Postmark API error: ${response.ErrorCode}`), {
          tags: { component: 'email', provider: 'postmark' },
          extra: { errorCode: response.ErrorCode, message: response.Message },
        });
        return { success: false, error: response.Message, provider: 'postmark' };
      }

      return { success: true, id: response.MessageID, provider: 'postmark' };
    } catch (err) {
      const error = err as Error & { code?: unknown };
      const permanent = typeof error.code === 'number' && PERMANENT_POSTMARK_CODES.has(error.code);
      captureError(err, {
        tags: { component: 'email', provider: 'postmark' },
        extra: { permanent },
      });
      return { success: false, error: error.message, permanent, provider: 'postmark' };
    }
  }

  async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
    if (env.SEND_EMAILS_IN_DEV !== 'true' && !isProduction) {
      const urls = (params.text ?? params.html).match(/https?:\/\/\S+/g) ?? [];
      console.log(
        `[Email:dev] to=${params.to} subject="${params.subject}"${urls.length ? `\n  links:\n    ${urls.join('\n    ')}` : ''}`,
      );
      return { success: true, id: 'dev-id' };
    }

    if (env.EMAIL) {
      const result = await sendWithCloudflare(env.EMAIL, params);
      if (result.success || result.permanent || !postmark) return result;
    }

    if (!postmark) {
      warn('No email provider configured, skipping email');
      return { success: false, error: 'No email provider configured' };
    }

    return sendWithPostmark(postmark, params);
  }

  return {
    sendEmail,
    isProduction,
  };
}
