import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePost } from '../client-logs';
import { emitClientLogEntry } from '@/server/client-logs';

const { mockGetSession, mockInfo, mockWarn, mockRunWithContext } = vi.hoisted(() => ({
  mockGetSession: vi.fn(
    async () => null as { user: { id: string }; session: { id: string; userId: string } } | null,
  ),
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockRunWithContext: vi.fn((_ctx: Record<string, unknown>, fn: () => void) => fn()),
}));

vi.mock('@corates/workers/auth', () => ({
  getSession: mockGetSession,
}));

vi.mock('@corates/workers/logger', () => ({
  info: mockInfo,
  warn: mockWarn,
  runWithContext: mockRunWithContext,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue(null);
});

describe('POST /api/client-logs', () => {
  it('returns 204 and emits info entries for anonymous callers', async () => {
    const res = await handlePost({
      request: new Request('http://localhost/api/client-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: [
            {
              level: 'info',
              message: 'client.auth.sign_in_failed',
              route: '/signin',
              data: { provider: 'password', code: 'AUTH_INVALID' },
            },
          ],
        }),
      }),
    });

    expect(res.status).toBe(204);
    expect(mockRunWithContext).not.toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith('client.auth.sign_in_failed', {
      source: 'browser',
      service: 'corates-web-client',
      route: '/signin',
      provider: 'password',
      code: 'AUTH_INVALID',
    });
  });

  it('scopes authenticated entries with userId from the session', async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: 'usr_1' }, session: { id: 's1', userId: 'usr_1' } });

    const res = await handlePost({
      request: new Request('http://localhost/api/client-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: [
            {
              level: 'warn',
              message: 'client.sync.fatal',
              data: { projectId: 'proj_1', reason: 'auth-required' },
            },
          ],
        }),
      }),
    });

    expect(res.status).toBe(204);
    expect(mockRunWithContext).toHaveBeenCalledWith({ userId: 'usr_1' }, expect.any(Function));
    expect(mockWarn).toHaveBeenCalledWith('client.sync.fatal', {
      source: 'browser',
      service: 'corates-web-client',
      userId: 'usr_1',
      projectId: 'proj_1',
      reason: 'auth-required',
    });
  });

  it('returns 400 for invalid payloads', async () => {
    const res = await handlePost({
      request: new Request('http://localhost/api/client-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: [] }),
      }),
    });

    expect(res.status).toBe(400);
    expect(mockInfo).not.toHaveBeenCalled();
  });
});

describe('emitClientLogEntry', () => {
  it('strips sensitive keys from nested data', () => {
    emitClientLogEntry(
      {
        level: 'info',
        message: 'client.test',
        data: {
          provider: 'google',
          email: 'secret@example.com',
          nested: { password: 'nope', code: 'AUTH_INVALID' },
        },
      },
      'usr_2',
    );

    expect(mockInfo).toHaveBeenCalledWith('client.test', {
      source: 'browser',
      service: 'corates-web-client',
      userId: 'usr_2',
      provider: 'google',
      nested: { code: 'AUTH_INVALID' },
    });
  });
});
