/**
 * Auth Store - Zustand store for authentication state
 *
 * This store holds auth state that needs to be accessible outside React components
 * (e.g., from Yjs callbacks, API interceptors). The AuthProvider component syncs
 * Better Auth's useSession() data into this store.
 *
 * Auth API methods (signin, signup, etc.) are also here since they need to
 * read/write store state and are called from components.
 */

import { create } from 'zustand';
import {
  authClient,
  listSessions as _listSessions,
  revokeSession as _revokeSession,
  revokeOtherSessions as _revokeOtherSessions,
  revokeSessions as _revokeSessions,
} from '@/api/auth-client';
import { queryClient, clearPersistedQueryCache } from '@/lib/queryClient';
import { API_BASE, BASEPATH } from '@/config/api';
import { saveLastLoginMethod, LOGIN_METHODS } from '@/lib/lastLoginMethod';
import { getCachedAvatar, pruneExpiredAvatars } from '@/primitives/avatarCache.js';
import { clearAllData } from '@/primitives/db.js';

// LocalStorage keys for offline caching
const AUTH_CACHE_KEY = 'corates-auth-cache';
const AUTH_CACHE_TIMESTAMP_KEY = 'corates-auth-cache-timestamp';
const AUTH_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  image?: string | null;
  role?: string | null;
  twoFactorEnabled?: boolean | null;
  [key: string]: unknown;
}

interface AuthState {
  isOnline: boolean;
  cachedUser: AuthUser | null;
  cachedAvatarUrl: string | null;
  authError: string | null;

  // These are synced from AuthProvider (Better Auth useSession)
  sessionUser: AuthUser | null;
  sessionLoading: boolean;
  sessionRefetch: (() => Promise<void>) | null;
}

/* eslint-disable no-unused-vars */
interface AuthActions {
  setOnline: (online: boolean) => void;
  setCachedUser: (user: AuthUser | null) => void;
  setCachedAvatarUrl: (url: string | null) => void;
  setAuthError: (error: string | null) => void;
  setSessionData: (
    user: AuthUser | null,
    loading: boolean,
    refetch: (() => Promise<void>) | null,
  ) => void;

  // Auth API methods
  signup: (email: string, password: string, name: string, role?: string | null) => Promise<unknown>;
  signin: (email: string, password: string) => Promise<{ twoFactorRequired: true } | unknown>;
  signinWithGoogle: (callbackPath?: string) => Promise<unknown>;
  signinWithOrcid: (callbackPath?: string) => Promise<unknown>;
  signinWithMagicLink: (email: string, callbackPath?: string) => Promise<unknown>;
  signout: () => Promise<void>;
  updateProfile: (data: Record<string, unknown>) => Promise<unknown>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  confirmPasswordReset: (token: string, newPassword: string) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  deleteAccount: () => Promise<{ success: boolean }>;

  // 2FA
  enableTwoFactor: (password: string) => Promise<unknown>;
  verifyTwoFactorSetup: (code: string) => Promise<unknown>;
  disableTwoFactor: (password: string) => Promise<unknown>;
  verifyTwoFactor: (code: string) => Promise<unknown>;

  // Session management
  listActiveSessions: () => Promise<unknown[]>;
  revokeSessionByToken: (token: string) => Promise<void>;
  revokeAllOtherSessions: () => Promise<void>;
  revokeAllSessions: () => Promise<void>;
  forceRefreshSession: () => Promise<void>;
}
/* eslint-enable no-unused-vars */

// Pure functions for localStorage cache

export function loadCachedAuth(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY);
    const timestamp = localStorage.getItem(AUTH_CACHE_TIMESTAMP_KEY);
    if (!cached || !timestamp) return null;

    const age = Date.now() - parseInt(timestamp, 10);
    if (age > AUTH_CACHE_MAX_AGE) {
      localStorage.removeItem(AUTH_CACHE_KEY);
      localStorage.removeItem(AUTH_CACHE_TIMESTAMP_KEY);
      return null;
    }

    return JSON.parse(cached);
  } catch {
    return null;
  }
}

export function saveCachedAuth(userData: AuthUser | null) {
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

// BroadcastChannel for cross-tab auth state sync
const authChannel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('corates-auth') : null;

function broadcastAuthChange() {
  authChannel?.postMessage({ type: 'auth-changed', timestamp: Date.now() });
}

// Shared cleanup logic for signout and revokeAllSessions
async function performSignoutCleanup() {
  const state = useAuthStore.getState();
  saveCachedAuth(null);
  state.setCachedUser(null);
  state.setCachedAvatarUrl(null);

  await clearAllData();
  queryClient.clear();
  await clearPersistedQueryCache();

  // Refetch session to clear it
  await state.sessionRefetch?.();
  broadcastAuthChange();
}

export const useAuthStore = create<AuthState & AuthActions>()((set, get) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  cachedUser: loadCachedAuth(),
  cachedAvatarUrl: null,
  authError: null,
  sessionUser: null,
  sessionLoading: true,
  sessionRefetch: null,

  setOnline: online => set({ isOnline: online }),
  setCachedUser: user => set({ cachedUser: user }),
  setCachedAvatarUrl: url => set({ cachedAvatarUrl: url }),
  setAuthError: error => set({ authError: error }),
  setSessionData: (user, loading, refetch) =>
    set({ sessionUser: user, sessionLoading: loading, sessionRefetch: refetch }),

  signup: async (email, password, name, role = null) => {
    try {
      set({ authError: null });
      const { data, error } = await authClient.signUp.email({
        email,
        password,
        name,
        ...(role ? { role } : {}),
      } as Parameters<typeof authClient.signUp.email>[0]);
      if (error) throw new Error(error.message);

      localStorage.setItem('pendingEmail', email);
      return data;
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  signin: async (email, password) => {
    try {
      set({ authError: null });
      const { data, error } = await authClient.signIn.email({ email, password });
      if (error) throw new Error(error.message);

      if ((data as Record<string, unknown>)?.twoFactorRedirect) {
        return { twoFactorRequired: true };
      }

      localStorage.removeItem('pendingEmail');
      saveLastLoginMethod(LOGIN_METHODS.EMAIL);
      broadcastAuthChange();
      return data;
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  signinWithGoogle: async callbackPath => {
    try {
      set({ authError: null });
      const path = callbackPath || '/dashboard';
      const base = (BASEPATH || '').replace(/\/$/, '');
      const callbackURL = `${window.location.origin}${base}${path}`;
      const errorURL = `${window.location.origin}${base}/signin`;

      saveLastLoginMethod(LOGIN_METHODS.GOOGLE);

      const { data, error } = await authClient.signIn.social({
        provider: 'google',
        callbackURL,
        errorCallbackURL: errorURL,
      });
      if (error) throw new Error(error.message);
      return data;
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  signinWithOrcid: async callbackPath => {
    try {
      set({ authError: null });
      const path = callbackPath || '/dashboard';
      const base = (BASEPATH || '').replace(/\/$/, '');
      const callbackURL = `${window.location.origin}${base}${path}`;
      const errorURL = `${window.location.origin}${base}/signin`;

      saveLastLoginMethod(LOGIN_METHODS.ORCID);

      const { data, error } = await authClient.signIn.oauth2({
        providerId: 'orcid',
        callbackURL,
        errorCallbackURL: errorURL,
      });
      if (error) throw new Error(error.message);
      return data;
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  signinWithMagicLink: async (email, callbackPath) => {
    try {
      set({ authError: null });
      const path = callbackPath || '/dashboard';
      const base = (BASEPATH || '').replace(/\/$/, '');
      const callbackURL = `${window.location.origin}${base}${path}`;

      const { data, error } = await authClient.signIn.magicLink({ email, callbackURL });
      if (error) throw new Error(error.message);

      localStorage.setItem('pendingEmail', email);
      localStorage.setItem('magicLinkSent', 'true');
      saveLastLoginMethod(LOGIN_METHODS.MAGIC_LINK);
      return data;
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  signout: async () => {
    try {
      set({ authError: null });
      const { error } = await authClient.signOut();
      if (error) throw new Error(error.message);
      await performSignoutCleanup();
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  updateProfile: async data => {
    try {
      set({ authError: null });
      const { data: updated, error } = await authClient.updateUser(data);
      if (error) throw new Error(error.message);
      await get().sessionRefetch?.();
      return updated;
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    try {
      set({ authError: null });
      const { error } = await authClient.changePassword({ currentPassword, newPassword });
      if (error) throw new Error(error.message);
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  resetPassword: async email => {
    try {
      set({ authError: null });
      const base = (BASEPATH || '').replace(/\/$/, '');
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}${base}/reset-password`,
      });
      if (error) throw new Error(error.message);
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  confirmPasswordReset: async (token, newPassword) => {
    try {
      set({ authError: null });
      const { error } = await authClient.resetPassword({ token, newPassword });
      if (error) throw new Error(error.message);
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  resendVerificationEmail: async email => {
    try {
      set({ authError: null });
      const { error } = await authClient.$fetch('/send-verification-email', {
        method: 'POST',
        body: { email },
      });
      if (error) throw new Error(error.message || 'Failed to resend verification email');
    } catch (err) {
      set({ authError: (err as Error).message || 'Failed to resend verification email' });
      throw err;
    }
  },

  deleteAccount: async () => {
    try {
      set({ authError: null });
      const response = await fetch(`${API_BASE}/api/users/me`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete account');
      }

      localStorage.removeItem('pendingEmail');
      await authClient.signOut();
      await performSignoutCleanup();
      return { success: true };
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  // 2FA

  enableTwoFactor: async password => {
    try {
      set({ authError: null });
      const { data, error } = await authClient.twoFactor.enable({ password });
      if (error) throw new Error(error.message);
      return data;
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  verifyTwoFactorSetup: async code => {
    try {
      set({ authError: null });
      const { data, error } = await authClient.twoFactor.verifyTotp({ code });
      if (error) throw new Error(error.message);
      broadcastAuthChange();
      return data;
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  disableTwoFactor: async password => {
    try {
      set({ authError: null });
      const { data, error } = await authClient.twoFactor.disable({ password });
      if (error) throw new Error(error.message);
      broadcastAuthChange();
      return data;
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  verifyTwoFactor: async code => {
    try {
      set({ authError: null });
      const { data, error } = await authClient.twoFactor.verifyTotp({ code });
      if (error) throw new Error(error.message);
      broadcastAuthChange();
      return data;
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  // Session management

  listActiveSessions: async () => {
    try {
      const result = await _listSessions();
      return result.data || [];
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  revokeSessionByToken: async token => {
    try {
      await _revokeSession({ token });
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  revokeAllOtherSessions: async () => {
    try {
      await _revokeOtherSessions();
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  revokeAllSessions: async () => {
    try {
      await _revokeSessions();
      await performSignoutCleanup();
    } catch (err) {
      set({ authError: (err as Error).message });
      throw err;
    }
  },

  forceRefreshSession: async () => {
    try {
      await get().sessionRefetch?.();
    } catch (err) {
      console.warn('Force session refresh failed:', err);
      throw err;
    }
  },
}));

// Initialize: load cached avatar and prune expired entries
if (typeof window !== 'undefined') {
  const cachedAuth = loadCachedAuth();
  if (cachedAuth?.id) {
    getCachedAvatar(cachedAuth.id).then((dataUrl: string | null) => {
      if (dataUrl) useAuthStore.getState().setCachedAvatarUrl(dataUrl);
    });
  }
  pruneExpiredAvatars();

  // Listen for online/offline
  window.addEventListener('online', () => useAuthStore.getState().setOnline(true));
  window.addEventListener('offline', () => useAuthStore.getState().setOnline(false));

  // Listen for auth changes from other tabs
  if (authChannel) {
    authChannel.addEventListener('message', event => {
      if (event.data?.type === 'auth-changed') {
        useAuthStore.getState().sessionRefetch?.();
      }
    });
  }
}

// Derived selectors (composing session + cached state)

export function selectIsLoggedIn(state: AuthState): boolean {
  if (state.isOnline) {
    if (state.sessionLoading && state.cachedUser) return true;
    return !!state.sessionUser;
  }
  return !!state.cachedUser;
}

export function selectIsAuthLoading(state: AuthState): boolean {
  if (!state.isOnline) return false;
  if (state.sessionLoading && state.cachedUser) return false;
  return state.sessionLoading;
}

/**
 * Select the raw user object from the store.
 * Returns the sessionUser, cachedUser, or null depending on online/loading state.
 * Does NOT merge avatar URL -- use selectUserAvatarUrl separately to avoid
 * creating new object references on every render (which breaks useSyncExternalStore).
 */
export function selectUser(state: AuthState): AuthUser | null {
  if (state.isOnline) {
    const currentUser = state.sessionUser;
    if (currentUser) return currentUser;
    if (state.sessionLoading) return state.cachedUser;
    return null;
  }
  return state.cachedUser;
}

export function selectUserAvatarUrl(state: AuthState): string | null {
  return state.cachedAvatarUrl;
}

export function selectTwoFactorEnabled(state: AuthState): boolean {
  const user = selectUser(state);
  return user?.twoFactorEnabled ?? false;
}

// Utility functions

export function getPendingEmail(): string | null {
  return localStorage.getItem('pendingEmail');
}
