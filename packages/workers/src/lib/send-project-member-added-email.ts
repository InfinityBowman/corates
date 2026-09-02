/**
 * Notify an existing user by email when they are added to a project directly.
 */

import { captureError, info } from './logger';
import { buildAppUrl } from './app-url';
import type { Env } from '../types';
import { queueEmail } from '@corates/shared/email';

interface SendProjectMemberAddedEmailParams {
  env: Env;
  email: string;
  projectId: string;
  projectName: string;
  inviterName: string;
  role: string;
}

interface SendProjectMemberAddedEmailResult {
  emailQueued: boolean;
}

export async function sendProjectMemberAddedEmail(
  params: SendProjectMemberAddedEmailParams,
): Promise<SendProjectMemberAddedEmailResult> {
  const { env, email, projectId, projectName, inviterName, role } = params;

  const projectUrl = buildAppUrl(env, `/projects/${projectId}`);

  if (env.ENVIRONMENT !== 'production') {
    console.log('[Email] Project member added URL:', projectUrl);
  }

  const { getProjectMemberAddedEmailHtml, getProjectMemberAddedEmailText } =
    await import('../auth/emailTemplates.js');
  const { sanitizeEmailSubject } = await import('@corates/shared/html');

  const emailHtml = getProjectMemberAddedEmailHtml({
    projectName,
    inviterName,
    projectUrl,
    role,
  });
  const emailText = getProjectMemberAddedEmailText({
    projectName,
    inviterName,
    projectUrl,
    role,
  });

  const safeProjectName = sanitizeEmailSubject(projectName);
  const safeInviterName = sanitizeEmailSubject(inviterName);

  try {
    await queueEmail(env.EMAIL_QUEUE, {
      to: email,
      subject: `${safeInviterName} added you to "${safeProjectName}" on CoRATES`,
      html: emailHtml,
      text: emailText,
    });
    info('member.email_queued', { email, projectName });
    return { emailQueued: true };
  } catch (err) {
    captureError(err, { tags: { component: 'member', action: 'queue-email' } });
    return { emailQueued: false };
  }
}
