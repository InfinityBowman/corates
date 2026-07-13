/**
 * Persistence layer tests for ProjectDoc.
 *
 * Covers the SQL-backed persistence:
 * - Schema setup
 * - Write path (synchronous INSERT per Y.Doc update)
 * - Cold load path
 * - Compaction (threshold + opportunistic + transactional)
 *
 * Design principle: real SQLite, real DO state, minimal mocks.
 * Failure injection uses real SQL triggers instead of mocking storage.
 *
 * See: packages/docs/audits/yjs-persistence-redesign.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import * as Y from 'yjs';
import { clearProjectDOs } from '../../__tests__/helpers.js';
import type { ProjectDoc, PersistenceLogger } from '../ProjectDoc.js';

vi.mock('@/auth/config.js', () => {
  const mockVerifyAuth = vi.fn(async () => ({
    user: { id: 'user-1', email: 'test@example.com' },
  }));

  return {
    verifyAuth: mockVerifyAuth,
    __mockVerifyAuth: mockVerifyAuth,
  };
});

/**
 * Recording logger for asserting on persistence events without touching
 * console. Tests call `instance._setLoggerForTest(logger)` after the DO has
 * initialised.
 */
interface RecordedLog {
  level: 'warn' | 'error';
  event: string;
  ctx: Record<string, unknown>;
}

function createRecordingLogger(): PersistenceLogger & { logs: RecordedLog[] } {
  const logs: RecordedLog[] = [];
  return {
    logs,
    warn(event, ctx) {
      logs.push({ level: 'warn', event, ctx });
    },
    error(event, ctx) {
      logs.push({ level: 'error', event, ctx });
    },
  };
}

/**
 * Rebuild a Y.Doc from the yjs_updates table.
 *
 * Mirrors the production load logic in `ProjectDoc.loadUpdatesIntoDoc`:
 * walk rows in seq order, applying `'update'` rows individually and
 * concatenating contiguous runs of `'snapshot'` rows before applying.
 *
 * Falls back to treating any row without a `kind` value as `'update'` so
 * this helper still works against tables that pre-date the schema change
 * (used by a couple of tests that seed rows directly).
 */
function loadDocFromTable(state: DurableObjectState): Y.Doc {
  const doc = new Y.Doc();
  const cursor = state.storage.sql.exec<{ kind: string | null; payload: ArrayBuffer }>(
    'SELECT kind, payload FROM yjs_updates ORDER BY seq',
  );

  let snapshotChunks: Uint8Array[] = [];
  const flushSnapshot = (): void => {
    if (snapshotChunks.length === 0) return;
    const total = snapshotChunks.reduce((acc, c) => acc + c.length, 0);
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const c of snapshotChunks) {
      combined.set(c, offset);
      offset += c.length;
    }
    Y.applyUpdate(doc, combined);
    snapshotChunks = [];
  };

  for (const row of cursor) {
    const bytes = new Uint8Array(row.payload);
    if (row.kind === 'snapshot') {
      snapshotChunks.push(bytes);
    } else {
      flushSnapshot();
      Y.applyUpdate(doc, bytes);
    }
  }
  flushSnapshot();
  return doc;
}

function countRows(state: DurableObjectState): number {
  return state.storage.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM yjs_updates').one().n;
}

describe('ProjectDoc Persistence', () => {
  // Each test gets a unique project ID to avoid cross-test contamination.
  // The test framework reuses the DO instance across tests, and our
  // `clearProjectDOs` helper only clears KV storage -- it does NOT clear
  // the SQL `yjs_updates` table. Using a unique ID per test gives each test
  // a fresh DO with an empty table and no leftover in-memory state.
  let projectIdCounter = 0;
  let currentProjectId = '';

  beforeEach(async () => {
    projectIdCounter++;
    currentProjectId = `persist-test-${projectIdCounter}`;
    await clearProjectDOs([currentProjectId]);
    vi.clearAllMocks();
  });

  function getStub() {
    const doName = `project:${currentProjectId}`;
    const id = env.PROJECT_DOC.idFromName(doName);
    return env.PROJECT_DOC.get(id);
  }

  // -------------------------------------------------------------------------
  // Step 0: Framework smoke test
  //
  // Verifies that `state.storage.sql.exec(...)` is accessible inside
  // `runInDurableObject`. No existing test in the suite uses it, so this is
  // the first moment we learn whether cloudflare:test exposes the SQL
  // storage API. If this test fails, the entire testing strategy in the
  // redesign doc needs to be reconsidered.
  // -------------------------------------------------------------------------
  describe('Framework: SQL storage accessibility', () => {
    it('state.storage.sql.exec returns a cursor for a trivial query', async () => {
      const stub = getStub();
      // Force the DO to initialize by making any RPC call
      await stub.syncProject({ meta: { name: 'smoke' } });

      await runInDurableObject(stub, async (_instance: ProjectDoc, state) => {
        const cursor = state.storage.sql.exec<{ n: number }>('SELECT 1 AS n');
        const rows = cursor.toArray();
        expect(rows).toHaveLength(1);
        expect(rows[0].n).toBe(1);
      });
    });

    it('state.storage.sql can CREATE, INSERT, and SELECT a BLOB column', async () => {
      const stub = getStub();
      await stub.syncProject({ meta: { name: 'smoke-blob' } });

      await runInDurableObject(stub, async (_instance: ProjectDoc, state) => {
        state.storage.sql.exec(
          'CREATE TABLE IF NOT EXISTS smoke_blob (id INTEGER PRIMARY KEY, data BLOB NOT NULL)',
        );

        const payload = new Uint8Array([0x01, 0x02, 0x03, 0xff]);
        // BLOB bindings require ArrayBuffer (SqlStorageValue does not include Uint8Array)
        state.storage.sql.exec(
          'INSERT INTO smoke_blob (data) VALUES (?)',
          payload.buffer as ArrayBuffer,
        );

        const rows = state.storage.sql
          .exec<{ data: ArrayBuffer }>('SELECT data FROM smoke_blob')
          .toArray();

        expect(rows).toHaveLength(1);
        const readBack = new Uint8Array(rows[0].data);
        expect(Array.from(readBack)).toEqual([0x01, 0x02, 0x03, 0xff]);

        // Clean up so this doesn't leak into other tests
        state.storage.sql.exec('DROP TABLE smoke_blob');
      });
    });

    it('state.storage.transactionSync rolls back on throw', async () => {
      const stub = getStub();
      await stub.syncProject({ meta: { name: 'smoke-txn' } });

      await runInDurableObject(stub, async (_instance: ProjectDoc, state) => {
        state.storage.sql.exec(
          'CREATE TABLE IF NOT EXISTS smoke_txn (id INTEGER PRIMARY KEY, val INTEGER)',
        );
        state.storage.sql.exec('INSERT INTO smoke_txn (val) VALUES (?)', 1);

        expect(() =>
          state.storage.transactionSync(() => {
            state.storage.sql.exec('INSERT INTO smoke_txn (val) VALUES (?)', 2);
            throw new Error('forced rollback');
          }),
        ).toThrow('forced rollback');

        const rows = state.storage.sql
          .exec<{ val: number }>('SELECT val FROM smoke_txn ORDER BY id')
          .toArray();
        expect(rows).toHaveLength(1);
        expect(rows[0].val).toBe(1);

        state.storage.sql.exec('DROP TABLE smoke_txn');
      });
    });
  });

  // -------------------------------------------------------------------------
  // Yjs encoding format: slice / concat round-trip
  //
  // Foundation test for the chunked-snapshot persistence design. We rely on
  // the property that `Y.encodeStateAsUpdate(doc)` returns a contiguous binary
  // blob with no internal absolute offsets, so it can be sliced into pieces,
  // concatenated back, and applied to a fresh Y.Doc to produce an identical
  // doc. If this property ever breaks, the chunked compaction in `compact()`
  // and the migration path for oversized legacy blobs both stop working.
  //
  // We test multiple chunk sizes including 1-byte chunks to ensure that
  // splitting in the middle of any varint or length-prefixed field is fine.
  // -------------------------------------------------------------------------
  describe('Yjs encoding: slice/concat round-trip', () => {
    function buildPopulatedDoc(): Y.Doc {
      const doc = new Y.Doc();
      const meta = doc.getMap('meta');
      meta.set('name', 'slice-concat-test');
      meta.set('description', 'Document for chunking foundation test');
      meta.set('createdAt', 1700000000000);

      const members = doc.getMap('members');
      for (let i = 0; i < 25; i++) {
        const m = new Y.Map<unknown>();
        m.set('userId', `user-${i}`);
        m.set('role', i === 0 ? 'owner' : 'member');
        m.set('name', `User Number ${i}`);
        m.set('email', `user${i}@example.com`);
        members.set(`user-${i}`, m);
      }

      const reviews = doc.getMap('reviews');
      const study = new Y.Map<unknown>();
      study.set('name', 'Study One');
      study.set('createdAt', 1700000000000);
      const checklists = new Y.Map<unknown>();
      for (let i = 0; i < 5; i++) {
        const c = new Y.Map<unknown>();
        c.set('type', 'amstar2');
        c.set('answer1', 'Yes');
        c.set('answer2', 'No');
        c.set('comment', `Reviewer comment number ${i} with some text`);
        checklists.set(`checklist-${i}`, c);
      }
      study.set('checklists', checklists);
      reviews.set('study-1', study);

      return doc;
    }

    function chunkBytes(bytes: Uint8Array, chunkSize: number): Uint8Array[] {
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < bytes.length; i += chunkSize) {
        chunks.push(bytes.slice(i, i + chunkSize));
      }
      return chunks;
    }

    function concatChunks(chunks: Uint8Array[]): Uint8Array {
      const total = chunks.reduce((acc, c) => acc + c.length, 0);
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
      }
      return out;
    }

    it('concatenated slices are byte-identical to the original encoding', () => {
      const doc = buildPopulatedDoc();
      const original = Y.encodeStateAsUpdate(doc);
      expect(original.length).toBeGreaterThan(100); // sanity: doc is non-trivial

      for (const chunkSize of [1, 7, 64, 256, 1024, original.length]) {
        const chunks = chunkBytes(original, chunkSize);
        const reassembled = concatChunks(chunks);
        expect(reassembled.length).toBe(original.length);
        expect(Array.from(reassembled)).toEqual(Array.from(original));
      }
    });

    it('Y.applyUpdate accepts a reassembled buffer and produces an equivalent doc', () => {
      const original = buildPopulatedDoc();
      const fullState = Y.encodeStateAsUpdate(original);

      // Try a few chunk sizes; the most important is small chunks where
      // boundaries fall in the middle of varints / length-prefixed fields.
      for (const chunkSize of [1, 17, 128, 4096]) {
        const chunks = chunkBytes(fullState, chunkSize);
        const reassembled = concatChunks(chunks);

        const reconstructed = new Y.Doc();
        Y.applyUpdate(reconstructed, reassembled);

        expect(reconstructed.getMap('meta').get('name')).toBe('slice-concat-test');
        expect(reconstructed.getMap('meta').get('description')).toBe(
          'Document for chunking foundation test',
        );

        const members = reconstructed.getMap('members');
        expect(members.size).toBe(25);
        const owner = members.get('user-0') as Y.Map<unknown>;
        expect(owner.get('role')).toBe('owner');
        expect(owner.get('email')).toBe('user0@example.com');

        const reviews = reconstructed.getMap('reviews');
        const study = reviews.get('study-1') as Y.Map<unknown>;
        expect(study.get('name')).toBe('Study One');
        const checklists = study.get('checklists') as Y.Map<unknown>;
        expect(checklists.size).toBe(5);
      }
    });

    it('reassembled doc encodes back to a state vector matching the original', () => {
      const original = buildPopulatedDoc();
      const fullState = Y.encodeStateAsUpdate(original);
      const chunks = chunkBytes(fullState, 64);
      const reassembled = concatChunks(chunks);

      const reconstructed = new Y.Doc();
      Y.applyUpdate(reconstructed, reassembled);

      // Equivalent state vectors mean the two docs are at the same logical
      // position in the CRDT, regardless of internal representation.
      const svOriginal = Y.encodeStateVector(original);
      const svReconstructed = Y.encodeStateVector(reconstructed);
      expect(Array.from(svReconstructed)).toEqual(Array.from(svOriginal));
    });
  });

  // -------------------------------------------------------------------------
  // Schema
  // -------------------------------------------------------------------------
  describe('Schema', () => {
    it('creates the yjs_updates table on first init', async () => {
      const stub = getStub();
      await stub.syncProject({ meta: { name: 'schema-test' } });

      await runInDurableObject(stub, async (_instance, state) => {
        const rows = state.storage.sql
          .exec<{
            name: string;
          }>("SELECT name FROM sqlite_master WHERE type='table' AND name='yjs_updates'")
          .toArray();
        expect(rows).toHaveLength(1);
      });
    });

    it('table has the expected columns', async () => {
      const stub = getStub();
      await stub.syncProject({ meta: { name: 'schema-columns' } });

      await runInDurableObject(stub, async (_instance, state) => {
        const cols = state.storage.sql
          .exec<{ name: string; type: string }>('PRAGMA table_info(yjs_updates)')
          .toArray();
        const byName = new Map(cols.map(c => [c.name, c.type]));
        expect(byName.get('seq')).toBe('INTEGER');
        expect(byName.get('kind')).toBe('TEXT');
        expect(byName.get('payload')).toBe('BLOB');
        expect(byName.get('created_at')).toBe('INTEGER');
      });
    });

    it('ensureSchema adds the kind column to a pre-existing table without it', async () => {
      const stub = getStub();
      await stub.syncProject({ meta: { name: 'schema-backfill' } });

      await runInDurableObject(stub, async (instance, state) => {
        // Simulate the pre-redesign schema by dropping the table and
        // recreating it without the kind column.
        state.storage.sql.exec('DROP TABLE yjs_updates');
        state.storage.sql.exec(
          `CREATE TABLE yjs_updates (
             seq        INTEGER PRIMARY KEY AUTOINCREMENT,
             payload    BLOB NOT NULL,
             created_at INTEGER NOT NULL
           )`,
        );

        // Seed a pre-existing row to prove the ALTER keeps it
        const seedPayload = new Uint8Array([0x00, 0x00]);
        state.storage.sql.exec(
          'INSERT INTO yjs_updates (payload, created_at) VALUES (?, ?)',
          seedPayload.buffer as ArrayBuffer,
          Date.now(),
        );

        // Re-run ensureSchema via the private method. It should ALTER to add
        // the missing column without dropping the seeded row.
        (instance as unknown as { ensureSchema(): void }).ensureSchema();

        const cols = state.storage.sql
          .exec<{ name: string }>('PRAGMA table_info(yjs_updates)')
          .toArray();
        expect(cols.some(c => c.name === 'kind')).toBe(true);

        // Seeded row survives and takes the default kind = 'update'.
        const rows = state.storage.sql
          .exec<{ kind: string }>('SELECT kind FROM yjs_updates')
          .toArray();
        expect(rows).toHaveLength(1);
        expect(rows[0].kind).toBe('update');
      });
    });
  });

  // -------------------------------------------------------------------------
  // Write path: synchronous INSERT per Y.Doc update
  // -------------------------------------------------------------------------
  describe('Write path', () => {
    it('inserts a row when a member is added via RPC', async () => {
      const stub = getStub();

      await stub.syncMember('add', {
        userId: 'w1',
        role: 'owner',
        name: 'Writer 1',
        email: 'w1@test.com',
      });

      await runInDurableObject(stub, async (_instance, state) => {
        expect(countRows(state)).toBeGreaterThanOrEqual(1);
        const doc = loadDocFromTable(state);
        const members = doc.getMap('members');
        expect(members.has('w1')).toBe(true);
      });
    });

    it('inserts multiple rows for multiple successive mutations', async () => {
      const stub = getStub();

      await stub.syncMember('add', {
        userId: 'w1',
        role: 'owner',
        name: 'W1',
        email: 'w1@test.com',
      });
      await stub.syncMember('add', {
        userId: 'w2',
        role: 'member',
        name: 'W2',
        email: 'w2@test.com',
      });
      await stub.syncMember('add', {
        userId: 'w3',
        role: 'member',
        name: 'W3',
        email: 'w3@test.com',
      });

      await runInDurableObject(stub, async (_instance, state) => {
        // Should have at least 3 rows (one per member add). Exact count may
        // be higher if Yjs emits multiple transactions per RPC.
        expect(countRows(state)).toBeGreaterThanOrEqual(3);
        const doc = loadDocFromTable(state);
        const members = doc.getMap('members');
        expect(members.size).toBe(3);
      });
    });

    it('logs an error and continues when INSERT fails', async () => {
      const stub = getStub();
      // Initialise the DO and install a recording logger
      await stub.syncProject({ meta: { name: 'insert-fail' } });
      const logger = createRecordingLogger();

      await runInDurableObject(stub, async (instance, state) => {
        instance._setLoggerForTest(logger);

        // Install a trigger that forces every subsequent INSERT to fail.
        state.storage.sql.exec(
          `CREATE TRIGGER fail_inserts BEFORE INSERT ON yjs_updates
           BEGIN SELECT RAISE(FAIL, 'forced insert failure'); END`,
        );
      });

      // Now mutate the doc. The synchronous INSERT in doc.on('update') will
      // throw, the handler should log and swallow, and the RPC call should
      // still complete.
      await stub.syncMember('add', {
        userId: 'survivor',
        role: 'member',
        name: 'Survivor',
        email: 's@test.com',
      });

      await runInDurableObject(stub, async (_instance, state) => {
        // Drop the trigger so subsequent tests / teardown aren't affected
        state.storage.sql.exec('DROP TRIGGER fail_inserts');
      });

      const failures = logger.logs.filter(
        l => l.level === 'error' && l.event === 'persistence_insert_failed',
      );
      expect(failures.length).toBeGreaterThan(0);
      expect(failures[0].ctx.projectId).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Cold load path
  // -------------------------------------------------------------------------
  describe('Cold load path', () => {
    it('reconstructs state from a single update row', async () => {
      const stub = getStub();
      await stub.syncProject({
        meta: { name: 'cold-load-single' },
        members: [
          {
            userId: 'cl1',
            role: 'owner',
            name: 'CL1',
            email: 'cl1@test.com',
          },
        ],
      });

      await runInDurableObject(stub, async (_instance, state) => {
        const doc = loadDocFromTable(state);
        expect(doc.getMap('meta').get('name')).toBe('cold-load-single');
        expect(doc.getMap('members').has('cl1')).toBe(true);
      });
    });

    it('reconstructs state from many rows applied in seq order', async () => {
      const stub = getStub();
      await stub.syncProject({ meta: { name: 'cold-load-many' } });

      // Make several successive mutations so multiple rows accumulate
      for (let i = 0; i < 5; i++) {
        await stub.syncMember('add', {
          userId: `m${i}`,
          role: 'member',
          name: `Member ${i}`,
          email: `m${i}@test.com`,
        });
      }

      await runInDurableObject(stub, async (_instance, state) => {
        expect(countRows(state)).toBeGreaterThanOrEqual(5);
        const doc = loadDocFromTable(state);
        const members = doc.getMap('members');
        for (let i = 0; i < 5; i++) {
          expect(members.has(`m${i}`)).toBe(true);
        }
      });
    });
  });

  // -------------------------------------------------------------------------
  // Compaction
  // -------------------------------------------------------------------------
  describe('Compaction', () => {
    it('reduces row count to 1 after a manual compact of a small doc', async () => {
      const stub = getStub();
      await stub.syncProject({ meta: { name: 'compact-manual' } });

      // Seed several rows
      for (let i = 0; i < 10; i++) {
        await stub.syncMember('add', {
          userId: `c${i}`,
          role: 'member',
          name: `C${i}`,
          email: `c${i}@test.com`,
        });
      }

      await runInDurableObject(stub, async (instance, state) => {
        const before = countRows(state);
        expect(before).toBeGreaterThan(1);

        // Call compact() via a cast so we can exercise it without waiting
        // for the 500-row threshold.
        (instance as unknown as { compact(): void }).compact();

        // Small doc -> one snapshot chunk -> exactly one row
        const after = countRows(state);
        expect(after).toBe(1);

        // The remaining row is a snapshot row, not an update row
        const kinds = state.storage.sql
          .exec<{ kind: string }>('SELECT kind FROM yjs_updates')
          .toArray();
        expect(kinds).toHaveLength(1);
        expect(kinds[0].kind).toBe('snapshot');

        // State is preserved
        const doc = loadDocFromTable(state);
        const members = doc.getMap('members');
        for (let i = 0; i < 10; i++) {
          expect(members.has(`c${i}`)).toBe(true);
        }
      });
    });

    it('chunks an oversized snapshot across multiple rows', async () => {
      const stub = getStub();
      await stub.syncProject({ meta: { name: 'compact-big' } });

      // Seed enough data so the encoded snapshot comfortably exceeds a
      // single 512 KiB chunk. Each member holds a big string payload so
      // we can push the doc above 1 MB without waiting on thousands of
      // individual writes.
      const bigPayload = 'x'.repeat(10_000); // 10 KB per member
      for (let i = 0; i < 150; i++) {
        await stub.syncMember('add', {
          userId: `big-${i}`,
          role: 'member',
          name: `Big User ${i}`,
          email: `big${i}@test.com`,
          // Stash extra data into the name field — any string slot will do
          image: bigPayload,
        });
      }

      await runInDurableObject(stub, async (instance, state) => {
        (instance as unknown as { compact(): void }).compact();

        const rows = state.storage.sql
          .exec<{
            kind: string;
            size: number;
          }>('SELECT kind, LENGTH(payload) AS size FROM yjs_updates ORDER BY seq')
          .toArray();

        // Expect at least 2 snapshot chunk rows because the encoded state
        // exceeds a single 512 KiB chunk. If this fails, the test data
        // isn't big enough any more and should be grown.
        expect(rows.length).toBeGreaterThan(1);
        expect(rows.every(r => r.kind === 'snapshot')).toBe(true);

        // No single chunk should exceed SNAPSHOT_CHUNK_SIZE bytes
        const SNAPSHOT_CHUNK_SIZE = 512 * 1024;
        for (const r of rows) {
          expect(r.size).toBeLessThanOrEqual(SNAPSHOT_CHUNK_SIZE);
        }

        // State is preserved across the chunked snapshot
        const doc = loadDocFromTable(state);
        const members = doc.getMap('members');
        expect(members.size).toBe(150);
        for (let i = 0; i < 150; i++) {
          expect(members.has(`big-${i}`)).toBe(true);
        }
      });
    });

    it('loads a doc correctly when chunked snapshot rows are followed by new update rows', async () => {
      const stub = getStub();
      await stub.syncProject({ meta: { name: 'compact-plus-updates' } });

      // Seed a chunkable doc
      const bigPayload = 'y'.repeat(10_000);
      for (let i = 0; i < 150; i++) {
        await stub.syncMember('add', {
          userId: `mix-${i}`,
          role: 'member',
          name: `Mix ${i}`,
          email: `mix${i}@test.com`,
          image: bigPayload,
        });
      }

      // Compact to produce snapshot chunk rows
      await runInDurableObject(stub, async (instance, _state) => {
        (instance as unknown as { compact(): void }).compact();
      });

      // Now add more members — these land as kind='update' rows appended
      // after the existing snapshot chunks
      await stub.syncMember('add', {
        userId: 'after-1',
        role: 'member',
        name: 'After 1',
        email: 'after1@test.com',
      });
      await stub.syncMember('add', {
        userId: 'after-2',
        role: 'member',
        name: 'After 2',
        email: 'after2@test.com',
      });

      await runInDurableObject(stub, async (_instance, state) => {
        // Table should contain several snapshot rows + at least 2 update rows
        const rows = state.storage.sql
          .exec<{ kind: string }>('SELECT kind FROM yjs_updates ORDER BY seq')
          .toArray();
        const snapshotCount = rows.filter(r => r.kind === 'snapshot').length;
        const updateCount = rows.filter(r => r.kind === 'update').length;
        expect(snapshotCount).toBeGreaterThan(1);
        expect(updateCount).toBeGreaterThanOrEqual(2);

        // Loading must correctly reassemble snapshots AND then apply updates
        const doc = loadDocFromTable(state);
        const members = doc.getMap('members');
        expect(members.size).toBe(152);
        expect(members.has('after-1')).toBe(true);
        expect(members.has('after-2')).toBe(true);
      });
    });

    it('compact() is a no-op when called twice in a row (no updates in between)', async () => {
      const stub = getStub();
      await stub.syncProject({ meta: { name: 'compact-idempotent' } });

      for (let i = 0; i < 5; i++) {
        await stub.syncMember('add', {
          userId: `idem-${i}`,
          role: 'member',
          name: `I${i}`,
          email: `i${i}@test.com`,
        });
      }

      await runInDurableObject(stub, async (instance, state) => {
        const compact = (instance as unknown as { compact(): void }).compact.bind(instance);
        compact();
        const firstRows = state.storage.sql
          .exec<{ seq: number }>('SELECT seq FROM yjs_updates ORDER BY seq')
          .toArray();

        compact(); // second call should be a no-op
        const secondRows = state.storage.sql
          .exec<{ seq: number }>('SELECT seq FROM yjs_updates ORDER BY seq')
          .toArray();

        // Row count unchanged AND the seq values are preserved (no new
        // writes happened on the second call).
        expect(secondRows.length).toBe(firstRows.length);
        expect(secondRows.map(r => r.seq)).toEqual(firstRows.map(r => r.seq));
      });
    });

    it('compaction is transactional: rollback preserves all rows on failure', async () => {
      const stub = getStub();
      await stub.syncProject({ meta: { name: 'compact-txn' } });

      // Seed several rows
      for (let i = 0; i < 10; i++) {
        await stub.syncMember('add', {
          userId: `t${i}`,
          role: 'member',
          name: `T${i}`,
          email: `t${i}@test.com`,
        });
      }

      const logger = createRecordingLogger();

      await runInDurableObject(stub, async (instance, state) => {
        instance._setLoggerForTest(logger);

        const rowsBefore = countRows(state);
        expect(rowsBefore).toBeGreaterThan(1);

        // Install a trigger that forces the compaction INSERT to fail
        // (but leaves the SELECT/DELETE portion of the transaction alone).
        state.storage.sql.exec(
          `CREATE TRIGGER fail_compaction_insert BEFORE INSERT ON yjs_updates
           BEGIN SELECT RAISE(FAIL, 'forced compaction failure'); END`,
        );

        (instance as unknown as { compact(): void }).compact();

        // Clean up trigger
        state.storage.sql.exec('DROP TRIGGER fail_compaction_insert');

        // All original rows should still be present because the transaction
        // rolled back (DELETE inside the transaction was undone).
        expect(countRows(state)).toBe(rowsBefore);

        // Doc is still recoverable from the original rows
        const doc = loadDocFromTable(state);
        const members = doc.getMap('members');
        for (let i = 0; i < 10; i++) {
          expect(members.has(`t${i}`)).toBe(true);
        }
      });

      const compactionFailures = logger.logs.filter(
        l => l.level === 'error' && l.event === 'compaction_failed',
      );
      expect(compactionFailures.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Regression: realistic CoRATES-sized document round-trips cleanly
  // -------------------------------------------------------------------------
  describe('Regression', () => {
    it('round-trips a document with many members without inflating storage', async () => {
      const stub = getStub();
      await stub.syncProject({ meta: { name: 'big' } });

      // Seed ~50 members to approximate a busy project
      const members = Array.from({ length: 50 }, (_, i) => ({
        userId: `bulk-${i}`,
        role: i === 0 ? 'owner' : 'member',
        name: `Bulk User ${i}`,
        email: `bulk${i}@test.com`,
      }));

      await stub.syncProject({
        meta: { name: 'big', description: 'Stress test' },
        members,
      });

      await runInDurableObject(stub, async (_instance, state) => {
        const doc = loadDocFromTable(state);
        const loadedMembers = doc.getMap('members');
        expect(loadedMembers.size).toBe(50);

        // Sanity check: total BLOB storage should be a reasonable multiple
        // of the raw Yjs encoding. If `Array.from(fullState)` sneaks back
        // into the code path this assertion catches it because the inflated
        // form would be ~3-4x larger than the raw Yjs encoding.
        const totalBytes = state.storage.sql
          .exec<{
            total: number;
          }>('SELECT COALESCE(SUM(LENGTH(payload)), 0) AS total FROM yjs_updates')
          .one().total;

        const fullState = Y.encodeStateAsUpdate(doc);
        // Allow up to 4x headroom for multiple rows vs one compacted snapshot
        expect(totalBytes).toBeLessThan(fullState.byteLength * 4);
      });
    });
  });
});
