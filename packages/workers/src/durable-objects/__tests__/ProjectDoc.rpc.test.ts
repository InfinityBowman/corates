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
import { clearProjectDOs } from '../../__tests__/helpers.js';
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

  // ---------------------------------------------------------------------------
  // getStorageStats: read-only RPC used by the admin dashboard
  // ---------------------------------------------------------------------------
  describe('getStorageStats', () => {
    // Use a fresh project ID per test so we can assert exact row counts and
    // content totals without bleed-over from sibling tests in the same file.
    let statsProjectIdCounter = 0;

    function getStatsStub() {
      statsProjectIdCounter++;
      const doName = `project:stats-test-${statsProjectIdCounter}`;
      const id = env.PROJECT_DOC.idFromName(doName);
      return env.PROJECT_DOC.get(id);
    }

    it('returns zero counts and zero bytes for an empty doc', async () => {
      const stub = getStatsStub();
      // Trigger initialization without making any logical changes. We call
      // syncProject with an empty members list so the doc is initialised but
      // no content lives inside it.
      await stub.syncProject({ members: [] });

      const stats = await stub.getStorageStats();

      expect(stats.content.members).toBe(0);
      expect(stats.content.studies).toBe(0);
      expect(stats.content.checklists).toBe(0);
      expect(stats.content.pdfs).toBe(0);
      // The encoded snapshot of an "empty" doc is non-zero (it carries
      // a state vector header) but it's tiny.
      expect(stats.encodedSnapshotBytes).toBeGreaterThanOrEqual(0);
      expect(stats.encodedSnapshotBytes).toBeLessThan(1024);
      expect(stats.memoryUsagePercent).toBeLessThan(0.01);
    });

    it('returns correct content counts for a populated doc', async () => {
      const stub = getStatsStub();

      // Seed members
      await stub.syncProject({
        meta: { name: 'stats-populated' },
        members: [
          { userId: 'u1', role: 'owner', name: 'Owner', email: 'o@test.com' },
          { userId: 'u2', role: 'member', name: 'Member 1', email: 'm1@test.com' },
          { userId: 'u3', role: 'member', name: 'Member 2', email: 'm2@test.com' },
        ],
      });

      // Seed two studies, each with a PDF
      await stub.syncPdf({
        action: 'add',
        studyId: 'study-1',
        studyName: 'Study 1',
        pdf: {
          key: 'r2-1',
          fileName: 'paper-1.pdf',
          size: 1024,
          uploadedBy: 'u1',
          uploadedAt: new Date().toISOString(),
        },
      });
      await stub.syncPdf({
        action: 'add',
        studyId: 'study-2',
        studyName: 'Study 2',
        pdf: {
          key: 'r2-2',
          fileName: 'paper-2.pdf',
          size: 2048,
          uploadedBy: 'u1',
          uploadedAt: new Date().toISOString(),
        },
      });

      const stats = await stub.getStorageStats();

      expect(stats.content.members).toBe(3);
      expect(stats.content.studies).toBe(2);
      expect(stats.content.pdfs).toBe(2);
      // No checklists were added — syncPdf only creates the study + pdfs
      expect(stats.content.checklists).toBe(0);

      // Row totals should match what's in the table
      expect(stats.rows.total).toBeGreaterThan(0);
      expect(stats.rows.totalBytes).toBe(stats.rows.snapshotBytes + stats.rows.updateBytes);

      // Encoded snapshot should be non-trivial since we have real content
      expect(stats.encodedSnapshotBytes).toBeGreaterThan(50);

      // Timestamps populated
      expect(stats.timestamps.oldestRowAt).not.toBeNull();
      expect(stats.timestamps.newestRowAt).not.toBeNull();
      expect(stats.timestamps.newestRowAt!).toBeGreaterThanOrEqual(stats.timestamps.oldestRowAt!);
    });

    it('reports row breakdown by kind correctly after compaction', async () => {
      const stub = getStatsStub();

      // Force a few rows to accumulate
      for (let i = 0; i < 5; i++) {
        await stub.syncMember('add', {
          userId: `c${i}`,
          role: 'member',
          name: `C${i}`,
          email: `c${i}@test.com`,
        });
      }

      // Stats before compaction: should be all update rows
      const beforeStats = await stub.getStorageStats();
      expect(beforeStats.rows.update).toBeGreaterThan(0);
      expect(beforeStats.rows.snapshot).toBe(0);

      // Manually compact to produce snapshot rows
      await runInDurableObject(stub, async (instance: ProjectDoc, _state) => {
        (instance as unknown as { compact(): void }).compact();
      });

      const afterStats = await stub.getStorageStats();
      expect(afterStats.rows.snapshot).toBeGreaterThan(0);
      expect(afterStats.rows.update).toBe(0);
      expect(afterStats.rows.total).toBe(afterStats.rows.snapshot);
      // Content counts unchanged by compaction (compaction doesn't lose data)
      expect(afterStats.content.members).toBe(beforeStats.content.members);
    });

    it('memoryUsagePercent is encoded size as a percentage of 128 MB', async () => {
      const stub = getStatsStub();
      await stub.syncMember('add', {
        userId: 'mem-pct',
        role: 'owner',
        name: 'Pct Test',
        email: 'p@test.com',
      });

      const stats = await stub.getStorageStats();
      const expected = (stats.encodedSnapshotBytes / (128 * 1024 * 1024)) * 100;
      // Allow tiny floating-point drift
      expect(Math.abs(stats.memoryUsagePercent - expected)).toBeLessThan(1e-9);
    });
  });
});
