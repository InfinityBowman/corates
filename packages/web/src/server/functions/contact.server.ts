import { env } from 'cloudflare:workers';
import { and, count, eq, gt } from 'drizzle-orm';
import type { Database } from '@corates/db/client';
import { contactSubmissions } from '@corates/db/schema';
import { throwDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { sha256 } from '@corates/shared/crypto';
import { escapeHtml } from '@corates/shared/html';
import type { ContactSubmissionId } from '@corates/shared/ids';
import { captureError, info } from '@corates/workers/logger';

const MAX_SUBMISSIONS_PER_HOUR = 5;
const DEDUP_BUCKET_MS = 60_000;

export interface ContactData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

async function contactDedupKey(email: string, subject: string, message: string): Promise<string> {
  const timeBucket = Math.floor(Date.now() / DEDUP_BUCKET_MS);
  return sha256(`${email}\0${subject}\0${message}\0${timeBucket}`);
}

export async function submitContact(
  db: Database,
  data: ContactData,
): Promise<{ success: true; messageId: string }> {
  const { name, email, subject, message } = data;
  const normalizedEmail = email.trim().toLowerCase();

  // Guard the notification inbox against retry loops and double-submits. The
  // contact_submissions table is the counter, so this needs no rate-limit infra.
  const [{ count: recentCount }] = await db
    .select({ count: count() })
    .from(contactSubmissions)
    .where(
      and(
        eq(contactSubmissions.email, normalizedEmail),
        gt(contactSubmissions.createdAt, new Date(Date.now() - 3600_000)),
      ),
    );
  if (recentCount >= MAX_SUBMISSIONS_PER_HOUR) {
    throwDomainError(SYSTEM_ERRORS.RATE_LIMITED);
  }

  const dedupKey = await contactDedupKey(normalizedEmail, subject, message);
  const id = crypto.randomUUID() as ContactSubmissionId;
  const inserted = await db
    .insert(contactSubmissions)
    .values({
      id,
      name,
      email: normalizedEmail,
      subject,
      message,
      dedupKey,
    })
    .onConflictDoNothing({ target: contactSubmissions.dedupKey })
    .returning({ id: contactSubmissions.id });

  if (inserted.length === 0) {
    info('contact.duplicate', { email: normalizedEmail });
    return { success: true, messageId: id };
  }

  const contactEmail =
    (env as unknown as Record<string, string | undefined>).CONTACT_EMAIL ?? 'contact@corates.org';

  // The row is already saved, so a notification failure should not surface as
  // a submission failure to the user - just log it.
  try {
    await env.EMAIL_QUEUE.send({
      to: contactEmail,
      subject: `[Contact Form] ${subject || 'New Inquiry'}`,
      replyTo: normalizedEmail,
      text: `New contact form submission:\n\nName: ${name}\nEmail: ${normalizedEmail}\nSubject: ${subject || 'Not specified'}\n\nMessage:\n${message}`,
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
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><a href="mailto:${escapeHtml(normalizedEmail)}">${escapeHtml(normalizedEmail)}</a></td>
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
    info('contact.sent', { subject: subject || 'New Inquiry' });
  } catch (err) {
    captureError(err, { tags: { component: 'contact', action: 'queue-email' } });
  }

  return { success: true, messageId: id };
}
