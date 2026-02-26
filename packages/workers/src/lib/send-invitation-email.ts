/**
 * Shared helper for sending project invitation emails with magic links.
 *
 * Extracts the duplicated ~80-line magic-link generation + email queueing
 * pattern that was repeated across members.ts, orgs/invitations.ts,
 * and orgs/members.ts.
 */

import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import type { Env } from '../types';
import { queueEmail } from './email-queue';

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
 * Generates a magic link and queues an invitation email.
 *
 * Throws on critical errors (missing AUTH_SECRET, failed magic link generation).
 * Returns { emailQueued: false } if only the queue send fails, since the
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

  const callbackPath = `${basepathNormalized}/complete-profile?invitation=${token}`;
  const callbackURL = `${appUrl}${callbackPath}`;

  const authBaseUrl = env.AUTH_BASE_URL || env.APP_URL || 'https://corates.org';
  let capturedMagicLinkUrl: string | null = null;

  const { betterAuth } = await import('better-auth');
  const { magicLink } = await import('better-auth/plugins');
  const { drizzleAdapter } = await import('better-auth/adapters/drizzle');
  const { drizzle } = await import('drizzle-orm/d1');
  const schema = await import('@/db/schema.js');
  const { MAGIC_LINK_EXPIRY_MINUTES } = await import('@/auth/emailTemplates.js');

  const authSecret = env.AUTH_SECRET || (envRecord.SECRET as string | undefined);
  if (!authSecret) {
    throw createDomainError(
      SYSTEM_ERRORS.INTERNAL_ERROR,
      { key: 'AUTH_SECRET' },
      'AUTH_SECRET must be configured',
    );
  }

  const tempDb = drizzle(env.DB, { schema });
  const tempAuth = betterAuth({
    database: drizzleAdapter(tempDb, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
      },
    }),
    baseURL: authBaseUrl,
    secret: authSecret,
    plugins: [
      magicLink({
        sendMagicLink: async ({ url }: { url: string }) => {
          capturedMagicLinkUrl = url;
        },
        expiresIn: 60 * MAGIC_LINK_EXPIRY_MINUTES,
      }),
    ],
  });

  await tempAuth.api.signInMagicLink({
    body: {
      email: email.toLowerCase(),
      callbackURL: callbackURL,
      newUserCallbackURL: callbackURL,
    },
    headers: new Headers(),
  });

  if (!capturedMagicLinkUrl) {
    throw createDomainError(
      SYSTEM_ERRORS.INTERNAL_ERROR,
      { service: 'magic-link' },
      'Failed to generate magic link URL',
    );
  }

  if (env.ENVIRONMENT !== 'production') {
    console.log('[Email] Project invitation magic link URL:', capturedMagicLinkUrl);
  }

  const { getProjectInvitationEmailHtml, getProjectInvitationEmailText } =
    await import('@/auth/emailTemplates.js');
  const { escapeHtml } = await import('@/lib/escapeHtml.js');

  const emailHtml = getProjectInvitationEmailHtml({
    projectName,
    inviterName,
    invitationUrl: capturedMagicLinkUrl,
    role,
  });
  const emailText = getProjectInvitationEmailText({
    projectName,
    inviterName,
    invitationUrl: capturedMagicLinkUrl,
    role,
  });

  const safeProjectName = escapeHtml(projectName);

  try {
    await queueEmail(env, {
      to: email,
      subject: `You're Invited to "${safeProjectName}" - CoRATES`,
      html: emailHtml,
      text: emailText,
    });
    return { emailQueued: true };
  } catch (err) {
    console.error('[Invitation] Failed to queue invitation email:', err);
    return { emailQueued: false };
  }
}
