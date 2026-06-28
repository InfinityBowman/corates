/**
 * Regression test for CORATES-WEB-C (Sentry): "Hydration failed - the server
 * rendered HTML didn't match the client" on resource pages.
 *
 * Root cause: the store seeds `cachedUser` from localStorage at module-init
 * time (`cachedUser: loadCachedAuth()`). On the server there is no localStorage
 * so it is null; on the client a returning user's cached session makes it
 * non-null. With `sessionLoading: true`, `selectIsLoggedIn` then returns a
 * different value on the first client render than on the server render, which
 * is exactly a hydration mismatch.
 *
 * The first client render MUST equal the server render. This test pins that.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// Heavy / IO dependencies pulled in transitively by the store. Stubbed so the
// module can be imported in isolation without touching IndexedDB, the network,
// or the query client.
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

describe('authStore SSR hydration consistency (CORATES-WEB-C)', () => {
  afterEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('first client render of selectIsLoggedIn must match the logged-out server render', async () => {
    // Server render: no persisted cache available.
    localStorage.clear();
    const server = await loadStoreFresh();
    const serverLoggedIn = server.selectIsLoggedIn(server.useAuthStore.getState());

    // Client render for a returning user: a valid cached session is present.
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ id: 'u1', email: 'a@b.com' }));
    localStorage.setItem(AUTH_CACHE_TIMESTAMP_KEY, Date.now().toString());
    const client = await loadStoreFresh();
    const clientLoggedIn = client.selectIsLoggedIn(client.useAuthStore.getState());

    expect(serverLoggedIn).toBe(false);
    // The bug: the first client render diverges from the server -> hydration mismatch.
    expect(clientLoggedIn).toBe(serverLoggedIn);
  });

  it('restores the cached user after mount so returning users still appear logged in', async () => {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ id: 'u1', email: 'a@b.com' }));
    localStorage.setItem(AUTH_CACHE_TIMESTAMP_KEY, Date.now().toString());
    const mod = await loadStoreFresh();

    // First render is logged-out (matches the server).
    expect(mod.selectIsLoggedIn(mod.useAuthStore.getState())).toBe(false);

    // AuthProvider's post-mount effect restores the persisted user.
    mod.useAuthStore.getState().setCachedUser(mod.loadCachedAuth());

    // While the session is still loading, the cached user keeps them logged in.
    expect(mod.selectIsLoggedIn(mod.useAuthStore.getState())).toBe(true);
  });
});
