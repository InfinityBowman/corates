/**
 * Contact form route
 * Handles contact form submissions and sends emails via Postmark
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { Client as PostmarkClient } from 'postmark';
import { contactRateLimit } from '@/middleware/rateLimit.js';
import { createDomainError, createValidationError, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import { escapeHtml } from '@/lib/escapeHtml.js';

const contact = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const field = firstIssue?.path?.[0] || 'input';
      const fieldName = String(field).charAt(0).toUpperCase() + String(field).slice(1);

      let errorCode = VALIDATION_ERRORS.INVALID_INPUT.code;
      let message = firstIssue?.message || 'Validation failed';

      const isMissing =
        firstIssue?.received === 'undefined' ||
        message.includes('received undefined') ||
        message.includes('Required');

      if (isMissing) {
        errorCode = VALIDATION_ERRORS.FIELD_REQUIRED.code;
        message = `${fieldName} is required`;
      } else if (firstIssue?.code === 'too_big') {
        errorCode = VALIDATION_ERRORS.FIELD_TOO_LONG.code;
      } else if (firstIssue?.code === 'too_small') {
        errorCode = VALIDATION_ERRORS.FIELD_TOO_SHORT.code;
        message = `${fieldName} is required`;
      } else if (firstIssue?.code === 'invalid_string') {
        errorCode = VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code;
      }

      const error = createValidationError(String(field), errorCode, null);
      error.message = message;
      return c.json(error, 400);
    }
  },
});

// Handle JSON parse errors
contact.onError((err, c) => {
  if (err.message?.includes('JSON')) {
    const error = createValidationError('body', VALIDATION_ERRORS.INVALID_INPUT.code, null);
    error.message = 'Invalid JSON input';
    return c.json(error, 400);
  }
  throw err;
});

// Apply rate limiting to contact endpoints
contact.use('*', contactRateLimit);

// Request schema
const ContactRequestSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(100, 'Name must be 100 characters or less')
      .openapi({ example: 'Jane Doe' }),
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .max(254, 'Email must be 254 characters or less')
      .email('Invalid email address')
      .openapi({ example: 'jane@example.com' }),
    subject: z
      .string()
      .trim()
      .max(150, 'Subject must be 150 characters or less')
      .optional()
      .default('')
      .openapi({ example: 'Question about CoRATES' }),
    message: z
      .string()
      .trim()
      .min(1, 'Message is required')
      .max(2000, 'Message must be 2000 characters or less')
      .openapi({ example: 'I have a question about...' }),
  })
  .openapi('ContactRequest');

// Response schemas
const ContactSuccessSchema = z
  .object({
    success: z.literal(true),
    messageId: z.string().openapi({ example: 'b7bc2f4a-e38e-4336-af7d-e6c392c2f817' }),
  })
  .openapi('ContactSuccess');

const ContactErrorSchema = z
  .object({
    code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
    message: z.string().openapi({ example: 'Name is required' }),
    statusCode: z.number().openapi({ example: 400 }),
    field: z.string().optional().openapi({ example: 'name' }),
    details: z.record(z.unknown()).optional(),
  })
  .openapi('ContactError');

// Route definition
const submitContactRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Contact'],
  summary: 'Submit contact form',
  description: 'Receives contact form data and sends an email to the team',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ContactRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ContactSuccessSchema,
        },
      },
      description: 'Contact form submitted successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ContactErrorSchema,
        },
      },
      description: 'Validation error',
    },
    429: {
      content: {
        'application/json': {
          schema: ContactErrorSchema,
        },
      },
      description: 'Rate limit exceeded',
    },
    503: {
      content: {
        'application/json': {
          schema: ContactErrorSchema,
        },
      },
      description: 'Email service unavailable',
    },
  },
});

contact.openapi(submitContactRoute, async c => {
  const env = c.env;
  const { name, email, subject, message } = c.req.valid('json');

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

export { contact as contactRoutes };
