import { env } from 'cloudflare:workers';
import { throwDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { escapeHtml } from '@corates/shared/html';
import { captureError } from '@corates/workers/logger';
import type { Database } from '@corates/db/client';
import { feedback } from '@corates/db/schema';
import type { FeedbackId } from '@corates/shared/ids';
import { and, count, eq, gt } from 'drizzle-orm';
import type { Session } from '@/server/middleware/auth';

const MAX_SUBMISSIONS_PER_HOUR = 5;

export interface FeedbackContext {
  route?: string;
  userAgent?: string;
  viewport?: string;
  replayId?: string;
}

export interface FeedbackData {
  category: 'bug' | 'idea' | 'other';
  message: string;
  context?: FeedbackContext;
}

export async function submitFeedback(
  db: Database,
  session: Session,
  data: FeedbackData,
): Promise<{ success: true; id: FeedbackId }> {
  const userId = session.user.id;

  // Guard the notification inbox against retry loops and double-submits. The
  // feedback table itself is the counter, so this needs no rate-limit infra.
  const [{ count: recentCount }] = await db
    .select({ count: count() })
    .from(feedback)
    .where(
      and(eq(feedback.userId, userId), gt(feedback.createdAt, new Date(Date.now() - 3600_000))),
    );
  if (recentCount >= MAX_SUBMISSIONS_PER_HOUR) {
    throwDomainError(SYSTEM_ERRORS.RATE_LIMITED);
  }

  const id = crypto.randomUUID() as FeedbackId;
  await db.insert(feedback).values({
    id,
    userId,
    category: data.category,
    message: data.message,
    context: data.context ? JSON.stringify(data.context) : null,
  });

  // The row is already saved, so a notification failure should not surface as
  // a submission failure to the user - just log it.
  try {
    await sendFeedbackEmail(session, data, id);
  } catch (err) {
    captureError(err, { tags: { component: 'feedback', action: 'queue-email' } });
  }

  return { success: true, id };
}

async function sendFeedbackEmail(
  session: Session,
  data: FeedbackData,
  id: FeedbackId,
): Promise<void> {
  const contactEmail =
    (env as unknown as Record<string, string | undefined>).CONTACT_EMAIL ?? 'contact@corates.org';
  const { name, email } = session.user;
  const ctx = data.context ?? {};

  const contextLines = [
    `Route: ${ctx.route ?? 'unknown'}`,
    `User agent: ${ctx.userAgent ?? 'unknown'}`,
    `Viewport: ${ctx.viewport ?? 'unknown'}`,
    ctx.replayId ? `Sentry replay: ${ctx.replayId}` : null,
    `Feedback id: ${id}`,
  ].filter(Boolean);

  const contextRowsHtml = contextLines
    .map(
      line =>
        `<tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">${escapeHtml(line as string)}</td></tr>`,
    )
    .join('');

  await env.EMAIL_QUEUE.send({
    to: contactEmail,
    subject: `[Feedback] ${data.category}: ${data.message.slice(0, 60)}`,
    replyTo: email,
    text: `New feedback (${data.category}) from ${name} (${email}):\n\n${data.message}\n\n${contextLines.join('\n')}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">New Feedback: ${escapeHtml(data.category)}</h2>
        <p style="margin-bottom: 4px;"><strong>${escapeHtml(name)}</strong> (<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>)</p>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; white-space: pre-wrap; margin: 16px 0;">${escapeHtml(data.message)}</div>
        <table style="width: 100%; border-collapse: collapse;">${contextRowsHtml}</table>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
          You can reply directly to this email to respond to ${escapeHtml(name)}.
        </p>
      </div>
    `,
  });
}
