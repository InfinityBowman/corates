import { createAuthClient } from 'better-auth/react';
import {
  genericOAuthClient,
  magicLinkClient,
  twoFactorClient,
  adminClient,
  organizationClient,
} from 'better-auth/client/plugins';
import { API_BASE } from '@/config/api';
import { parseError } from '@/lib/error-utils';

export const authClient = createAuthClient({
  baseURL: API_BASE,

  plugins: [
    genericOAuthClient(),
    magicLinkClient(),
    twoFactorClient(),
    adminClient(),
    organizationClient(),
  ],

  fetchOptions: {
    credentials: 'include' as globalThis.RequestCredentials,
    onError(error: unknown) {
      const parsedError = parseError(error);
      console.error('Auth error:', parsedError.code, parsedError.message);
    },
  },
});

/**
 * Wraps a Better Auth client call to throw on error instead of returning { data, error } tuples.
 * Makes auth calls work naturally with try/catch and TanStack Query.
 */
export async function authFetch<T>(
  call: Promise<{ data: T; error: { message?: string } | null }>,
): Promise<T> {
  const result = await call;
  if (result.error) {
    throw new Error(result.error.message || 'Auth request failed');
  }
  return result.data;
}

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  updateUser,
  changePassword,
  resetPassword,
  requestPasswordReset,
  verifyEmail,
  admin,
  organization,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  revokeSessions,
} = authClient;
