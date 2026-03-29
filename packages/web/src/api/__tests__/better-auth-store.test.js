/**
 * Tests for authStore (Zustand) - Authentication flows and state management
 *
 * Note: These tests focus on the business logic and state management.
 * Better Auth client internals are mocked.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock dependencies before importing the store
vi.mock('@/api/auth-client', () => ({
  authClient: {
    signUp: {
      email: vi.fn(),
    },
    signIn: {
      email: vi.fn(),
      social: vi.fn(),
      oauth2: vi.fn(),
      magicLink: vi.fn(),
    },
    signOut: vi.fn(),
    updateUser: vi.fn(),
    changePassword: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    twoFactor: {
      enable: vi.fn(),
      verifyTotp: vi.fn(),
      disable: vi.fn(),
    },
    sendVerificationEmail: vi.fn(),
  },
  listSessions: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
  revokeSessions: vi.fn(),
}));

vi.mock('@/lib/queryClient', () => ({
  queryClient: { clear: vi.fn() },
}));

vi.mock('@/config/api', () => ({
  API_BASE: 'http://localhost:8787',
  BASEPATH: '',
}));

vi.mock('@/lib/lastLoginMethod', () => ({
  saveLastLoginMethod: vi.fn(),
  LOGIN_METHODS: {
    EMAIL: 'email',
    GOOGLE: 'google',
    ORCID: 'orcid',
    MAGIC_LINK: 'magic-link',
  },
}));

vi.mock('@/primitives/avatarCache.js', () => ({
  getCachedAvatar: vi.fn().mockResolvedValue(null),
  pruneExpiredAvatars: vi.fn(),
}));

vi.mock('@/primitives/db.js', () => ({
  clearAllData: vi.fn().mockResolvedValue(undefined),
}));

// Mock BroadcastChannel
global.BroadcastChannel = vi.fn(function () {
  this.postMessage = vi.fn();
  this.addEventListener = vi.fn();
  this.removeEventListener = vi.fn();
  this.close = vi.fn();
});

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = value.toString();
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  },
};
global.localStorage = localStorageMock;

describe('authStore - Signup Flow', () => {
  let authStore;
  let authClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    authClient = (await import('@/api/auth-client')).authClient;
    const { useAuthStore } = await import('@/stores/authStore');
    authStore = useAuthStore;

    // Reset store state
    authStore.setState({ authError: null });
  });

  it('should signup successfully with email and password', async () => {
    authClient.signUp.email.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });

    const result = await authStore
      .getState()
      .signup('test@example.com', 'password123', 'Test User');

    expect(authClient.signUp.email).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });

    expect(localStorage.getItem('pendingEmail')).toBe('test@example.com');
    expect(result).toEqual({ user: { id: 'user-1', email: 'test@example.com' } });
  });

  it('should signup with role when provided', async () => {
    authClient.signUp.email.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com', role: 'researcher' } },
      error: null,
    });

    await authStore.getState().signup('test@example.com', 'password123', 'Test User', 'researcher');

    expect(authClient.signUp.email).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      role: 'researcher',
    });
  });

  it('should handle signup errors', async () => {
    authClient.signUp.email.mockResolvedValue({
      data: null,
      error: { message: 'Email already exists' },
    });

    await expect(
      authStore.getState().signup('test@example.com', 'password123', 'Test User'),
    ).rejects.toThrow('Email already exists');

    expect(authStore.getState().authError).toBe('Email already exists');
  });
});

describe('authStore - Signin Flow', () => {
  let authStore;
  let authClient;
  let saveLastLoginMethod;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    authClient = (await import('@/api/auth-client')).authClient;
    saveLastLoginMethod = (await import('@/lib/lastLoginMethod')).saveLastLoginMethod;

    const { useAuthStore } = await import('@/stores/authStore');
    authStore = useAuthStore;
    authStore.setState({ authError: null });
  });

  it('should signin successfully with email and password', async () => {
    authClient.signIn.email.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });

    localStorage.setItem('pendingEmail', 'test@example.com');

    const result = await authStore.getState().signin('test@example.com', 'password123');

    expect(authClient.signIn.email).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(saveLastLoginMethod).toHaveBeenCalledWith('email');
    expect(localStorage.getItem('pendingEmail')).toBeNull();
    expect(result).toBeDefined();
  });

  it('should return 2FA required flag when 2FA is needed', async () => {
    authClient.signIn.email.mockResolvedValue({
      data: { twoFactorRedirect: true },
      error: null,
    });

    const result = await authStore.getState().signin('test@example.com', 'password123');

    expect(result.twoFactorRequired).toBe(true);
  });

  it('should handle signin errors', async () => {
    authClient.signIn.email.mockResolvedValue({
      data: null,
      error: { message: 'Invalid credentials' },
    });

    await expect(authStore.getState().signin('test@example.com', 'wrong-password')).rejects.toThrow(
      'Invalid credentials',
    );

    expect(authStore.getState().authError).toBe('Invalid credentials');
  });
});

describe('authStore - Social Auth', () => {
  let authStore;
  let authClient;
  let saveLastLoginMethod;
  let LOGIN_METHODS;

  beforeEach(async () => {
    vi.clearAllMocks();

    authClient = (await import('@/api/auth-client')).authClient;
    const lastLoginModule = await import('@/lib/lastLoginMethod');
    saveLastLoginMethod = lastLoginModule.saveLastLoginMethod;
    LOGIN_METHODS = lastLoginModule.LOGIN_METHODS;

    delete global.window.location;
    global.window.location = { origin: 'http://localhost:5173' };

    const { useAuthStore } = await import('@/stores/authStore');
    authStore = useAuthStore;
    authStore.setState({ authError: null });
  });

  it('should signin with Google', async () => {
    authClient.signIn.social.mockResolvedValue({
      data: { redirectUrl: 'https://accounts.google.com/...' },
      error: null,
    });

    await authStore.getState().signinWithGoogle('/dashboard');

    expect(saveLastLoginMethod).toHaveBeenCalledWith(LOGIN_METHODS.GOOGLE);
    expect(authClient.signIn.social).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: 'http://localhost:5173/dashboard',
      errorCallbackURL: 'http://localhost:5173/signin',
    });
  });

  it('should signin with ORCID', async () => {
    authClient.signIn.oauth2.mockResolvedValue({
      data: { redirectUrl: 'https://orcid.org/...' },
      error: null,
    });

    await authStore.getState().signinWithOrcid('/projects');

    expect(saveLastLoginMethod).toHaveBeenCalledWith(LOGIN_METHODS.ORCID);
    expect(authClient.signIn.oauth2).toHaveBeenCalledWith({
      providerId: 'orcid',
      callbackURL: 'http://localhost:5173/projects',
      errorCallbackURL: 'http://localhost:5173/signin',
    });
  });

  it('should send magic link', async () => {
    authClient.signIn.magicLink.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    await authStore.getState().signinWithMagicLink('test@example.com', '/verify');

    expect(authClient.signIn.magicLink).toHaveBeenCalledWith({
      email: 'test@example.com',
      callbackURL: 'http://localhost:5173/verify',
    });

    expect(localStorage.getItem('pendingEmail')).toBe('test@example.com');
    expect(saveLastLoginMethod).toHaveBeenCalledWith(LOGIN_METHODS.MAGIC_LINK);
  });
});

describe('authStore - Signout', () => {
  let authStore;
  let authClient;

  beforeEach(async () => {
    vi.clearAllMocks();

    authClient = (await import('@/api/auth-client')).authClient;

    const { useAuthStore } = await import('@/stores/authStore');
    authStore = useAuthStore;
    authStore.setState({ authError: null, sessionRefetch: null });
  });

  it('should signout successfully', async () => {
    authClient.signOut.mockResolvedValue({
      error: null,
    });

    await authStore.getState().signout();

    expect(authClient.signOut).toHaveBeenCalled();
  });

  it('should handle signout errors', async () => {
    authClient.signOut.mockResolvedValue({
      error: { message: 'Signout failed' },
    });

    await expect(authStore.getState().signout()).rejects.toThrow('Signout failed');
    expect(authStore.getState().authError).toBe('Signout failed');
  });
});

describe('authStore - Password Management', () => {
  let authStore;
  let authClient;

  beforeEach(async () => {
    vi.clearAllMocks();

    authClient = (await import('@/api/auth-client')).authClient;

    global.window.location = { origin: 'http://localhost:5173' };

    const { useAuthStore } = await import('@/stores/authStore');
    authStore = useAuthStore;
    authStore.setState({ authError: null });
  });

  it('should change password', async () => {
    authClient.changePassword.mockResolvedValue({
      error: null,
    });

    await authStore.getState().changePassword('oldPassword123', 'newPassword456');

    expect(authClient.changePassword).toHaveBeenCalledWith({
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword456',
    });

    expect(authStore.getState().authError).toBeNull();
  });

  it('should request password reset', async () => {
    authClient.requestPasswordReset.mockResolvedValue({
      error: null,
    });

    await authStore.getState().resetPassword('test@example.com');

    expect(authClient.requestPasswordReset).toHaveBeenCalledWith({
      email: 'test@example.com',
      redirectTo: 'http://localhost:5173/reset-password',
    });
  });

  it('should confirm password reset with token', async () => {
    authClient.resetPassword.mockResolvedValue({
      error: null,
    });

    await authStore.getState().confirmPasswordReset('reset-token-123', 'newPassword789');

    expect(authClient.resetPassword).toHaveBeenCalledWith({
      token: 'reset-token-123',
      newPassword: 'newPassword789',
    });
  });

  it('should handle password change errors', async () => {
    authClient.changePassword.mockResolvedValue({
      error: { message: 'Current password is incorrect' },
    });

    await expect(authStore.getState().changePassword('wrong', 'new')).rejects.toThrow(
      'Current password is incorrect',
    );

    expect(authStore.getState().authError).toBe('Current password is incorrect');
  });
});

describe('authStore - Two-Factor Authentication', () => {
  let authStore;
  let authClient;

  beforeEach(async () => {
    vi.clearAllMocks();

    authClient = (await import('@/api/auth-client')).authClient;

    const { useAuthStore } = await import('@/stores/authStore');
    authStore = useAuthStore;
    authStore.setState({ authError: null });
  });

  it('should enable 2FA with password', async () => {
    authClient.twoFactor.enable.mockResolvedValue({
      data: {
        totpURI: 'otpauth://totp/...',
        secret: 'ABC123',
        backupCodes: ['code1', 'code2'],
      },
      error: null,
    });

    const result = await authStore.getState().enableTwoFactor('myPassword123');

    expect(authClient.twoFactor.enable).toHaveBeenCalledWith({
      password: 'myPassword123',
    });

    expect(result.totpURI).toBeDefined();
    expect(result.secret).toBe('ABC123');
    expect(result.backupCodes).toEqual(['code1', 'code2']);
  });

  it('should verify 2FA setup with code', async () => {
    authClient.twoFactor.verifyTotp.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const result = await authStore.getState().verifyTwoFactorSetup('123456');

    expect(authClient.twoFactor.verifyTotp).toHaveBeenCalledWith({
      code: '123456',
    });

    expect(result).toEqual({ success: true });
  });

  it('should disable 2FA with password', async () => {
    authClient.twoFactor.disable.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const result = await authStore.getState().disableTwoFactor('myPassword123');

    expect(authClient.twoFactor.disable).toHaveBeenCalledWith({
      password: 'myPassword123',
    });

    expect(result).toEqual({ success: true });
  });

  it('should verify 2FA code during signin', async () => {
    authClient.twoFactor.verifyTotp.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });

    const result = await authStore.getState().verifyTwoFactor('654321');

    expect(authClient.twoFactor.verifyTotp).toHaveBeenCalledWith({
      code: '654321',
    });

    expect(result.user).toBeDefined();
  });

  it('should handle 2FA errors', async () => {
    authClient.twoFactor.enable.mockResolvedValue({
      data: null,
      error: { message: 'Invalid password' },
    });

    await expect(authStore.getState().enableTwoFactor('wrongPassword')).rejects.toThrow(
      'Invalid password',
    );
    expect(authStore.getState().authError).toBe('Invalid password');
  });
});

describe('authStore - Profile Management', () => {
  let authStore;
  let authClient;

  beforeEach(async () => {
    vi.clearAllMocks();

    authClient = (await import('@/api/auth-client')).authClient;

    const { useAuthStore } = await import('@/stores/authStore');
    authStore = useAuthStore;
    authStore.setState({ authError: null, sessionRefetch: null });
  });

  it('should update user profile', async () => {
    authClient.updateUser.mockResolvedValue({
      data: { user: { id: 'user-1', name: 'New Name' } },
      error: null,
    });

    const result = await authStore.getState().updateProfile({ name: 'New Name' });

    expect(authClient.updateUser).toHaveBeenCalledWith({ name: 'New Name' });
    expect(result.user.name).toBe('New Name');
  });

  it('should handle profile update errors', async () => {
    authClient.updateUser.mockResolvedValue({
      data: null,
      error: { message: 'Update failed' },
    });

    await expect(authStore.getState().updateProfile({ name: 'Test' })).rejects.toThrow(
      'Update failed',
    );
    expect(authStore.getState().authError).toBe('Update failed');
  });
});

describe('authStore - Account Deletion', () => {
  let authStore;
  let authClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    authClient = (await import('@/api/auth-client')).authClient;
    authClient.signOut.mockResolvedValue({ error: null });

    global.fetch = vi.fn();

    const { useAuthStore } = await import('@/stores/authStore');
    authStore = useAuthStore;
    authStore.setState({ authError: null, sessionRefetch: null });
  });

  it('should delete account successfully', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    localStorage.setItem('pendingEmail', 'test@example.com');

    const result = await authStore.getState().deleteAccount();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/me'),
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
      }),
    );

    expect(localStorage.getItem('pendingEmail')).toBeNull();
    expect(authClient.signOut).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('should handle account deletion errors', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Deletion failed' }),
    });

    await expect(authStore.getState().deleteAccount()).rejects.toThrow('Deletion failed');
    expect(authStore.getState().authError).toBe('Deletion failed');
  });
});

describe('authStore - Utility Functions', () => {
  let authStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    const { useAuthStore } = await import('@/stores/authStore');
    authStore = useAuthStore;
    authStore.setState({ authError: null });
  });

  it('should clear auth error', async () => {
    // Trigger an error first
    const authClient = (await import('@/api/auth-client')).authClient;
    authClient.signIn.email.mockResolvedValue({
      data: null,
      error: { message: 'Test error' },
    });

    await authStore
      .getState()
      .signin('test@example.com', 'wrong')
      .catch(() => {});

    expect(authStore.getState().authError).toBe('Test error');

    authStore.getState().setAuthError(null);

    expect(authStore.getState().authError).toBeNull();
  });
});
