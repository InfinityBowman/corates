import { env } from 'cloudflare:workers';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { escapeHtml } from '@/server/escapeHtml';
import { checkRateLimit, CONTACT_RATE_LIMIT } from '@/server/rateLimit';

interface ContactData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export async function sendContactEmail(
  request: Request,
  data: ContactData,
): Promise<{ success: true; messageId: string }> {
  const rate = checkRateLimit(request, env, CONTACT_RATE_LIMIT);
  if (rate.blocked) throw rate.blocked;

  const { name, email, subject, message } = data;
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

    return { success: true, messageId: crypto.randomUUID() };
  } catch (err) {
    console.error('[Contact] Failed to queue email:', (err as Error).message);
    const domainError = createDomainError(SYSTEM_ERRORS.EMAIL_SEND_FAILED, {
      service: 'email',
      originalError: (err as Error).message,
    });
    throw Response.json(domainError, { status: 503 });
  }
}
