/**
 * Stop-impersonation server function tests.
 *
 * Tests the pure business logic in admin-users.server.ts.
 * CSRF is handled by the server function framework and is not tested here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stopImpersonation } from '@/server/functions/admin-users.server';

const { mockAuthHandler } = vi.hoisted(() => ({
  mockAuthHandler: vi.fn(
    async (_req: Request) =>
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  ),
}));

vi.mock('@corates/workers/auth-config', () => ({
  createAuth: () => ({ handler: mockAuthHandler }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthHandler.mockImplementation(
    async () =>
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  );
});

function req(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/admin/stop-impersonation', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
  });
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe('POST /api/admin/stop-impersonation - request forwarding', () => {
  it('forwards cookie/origin/referer + accept=json to better-auth and uses POST + correct path', async () => {
    const cookie = 'session=test-token; other=value';
    const origin = 'http://localhost:3010';
    await stopImpersonation(req({ cookie, origin, referer: `${origin}/x` }));

    expect(mockAuthHandler).toHaveBeenCalledTimes(1);
    const forwarded = mockAuthHandler.mock.calls[0][0]!;
    expect(forwarded).toBeInstanceOf(Request);
    expect(forwarded.method).toBe('POST');
    const fwdUrl = new URL(forwarded.url);
    expect(fwdUrl.pathname).toBe('/api/auth/admin/stop-impersonating');
    expect(forwarded.headers.get('cookie')).toBe(cookie);
    expect(forwarded.headers.get('origin')).toBe(origin);
    expect(forwarded.headers.get('referer')).toBe(`${origin}/x`);
    expect(forwarded.headers.get('accept')).toBe('application/json');
  });

  it('returns better-auth response verbatim on success', async () => {
    mockAuthHandler.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, message: 'Impersonation stopped' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const res = await stopImpersonation(
      req({ cookie: 'session=t', origin: 'http://localhost:3010' }),
    );
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Impersonation stopped');
  });
});

describe('POST /api/admin/stop-impersonation - error path', () => {
  it('throws when better-auth handler throws', async () => {
    mockAuthHandler.mockRejectedValueOnce(new Error('Better Auth service unavailable'));

    await expect(
      stopImpersonation(req({ cookie: 'session=t', origin: 'http://localhost:3010' })),
    ).rejects.toThrow('Better Auth service unavailable');
  });
});
