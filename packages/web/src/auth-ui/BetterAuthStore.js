import { createSignal, createEffect, createRoot } from 'solid-js';
import { authClient, useSession } from '@api/auth-client.js';
import useOnlineStatus from '@primitives/useOnlineStatus.js';

function createBetterAuthStore() {
  const isOnline = useOnlineStatus();

  // Use Better Auth's built-in session hook
  const session = useSession();

  // Derived signals from Better Auth session
  const isLoggedIn = () => !!session().data?.user;
  const isAuthenticated = () => !!session().data?.user;
  const user = () => session().data?.user || null;
  const authLoading = () => session().isPending;

  // Error state for auth operations
  const [authError, setAuthError] = createSignal(null);

  // Clear error when going online
  createEffect(() => {
    if (isOnline()) {
      setAuthError(null);
    }
  });

  createEffect(() => {
    console.log(
      'Session loading:',
      session().isPending,
      'User:',
      session().data?.user,
      'isLoggedIn:',
      isLoggedIn(),
    );
  });

  // Listen for tab visibility changes to refresh session
  createEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !authLoading() && isOnline()) {
        // Refresh session when tab becomes visible (user might have verified email in another tab)
        session().refetch?.();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });

  // --- API methods ---
  async function signup(email, password, name) {
    try {
      setAuthError(null);
      const { data, error } = await authClient.signUp.email({
        email,
        password,
        name,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Store pending email for verification if needed
      localStorage.setItem('pendingEmail', email);
      return data;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  async function signin(email, password) {
    try {
      setAuthError(null);
      const { data, error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Clear pending email on successful sign in
      localStorage.removeItem('pendingEmail');
      return data;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  async function signout() {
    try {
      setAuthError(null);
      const { error } = await authClient.signOut();

      if (error) {
        throw new Error(error.message);
      }
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  async function updateProfile(data) {
    try {
      setAuthError(null);
      const { data: updated, error } = await authClient.updateUser(data);

      if (error) {
        throw new Error(error.message);
      }

      return updated;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  async function changePassword(currentPassword, newPassword) {
    try {
      setAuthError(null);
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  async function resetPassword(email) {
    try {
      setAuthError(null);
      const { error } = await authClient.forgetPassword({
        email,
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  async function authFetch(url, options = {}) {
    try {
      // Better Auth automatically handles authentication via cookies
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error(`Request failed with status ${response.status}`);
      }

      return response;
    } catch (err) {
      if (err.message.includes('Authentication required')) {
        setAuthError('Session expired. Please sign in again.');
      }
      throw err;
    }
  }

  // Utility functions for compatibility
  function getPendingEmail() {
    return localStorage.getItem('pendingEmail');
  }

  function getAccessToken() {
    // Better Auth uses httpOnly cookies, so tokens aren't accessible
    // This is for compatibility only
    return null;
  }

  // Mock methods that aren't needed with Better Auth
  async function sendEmailVerification() {
    // Better Auth handles email verification automatically
    console.warn('Email verification is handled automatically by Better Auth');
  }

  async function resendVerificationEmail(email) {
    try {
      setAuthError(null);
      // Try to trigger email resend through Better Auth
      const { error } = await authClient.sendVerificationEmail?.({ email });

      if (error) {
        throw new Error(error.message);
      }
    } catch (err) {
      // If Better Auth doesn't have this method, we could call our backend directly
      try {
        const response = await fetch('/api/auth/send-verification-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to resend verification email');
        }
      } catch (fetchErr) {
        setAuthError(fetchErr.message || 'Failed to resend verification email');
        throw fetchErr;
      }
    }
  }

  async function verifyEmail(code) {
    // Better Auth handles email verification automatically
    console.warn('Email verification is handled automatically by Better Auth');
  }

  async function getCurrentUser() {
    // Use the reactive user signal instead
    return user();
  }

  async function refreshAccessToken() {
    // Better Auth handles token refresh automatically
    // Just trigger a session refetch
    try {
      await session().refetch?.();
    } catch (err) {
      console.warn('Session refresh failed:', err);
    }
  }

  return {
    // State
    isLoggedIn,
    isAuthenticated,
    user,
    authLoading,
    authError,

    // Actions
    signup,
    signin,
    signout,
    updateProfile,
    changePassword,
    resetPassword,
    resendVerificationEmail,
    authFetch,

    // Utility/compatibility methods
    getCurrentUser,
    refreshAccessToken,
    sendEmailVerification,
    verifyEmail,
    getPendingEmail,
    getAccessToken,

    // Better Auth session object for advanced usage
    session,
  };
}

const betterAuth = createRoot(createBetterAuthStore);

export function useBetterAuth() {
  return betterAuth;
}
