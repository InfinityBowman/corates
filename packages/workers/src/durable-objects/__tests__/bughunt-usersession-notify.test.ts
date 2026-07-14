/**
 * Bug hunt: UserSession.notify() error isolation.
 *
 * ProjectDoc.broadcastBinary wraps every send in safeSend (readyState check
 * plus try/catch) because in production a socket can look OPEN while its
 * underlying connection is already broken, and send() then throws.
 * UserSession.notify() iterates sockets and calls ws.send() bare -- no
 * try/catch. If any send throws, the whole notify() RPC throws:
 *  - remaining healthy sockets (e.g. a second tab) never receive the message
 *  - the "queue for later" fallback never runs, so the notification is
 *    permanently lost instead of being delivered on the next connect
 *  - the caller (notifyUser in src/lib/notify.ts) swallows the error and
 *    reports success: false, so nothing retries.
 *
 * Reachable path today: user leaves CoRATES open, network dies without a
 * clean close (laptop sleep, wifi drop). Another member triggers a
 * notification (e.g. invitation accepted -> notifyOrgMembers -> stub.notify).
 * The dead socket's send throws and the notification is dropped even though
 * the pendingNotifications queue exists precisely for this situation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import type { UserSession } from '../UserSession.js';

vi.mock('@/auth/config.js', () => ({
  verifyAuth: vi.fn(async () => ({
    user: { id: 'bh-notify-user', email: 'test@example.com' },
  })),
}));

describe('UserSession.notify error isolation (bug hunt)', () => {
  let seq = 0;
  let userId = '';

  beforeEach(async () => {
    seq += 1;
    userId = `bh-notify-user-${seq}`;
    const stub = env.USER_SESSION.get(env.USER_SESSION.idFromName(userId));
    await runInDurableObject(stub, async (_instance: UserSession, state: DurableObjectState) => {
      await state.storage.deleteAll();
    });
    vi.clearAllMocks();
  });

  function getStub() {
    return env.USER_SESSION.get(env.USER_SESSION.idFromName(userId));
  }

  it('delivers to the healthy socket (or queues) when another socket send throws', async () => {
    const stub = getStub();

    await runInDurableObject(stub, async (instance: UserSession, state: DurableObjectState) => {
      const received: string[] = [];

      // A socket whose connection died without a clean close: readyState
      // still reports OPEN but send() throws (the exact condition ProjectDoc
      // defends against with safeSend).
      const brokenWs = {
        readyState: WebSocket.OPEN,
        send() {
          throw new Error('broken pipe');
        },
      } as unknown as WebSocket;

      // The same user's second tab, healthy.
      const goodWs = {
        readyState: WebSocket.OPEN,
        send(data: string) {
          received.push(data);
        },
      } as unknown as WebSocket;

      const originalGetWebSockets = state.getWebSockets.bind(state);
      state.getWebSockets = ((tag?: string) => {
        if (!tag) return [brokenWs, goodWs];
        return originalGetWebSockets(tag);
      }) as typeof state.getWebSockets;

      let threw: unknown = null;
      try {
        await instance.notify({ type: 'project_added', projectId: 'p-1' });
      } catch (err) {
        threw = err;
      }
      state.getWebSockets = originalGetWebSockets;

      const pending =
        ((await state.storage.get('pendingNotifications')) as unknown[] | undefined) ?? [];

      // The notification must not be lost: either the healthy socket got it
      // or it was queued for the next connect. And notify() must not throw.
      expect(threw).toBeNull();
      expect(received.length > 0 || pending.length > 0).toBe(true);
    });
  });

  it('falls back to the pending queue when the only socket send throws', async () => {
    const stub = getStub();

    await runInDurableObject(stub, async (instance: UserSession, state: DurableObjectState) => {
      const brokenWs = {
        readyState: WebSocket.OPEN,
        send() {
          throw new Error('broken pipe');
        },
      } as unknown as WebSocket;

      const originalGetWebSockets = state.getWebSockets.bind(state);
      state.getWebSockets = ((tag?: string) => {
        if (!tag) return [brokenWs];
        return originalGetWebSockets(tag);
      }) as typeof state.getWebSockets;

      let threw: unknown = null;
      let result: { success: boolean; delivered: boolean } | null = null;
      try {
        result = await instance.notify({ type: 'project_added', projectId: 'p-2' });
      } catch (err) {
        threw = err;
      }
      state.getWebSockets = originalGetWebSockets;

      const pending =
        ((await state.storage.get('pendingNotifications')) as unknown[] | undefined) ?? [];

      // Nothing was actually delivered, so the notification must be queued
      // for the next connect -- that queue is the entire point of the
      // pendingNotifications design.
      expect(threw).toBeNull();
      expect(result?.delivered ?? false).toBe(false);
      expect(pending.length).toBe(1);
    });
  });
});
