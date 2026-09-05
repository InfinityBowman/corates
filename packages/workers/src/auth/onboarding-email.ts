/**
 * Collects and verifies a real email for sign-ins that arrived without one
 * (ORCID). A code proves ownership; if the address already has an account,
 * the throwaway user is folded into it. Better Auth's change-email returns
 * silent success for a taken address, so it is not used here.
 */

import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint, sessionMiddleware } from 'better-auth/api';
import { setCookieCache, setSessionCookie } from 'better-auth/cookies';
import { z } from 'zod';
import { isSyntheticEmail, isValidEmail, normalizeEmail } from '@corates/shared/email';
import { info, warn } from '../lib/logger';

export const ONBOARDING_EMAIL_ERROR_CODES = {
  INVALID_EMAIL: { code: 'INVALID_EMAIL', message: 'Enter a valid email address' },
  NOT_ELIGIBLE: { code: 'NOT_ELIGIBLE', message: 'This account already has a verified email' },
  CODE_INVALID: { code: 'CODE_INVALID', message: 'That code is not right' },
  CODE_EXPIRED: { code: 'CODE_EXPIRED', message: 'That code has expired' },
  TOO_MANY_ATTEMPTS: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many incorrect attempts' },
  EMAIL_IN_USE: {
    code: 'EMAIL_IN_USE',
    message: 'That email already belongs to another account',
  },
} as const;

export interface OnboardingEmailOptions {
  sendCode: (data: { email: string; code: string; userId: string }) => Promise<void>;
  /** Veto discarding a user that owns data outside Better Auth's tables */
  canDiscardUser?: (userId: string) => Promise<boolean>;
  /** Seconds a code stays valid. Defaults to 600. */
  expiresIn?: number;
  /** Wrong guesses allowed before the code is thrown away. Defaults to 5. */
  allowedAttempts?: number;
  generateCode?: () => string;
}

interface OnboardingUser {
  id: string;
  email: string;
  emailVerified: boolean;
  profileCompletedAt?: number | null;
}

const CODE_IDENTIFIER_PREFIX = 'onboarding-email-otp-';

export function onboardingCodeIdentifier(email: string): string {
  return `${CODE_IDENTIFIER_PREFIX}${email}`;
}

function defaultGenerateCode(): string {
  const values = crypto.getRandomValues(new Uint32Array(1));
  return String(values[0] % 1_000_000).padStart(6, '0');
}

function needsRealEmail(user: OnboardingUser): boolean {
  return isSyntheticEmail(user.email) || !user.emailVerified;
}

function splitAtLastColon(value: string): [string, string] {
  const index = value.lastIndexOf(':');
  if (index === -1) return [value, ''];
  return [value.slice(0, index), value.slice(index + 1)];
}

export function onboardingEmail(opts: OnboardingEmailOptions) {
  const expiresIn = opts.expiresIn ?? 600;
  const allowedAttempts = opts.allowedAttempts ?? 5;
  const generateCode = opts.generateCode ?? defaultGenerateCode;

  return {
    id: 'onboarding-email',
    endpoints: {
      requestOnboardingEmail: createAuthEndpoint(
        '/onboarding/request-email',
        {
          method: 'POST',
          body: z.object({ email: z.string() }),
          use: [sessionMiddleware],
        },
        async ctx => {
          const user = ctx.context.session.user as OnboardingUser;
          if (!needsRealEmail(user)) {
            throw APIError.from('BAD_REQUEST', ONBOARDING_EMAIL_ERROR_CODES.NOT_ELIGIBLE);
          }
          const email = normalizeEmail(ctx.body.email);
          if (!isValidEmail(email) || isSyntheticEmail(email)) {
            throw APIError.from('BAD_REQUEST', ONBOARDING_EMAIL_ERROR_CODES.INVALID_EMAIL);
          }

          const identifier = onboardingCodeIdentifier(email);
          const code = generateCode();
          await ctx.context.internalAdapter.deleteVerificationByIdentifier(identifier);
          await ctx.context.internalAdapter.createVerificationValue({
            identifier,
            value: `${code}:0`,
            expiresAt: new Date(Date.now() + expiresIn * 1000),
          });

          // Sent even for a taken address so the response reveals nothing
          await opts.sendCode({ email, code, userId: user.id });
          return ctx.json({ success: true });
        },
      ),

      confirmOnboardingEmail: createAuthEndpoint(
        '/onboarding/confirm-email',
        {
          method: 'POST',
          body: z.object({ email: z.string(), code: z.string() }),
          use: [sessionMiddleware],
        },
        async ctx => {
          const { internalAdapter, adapter } = ctx.context;
          const session = ctx.context.session;
          const user = session.user as OnboardingUser;
          if (!needsRealEmail(user)) {
            throw APIError.from('BAD_REQUEST', ONBOARDING_EMAIL_ERROR_CODES.NOT_ELIGIBLE);
          }
          const email = normalizeEmail(ctx.body.email);
          const identifier = onboardingCodeIdentifier(email);

          const reject = (
            error: (typeof ONBOARDING_EMAIL_ERROR_CODES)[keyof typeof ONBOARDING_EMAIL_ERROR_CODES],
            status: 'BAD_REQUEST' | 'FORBIDDEN' = 'BAD_REQUEST',
          ) => {
            info('auth.onboarding_code_rejected', { userId: user.id, reason: error.code });
            return APIError.from(status, error);
          };
          const record = await internalAdapter.findVerificationValue(identifier);
          if (!record) throw reject(ONBOARDING_EMAIL_ERROR_CODES.CODE_INVALID);
          if (record.expiresAt < new Date()) {
            await internalAdapter.deleteVerificationByIdentifier(identifier);
            throw reject(ONBOARDING_EMAIL_ERROR_CODES.CODE_EXPIRED);
          }
          const [storedCode, attemptsRaw] = splitAtLastColon(record.value);
          const attempts = Number.parseInt(attemptsRaw || '0', 10);
          if (attempts >= allowedAttempts) {
            await internalAdapter.deleteVerificationByIdentifier(identifier);
            throw reject(ONBOARDING_EMAIL_ERROR_CODES.TOO_MANY_ATTEMPTS, 'FORBIDDEN');
          }
          if (storedCode !== ctx.body.code.trim()) {
            await internalAdapter.updateVerificationByIdentifier(identifier, {
              value: `${storedCode}:${attempts + 1}`,
            });
            throw reject(ONBOARDING_EMAIL_ERROR_CODES.CODE_INVALID);
          }
          await internalAdapter.deleteVerificationByIdentifier(identifier);

          const existing = await internalAdapter.findUserByEmail(email);
          if (!existing || existing.user.id === user.id) {
            const updated = await internalAdapter.updateUser(user.id, {
              email,
              emailVerified: true,
            });
            const dontRememberMe = await ctx.getSignedCookie(
              ctx.context.authCookies.dontRememberToken.name,
              ctx.context.secret,
            );
            await setCookieCache(
              ctx,
              { session: session.session, user: updated },
              !!dontRememberMe,
            );
            info('auth.onboarding_email_verified', { userId: user.id });
            return ctx.json({ claimed: false });
          }

          // Only a throwaway user can be folded into the existing account
          const discardable =
            !user.profileCompletedAt && ((await opts.canDiscardUser?.(user.id)) ?? true);
          if (!discardable) {
            // The one case that still needs a manual merge
            warn('auth.onboarding_email_in_use', {
              userId: user.id,
              existingUserId: existing.user.id,
            });
            throw APIError.from('CONFLICT', ONBOARDING_EMAIL_ERROR_CODES.EMAIL_IN_USE);
          }

          await adapter.updateMany({
            model: 'account',
            where: [{ field: 'userId', value: user.id }],
            update: { userId: existing.user.id },
          });

          // Drop the orphan's personal workspace so it does not linger ownerless
          const memberships = await adapter.findMany<{ organizationId: string }>({
            model: 'member',
            where: [{ field: 'userId', value: user.id }],
          });
          for (const membership of memberships) {
            const members = await adapter.count({
              model: 'member',
              where: [{ field: 'organizationId', value: membership.organizationId }],
            });
            if (members === 1) {
              await adapter.delete({
                model: 'organization',
                where: [{ field: 'id', value: membership.organizationId }],
              });
            }
          }
          await adapter.deleteMany({
            model: 'member',
            where: [{ field: 'userId', value: user.id }],
          });
          await internalAdapter.deleteUser(user.id);

          let target = existing.user;
          if (!target.emailVerified) {
            target = await internalAdapter.updateUser(target.id, { emailVerified: true });
          }
          const newSession = await internalAdapter.createSession(target.id);
          if (!newSession) {
            throw APIError.fromStatus('INTERNAL_SERVER_ERROR', {
              message: 'Could not start a session for the existing account',
            });
          }
          await setSessionCookie(ctx, { session: newSession, user: target });
          info('auth.onboarding_account_claimed', { discardedUserId: user.id, userId: target.id });
          return ctx.json({ claimed: true });
        },
      ),
    },
    rateLimit: [
      {
        pathMatcher: (path: string) => path === '/onboarding/request-email',
        window: 60,
        max: 3,
      },
      {
        pathMatcher: (path: string) => path === '/onboarding/confirm-email',
        window: 60,
        max: 5,
      },
    ],
    $ERROR_CODES: ONBOARDING_EMAIL_ERROR_CODES,
  } satisfies BetterAuthPlugin;
}
