// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDismissedHint } from '../useDismissedHint';

const auth = vi.hoisted(() => ({
  user: null as null | { id: string; preferences?: string | null },
  sessionRefetch: vi.fn(async (_options?: { disableCookieCache?: boolean }) => {}),
}));
const server = vi.hoisted(() => ({
  dismissHint: vi.fn(async (_args: { data: { hintId: string } }) => ({ dismissedHints: [] })),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof auth) => unknown) => selector(auth),
  selectUser: (s: typeof auth) => s.user,
}));
vi.mock('@/server/functions/users.functions', () => ({
  dismissHint: server.dismissHint,
}));

const KEY = 'studiesExplainerDismissed:user-1';

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useDismissedHint', () => {
  beforeEach(() => {
    localStorage.clear();
    auth.user = { id: 'user-1', preferences: null };
    auth.sessionRefetch.mockClear();
    server.dismissHint.mockClear();
  });

  it('shows the hint when neither the server nor this device has dismissed it', async () => {
    const { result } = renderHook(() => useDismissedHint('studiesExplainer'));
    await flush();
    expect(result.current.dismissed).toBe(false);
    expect(server.dismissHint).not.toHaveBeenCalled();
  });

  it('hides the hint when the server list contains it', async () => {
    auth.user = {
      id: 'user-1',
      preferences: JSON.stringify({ dismissedHints: ['studiesExplainer'] }),
    };
    const { result } = renderHook(() => useDismissedHint('studiesExplainer'));
    await flush();
    expect(result.current.dismissed).toBe(true);
    expect(server.dismissHint).not.toHaveBeenCalled();
  });

  it('dismissing hides immediately, writes locally, saves to the server, and refetches fresh', async () => {
    const { result } = renderHook(() => useDismissedHint('studiesExplainer'));
    await flush();

    act(() => result.current.dismiss());
    expect(result.current.dismissed).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('true');

    await flush();
    expect(server.dismissHint).toHaveBeenCalledExactlyOnceWith({
      data: { hintId: 'studiesExplainer' },
    });
    expect(auth.sessionRefetch).toHaveBeenCalledExactlyOnceWith({ disableCookieCache: true });
  });

  it('sends a dismissal only this device knows about up to the server once', async () => {
    localStorage.setItem(KEY, 'true');
    const { result, rerender } = renderHook(() => useDismissedHint('studiesExplainer'));
    await flush();

    expect(result.current.dismissed).toBe(true);
    expect(server.dismissHint).toHaveBeenCalledTimes(1);

    rerender();
    await flush();
    expect(server.dismissHint).toHaveBeenCalledTimes(1);
  });

  it('keeps the hint hidden on this device when the server save fails', async () => {
    server.dismissHint.mockRejectedValueOnce(new Error('offline'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useDismissedHint('studiesExplainer'));
    await flush();

    act(() => result.current.dismiss());
    await flush();

    expect(result.current.dismissed).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('true');
    expect(auth.sessionRefetch).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
