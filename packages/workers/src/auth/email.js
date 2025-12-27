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
} from './emailTemplates.js';

/**
 * Create email service based on environment
 * @param {Object} env - Environment variables
 * @returns {Object} Email service functions
 */
export function createEmailService(env) {
  const isProduction = env.ENVIRONMENT === 'production';

  // Initialize Postmark client if API key is available
  const postmark = env.POSTMARK_SERVER_TOKEN ? new PostmarkClient(env.POSTMARK_SERVER_TOKEN) : null;

  /**
   * Send email using Postmark
   */
  async function sendEmail({ to, subject, html, text }) {
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
      console.error('[Email] Exception during send:', err.message, err.stack);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send email verification email
   */
  async function sendEmailVerification(to, verificationUrl, userDisplayName = '') {
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
  async function sendPasswordReset(to, resetUrl, userDisplayName = '') {
    const subject = 'Reset Your Password - CoRATES';
    const name = userDisplayName || 'there';
    const html = getPasswordResetEmailHtml({ name, subject, resetUrl });
    const text = getPasswordResetEmailText({ name, resetUrl });
    return sendEmail({ to, subject, html, text });
  }

  /**
   * Send magic link email for passwordless sign-in
   */
  async function sendMagicLink(to, magicLinkUrl) {
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
  async function sendProjectInvitation(to, projectName, inviterName, invitationUrl, role) {
    if (env.SEND_EMAILS_IN_DEV !== 'true' && !isProduction) {
      console.log('[Email] Development environment - email sending is DISABLED');
      console.log('[Email] Project invitation URL:', invitationUrl);
      return { success: true, id: 'dev-id' };
    }
    const subject = `You're Invited to "${projectName}" - CoRATES`;
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
