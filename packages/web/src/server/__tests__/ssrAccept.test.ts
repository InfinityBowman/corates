import { describe, expect, it } from 'vitest';
import { NOT_ACCEPTABLE_MESSAGE, withAcceptNegotiation } from '@/server/ssrAccept';

const refusal = () =>
  Response.json({ error: 'Only HTML requests are supported here' }, { status: 500 });

describe('withAcceptNegotiation', () => {
  it('rewrites the Accept refusal to 406', async () => {
    const response = await withAcceptNegotiation(refusal());

    expect(response.status).toBe(406);
    await expect(response.json()).resolves.toEqual({ error: NOT_ACCEPTABLE_MESSAGE });
  });

  it('leaves other JSON 500s alone', async () => {
    const response = await withAcceptNegotiation(
      Response.json({ error: 'database unavailable' }, { status: 500 }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'database unavailable' });
  });

  it('leaves HTML error pages alone', async () => {
    const response = await withAcceptNegotiation(
      new Response('<html>boom</html>', { status: 500, headers: { 'content-type': 'text/html' } }),
    );

    expect(response.status).toBe(500);
  });

  it('passes successful responses through untouched', async () => {
    const ok = new Response('<html>page</html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });

    expect(await withAcceptNegotiation(ok)).toBe(ok);
  });
});
