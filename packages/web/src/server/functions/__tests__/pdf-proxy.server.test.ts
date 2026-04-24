import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxyPdfFetch } from '@/server/functions/pdf-proxy.server';
import type { Session } from '@/server/middleware/auth';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockSession(): Session {
  return {
    user: { id: 'u1', email: 'user@example.com', name: 'User', role: 'user' },
    session: { id: 'sess-1', userId: 'u1' },
  } as Session;
}

describe('proxyPdfFetch', () => {
  it('throws 400 when url is empty', async () => {
    try {
      await proxyPdfFetch(mockSession(), { url: '' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
      const body = (await (err as Response).json()) as { error: string };
      expect(body.error).toBe('URL is required');
    }
  });

  it('blocks SSRF / non-allowlisted URLs', async () => {
    const dangerousUrls = [
      'https://127.0.0.1/admin',
      'https://localhost:8787/api/admin',
      'http://169.254.169.254/latest/meta-data/',
      'https://evil-site.com/malicious.pdf',
      'javascript:alert(1)',
    ];

    for (const url of dangerousUrls) {
      try {
        await proxyPdfFetch(mockSession(), { url });
        expect.unreachable('should have thrown for ' + url);
      } catch (err) {
        expect((err as Response).status).toBe(400);
        const body = (await (err as Response).json()) as { code?: string };
        expect(body.code).toBe('SSRF_BLOCKED');
      }
    }
  });

  it('returns PDF bytes on happy path', async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    globalThis.fetch = vi.fn(
      async () =>
        new Response(pdfBytes, {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        }),
    ) as unknown as typeof fetch;

    const result = await proxyPdfFetch(mockSession(), {
      url: 'https://arxiv.org/pdf/1234.5678.pdf',
    });

    expect(new Uint8Array(result)).toEqual(pdfBytes);
  });

  it('detects auth-wall redirects and throws 403', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://arxiv.org/login?return=/pdf/x.pdf' },
        }),
    ) as unknown as typeof fetch;

    try {
      await proxyPdfFetch(mockSession(), { url: 'https://arxiv.org/pdf/1234.5678.pdf' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(403);
      const body = (await (err as Response).json()) as { code?: string };
      expect(body.code).toBe('AUTH_REQUIRED');
    }
  });

  it('throws 400 when remote returns non-PDF content-type', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response('plain text', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
    ) as unknown as typeof fetch;

    try {
      await proxyPdfFetch(mockSession(), { url: 'https://arxiv.org/pdf/1234.5678.pdf' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
      const body = (await (err as Response).json()) as { error: string };
      expect(body.error).toBe('URL did not return a PDF');
    }
  });

  it('throws 403 when remote returns HTML (login page)', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response('<html>login</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    ) as unknown as typeof fetch;

    try {
      await proxyPdfFetch(mockSession(), { url: 'https://arxiv.org/pdf/1234.5678.pdf' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(403);
      const body = (await (err as Response).json()) as { code?: string };
      expect(body.code).toBe('AUTH_REQUIRED');
    }
  });
});
