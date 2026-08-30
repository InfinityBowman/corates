/**
 * Request correlation across the Durable Object boundary.
 *
 * AsyncLocalStorage does not survive `stub.fetch()`, so the calling worker
 * forwards its requestId as a header and the DO reopens a scope from it. This
 * pins both halves: that the header reaches the DO on a rebuilt WebSocket
 * upgrade, and that the ALS scope genuinely does not cross (the reason the
 * header exists at all).
 *
 * `verifyAuth` runs inside the DO with the Request the DO received, which
 * makes it a probe for both without instrumenting production code.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { runWithLogger, getRequestId } from '../../lib/logger';

const seen: Array<{ header: string | null; scopedRequestId: string | undefined }> = [];

vi.mock('../../auth/config', () => ({
  verifyAuth: vi.fn(async (request: Request) => {
    seen.push({
      header: request.headers.get('x-request-id'),
      scopedRequestId: getRequestId(),
    });
    return { user: { id: 'user-do-1', email: 'do@example.com' }, session: null };
  }),
}));

const USER = 'user-do-1';

function upgradeRequest(headers: Record<string, string> = {}) {
  return new Request(`https://internal/api/sessions/${USER}`, {
    headers: {
      Upgrade: 'websocket',
      'Sec-WebSocket-Key': 'test-key',
      'Sec-WebSocket-Version': '13',
      ...headers,
    },
  });
}

function sessionStub() {
  const ns = env.USER_SESSION;
  return ns.get(ns.idFromName(USER));
}

describe('UserSession request correlation', () => {
  beforeEach(() => {
    seen.length = 0;
    vi.clearAllMocks();
  });

  it('adopts a forwarded requestId, and the rebuilt upgrade still completes', async () => {
    // Exactly what packages/web/src/server.ts does before stub.fetch().
    const original = upgradeRequest();
    const headers = new Headers(original.headers);
    headers.set('x-request-id', 'req-abc-123');

    const response = await sessionStub().fetch(new Request(original, { headers }));

    expect(response.status).toBe(101);
    expect(response.webSocket).toBeTruthy();
    expect(seen).toHaveLength(1);
    expect(seen[0].header).toBe('req-abc-123');
    expect(seen[0].scopedRequestId).toBe('req-abc-123');
    // Intentionally leave the upgrade open: closing the client socket triggers
    // UserSession.webSocketClose console logging, which hangs the vitest DO pool.
  });

  it('still opens a scope when no requestId is forwarded', async () => {
    const response = await sessionStub().fetch(upgradeRequest());

    expect(response.status).toBe(101);
    expect(seen).toHaveLength(1);
    expect(seen[0].header).toBeNull();
    expect(seen[0].scopedRequestId).toEqual(expect.any(String));
  });

  it('does not inherit the caller scope implicitly - the header is what carries it', async () => {
    const response = await runWithLogger({ requestId: 'req-als-999' }, async () => {
      expect(getRequestId()).toBe('req-als-999');
      // Deliberately forwarded without the header.
      return sessionStub().fetch(upgradeRequest());
    });

    expect(response.status).toBe(101);
    expect(seen).toHaveLength(1);
    expect(seen[0].scopedRequestId).not.toBe('req-als-999');
  });
});
