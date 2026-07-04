/**
 * Shared helper for sending project invitation emails.
 *
 * Emails a stable invitation link (/invite/<token>) that stays valid for the
 * full invitation lifetime (7 days). The /invite/$token route handles every
 * auth state (new user, existing user, already signed in), so no short-lived
 * magic link is embedded in the email.
 */

import { captureError } from './logger';
import type { Env } from '../types';
import { queueEmail } from '@corates/shared/email';

interface SendInvitationEmailParams {
  env: Env;
  email: string;
  token: string;
  projectName: string;
  inviterName: string;
  role: string;
}

interface SendInvitationEmailResult {
  emailQueued: boolean;
}

/**
 * Builds the invitation URL and queues an invitation email.
 *
 * Returns { emailQueued: false } if the queue send fails, since the
 * invitation record already exists in the database and can be resent.
 */
export async function sendInvitationEmail(
  params: SendInvitationEmailParams,
): Promise<SendInvitationEmailResult> {
  const { env, email, token, projectName, inviterName, role } = params;

  const appUrl = env.APP_URL || 'https://corates.org';
  const envRecord = env as unknown as Record<string, string | undefined>;
  const basepath = envRecord.BASEPATH || '';
  const basepathNormalized = basepath ? basepath.replace(/\/$/, '') : '';

  const invitationUrl = `${appUrl}${basepathNormalized}/invite/${token}`;

  if (env.ENVIRONMENT !== 'production') {
    console.log('[Email] Project invitation URL:', invitationUrl);
  }

  // Store full URL for e2e test retrieval (same pattern as magic links in auth/config.ts)
  if (env.DEV_MODE) {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(
        `test-${crypto.randomUUID()}`,
        `test-url:invitation:${email.toLowerCase()}`,
        invitationUrl,
        now + 600,
        now,
        now,
      )
      .run();
  }

  const { getProjectInvitationEmailHtml, getProjectInvitationEmailText } =
    await import('../auth/emailTemplates.js');
  const { sanitizeEmailSubject } = await import('@corates/shared/html');

  const emailHtml = getProjectInvitationEmailHtml({
    projectName,
    inviterName,
    invitationUrl,
    role,
  });
  const emailText = getProjectInvitationEmailText({
    projectName,
    inviterName,
    invitationUrl,
    role,
  });

  const safeProjectName = sanitizeEmailSubject(projectName);

  try {
    await queueEmail(env.EMAIL_QUEUE, {
      to: email,
      subject: `You're Invited to "${safeProjectName}" - CoRATES`,
      html: emailHtml,
      text: emailText,
    });
    return { emailQueued: true };
  } catch (err) {
    captureError(err, { tags: { component: 'invitation', action: 'queue-email' } });
    return { emailQueued: false };
  }
}
