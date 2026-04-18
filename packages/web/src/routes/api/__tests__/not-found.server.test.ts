import { describe, expect, it } from 'vitest';
import { Route } from '../$';

const handle = Route.options.server!.handlers as unknown as {
  GET: (args: { request: Request }) => Promise<Response>;
  POST: (args: { request: Request }) => Promise<Response>;
};

describe('catch-all /api/$', () => {
  it('returns 404 + SYSTEM_ROUTE_NOT_FOUND JSON for unmatched GET', async () => {
    const res = await handle.GET({
      request: new Request('http://localhost/api/typo', { method: 'GET' }),
    });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as { code: string; details?: { path?: string } };
    expect(body.code).toBe('SYSTEM_ROUTE_NOT_FOUND');
    expect(body.details?.path).toBe('/api/typo');
  });

  it('returns 404 for unmatched POST too (every method funnels through)', async () => {
    const res = await handle.POST({
      request: new Request('http://localhost/api/admin/nonexistent', {
        method: 'POST',
        body: '{}',
      }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string; details?: { path?: string } };
    expect(body.code).toBe('SYSTEM_ROUTE_NOT_FOUND');
    expect(body.details?.path).toBe('/api/admin/nonexistent');
  });
});
