import { createAuthClient } from 'better-auth/react';
import {
  emailOTPClient,
  twoFactorClient,
  adminClient,
  organizationClient,
} from 'better-auth/client/plugins';
import {
  AUTH_ERRORS,
  USER_ERRORS,
  createDomainError,
  normalizeError,
  type ErrorDefinition,
} from '@corates/shared';
import { API_BASE } from '@/config/api';

/**
 * Better Auth reports failures via error codes (e.g. INVALID_EMAIL_OR_PASSWORD).
 * Map them onto our domain error definitions so the shared friendly-message
 * system resolves them instead of collapsing to a generic "Something went wrong".
 */
const BETTER_AUTH_ERROR_MAP: Record<string, ErrorDefinition> = {
  INVALID_EMAIL_OR_PASSWORD: AUTH_ERRORS.INVALID,
  INVALID_PASSWORD: AUTH_ERRORS.INVALID,
  INVALID_EMAIL: AUTH_ERRORS.INVALID,
  CREDENTIAL_ACCOUNT_NOT_FOUND: AUTH_ERRORS.INVALID,
  USER_NOT_FOUND: USER_ERRORS.NOT_FOUND,
  EMAIL_NOT_VERIFIED: USER_ERRORS.EMAIL_NOT_VERIFIED,
  // Emailed codes: the email-otp plugin and our onboarding plugin
  INVALID_OTP: AUTH_ERRORS.CODE_INVALID,
  CODE_INVALID: AUTH_ERRORS.CODE_INVALID,
  OTP_EXPIRED: AUTH_ERRORS.CODE_EXPIRED,
  CODE_EXPIRED: AUTH_ERRORS.CODE_EXPIRED,
  TOO_MANY_ATTEMPTS: AUTH_ERRORS.CODE_TOO_MANY_ATTEMPTS,
  EMAIL_IN_USE: AUTH_ERRORS.EMAIL_IN_USE,
};

export const authClient = createAuthClient({
  baseURL: API_BASE,

  plugins: [emailOTPClient(), twoFactorClient(), adminClient(), organizationClient()],

  fetchOptions: {
    credentials: 'include' as globalThis.RequestCredentials,
    onError(error: unknown) {
      const parsedError = normalizeError(error);
      console.error('Auth error:', parsedError.code, parsedError.message);
    },
  },
});

/**
 * Wraps a Better Auth client call to throw on error instead of returning { data, error } tuples.
 * Makes auth calls work naturally with try/catch and TanStack Query.
 */
export async function authFetch<T>(
  call: Promise<{
    data: T;
    error: { message?: string; code?: string; status?: number } | null;
  }>,
): Promise<T> {
  const result = await call;
  if (result.error) {
    const { code, message, status } = result.error;
    const errorDef = code ? BETTER_AUTH_ERROR_MAP[code] : undefined;
    if (errorDef) {
      throw createDomainError(errorDef, undefined, message);
    }
    // Unmapped failures fall back to a generic system error rather than an
    // opaque UNKNOWN_UNHANDLED_ERROR, which the plain Error path produced.
    throw createDomainError(
      {
        code: 'SYSTEM_INTERNAL_ERROR',
        defaultMessage: message || 'Auth request failed',
        statusCode: status || 500,
      },
      undefined,
      message,
    );
  }
  return result.data;
}

export const { useSession, listSessions, revokeSession, revokeOtherSessions, revokeSessions } =
  authClient;
