import { createAuthClient } from 'better-auth/solid';
import { genericOAuthClient, magicLinkClient, twoFactorClient } from 'better-auth/client/plugins';
import { API_BASE } from '@config/api.js';

export const authClient = createAuthClient({
  baseURL: API_BASE,

  plugins: [genericOAuthClient(), magicLinkClient(), twoFactorClient()],

  fetchOptions: {
    credentials: 'include',
    onError(error) {
      console.error('Auth error:', error);
      if (error.error.status === 429) {
        console.error('Too many requests. Please try again later.');
      } else if (error.error.status === 401) {
        console.error('Unauthorized');
      }
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
} = authClient;
