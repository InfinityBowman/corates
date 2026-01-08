/**
 * Better Auth Store - Centralized authentication state management
 *
 * WARNING: HIGH BLAST RADIUS FILE
 *
 * This file manages ALL authentication state for the application.
 * Changes here impact:
 * - User login/logout flow
 * - Session management and caching
 * - Offline authentication fallback
 * - Organization context switching
 * - Avatar caching
 * - Query cache invalidation on auth changes
 *
 * BEFORE MODIFYING:
 * 1. Read: .cursor/rules/error-handling.mdc
 * 2. Understand Better Auth session structure
 * 3. Test login/logout flows in both online and offline modes
 * 4. Verify LocalStorage fallback works (7-day cache)
 * 5. Check organization switching doesn't break state
 * 6. Test bfcache restoration (browser back button)
 *
 * CRITICAL PATTERNS:
 * - Singleton pattern (createRoot prevents disposal)
 * - Dual caching (Better Auth + LocalStorage for offline)
 * - Avatar caching in IndexedDB
 * - Query invalidation on sign out
 *
 * See: packages/docs/guides/authentication.md
 */

import { createSignal, createRoot, createEffect } from 'solid-js';
import {
  authClient,
  useSession,
  listSessions as _listSessions,
  revokeSession as _revokeSession,
  revokeOtherSessions as _revokeOtherSessions,
  revokeSessions as _revokeSessions,
} from '@api/auth-client.js';
import { queryClient, clearPersistedQueryCache } from '@lib/queryClient.js';
import { queryKeys } from '@lib/queryKeys.js';
import { API_BASE, BASEPATH } from '@config/api.js';
import { saveLastLoginMethod, LOGIN_METHODS } from '@lib/lastLoginMethod.js';
import {
  fetchAndCacheAvatar,
  getCachedAvatar,
  pruneExpiredAvatars,
} from '@/primitives/avatarCache.js';
import { clearAllData } from '@/primitives/db.js';

// LocalStorage keys for offline caching
const AUTH_CACHE_KEY = 'corates-auth-cache';
const AUTH_CACHE_TIMESTAMP_KEY = 'corates-auth-cache-timestamp';
const AUTH_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function createBetterAuthStore() {
  // Track online status without reactive primitives (for singleton context)
  const [isOnline, setIsOnline] = createSignal(navigator.onLine);

  // Set up event listeners for online/offline
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
  }

  // Load cached auth data from localStorage
  function loadCachedAuth() {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(AUTH_CACHE_KEY);
      const timestamp = localStorage.getItem(AUTH_CACHE_TIMESTAMP_KEY);
      if (!cached || !timestamp) return null;

      const age = Date.now() - parseInt(timestamp, 10);
      if (age > AUTH_CACHE_MAX_AGE) {
        // Cache expired, clear it
        localStorage.removeItem(AUTH_CACHE_KEY);
        localStorage.removeItem(AUTH_CACHE_TIMESTAMP_KEY);
        return null;
      }

      return JSON.parse(cached);
    } catch (err) {
      console.error('Error loading cached auth:', err);
      return null;
    }
  }

  // Save auth data to localStorage
  function saveCachedAuth(userData) {
    if (typeof window === 'undefined') return;
    try {
      if (userData) {
        localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(userData));
        localStorage.setItem(AUTH_CACHE_TIMESTAMP_KEY, Date.now().toString());
      } else {
        localStorage.removeItem(AUTH_CACHE_KEY);
        localStorage.removeItem(AUTH_CACHE_TIMESTAMP_KEY);
      }
    } catch (err) {
      console.error('Error saving cached auth:', err);
    }
  }

  // Better Auth's useSession uses reactive primitives, so wrap in createRoot
  // This is acceptable for this singleton as we want the session to persist
  const {
    session,
    isLoggedIn: sessionIsLoggedIn,
    isAuthenticated: sessionIsAuthenticated,
    user: sessionUser,
    authLoading,
  } = createRoot(() => {
    const session = useSession();

    // Derived signals from Better Auth session
    const isLoggedIn = () => !!session().data?.user;
    const isAuthenticated = () => !!session().data?.user;
    const user = () => session().data?.user || null;
    const authLoading = () => session().isPending;

    return { session, isLoggedIn, isAuthenticated, user, authLoading };
  });

  // Enhanced signals that fall back to cached data when offline
  const cachedAuth = loadCachedAuth();
  const [cachedUser, setCachedUser] = createSignal(cachedAuth);

  // Cached avatar data URL for offline use
  const [cachedAvatarUrl, setCachedAvatarUrl] = createSignal(null);

  // Load cached avatar on init (async)
  if (cachedAuth?.id) {
    getCachedAvatar(cachedAuth.id).then(dataUrl => {
      if (dataUrl) setCachedAvatarUrl(dataUrl);
    });
  }

  // Prune expired avatar cache entries on startup
  pruneExpiredAvatars();

  // Cache user data when session is successfully fetched (only when online)
  // Wrap in createRoot to properly dispose of the effect
  createRoot(() => {
    createEffect(() => {
      const sessionData = session().data;
      if (isOnline()) {
        if (sessionData?.user) {
          // Cache when we have a user and we're online
          saveCachedAuth(sessionData.user);
          setCachedUser(sessionData.user);

          // Cache the avatar image for offline use
          if (sessionData.user.image && sessionData.user.id) {
            fetchAndCacheAvatar(sessionData.user.id, sessionData.user.image).then(dataUrl => {
              if (dataUrl) setCachedAvatarUrl(dataUrl);
            });
          }
        } else if (!authLoading()) {
          // Clear cache when logged out (only after loading completes to avoid clearing on initial load)
          saveCachedAuth(null);
          setCachedUser(null);
        }
      }
    });
  });

  // Combined signals that use cached data when offline
  const isLoggedIn = () => {
    if (isOnline()) {
      // During auth loading (e.g., visibilitychange refetch), keep previous state stable
      // to prevent UI thrash. Use cached user if available during loading.
      if (authLoading()) {
        const cached = cachedUser();
        if (cached) return true;
      }
      return sessionIsLoggedIn();
    }
    // When offline, use cached data
    return !!cachedUser();
  };

  const isAuthenticated = () => {
    if (isOnline()) {
      return sessionIsAuthenticated();
    }
    // When offline, use cached data
    return !!cachedUser();
  };

  const user = () => {
    if (isOnline()) {
      const currentUser = sessionUser();
      // When online, prefer cached avatar data URL (works offline, faster loading)
      if (currentUser && cachedAvatarUrl()) {
        return { ...currentUser, image: cachedAvatarUrl() };
      }
      // During loading, use cached data to prevent avatar flash
      if (!currentUser && authLoading()) {
        const cached = cachedUser();
        if (cached && cachedAvatarUrl()) {
          return { ...cached, image: cachedAvatarUrl() };
        }
        return cached;
      }
      return currentUser;
    }
    // When offline, return cached user with cached avatar
    const cached = cachedUser();
    if (cached && cachedAvatarUrl()) {
      return { ...cached, image: cachedAvatarUrl() };
    }
    return cached;
  };

  // Error state for auth operations
  const [authError, setAuthError] = createSignal(null);

  // BroadcastChannel for cross-tab auth state sync
  const authChannel =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('corates-auth') : null;

  // Listen for auth state changes from other tabs
  if (authChannel) {
    const handleMessage = event => {
      if (event.data?.type === 'auth-changed') {
        // Another tab changed auth state, refetch session
        session().refetch?.();
      }
    };

    authChannel.addEventListener('message', handleMessage);
  }

  // Broadcast auth changes to other tabs
  function broadcastAuthChange() {
    authChannel?.postMessage({ type: 'auth-changed', timestamp: Date.now() });
  }

  // Listen for tab visibility changes to refresh session
  if (typeof document !== 'undefined') {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !authLoading() && isOnline()) {
        // Refresh session when tab becomes visible (user might have verified email in another tab)
        try {
          await session().refetch?.();

          // Wait a bit for session to update
          await new Promise(resolve => setTimeout(resolve, 100));

          // Invalidate project list query if user is authenticated
          const currentUser = user();
          if (currentUser?.id) {
            // Invalidate and refetch project list queries to ensure they're current
            try {
              await queryClient.invalidateQueries({
                queryKey: queryKeys.projects.all,
              });
              // Also invalidate legacy query key for backward compatibility
              await queryClient.invalidateQueries({
                queryKey: queryKeys.projects.list(currentUser.id),
              });
            } catch (err) {
              console.warn('[auth] Failed to refresh project list after visibility change:', err);
            }
          } else {
            // User is not authenticated, clear query cache for all projects
            queryClient.removeQueries({ queryKey: queryKeys.projects.all });
          }
        } catch (err) {
          console.warn('[auth] Failed to refresh session on visibility change:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

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
      // Build full callback URL using current origin + basepath (if set)
      // Normalize path to avoid double slashes when BASEPATH ends with /
      const path = callbackPath || '/dashboard';
      const base = (BASEPATH || '').replace(/\/$/, ''); // Remove trailing slash from basepath
      const callbackURL = `${window.location.origin}${base}${path}`;

      // Save login method before redirect
      saveLastLoginMethod(LOGIN_METHODS.GOOGLE);

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
      // Build full callback URL using current origin + basepath (if set)
      // Normalize path to avoid double slashes when BASEPATH ends with /
      const path = callbackPath || '/dashboard';
      const base = (BASEPATH || '').replace(/\/$/, ''); // Remove trailing slash from basepath
      const callbackURL = `${window.location.origin}${base}${path}`;

      // Save login method before redirect
      saveLastLoginMethod(LOGIN_METHODS.ORCID);

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
      // Build full callback URL using current origin + basepath (if set)
      // Normalize path to avoid double slashes when BASEPATH ends with /
      const path = callbackPath || '/dashboard';
      const base = (BASEPATH || '').replace(/\/$/, ''); // Remove trailing slash from basepath
      const callbackURL = `${window.location.origin}${base}${path}`;

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

      // Save login method for when they click the link
      saveLastLoginMethod(LOGIN_METHODS.MAGIC_LINK);

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

      // Save login method on successful sign in
      saveLastLoginMethod(LOGIN_METHODS.EMAIL);

      // Notify other tabs of auth change
      broadcastAuthChange();

      return data;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  /**
   * Shared cleanup logic for signout and revokeAllSessions.
   * Clears all caches, resets state, and notifies other tabs.
   */
  async function _performSignoutCleanup() {
    // Clear cached auth data
    saveCachedAuth(null);
    setCachedUser(null);
    setCachedAvatarUrl(null);

    // Clear all local data from unified Dexie database
    // This includes avatars, PDFs, query cache, form states, and ops queue
    await clearAllData();

    // Clear all in-memory query cache
    queryClient.clear();

    // Clear persisted query cache (IndexedDB and localStorage)
    // This prevents stale data from being restored on next page load
    await clearPersistedQueryCache();

    // Refetch session to immediately clear it in current tab
    // This ensures session().data becomes null right away, preventing components
    // from trying to fetch data with stale user state
    await session().refetch?.();

    // Notify other tabs of auth change
    broadcastAuthChange();
  }

  async function signout() {
    try {
      setAuthError(null);
      const { error } = await authClient.signOut();

      if (error) {
        throw new Error(error.message);
      }

      await _performSignoutCleanup();
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
      // Normalize path to avoid double slashes when BASEPATH ends with /
      const base = (BASEPATH || '').replace(/\/$/, ''); // Remove trailing slash from basepath
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}${base}/reset-password`,
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

  // Internal helper to verify TOTP code (used for both setup verification and sign-in)
  async function _verifyTotpCode(code) {
    setAuthError(null);
    const { data, error } = await authClient.twoFactor.verifyTotp({
      code,
    });

    if (error) {
      throw new Error(error.message);
    }

    broadcastAuthChange();
    return data;
  }

  // Verify and complete 2FA setup with code from authenticator app
  async function verifyTwoFactorSetup(code) {
    try {
      return await _verifyTotpCode(code);
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
      return await _verifyTotpCode(code);
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

  // ==========================================
  // Session Management (M1: Session Revocation)
  // ==========================================

  /**
   * List all active sessions for the current user
   * Returns session data including device info, IP, and timestamps
   */
  async function listActiveSessions() {
    try {
      const result = await _listSessions();
      return result.data || [];
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  /**
   * Revoke a specific session by its token
   * @param {string} token - The session token to revoke
   */
  async function revokeSessionByToken(token) {
    try {
      await _revokeSession({ token });
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  /**
   * Revoke all sessions except the current one
   * Useful for "logout from other devices" functionality
   */
  async function revokeAllOtherSessions() {
    try {
      await _revokeOtherSessions();
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }

  /**
   * Revoke all sessions including the current one
   * Will log out the user from all devices
   */
  async function revokeAllSessions() {
    try {
      await _revokeSessions();
      await _performSignoutCleanup();
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
        // Import error utilities dynamically to avoid circular dependencies
        const { parseApiError, getErrorMessage } = await import('@/lib/error-utils.js');
        const parsedError = await parseApiError(response);

        if (parsedError.code === 'AUTH_REQUIRED' || parsedError.code === 'AUTH_EXPIRED') {
          setAuthError(getErrorMessage('AUTH_EXPIRED'));
        }

        throw new Error(parsedError.message);
      }

      return response;
    } catch (err) {
      // Re-throw if it's already been processed
      if (err.message && !err.message.includes('Request failed with status')) {
        throw err;
      }

      // Handle unprocessed errors
      const { parseError, getErrorMessage } = await import('@/lib/error-utils.js');
      const parsedError = parseError(err);

      if (parsedError.code === 'AUTH_REQUIRED' || parsedError.code === 'AUTH_EXPIRED') {
        setAuthError(getErrorMessage('AUTH_EXPIRED'));
      }

      throw new Error(parsedError.message);
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

  /**
   * Force refresh the auth session
   * Used when page is restored from bfcache to ensure session is current
   * Always refreshes, even if session is already loaded
   */
  async function forceRefreshSession() {
    try {
      await session().refetch?.();
    } catch (err) {
      console.warn('Force session refresh failed:', err);
      throw err;
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

      // Clear pending email from localStorage (account-specific)
      localStorage.removeItem('pendingEmail');

      // Sign out from Better Auth session
      await authClient.signOut();

      // Use shared cleanup (clears caches, resets state, notifies tabs)
      await _performSignoutCleanup();

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
    isOnline,

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

    // Session Management (M1: Session Revocation)
    listActiveSessions,
    revokeSessionByToken,
    revokeAllOtherSessions,
    revokeAllSessions,

    // Utility/compatibility methods
    getCurrentUser,
    refreshAccessToken,
    forceRefreshSession,
    sendEmailVerification,
    getPendingEmail,
    getAccessToken,

    // Better Auth session object for advanced usage
    session,
  };
}

// Create singleton instance without createRoot
// This is a plain object with reactive primitives, not a component tree
const betterAuth = createBetterAuthStore();

export function useBetterAuth() {
  return betterAuth;
}
