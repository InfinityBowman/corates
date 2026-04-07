/**
 * Regression tests for ProjectDoc RPC methods.
 *
 * C1: RPC mutations must be durable immediately (no debouncing window).
 *     Now satisfied by synchronous SQL INSERT in the doc.on('update') handler
 *     -- every Y.Doc mutation, including those from RPC methods, persists
 *     inline before the RPC call returns.
 *
 * I1: syncProject member replacement must be transactional (no partial state).
 *     This is a Y.Doc-level transaction, not a SQL transaction -- the Yjs
 *     `doc.transact(...)` call in syncProject ensures all member deletes +
 *     inserts fire as a single observable change.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env, runInDurableObject } from 'cloudflare:test';
import * as Y from 'yjs';
import { clearProjectDOs } from '@/__tests__/helpers.js';
import type { ProjectDoc } from '../ProjectDoc.js';

vi.mock('@/auth/config.js', () => {
  const mockVerifyAuth = vi.fn(async () => ({
    user: { id: 'user-1', email: 'test@example.com' },
  }));

  return {
    verifyAuth: mockVerifyAuth,
    __mockVerifyAuth: mockVerifyAuth,
  };
});

describe('ProjectDoc RPC Persistence', () => {
  const projectId = 'rpc-persist-test';

  beforeEach(async () => {
    await clearProjectDOs([projectId]);
    vi.clearAllMocks();
  });

  function getStub() {
    const doName = `project:${projectId}`;
    const id = env.PROJECT_DOC.idFromName(doName);
    return env.PROJECT_DOC.get(id);
  }

  /**
   * Rebuild a Y.Doc by reading all rows from the `yjs_updates` table in seq
   * order and applying each one. BLOB columns come back as ArrayBuffer and
   * must be wrapped with `new Uint8Array(...)` before handing to Yjs.
   */
  function decodeYDocFromStorage(state: DurableObjectState): Y.Doc {
    const doc = new Y.Doc();
    const cursor = state.storage.sql.exec<{ payload: ArrayBuffer }>(
      'SELECT payload FROM yjs_updates ORDER BY seq',
    );
    for (const row of cursor) {
      Y.applyUpdate(doc, new Uint8Array(row.payload));
    }
    return doc;
  }

  describe('C1: RPC persistence with no WebSocket connections', () => {
    it('syncMember(add) should persist to storage when no connections exist', async () => {
      const stub = getStub();

      await stub.syncMember('add', {
        userId: 'member-1',
        role: 'member',
        joinedAt: Date.now(),
        name: 'Test Member',
        email: 'member@example.com',
        givenName: 'Test',
        familyName: 'Member',
        image: null,
      });

      // Verify the state was persisted to storage
      await runInDurableObject(stub, async (_instance: ProjectDoc, state: DurableObjectState) => {
        const doc = decodeYDocFromStorage(state);
        const membersMap = doc.getMap('members');
        const member = membersMap.get('member-1') as Y.Map<unknown>;
        expect(member).toBeDefined();
        expect(member.get('name')).toBe('Test Member');
        expect(member.get('role')).toBe('member');
      });
    });

    it('syncProject should persist metadata and members to storage', async () => {
      const stub = getStub();

      await stub.syncProject({
        meta: { name: 'Test Project', description: 'A test' },
        members: [
          {
            userId: 'user-a',
            role: 'owner',
            joinedAt: Date.now(),
            name: 'User A',
            email: 'a@test.com',
          },
        ],
      });

      await runInDurableObject(stub, async (_instance: ProjectDoc, state: DurableObjectState) => {
        const doc = decodeYDocFromStorage(state);
        const meta = doc.getMap('meta');
        expect(meta.get('name')).toBe('Test Project');

        const members = doc.getMap('members');
        expect(members.has('user-a')).toBe(true);
      });
    });

    it('syncPdf should persist PDF metadata to storage', async () => {
      const stub = getStub();

      await stub.syncPdf({
        action: 'add',
        studyId: 'study-1',
        studyName: 'Test Study',
        pdf: {
          key: 'r2-key-1',
          fileName: 'paper.pdf',
          size: 1024,
          uploadedBy: 'user-1',
          uploadedAt: new Date().toISOString(),
        },
      });

      await runInDurableObject(stub, async (_instance: ProjectDoc, state: DurableObjectState) => {
        const doc = decodeYDocFromStorage(state);
        const reviews = doc.getMap('reviews');
        const study = reviews.get('study-1') as Y.Map<unknown>;
        expect(study).toBeDefined();
        expect(study.get('name')).toBe('Test Study');

        const pdfs = study.get('pdfs') as Y.Map<unknown>;
        expect(pdfs.has('paper.pdf')).toBe(true);
      });
    });
  });

  describe('I1: syncProject member replacement', () => {
    it('should fully replace old members with new members', async () => {
      const stub = getStub();

      // Seed with initial members
      await stub.syncProject({
        members: [
          {
            userId: 'old-user-1',
            role: 'owner',
            name: 'Old User 1',
            email: 'old1@test.com',
          },
          {
            userId: 'old-user-2',
            role: 'member',
            name: 'Old User 2',
            email: 'old2@test.com',
          },
        ],
      });

      // Replace with a completely different set
      await stub.syncProject({
        members: [
          {
            userId: 'new-user-1',
            role: 'owner',
            name: 'New User 1',
            email: 'new1@test.com',
          },
          {
            userId: 'new-user-3',
            role: 'member',
            name: 'New User 3',
            email: 'new3@test.com',
          },
        ],
      });

      await runInDurableObject(stub, async (_instance: ProjectDoc, state: DurableObjectState) => {
        const doc = decodeYDocFromStorage(state);
        const members = doc.getMap('members');

        // Old members must be gone
        expect(members.has('old-user-1')).toBe(false);
        expect(members.has('old-user-2')).toBe(false);

        // New members must be present
        expect(members.has('new-user-1')).toBe(true);
        expect(members.has('new-user-3')).toBe(true);
        expect(members.size).toBe(2);

        // Verify field integrity
        const newUser1 = members.get('new-user-1') as Y.Map<unknown>;
        expect(newUser1.get('role')).toBe('owner');
        expect(newUser1.get('name')).toBe('New User 1');
      });
    });

    it('should handle replacing members with an empty list', async () => {
      const stub = getStub();

      await stub.syncProject({
        members: [
          {
            userId: 'user-to-remove',
            role: 'owner',
            name: 'Remove Me',
            email: 'remove@test.com',
          },
        ],
      });

      await stub.syncProject({ members: [] });

      await runInDurableObject(stub, async (_instance: ProjectDoc, state: DurableObjectState) => {
        const doc = decodeYDocFromStorage(state);
        const members = doc.getMap('members');
        expect(members.size).toBe(0);
      });
    });
  });
});
