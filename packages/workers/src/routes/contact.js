/**
 * Contact form route
 * Handles contact form submissions and sends emails via Postmark
 */

import { Hono } from 'hono';
import { Client as PostmarkClient } from 'postmark';
import { z } from 'zod';
import { contactRateLimit } from '../middleware/rateLimit.js';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';

const contact = new Hono();

// Apply rate limiting to contact endpoints
contact.use('*', contactRateLimit);

// Contact form validation schema
const contactSchema = z.object({
  name: z
    .string({ required_error: 'Name is required', invalid_type_error: 'Name must be a string' })
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  email: z
    .string({ required_error: 'Email is required', invalid_type_error: 'Email must be a string' })
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
    .string({
      required_error: 'Message is required',
      invalid_type_error: 'Message must be a string',
    })
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
    const error = createValidationError(
      'body',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      null,
      'invalid_json',
    );
    return c.json(error, error.statusCode);
  }

  // Validate with Zod
  const result = contactSchema.safeParse(body);
  if (!result.success) {
    // Get the first error message, prioritizing custom messages
    const firstIssue = result.error.issues[0];
    let fieldName = 'input';
    let errorMessage = firstIssue?.message || 'Invalid input';

    // Extract field name from path
    if (firstIssue?.path?.length > 0) {
      fieldName = firstIssue.path[0];
    }

    // If it's a type error or required error, create a user-friendly message
    if (errorMessage.includes('expected') || errorMessage.includes('required')) {
      errorMessage = `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
    }

    // Determine the appropriate validation error code
    let errorCode = VALIDATION_ERRORS.INVALID_INPUT.code;
    if (errorMessage.includes('required')) {
      errorCode = VALIDATION_ERRORS.FIELD_REQUIRED.code;
    } else if (
      errorMessage.includes('too long') ||
      errorMessage.includes('100') ||
      errorMessage.includes('2000')
    ) {
      errorCode = VALIDATION_ERRORS.FIELD_TOO_LONG.code;
    } else if (errorMessage.includes('too short')) {
      errorCode = VALIDATION_ERRORS.FIELD_TOO_SHORT.code;
    } else if (errorMessage.includes('email') || errorMessage.includes('Invalid email')) {
      errorCode = VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code;
    }

    const error = createValidationError(fieldName, errorCode, null);
    // Override the message to include the field name
    error.message = errorMessage;
    return c.json(error, error.statusCode);
  }

  const { name, email, subject, message } = result.data;

  // Check for Postmark token
  if (!env.POSTMARK_SERVER_TOKEN) {
    console.error('[Contact] No POSTMARK_SERVER_TOKEN configured');
    const error = createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, {
      service: 'email',
    });
    return c.json(error, error.statusCode);
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
      const error = createDomainError(SYSTEM_ERRORS.EMAIL_SEND_FAILED, {
        service: 'postmark',
        errorCode: response.ErrorCode,
      });
      return c.json(error, error.statusCode);
    }

    return c.json({ success: true, messageId: response.MessageID });
  } catch (err) {
    console.error('[Contact] Exception during send:', err.message, err.stack);
    const error = createDomainError(SYSTEM_ERRORS.EMAIL_SEND_FAILED, {
      service: 'postmark',
      originalError: err.message,
    });
    return c.json(error, error.statusCode);
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
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

export { contact as contactRoutes };
