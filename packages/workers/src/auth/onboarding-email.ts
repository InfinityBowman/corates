/**
 * Collects and verifies a real email for sign-ins that arrived without one
 * (ORCID). A code proves ownership; if the address already has an account,
 * the throwaway user is folded into it. Better Auth's change-email returns
 * silent success for a taken address, so it is not used here.
 */

import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint, sessionMiddleware } from 'better-auth/api';
import { setCookieCache, setSessionCookie } from 'better-auth/cookies';
import { revokeUnprovenAccountAccess } from 'better-auth/db';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '@corates/db/client';
import * as schema from '@corates/db/schema';
import { isSyntheticEmail, isValidEmail, normalizeEmail } from '@corates/shared/email';
import type { UserId } from '@corates/shared/ids';
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
  /** Claiming folds one user into another in a single D1 batch */
  db: Database;
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

function onboardingCodeIdentifier(email: string): string {
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
  const { db } = opts;
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
          const { internalAdapter } = ctx.context;
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
          if (record && record.expiresAt < new Date()) {
            await internalAdapter.deleteVerificationByIdentifier(identifier);
            throw reject(ONBOARDING_EMAIL_ERROR_CODES.CODE_EXPIRED);
          }
          // Atomic consume: concurrent submissions cannot share one attempt budget
          // or both pass the check. A wrong guess re-creates the row with the
          // attempt count bumped; an exhausted row stays consumed, locking the code out.
          const consumed = await internalAdapter.consumeVerificationValue(identifier);
          if (!consumed) throw reject(ONBOARDING_EMAIL_ERROR_CODES.CODE_INVALID);
          const [storedCode, attemptsRaw] = splitAtLastColon(consumed.value);
          const attempts = Number.parseInt(attemptsRaw || '0', 10);
          if (attempts >= allowedAttempts) {
            throw reject(ONBOARDING_EMAIL_ERROR_CODES.TOO_MANY_ATTEMPTS, 'FORBIDDEN');
          }
          if (storedCode !== ctx.body.code.trim()) {
            await internalAdapter.createVerificationValue({
              identifier,
              value: `${storedCode}:${attempts + 1}`,
              expiresAt: consumed.expiresAt,
            });
            throw reject(ONBOARDING_EMAIL_ERROR_CODES.CODE_INVALID);
          }

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

          // An unverified row carries no proof its password or sessions belong to
          // the mailbox owner, so they are stripped before the owner inherits it
          let target = existing.user;
          if (!target.emailVerified) {
            const promoted = await revokeUnprovenAccountAccess(ctx, target.id);
            if (!promoted) {
              throw APIError.fromStatus('INTERNAL_SERVER_ERROR', {
                message: 'Could not verify the existing account',
              });
            }
            target = promoted;
          }
          // The session comes first so a veto (banned target) fires before anything moves
          const newSession = await internalAdapter.createSession(target.id);
          if (!newSession) {
            throw APIError.fromStatus('INTERNAL_SERVER_ERROR', {
              message: 'Could not start a session for the existing account',
            });
          }

          const orphanId = user.id as UserId;
          const targetId = target.id as UserId;
          const memberships = await db
            .select({ id: schema.member.id, organizationId: schema.member.organizationId })
            .from(schema.member)
            .where(eq(schema.member.userId, orphanId));
          const orgIds = memberships.map(m => m.organizationId);
          const orgMembers =
            orgIds.length === 0 ?
              []
            : await db
                .select({
                  organizationId: schema.member.organizationId,
                  userId: schema.member.userId,
                })
                .from(schema.member)
                .where(inArray(schema.member.organizationId, orgIds));
          const soloOrgIds = orgIds.filter(
            id => orgMembers.filter(m => m.organizationId === id).length === 1,
          );
          // Shared workspaces follow the user; one only the orphan occupied is dropped
          const membershipsToMove = memberships.filter(
            m =>
              !soloOrgIds.includes(m.organizationId) &&
              !orgMembers.some(o => o.organizationId === m.organizationId && o.userId === targetId),
          );

          const ops = [
            db
              .update(schema.account)
              .set({ userId: targetId, updatedAt: new Date() })
              .where(eq(schema.account.userId, orphanId)),
            ...membershipsToMove.map(m =>
              db.update(schema.member).set({ userId: targetId }).where(eq(schema.member.id, m.id)),
            ),
            ...soloOrgIds.map(id =>
              db.delete(schema.organization).where(eq(schema.organization.id, id)),
            ),
            db.delete(schema.member).where(eq(schema.member.userId, orphanId)),
            db.delete(schema.user).where(eq(schema.user.id, orphanId)),
          ];
          await db.batch(ops as [(typeof ops)[0], ...typeof ops]);

          await setSessionCookie(ctx, { session: newSession, user: target });
          info('auth.onboarding_account_claimed', { discardedUserId: user.id, userId: target.id });
          return ctx.json({ claimed: true });
        },
      ),
    },
    $ERROR_CODES: ONBOARDING_EMAIL_ERROR_CODES,
  } satisfies BetterAuthPlugin;
}
