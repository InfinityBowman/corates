/**
 * Email service for BetterAuth
 * Handles email sending based on environment configuration
 */

/**
 * Create email service based on environment
 * @param {Object} env - Environment variables
 * @returns {Object} Email service functions
 */
export function createEmailService(env) {
  const isProduction = env.ENVIRONMENT === 'production';
  const sendRealEmailsInDev = env.SEND_EMAILS_IN_DEV === 'true';

  /**
   * Send email using SMTP configuration
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML content
   * @param {string} options.text - Plain text content
   * @returns {Promise<Object>} Result object
   */
  async function sendEmail({ to, subject, html, text }) {
    console.log(`Preparing to send email to: ${to}`, !isProduction, sendRealEmailsInDev);
    // Development mode with real email testing enabled
    if (!isProduction && sendRealEmailsInDev) {
      return await sendRealEmail({ to, subject, html, text });
    }

    // Production mode
    if (isProduction) {
      return await sendRealEmail({ to, subject, html, text });
    }

    // Development mode without real email sending
    return { success: true, mode: 'development-not-sending' };
  }

  /**
   * Actually send email via configured service
   */
  async function sendRealEmail({ to, subject, html, text }) {
    try {
      // Option 1: Use Resend (recommended for Workers)
      if (env.RESEND_API_KEY) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${env.EMAIL_FROM_NAME || 'CoRATES'} <${env.EMAIL_FROM}>`,
            to: [to],
            subject: subject,
            html: html,
            text: text,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Resend API error: ${error.message}`);
        }

        const result = await response.json();
        console.log('Email sent successfully via Resend:', result.id);
        return { success: true, id: result.id, service: 'resend' };
      }

      // Option 2: Use SendGrid
      if (env.SENDGRID_API_KEY) {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: {
              email: env.EMAIL_FROM,
              name: env.EMAIL_FROM_NAME || 'CoRATES',
            },
            subject: subject,
            content: [
              { type: 'text/plain', value: text },
              { type: 'text/html', value: html },
            ].filter((c) => c.value),
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`SendGrid API error: ${error}`);
        }

        console.log('Email sent successfully via SendGrid');
        return { success: true, service: 'sendgrid' };
      }

      // Option 3: Use a simple SMTP relay server (for development)
      try {
        const relayUrl = env.SMTP_RELAY_URL || 'http://localhost:3001/send-email';
        const response = await fetch(relayUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, subject, html, text }),
        });
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`SMTP relay error: ${error}`);
        }
        const result = await response.json();
        // console.log('Email sent via local SMTP relay:', result.messageId || result);
        return { success: true, service: 'smtp-relay', ...result };
      } catch (error) {
        console.error('Failed to send email via local SMTP relay:', error);
        throw new Error(`Failed to send email via local SMTP relay: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send email verification email
   * @param {string} to - Recipient email
   * @param {string} verificationUrl - Verification URL
   * @param {string} userDisplayName - User's display name
   * @returns {Promise<Object>} Result object
   */
  async function sendEmailVerification(to, verificationUrl, userDisplayName = '') {
    console.log(`Sending email verification to: ${to} with URL: ${verificationUrl}`);
    const subject = 'Verify Your Email Address - CoRATES';
    const name = userDisplayName || 'there';
    const { getVerificationEmailHtml, getVerificationEmailText } = await import('./emailTemplates.js');
    const html = getVerificationEmailHtml({ name, subject, verificationUrl });
    const text = getVerificationEmailText({ name, verificationUrl });
    return await sendEmail({ to, subject, html, text });
  }

  /**
   * Send password reset email
   * @param {string} to - Recipient email
   * @param {string} resetUrl - Password reset URL
   * @param {string} userDisplayName - User's display name
   * @returns {Promise<Object>} Result object
   */
  async function sendPasswordReset(to, resetUrl, userDisplayName = '') {
    console.log(`Sending password reset to: ${to} with URL: ${resetUrl}`);
    const subject = 'Reset Your Password - CoRATES';
    const name = userDisplayName || 'there';
    const { getPasswordResetEmailHtml, getPasswordResetEmailText } = await import('./emailTemplates.js');
    const html = getPasswordResetEmailHtml({ name, subject, resetUrl });
    const text = getPasswordResetEmailText({ name, resetUrl });
    return await sendEmail({ to, subject, html, text });
  }

  return {
    sendEmail,
    sendEmailVerification,
    sendPasswordReset,
    isProduction,
  };
}
