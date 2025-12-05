/**
 * Email service for BetterAuth
 * Uses Resend SDK for Cloudflare Workers
 */

import { Resend } from 'resend';
import {
  getVerificationEmailHtml,
  getVerificationEmailText,
  getPasswordResetEmailHtml,
  getPasswordResetEmailText,
  getMagicLinkEmailHtml,
  getMagicLinkEmailText,
} from './emailTemplates.js';

/**
 * Create email service based on environment
 * @param {Object} env - Environment variables
 * @returns {Object} Email service functions
 */
export function createEmailService(env) {
  const isProduction = env.ENVIRONMENT === 'production';

  // Initialize Resend client if API key is available
  const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

  /**
   * Send email using Resend
   */
  async function sendEmail({ to, subject, html, text }) {
    if (env.SEND_EMAILS_IN_DEV !== 'true' && !isProduction) {
      console.log('[Email] Development environment - email sending is DISABLED');
      return { success: true, id: 'dev-id' };
    }

    if (!resend) {
      console.log('[Email] No RESEND_API_KEY configured, skipping email');
      return { success: false, error: 'No email provider configured' };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: `CoRATES <${env.EMAIL_FROM || 'noreply@corates.org'}>`,
        to: [to],
        subject,
        html,
        text,
      });

      if (error) {
        console.error('[Email] Resend API error:', JSON.stringify(error));
        return { success: false, error: error.message };
      }

      return { success: true, id: data?.id };
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

  return {
    sendEmail,
    sendEmailVerification,
    sendPasswordReset,
    sendMagicLink,
    isProduction,
  };
}
