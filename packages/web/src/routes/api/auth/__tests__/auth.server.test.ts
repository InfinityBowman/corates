import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleGet as sessionHandler } from '../session';
import { handleGet as verifyEmailHandler } from '../verify-email';
import { handle as catchAllHandler } from '../$';

const { mockAuthHandler, mockGetSession } = vi.hoisted(() => ({
  mockAuthHandler: vi.fn(
    async (_request: Request) => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  ),
  mockGetSession: vi.fn(async (_args: { headers: Headers }) => null as unknown),
}));

vi.mock('@corates/workers/auth-config', () => ({
  createAuth: () => ({
    handler: mockAuthHandler,
    api: { getSession: mockGetSession },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthHandler.mockImplementation(
    async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  );
  mockGetSession.mockResolvedValue(null);
});

describe('GET /api/auth/session', () => {
  it('returns user/session/sessionToken when better-auth returns a session', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'u1', email: 'u1@example.com', name: 'U1' },
      session: { id: 'sess-token-1', userId: 'u1' },
    });

    const res = await sessionHandler({
      request: new Request('http://localhost/api/auth/session', { method: 'GET' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { id: string };
      session: { id: string };
      sessionToken: string;
    };
    expect(body.user.id).toBe('u1');
    expect(body.session.id).toBe('sess-token-1');
    expect(body.sessionToken).toBe('sess-token-1');
  });

  it('returns nulls (200) when no session is present', async () => {
    const res = await sessionHandler({
      request: new Request('http://localhost/api/auth/session', { method: 'GET' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: null; session: null; sessionToken: null };
    expect(body.user).toBeNull();
    expect(body.session).toBeNull();
    expect(body.sessionToken).toBeNull();
  });

  it('swallows getSession errors and returns nulls', async () => {
    mockGetSession.mockRejectedValueOnce(new Error('db down'));

    const res = await sessionHandler({
      request: new Request('http://localhost/api/auth/session', { method: 'GET' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: null; session: null };
    expect(body.user).toBeNull();
    expect(body.session).toBeNull();
  });
});

describe('GET /api/auth/verify-email', () => {
  it('returns success page (200, html) on 2xx and forwards Set-Cookie headers', async () => {
    const upstream = new Response('{"ok":true}', { status: 200 });
    upstream.headers.append('Set-Cookie', 'better-auth.session_token=abc; Path=/');
    upstream.headers.append('Set-Cookie', 'better-auth.session_data=xyz; Path=/');
    mockAuthHandler.mockResolvedValueOnce(upstream);

    const res = await verifyEmailHandler({
      request: new Request('http://localhost/api/auth/verify-email?token=abc', { method: 'GET' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const cookies = res.headers.getSetCookie?.() ?? [];
    expect(cookies).toContain('better-auth.session_token=abc; Path=/');
    expect(cookies).toContain('better-auth.session_data=xyz; Path=/');

    const html = await res.text();
    expect(html).toContain('Email Verified Successfully');
  });

  it('returns failure page (status preserved) on non-2xx', async () => {
    mockAuthHandler.mockResolvedValueOnce(new Response('expired', { status: 400 }));

    const res = await verifyEmailHandler({
      request: new Request('http://localhost/api/auth/verify-email?token=expired', {
        method: 'GET',
      }),
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Email Verification Failed');
  });

  it('returns error page (500) when better-auth throws', async () => {
    mockAuthHandler.mockRejectedValueOnce(new Error('boom'));

    const res = await verifyEmailHandler({
      request: new Request('http://localhost/api/auth/verify-email?token=x', { method: 'GET' }),
    });
    expect(res.status).toBe(500);
    const html = await res.text();
    expect(html).toContain('Something Went Wrong');
  });

  it('forwards the original query string to better-auth', async () => {
    await verifyEmailHandler({
      request: new Request('http://localhost/api/auth/verify-email?token=abc&callbackURL=%2Fhome', {
        method: 'GET',
      }),
    });
    expect(mockAuthHandler).toHaveBeenCalledTimes(1);
    const forwarded = mockAuthHandler.mock.calls[0][0]!;
    const fwdUrl = new URL(forwarded.url);
    expect(fwdUrl.pathname).toBe('/api/auth/verify-email');
    expect(fwdUrl.searchParams.get('token')).toBe('abc');
    expect(fwdUrl.searchParams.get('callbackURL')).toBe('/home');
  });
});

describe('catch-all /api/auth/$', () => {
  it('forwards arbitrary paths (e.g. sign-in/email) to better-auth and returns its response', async () => {
    mockAuthHandler.mockResolvedValueOnce(
      new Response(JSON.stringify({ token: 'jwt' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const res = await catchAllHandler({
      request: new Request('http://localhost/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'pw' }),
      }),
    });
    expect(res.status).toBe(200);
    expect(mockAuthHandler).toHaveBeenCalledTimes(1);

    const forwarded = mockAuthHandler.mock.calls[0][0]!;
    expect(new URL(forwarded.url).pathname).toBe('/api/auth/sign-in/email');
    expect(forwarded.method).toBe('POST');
  });

  it('preserves the query string when forwarding', async () => {
    await catchAllHandler({
      request: new Request(
        'http://localhost/api/auth/callback/google?state=abc&code=xyz',
        { method: 'GET' },
      ),
    });
    const forwarded = mockAuthHandler.mock.calls[0][0]!;
    const fwdUrl = new URL(forwarded.url);
    expect(fwdUrl.pathname).toBe('/api/auth/callback/google');
    expect(fwdUrl.searchParams.get('state')).toBe('abc');
    expect(fwdUrl.searchParams.get('code')).toBe('xyz');
  });

  it('returns 500 with details when better-auth throws', async () => {
    mockAuthHandler.mockRejectedValueOnce(new Error('something went bad'));

    const res = await catchAllHandler({
      request: new Request('http://localhost/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'x@y.com', password: 'pw' }),
      }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; details: string };
    expect(body.error).toBe('Authentication error');
    expect(body.details).toBe('something went bad');
  });
});
