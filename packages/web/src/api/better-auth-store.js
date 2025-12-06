import { createSignal, createEffect, createRoot } from 'solid-js';
import { authClient, useSession } from '@api/auth-client.js';
import useOnlineStatus from '@primitives/useOnlineStatus.js';
import projectStore from '@primitives/projectStore.js';
import { API_BASE } from '@config/api.js';

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

  // BroadcastChannel for cross-tab auth state sync
  const authChannel =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('corates-auth') : null;

  // Listen for auth state changes from other tabs
  createEffect(() => {
    if (!authChannel) return;

    const handleMessage = event => {
      if (event.data?.type === 'auth-changed') {
        // Another tab changed auth state, refetch session
        session().refetch?.();
      }
    };

    authChannel.addEventListener('message', handleMessage);

    return () => {
      authChannel.removeEventListener('message', handleMessage);
    };
  });

  // Broadcast auth changes to other tabs
  function broadcastAuthChange() {
    authChannel?.postMessage({ type: 'auth-changed', timestamp: Date.now() });
  }

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
  async function signup(email, password, name, role = null) {
    try {
      setAuthError(null);
      const signupData = {
        email,
        password,
        name,
      };

      // Only include role if provided
      if (role) {
        signupData.role = role;
      }

      const { data, error } = await authClient.signUp.email(signupData);

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

  async function signinWithGoogle(callbackPath) {
    try {
      setAuthError(null);
      // Build full callback URL using current origin
      const callbackURL = `${window.location.origin}${callbackPath || '/dashboard'}`;

      const { data, error } = await authClient.signIn.social({
        provider: 'google',
        callbackURL,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  async function signinWithOrcid(callbackPath) {
    try {
      setAuthError(null);
      // Build full callback URL using current origin
      const callbackURL = `${window.location.origin}${callbackPath || '/dashboard'}`;

      // Use genericOAuth signIn for custom providers
      const { data, error } = await authClient.signIn.oauth2({
        providerId: 'orcid',
        callbackURL,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  async function signinWithMagicLink(email, callbackPath) {
    try {
      setAuthError(null);
      const callbackURL = `${window.location.origin}${callbackPath || '/dashboard'}`;

      const { data, error } = await authClient.signIn.magicLink({
        email,
        callbackURL,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Store pending email for the check-email page
      localStorage.setItem('pendingEmail', email);
      localStorage.setItem('magicLinkSent', 'true');
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

      // Check if 2FA is required
      if (data?.twoFactorRedirect) {
        return { twoFactorRequired: true };
      }

      // Clear pending email on successful sign in
      localStorage.removeItem('pendingEmail');

      // Notify other tabs of auth change
      broadcastAuthChange();

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

      // Clear cached project data on logout
      projectStore.clearProjectList();

      // Notify other tabs of auth change
      broadcastAuthChange();
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

      // Refresh session to get updated user data
      await session().refetch?.();

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
      // BetterAuth uses requestPasswordReset to send reset email
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  // Confirm password reset with token and new password
  async function confirmPasswordReset(token, newPassword) {
    try {
      setAuthError(null);
      const { error } = await authClient.resetPassword({
        token,
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

  // --- Two-Factor Authentication ---

  // Enable 2FA - returns QR code URI and secret for setup
  // Requires password for security verification
  async function enableTwoFactor(password) {
    try {
      setAuthError(null);
      const { data, error } = await authClient.twoFactor.enable({
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data; // { totpURI, secret, backupCodes }
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  // Verify and complete 2FA setup with code from authenticator app
  async function verifyTwoFactorSetup(code) {
    try {
      setAuthError(null);
      const { data, error } = await authClient.twoFactor.verifyTotp({
        code,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Notify other tabs of auth change (2FA enabled)
      broadcastAuthChange();

      return data;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  // Disable 2FA (requires password for security)
  async function disableTwoFactor(password) {
    try {
      setAuthError(null);
      const { data, error } = await authClient.twoFactor.disable({
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Notify other tabs of auth change (2FA disabled)
      broadcastAuthChange();

      return data;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  // Verify 2FA code during sign-in
  async function verifyTwoFactor(code) {
    try {
      setAuthError(null);
      const { data, error } = await authClient.twoFactor.verifyTotp({
        code,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Notify other tabs of auth change (2FA completed)
      broadcastAuthChange();

      return data;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  // Get 2FA status for current user - check from session user data
  function getTwoFactorStatus() {
    const currentUser = user();
    return { enabled: currentUser?.twoFactorEnabled ?? false };
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
      const result = await authClient.sendVerificationEmail?.({ email });
      const error = result?.error;

      if (error) {
        throw new Error(error.message);
      }
    } catch {
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

  async function deleteAccount() {
    try {
      setAuthError(null);
      const response = await fetch(`${API_BASE}/api/users/me`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete account');
      }

      // Clear local data
      projectStore.clearProjectList();
      localStorage.removeItem('pendingEmail');

      // Sign out after successful deletion
      await authClient.signOut();

      return { success: true };
    } catch (err) {
      setAuthError(err.message);
      throw err;
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
    signinWithGoogle,
    signinWithOrcid,
    signinWithMagicLink,
    signout,
    updateProfile,
    changePassword,
    resetPassword,
    confirmPasswordReset,
    resendVerificationEmail,
    deleteAccount,
    authFetch,
    clearAuthError: () => setAuthError(null),

    // Two-Factor Authentication
    enableTwoFactor,
    verifyTwoFactorSetup,
    disableTwoFactor,
    verifyTwoFactor,
    getTwoFactorStatus,

    // Utility/compatibility methods
    getCurrentUser,
    refreshAccessToken,
    sendEmailVerification,
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
