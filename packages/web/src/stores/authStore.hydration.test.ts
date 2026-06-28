/**
 * Guards the auth-store invariant that the protected-route guard depends on.
 *
 * `routes/_app/_protected.tsx` runs `selectIsLoggedIn(useAuthStore.getState())`
 * SYNCHRONOUSLY in `beforeLoad` and redirects to /signin when it returns false.
 * On a hard navigation / refresh this runs before any session fetch resolves,
 * so it relies on `cachedUser` being loaded from localStorage at store-init
 * time. If that load is deferred (e.g. to a post-mount effect), the guard sees
 * no user and bounces logged-in users to /signin on every refresh of a
 * protected page. This test pins the synchronous load.
 *
 * (The hydration mismatch this once tried to fix, Sentry CORATES-WEB-C, is now
 * handled in the Navbar via useHydrated(), NOT by nulling cachedUser here.)
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// Heavy / IO dependencies pulled in transitively by the store.
vi.mock('@/api/auth-client', () => ({
  authClient: {},
  authFetch: vi.fn(),
  listSessions: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
  revokeSessions: vi.fn(),
}));
vi.mock('@/server/functions/users.functions', () => ({ deleteMyAccount: vi.fn() }));
vi.mock('@/lib/queryClient', () => ({ queryClient: { clear: vi.fn() } }));
vi.mock('@/primitives/avatarCache.js', () => ({
  getCachedAvatar: vi.fn(async () => null),
  pruneExpiredAvatars: vi.fn(),
}));
vi.mock('@/primitives/db.js', () => ({ clearAllData: vi.fn(async () => {}) }));

// Private keys from authStore.ts loadCachedAuth().
const AUTH_CACHE_KEY = 'corates-auth-cache';
const AUTH_CACHE_TIMESTAMP_KEY = 'corates-auth-cache-timestamp';

async function loadStoreFresh() {
  vi.resetModules();
  return import('./authStore');
}

describe('authStore protected-route guard invariant (CORATES-WEB-C follow-up)', () => {
  afterEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('loads cachedUser synchronously at init so the guard sees a logged-in user before the session resolves', async () => {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ id: 'u1', email: 'a@b.com' }));
    localStorage.setItem(AUTH_CACHE_TIMESTAMP_KEY, Date.now().toString());

    const mod = await loadStoreFresh();
    const state = mod.useAuthStore.getState();

    // Synchronous load is what beforeLoad relies on.
    expect(state.cachedUser).toMatchObject({ id: 'u1' });
    expect(state.sessionLoading).toBe(true);
    // The guard must treat a returning user as logged in while the session loads.
    expect(mod.selectIsLoggedIn(state)).toBe(true);
  });

  it('reports logged-out at init when there is no cached user', async () => {
    localStorage.clear();
    const mod = await loadStoreFresh();
    expect(mod.selectIsLoggedIn(mod.useAuthStore.getState())).toBe(false);
  });
});
