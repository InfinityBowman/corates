import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import {
  createDomainError,
  createValidationError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import type { ValidationErrorCode } from '@corates/shared';
import { escapeHtml } from '@/server/escapeHtml';
import { checkRateLimit, CONTACT_RATE_LIMIT } from '@/server/rateLimit';

const ContactRequestSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
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

// Translate the first zod issue into the same DomainError shape the Hono
// route produced so clients see identical error codes/messages.
function validationErrorFromZod(issues: z.ZodIssue[]): Response {
  const firstIssue = issues[0];
  const field = firstIssue?.path?.[0] ?? 'input';
  const fieldName = String(field).charAt(0).toUpperCase() + String(field).slice(1);

  let errorCode: ValidationErrorCode = VALIDATION_ERRORS.INVALID_INPUT.code;
  let message = firstIssue?.message || 'Validation failed';

  const isMissing =
    firstIssue?.code === 'invalid_type' ||
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
  } else if (firstIssue?.code === 'invalid_format') {
    errorCode = VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code;
  }

  const error = createValidationError(String(field), errorCode, null);
  error.message = message;
  return Response.json(error, { status: 400 });
}

function invalidJsonError(): Response {
  const error = createValidationError('body', VALIDATION_ERRORS.INVALID_INPUT.code, null);
  error.message = 'Invalid JSON input';
  return Response.json(error, { status: 400 });
}

const handler = async ({ request }: { request: Request }) => {
  const rate = checkRateLimit(request, env, CONTACT_RATE_LIMIT);
  if (rate.blocked) return rate.blocked;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return invalidJsonError();
  }

  const parsed = ContactRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return validationErrorFromZod(parsed.error.issues);
  }

  const { name, email, subject, message } = parsed.data;
  const contactEmail =
    (env as unknown as Record<string, string | undefined>).CONTACT_EMAIL ?? 'contact@corates.org';

  try {
    await env.EMAIL_QUEUE.send({
      to: contactEmail,
      subject: `[Contact Form] ${subject || 'New Inquiry'}`,
      replyTo: email,
      text: `New contact form submission:\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject || 'Not specified'}\n\nMessage:\n${message}`,
      html: `
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
    });

    return Response.json(
      { success: true as const, messageId: crypto.randomUUID() },
      { status: 200, headers: rate.headers },
    );
  } catch (err) {
    const error = err as Error;
    console.error('[Contact] Failed to queue email:', error.message);
    const domainError = createDomainError(SYSTEM_ERRORS.EMAIL_SEND_FAILED, {
      service: 'email',
      originalError: error.message,
    });
    return Response.json(domainError, { status: 503 });
  }
};

export const Route = createFileRoute('/api/contact')({
  server: {
    handlers: {
      POST: handler,
    },
  },
});
