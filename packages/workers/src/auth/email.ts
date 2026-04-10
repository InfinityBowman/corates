/**
 * Email service for BetterAuth
 * Uses Postmark for Cloudflare Workers
 *
 * Note: Email composition (templates, subjects) is handled by better-auth plugin
 * callbacks in config.ts, which queue pre-rendered emails via email-queue.ts.
 * This service only handles the generic send operation for the queue consumer.
 */

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
}

interface EmailService {
  sendEmail: (_params: SendEmailParams) => Promise<EmailResult>;
  isProduction: boolean;
}

/**
 * Create email service based on environment
 */
export function createEmailService(env: Env): EmailService {
  const isProduction = env.ENVIRONMENT === 'production';

  // Initialize Postmark client if API key is available
  const postmark = env.POSTMARK_SERVER_TOKEN ? new PostmarkClient(env.POSTMARK_SERVER_TOKEN) : null;

  /**
   * Send email using Postmark
   */
  async function sendEmail({
    to,
    subject,
    html,
    text,
    replyTo,
  }: SendEmailParams): Promise<EmailResult> {
    if (env.SEND_EMAILS_IN_DEV !== 'true' && !isProduction) {
      console.log('[Email] Development environment - email sending is DISABLED');
      return { success: true, id: 'dev-id' };
    }

    if (!postmark) {
      console.log('[Email] No POSTMARK_SERVER_TOKEN configured, skipping email');
      return { success: false, error: 'No email provider configured' };
    }

    try {
      const response = await postmark.sendEmail({
        From: `CoRATES <${env.EMAIL_FROM || 'noreply@corates.org'}>`,
        To: to,
        Subject: subject,
        HtmlBody: html,
        TextBody: text,
        ...(replyTo ? { ReplyTo: replyTo } : {}),
        MessageStream: 'outbound',
      });

      if (response.ErrorCode !== 0) {
        console.error('[Email] Postmark API error:', JSON.stringify(response));
        return { success: false, error: response.Message };
      }

      return { success: true, id: response.MessageID };
    } catch (err) {
      const error = err as Error;
      console.error('[Email] Exception during send:', error.message, error.stack);
      return { success: false, error: error.message };
    }
  }

  return {
    sendEmail,
    isProduction,
  };
}
