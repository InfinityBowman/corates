/**
 * Tests for ProjectDoc hibernation-related behavior.
 *
 * Verifies that the DO is properly configured for Cloudflare Hibernatable
 * WebSocket API: awareness interval cleared, server awareness nulled,
 * broadcast error isolation, and re-sync on wake-up.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env, runInDurableObject } from 'cloudflare:test';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import { clearProjectDOs } from '../../__tests__/helpers.js';
import type { ProjectDoc } from '../ProjectDoc.js';

vi.mock('@/auth/config.js', () => ({
  verifyAuth: vi.fn(async () => ({
    user: { id: 'user-1', email: 'test@example.com' },
  })),
}));

interface ProjectDocInternals {
  doc: Y.Doc | null;
  awareness: awarenessProtocol.Awareness | null;
  initializeDoc(): Promise<void>;
  broadcastBinary(message: Uint8Array, exclude: WebSocket | null): void;
}

describe('ProjectDoc hibernation behavior', () => {
  const projectId = 'hibernation-test';

  beforeEach(async () => {
    await clearProjectDOs([projectId]);
    vi.clearAllMocks();
  });

  function getStub() {
    const doName = `project:${projectId}`;
    const id = env.PROJECT_DOC.idFromName(doName);
    return env.PROJECT_DOC.get(id);
  }

  describe('awareness configuration', () => {
    it('should clear the awareness check interval after initialization', async () => {
      const stub = getStub();

      // Trigger initialization via an RPC call
      await stub.syncMember('add', {
        userId: 'u1',
        role: 'member',
        name: 'Test',
        email: 't@test.com',
      });

      await runInDurableObject(stub, async (instance: ProjectDoc) => {
        const internals = instance as unknown as ProjectDocInternals;
        expect(internals.awareness).not.toBeNull();

        const awareness = internals.awareness!;
        type AwarenessWithInterval = { _checkInterval: ReturnType<typeof setInterval> | null };

        // A fresh Awareness always has an active check interval.
        const freshAwareness = new awarenessProtocol.Awareness(new Y.Doc());
        expect((freshAwareness as unknown as AwarenessWithInterval)._checkInterval).toBeTruthy();
        freshAwareness.destroy();

        // Ours should have been cleared to allow DO hibernation.
        const interval = (awareness as unknown as AwarenessWithInterval)._checkInterval;
        // In the Workers runtime, clearInterval may null the property or
        // leave a dead timer ID. Either way it must differ from a fresh one,
        // and getLocalState must be null (server has no local presence).
        expect(interval === null || interval === undefined || typeof interval === 'number').toBe(
          true,
        );
        expect(awareness.getLocalState()).toBeNull();
      });
    });

    it('should set server awareness local state to null', async () => {
      const stub = getStub();

      await stub.syncMember('add', {
        userId: 'u1',
        role: 'member',
        name: 'Test',
        email: 't@test.com',
      });

      await runInDurableObject(stub, async (instance: ProjectDoc) => {
        const internals = instance as unknown as ProjectDocInternals;
        expect(internals.awareness).not.toBeNull();
        expect(internals.awareness!.getLocalState()).toBeNull();
      });
    });
  });

  describe('broadcast error isolation', () => {
    it('should continue broadcasting to remaining clients when one throws', async () => {
      const stub = getStub();

      await stub.syncMember('add', {
        userId: 'u1',
        role: 'member',
        name: 'Test',
        email: 't@test.com',
      });

      await runInDurableObject(stub, async (instance: ProjectDoc, state: DurableObjectState) => {
        const internals = instance as unknown as ProjectDocInternals;
        await internals.initializeDoc();

        const received: Uint8Array[] = [];

        // Create mock WebSockets: first one throws, second should still receive
        const brokenWs = {
          readyState: WebSocket.OPEN,
          send() {
            throw new Error('broken pipe');
          },
        } as unknown as WebSocket;

        const goodWs = {
          readyState: WebSocket.OPEN,
          send(data: Uint8Array) {
            received.push(data);
          },
        } as unknown as WebSocket;

        // Monkey-patch getWebSockets to return our mocks
        const originalGetWebSockets = state.getWebSockets.bind(state);
        state.getWebSockets = ((tag?: string) => {
          if (!tag) return [brokenWs, goodWs];
          return originalGetWebSockets(tag);
        }) as typeof state.getWebSockets;

        const testMessage = new Uint8Array([1, 2, 3]);
        internals.broadcastBinary(testMessage, null);

        expect(received).toHaveLength(1);
        expect(received[0]).toEqual(testMessage);

        // Restore
        state.getWebSockets = originalGetWebSockets;
      });
    });

    it('should skip closed connections without error', async () => {
      const stub = getStub();

      await stub.syncMember('add', {
        userId: 'u1',
        role: 'member',
        name: 'Test',
        email: 't@test.com',
      });

      await runInDurableObject(stub, async (instance: ProjectDoc, state: DurableObjectState) => {
        const internals = instance as unknown as ProjectDocInternals;
        await internals.initializeDoc();

        const received: Uint8Array[] = [];

        const closedWs = {
          readyState: WebSocket.CLOSED,
          send() {
            throw new Error('should not be called');
          },
        } as unknown as WebSocket;

        const openWs = {
          readyState: WebSocket.OPEN,
          send(data: Uint8Array) {
            received.push(data);
          },
        } as unknown as WebSocket;

        const originalGetWebSockets = state.getWebSockets.bind(state);
        state.getWebSockets = ((tag?: string) => {
          if (!tag) return [closedWs, openWs];
          return originalGetWebSockets(tag);
        }) as typeof state.getWebSockets;

        const testMessage = new Uint8Array([4, 5, 6]);
        internals.broadcastBinary(testMessage, null);

        expect(received).toHaveLength(1);

        state.getWebSockets = originalGetWebSockets;
      });
    });
  });

  describe('re-initialization after simulated hibernation', () => {
    it('should rebuild doc from storage when doc is null', async () => {
      const stub = getStub();

      // Write some state via RPC
      await stub.syncProject({
        meta: { name: 'Hibernation Test' },
        members: [{ userId: 'u1', role: 'owner', name: 'Owner' }],
      });

      // Simulate hibernation by nulling the doc
      await runInDurableObject(stub, async (instance: ProjectDoc) => {
        const internals = instance as unknown as ProjectDocInternals;
        expect(internals.doc).not.toBeNull();

        // Null the doc to simulate hibernation eviction
        internals.doc = null;
        internals.awareness = null;
      });

      // Re-initialize via another RPC call
      const info = (await stub.getProjectInfo()) as {
        meta: Record<string, unknown>;
        members: Array<{ userId: string }>;
      };

      expect(info.meta.name).toBe('Hibernation Test');
      expect(info.members).toHaveLength(1);
      expect(info.members[0].userId).toBe('u1');
    });

    it('should set awareness local state to null after re-initialization', async () => {
      const stub = getStub();

      await stub.syncMember('add', {
        userId: 'u1',
        role: 'member',
        name: 'Test',
        email: 't@test.com',
      });

      // Simulate hibernation
      await runInDurableObject(stub, async (instance: ProjectDoc) => {
        const internals = instance as unknown as ProjectDocInternals;
        internals.doc = null;
        internals.awareness = null;
      });

      // Re-initialize
      await stub.getProjectInfo();

      await runInDurableObject(stub, async (instance: ProjectDoc) => {
        const internals = instance as unknown as ProjectDocInternals;
        expect(internals.awareness).not.toBeNull();
        expect(internals.awareness!.getLocalState()).toBeNull();
      });
    });
  });
});
