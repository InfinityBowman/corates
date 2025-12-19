/**
 * Contact form route
 * Handles contact form submissions and sends emails via Postmark
 */

import { Hono } from 'hono';
import { Client as PostmarkClient } from 'postmark';
import { z } from 'zod';
import { contactRateLimit } from '../middleware/rate-limit.js';

const contact = new Hono();

// Apply rate limiting to contact endpoints
contact.use('*', contactRateLimit);

// Contact form validation schema
const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .max(254, 'Email must be 254 characters or less')
    .email('Invalid email address'),
  subject: z
    .string()
    .trim()
    .max(150, 'Subject must be 150 characters or less')
    .optional()
    .default(''),
  message: z
    .string()
    .trim()
    .min(1, 'Message is required')
    .max(2000, 'Message must be 2000 characters or less'),
});

/**
 * POST /contact
 * Receives contact form data and sends an email to the team
 */
contact.post('/', async c => {
  const env = c.env;

  // Parse request body
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // Validate with Zod
  const result = contactSchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.errors[0]?.message || 'Invalid input';
    return c.json({ error: firstError }, 400);
  }

  const { name, email, subject, message } = result.data;

  // Check for Postmark token
  if (!env.POSTMARK_SERVER_TOKEN) {
    console.error('[Contact] No POSTMARK_SERVER_TOKEN configured');
    return c.json({ error: 'Email service not configured' }, 500);
  }

  const postmark = new PostmarkClient(env.POSTMARK_SERVER_TOKEN);
  const contactEmail = env.CONTACT_EMAIL || 'contact@corates.org';

  try {
    // Send email to the team
    const response = await postmark.sendEmail({
      From: `CoRATES Contact Form <${env.EMAIL_FROM || 'contact@corates.org'}>`,
      To: contactEmail,
      ReplyTo: email,
      Subject: `[Contact Form] ${subject || 'New Inquiry'}`,
      TextBody: `New contact form submission:\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject || 'Not specified'}\n\nMessage:\n${message}`,
      HtmlBody: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">New Contact Form Submission</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 100px;">Name:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Email:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Subject:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${escapeHtml(subject || 'Not specified')}</td>
            </tr>
          </table>
          <h3 style="color: #374151;">Message:</h3>
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(message)}</div>
          <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
            You can reply directly to this email to respond to ${escapeHtml(name)}.
          </p>
        </div>
      `,
      MessageStream: 'outbound',
    });

    if (response.ErrorCode !== 0) {
      console.error('[Contact] Postmark API error:', JSON.stringify(response));
      return c.json({ error: 'Failed to send message' }, 500);
    }

    return c.json({ success: true, messageId: response.MessageID });
  } catch (err) {
    console.error('[Contact] Exception during send:', err.message, err.stack);
    return c.json({ error: 'Failed to send message' }, 500);
  }
});

/**
 * Escape HTML to prevent XSS in email content
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replaceAll(/[&<>"']/g, m => map[m]);
}

export { contact as contactRoutes };
