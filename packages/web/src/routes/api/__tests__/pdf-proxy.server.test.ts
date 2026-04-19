import { afterEach, describe, expect, it, vi } from 'vitest';
import { handler as pdfProxyHandler } from '../pdf-proxy';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function jsonReq(body: unknown): Request {
  return new Request('http://localhost/api/pdf-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/pdf-proxy', () => {
  it('returns 400 when url is missing', async () => {
    const res = await pdfProxyHandler({ request: jsonReq({}) });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('URL is required');
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
      const res = await pdfProxyHandler({ request: jsonReq({ url }) });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe('SSRF_BLOCKED');
    }
  });

  it('returns PDF bytes on happy path', async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
    globalThis.fetch = vi.fn(
      async () =>
        new Response(pdfBytes, {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        }),
    ) as unknown as typeof fetch;

    const res = await pdfProxyHandler({
      request: jsonReq({ url: 'https://arxiv.org/pdf/1234.5678.pdf' }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    const buf = await res.arrayBuffer();
    expect(new Uint8Array(buf)).toEqual(pdfBytes);
  });

  it('detects auth-wall redirects and returns 403', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://arxiv.org/login?return=/pdf/x.pdf' },
        }),
    ) as unknown as typeof fetch;

    const res = await pdfProxyHandler({
      request: jsonReq({ url: 'https://arxiv.org/pdf/1234.5678.pdf' }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('AUTH_REQUIRED');
  });

  it('returns 400 when remote returns non-PDF content-type (non-html)', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response('plain text', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
    ) as unknown as typeof fetch;

    const res = await pdfProxyHandler({
      request: jsonReq({ url: 'https://arxiv.org/pdf/1234.5678.pdf' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('URL did not return a PDF');
  });

  it('returns 403 when remote returns HTML (login page)', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response('<html>login</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    ) as unknown as typeof fetch;

    const res = await pdfProxyHandler({
      request: jsonReq({ url: 'https://arxiv.org/pdf/1234.5678.pdf' }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('AUTH_REQUIRED');
  });
});
