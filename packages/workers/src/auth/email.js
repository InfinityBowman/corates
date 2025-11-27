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

  // Helper to timeout fetch requests so they don't block workers for too long
  function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
  }

  /**
   * Send email directly to the provider (bypasses queue).
   * This is used by EmailQueue DO to avoid infinite loops.
   */
  async function sendDirectEmail({ to, subject, html, text }) {
    // Option 1: Use Resend (recommended for Workers)
    if (env.RESEND_API_KEY) {
      const response = await fetchWithTimeout(
        'https://api.resend.com/emails',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${'CoRATES'} <${env.EMAIL_FROM}>`,
            to: [to],
            subject: subject,
            html: html,
            text: text,
          }),
        },
        10000, // 10 second timeout for DO context
      );

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
      const response = await fetchWithTimeout(
        'https://api.sendgrid.com/v3/mail/send',
        {
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
            ].filter(c => c.value),
          }),
        },
        10000,
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SendGrid API error: ${error}`);
      }

      console.log('Email sent successfully via SendGrid');
      return { success: true, service: 'sendgrid' };
    }

    // Option 3: Use a simple SMTP relay server (for development)
    const relayUrl = env.SMTP_RELAY_URL || 'http://localhost:3001/send-email';
    const response = await fetchWithTimeout(
      relayUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html, text }),
      },
      10000,
    );
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SMTP relay error: ${error}`);
    }
    const result = await response.json();
    return { success: true, service: 'smtp-relay', ...result };
  }

  /**
   * Actually send email via configured service (may use queue)
   */
  async function sendRealEmail({ to, subject, html, text }) {
    try {
      // If a Durable Object queue is configured, forward to it instead of
      // calling the third-party provider directly. This keeps the request
      // path fast and lets the EmailQueue DO handle retries.
      if (env.EMAIL_QUEUE && typeof env.EMAIL_QUEUE.idFromName === 'function') {
        try {
          const id = env.EMAIL_QUEUE.idFromName('default');
          const queue = env.EMAIL_QUEUE.get(id);
          // Use a full URL to avoid 'Invalid URL: /' error
          const req = new Request('https://email-queue/do', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, subject, html, text }),
          });
          await queue.fetch(req);
          return { success: true, service: 'email_queue' };
        } catch (err) {
          console.error('Failed to enqueue email to EmailQueue DO', err);
          // Fall back to direct send below
        }
      }

      // Fall back to direct send if queue failed or not available
      return await sendDirectEmail({ to, subject, html, text });
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
    const { getVerificationEmailHtml, getVerificationEmailText } = await import(
      './emailTemplates.js'
    );
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
    const { getPasswordResetEmailHtml, getPasswordResetEmailText } = await import(
      './emailTemplates.js'
    );
    const html = getPasswordResetEmailHtml({ name, subject, resetUrl });
    const text = getPasswordResetEmailText({ name, resetUrl });
    return await sendEmail({ to, subject, html, text });
  }

  /**
   * Fire-and-forget async email verification
   */
  function sendEmailVerificationAsync(to, verificationUrl, userDisplayName = '') {
    sendEmailVerification(to, verificationUrl, userDisplayName).catch(err =>
      console.error('Async email verification error:', err),
    );
  }

  /**
   * Fire-and-forget async password reset
   */
  function sendPasswordResetAsync(to, resetUrl, userDisplayName = '') {
    sendPasswordReset(to, resetUrl, userDisplayName).catch(err =>
      console.error('Async password reset error:', err),
    );
  }

  return {
    sendEmail,
    sendDirectEmail,
    sendEmailVerification,
    sendPasswordReset,
    sendEmailVerificationAsync,
    sendPasswordResetAsync,
    isProduction,
  };
}
