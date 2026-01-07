import { createAuthClient } from 'better-auth/solid';
import {
  genericOAuthClient,
  magicLinkClient,
  twoFactorClient,
  adminClient,
  organizationClient,
} from 'better-auth/client/plugins';
import { API_BASE } from '@config/api.js';
import { parseError } from '@/lib/error-utils.js';

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
    credentials: 'include',
    onError(error) {
      const parsedError = parseError(error);
      console.error('Auth error:', parsedError.code, parsedError.message);
    },
    onSuccess() {
      // Auth action successful
    },
  },
});

// Export Better Auth methods for easy access
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
  // Session management (M1: Session Revocation)
  listSessions,
  revokeSession,
  revokeOtherSessions,
  revokeSessions,
} = authClient;
