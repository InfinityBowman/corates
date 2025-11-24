import { createAuthClient } from 'better-auth/solid';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_WORKER_API_URL || 'http://localhost:8787',

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
    onSuccess(data) {
      // console.log('Auth action successful', data);
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
  forgetPassword,
  verifyEmail,
} = authClient;
