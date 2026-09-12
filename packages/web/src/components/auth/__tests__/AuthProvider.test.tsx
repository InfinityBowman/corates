// @vitest-environment jsdom
/**
 * A failed session check that is not a 401 must not wipe the cached user,
 * which is what a 429 on first load used to do.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';

const sessionState = vi.hoisted(() => ({
  value: {
    data: null as { user: { id: string; email: string } } | null,
    isPending: false,
    error: null as { status: number } | null,
    refetch: vi.fn(async () => {}),
  },
}));

vi.mock('@/api/auth-client', () => ({
  useSession: () => sessionState.value,
  authClient: {},
  authFetch: vi.fn(),
  listSessions: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
  revokeSessions: vi.fn(),
}));
vi.mock('@/server/functions/users.functions', () => ({ deleteMyAccount: vi.fn() }));
vi.mock('@/lib/queryClient', () => ({
  queryClient: { clear: vi.fn(), invalidateQueries: vi.fn(), removeQueries: vi.fn() },
}));
vi.mock('@/primitives/avatarCache.js', () => ({
  getCachedAvatar: vi.fn(async () => null),
  pruneExpiredAvatars: vi.fn(),
  fetchAndCacheAvatar: vi.fn(async () => null),
}));
vi.mock('@/primitives/db.js', () => ({ clearAllData: vi.fn(async () => {}) }));
vi.mock('@/config/sentry', () => ({ setSentryUser: vi.fn() }));

const AUTH_CACHE_KEY = 'corates-auth-cache';
const AUTH_CACHE_TIMESTAMP_KEY = 'corates-auth-cache-timestamp';

async function renderWithCachedUser(error: { status: number }) {
  localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ id: 'u1', email: 'a@b.com' }));
  localStorage.setItem(AUTH_CACHE_TIMESTAMP_KEY, Date.now().toString());
  sessionState.value = { data: null, isPending: false, error, refetch: vi.fn(async () => {}) };
  vi.resetModules();
  const store = await import('@/stores/authStore');
  const { AuthProvider } = await import('../AuthProvider');
  render(<AuthProvider>{null}</AuthProvider>);
  return store;
}

describe('AuthProvider session outcomes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    vi.resetModules();
  });

  it('keeps the cache and stays logged in on a 429, then retries', async () => {
    const store = await renderWithCachedUser({ status: 429 });
    expect(localStorage.getItem(AUTH_CACHE_KEY)).not.toBeNull();
    const state = store.useAuthStore.getState();
    expect(state.sessionUnavailable).toBe(true);
    expect(store.selectIsLoggedIn(state)).toBe(true);

    // The mount refetch fires at 100ms; the backoff retry follows at 2s
    await vi.advanceTimersByTimeAsync(2_100);
    expect(sessionState.value.refetch).toHaveBeenCalledTimes(2);
  });

  it('holds the retry while offline and schedules it again on reconnect', async () => {
    const store = await renderWithCachedUser({ status: 503 });
    await vi.advanceTimersByTimeAsync(100);
    expect(sessionState.value.refetch).toHaveBeenCalledTimes(1);

    act(() => store.useAuthStore.getState().setOnline(false));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(sessionState.value.refetch).toHaveBeenCalledTimes(1);

    // The mount-time schedule already consumed the 2s slot, so this is the 4s retry
    act(() => store.useAuthStore.getState().setOnline(true));
    await vi.advanceTimersByTimeAsync(4_000);
    expect(sessionState.value.refetch).toHaveBeenCalledTimes(2);
  });
});
