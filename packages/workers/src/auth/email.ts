/**
 * Email service for BetterAuth
 * Uses Postmark for Cloudflare Workers
 */

import { Client as PostmarkClient } from 'postmark';
import {
  getVerificationEmailHtml,
  getVerificationEmailText,
  getPasswordResetEmailHtml,
  getPasswordResetEmailText,
  getMagicLinkEmailHtml,
  getMagicLinkEmailText,
  getProjectInvitationEmailHtml,
  getProjectInvitationEmailText,
} from './emailTemplates';
import type { Env } from '../types';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface EmailService {
  sendEmail: (params: SendEmailParams) => Promise<EmailResult>;
  sendEmailVerification: (
    to: string,
    verificationUrl: string,
    userDisplayName?: string,
  ) => Promise<EmailResult>;
  sendPasswordReset: (to: string, resetUrl: string, userDisplayName?: string) => Promise<EmailResult>;
  sendMagicLink: (to: string, magicLinkUrl: string) => Promise<EmailResult>;
  sendProjectInvitation: (
    to: string,
    projectName: string,
    inviterName: string,
    invitationUrl: string,
    role: string,
  ) => Promise<EmailResult>;
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
  async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<EmailResult> {
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

  /**
   * Send email verification email
   */
  async function sendEmailVerification(
    to: string,
    verificationUrl: string,
    userDisplayName: string = '',
  ): Promise<EmailResult> {
    if (env.SEND_EMAILS_IN_DEV !== 'true' && !isProduction) {
      console.log('[Email] Development environment - email sending is DISABLED');
      return { success: true, id: 'dev-id' };
    }
    const subject = 'Verify Your Email Address - CoRATES';
    const name = userDisplayName || 'there';
    const html = getVerificationEmailHtml({ name, subject, verificationUrl });
    const text = getVerificationEmailText({ name, verificationUrl });
    return sendEmail({ to, subject, html, text });
  }

  /**
   * Send password reset email
   */
  async function sendPasswordReset(
    to: string,
    resetUrl: string,
    userDisplayName: string = '',
  ): Promise<EmailResult> {
    const subject = 'Reset Your Password - CoRATES';
    const name = userDisplayName || 'there';
    const html = getPasswordResetEmailHtml({ name, subject, resetUrl });
    const text = getPasswordResetEmailText({ name, resetUrl });
    return sendEmail({ to, subject, html, text });
  }

  /**
   * Send magic link email for passwordless sign-in
   */
  async function sendMagicLink(to: string, magicLinkUrl: string): Promise<EmailResult> {
    if (env.SEND_EMAILS_IN_DEV !== 'true' && !isProduction) {
      console.log('[Email] Development environment - email sending is DISABLED');
      console.log('[Email] Magic link URL:', magicLinkUrl);
      return { success: true, id: 'dev-id' };
    }
    const subject = 'Sign in to CoRATES';
    const html = getMagicLinkEmailHtml({ subject, magicLinkUrl });
    const text = getMagicLinkEmailText({ magicLinkUrl });
    return sendEmail({ to, subject, html, text });
  }

  /**
   * Send project invitation email
   */
  async function sendProjectInvitation(
    to: string,
    projectName: string,
    inviterName: string,
    invitationUrl: string,
    role: string,
  ): Promise<EmailResult> {
    if (env.SEND_EMAILS_IN_DEV !== 'true' && !isProduction) {
      console.log('[Email] Development environment - email sending is DISABLED');
      console.log('[Email] Project invitation URL:', invitationUrl);
      return { success: true, id: 'dev-id' };
    }
    // Note: Email subjects are plain text, not HTML, so we don't need HTML escaping
    // However, we should still sanitize to prevent issues with email clients
    const { escapeHtml } = await import('../lib/escapeHtml');
    const safeProjectName = escapeHtml(projectName);
    const subject = `You're Invited to "${safeProjectName}" - CoRATES`;
    const html = getProjectInvitationEmailHtml({ projectName, inviterName, invitationUrl, role });
    const text = getProjectInvitationEmailText({ projectName, inviterName, invitationUrl, role });
    return sendEmail({ to, subject, html, text });
  }

  return {
    sendEmail,
    sendEmailVerification,
    sendPasswordReset,
    sendMagicLink,
    sendProjectInvitation,
    isProduction,
  };
}
