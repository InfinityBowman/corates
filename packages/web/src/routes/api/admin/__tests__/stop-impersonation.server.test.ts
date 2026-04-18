import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STATIC_ORIGINS } from '@corates/workers/config/origins';
import { handlePost } from '../stop-impersonation';

const TRUSTED_ORIGIN = STATIC_ORIGINS[0];

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

describe('POST /api/admin/stop-impersonation - CSRF', () => {
  it('rejects with 403 + AUTH_FORBIDDEN/missing_origin when no Origin or Referer', async () => {
    const res = await handlePost({ request: req({ cookie: 'session=token' }) });
    expect(res.status).toBe(403);
    const body = await readJson(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect((body.details as { reason?: string })?.reason).toBe('missing_origin');
    expect(mockAuthHandler).not.toHaveBeenCalled();
  });

  it('rejects with 403 + AUTH_FORBIDDEN/untrusted_origin when Origin is not allowed', async () => {
    const res = await handlePost({
      request: req({ cookie: 'session=token', origin: 'https://evil.example.com' }),
    });
    expect(res.status).toBe(403);
    const body = await readJson(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
    const details = body.details as { reason?: string; origin?: string };
    expect(details.reason).toBe('untrusted_origin');
    expect(details.origin).toBe('https://evil.example.com');
    expect(mockAuthHandler).not.toHaveBeenCalled();
  });

  it('accepts when Origin is trusted', async () => {
    const res = await handlePost({
      request: req({ cookie: 'session=token', origin: TRUSTED_ORIGIN }),
    });
    expect(res.status).toBe(200);
    expect(mockAuthHandler).toHaveBeenCalledTimes(1);
  });

  it('accepts when only Referer is trusted (no Origin)', async () => {
    const res = await handlePost({
      request: req({ cookie: 'session=token', referer: `${TRUSTED_ORIGIN}/admin` }),
    });
    expect(res.status).toBe(200);
    expect(mockAuthHandler).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/admin/stop-impersonation - request forwarding', () => {
  it('forwards cookie/origin/referer + accept=json to better-auth and uses POST + correct path', async () => {
    const cookie = 'session=test-token; other=value';
    await handlePost({
      request: req({ cookie, origin: TRUSTED_ORIGIN, referer: `${TRUSTED_ORIGIN}/x` }),
    });

    expect(mockAuthHandler).toHaveBeenCalledTimes(1);
    const forwarded = mockAuthHandler.mock.calls[0][0]!;
    expect(forwarded).toBeInstanceOf(Request);
    expect(forwarded.method).toBe('POST');
    const fwdUrl = new URL(forwarded.url);
    expect(fwdUrl.pathname).toBe('/api/auth/admin/stop-impersonating');
    expect(forwarded.headers.get('cookie')).toBe(cookie);
    expect(forwarded.headers.get('origin')).toBe(TRUSTED_ORIGIN);
    expect(forwarded.headers.get('referer')).toBe(`${TRUSTED_ORIGIN}/x`);
    expect(forwarded.headers.get('accept')).toBe('application/json');
  });

  it('returns better-auth response verbatim on success', async () => {
    mockAuthHandler.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, message: 'Impersonation stopped' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const res = await handlePost({
      request: req({ cookie: 'session=t', origin: TRUSTED_ORIGIN }),
    });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Impersonation stopped');
  });
});

describe('POST /api/admin/stop-impersonation - error path', () => {
  it('returns 500 with friendly error when better-auth handler throws', async () => {
    mockAuthHandler.mockRejectedValueOnce(new Error('Better Auth service unavailable'));

    const res = await handlePost({
      request: req({ cookie: 'session=t', origin: TRUSTED_ORIGIN }),
    });
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body.error).toBe('Failed to stop impersonation');
  });
});
