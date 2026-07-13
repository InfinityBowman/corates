import { captureError, warn } from '../lib/logger';
import * as Y from 'yjs';

const COMPACTION_ROW_THRESHOLD = 500;
const OPPORTUNISTIC_COMPACTION_MIN = 50;
// 512 KiB chunks keep individual rows well under the 2 MB DO SQLite row limit.
const SNAPSHOT_CHUNK_SIZE = 512 * 1024;
// Updates above this size skip the single-row insert entirely (it would fail
// at the 2 MB SQLite value cap) and are persisted via a forced chunked
// snapshot instead. A large merged offline backlog is the realistic producer
// of oversized updates.
const MAX_UPDATE_ROW_BYTES = 1024 * 1024;

export type PersistResult = 'ok' | 'compact' | 'oversized' | 'failed';

export interface PersistenceLogger {
  warn(event: string, ctx: Record<string, unknown>): void;
  error(event: string, ctx: Record<string, unknown>): void;
}

function serializeCtx(ctx: Record<string, unknown>): string {
  try {
    return JSON.stringify(ctx, (_key, value) => {
      if (value instanceof Error) {
        return { name: value.name, message: value.message, stack: value.stack };
      }
      return value;
    });
  } catch {
    return '[ctx serialization failed]';
  }
}

export const defaultLogger: PersistenceLogger = {
  warn(event, ctx) {
    warn(`[ProjectDoc] ${event}: ${serializeCtx(ctx)}`);
  },
  error(event, ctx) {
    const error = ctx.error;
    if (error instanceof Error) {
      captureError(error, { tags: { component: 'project-doc-persistence' }, extra: ctx });
    } else {
      captureError(new Error(`[ProjectDoc] ${event}`), {
        tags: { component: 'project-doc-persistence' },
        extra: ctx,
      });
    }
  },
};

/**
 * Convert a Uint8Array to an ArrayBuffer for SQL BLOB binding.
 *
 * `SqlStorageValue` only accepts `ArrayBuffer | string | number | null`, not
 * `Uint8Array`. We always allocate a fresh ArrayBuffer to avoid type narrowing
 * issues with `Uint8Array.buffer` being `ArrayBuffer | SharedArrayBuffer`.
 */
function uint8ArrayToBuffer(u8: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(u8.byteLength);
  new Uint8Array(copy).set(u8);
  return copy;
}

interface StorageContext {
  storage: DurableObjectState['storage'];
  id: DurableObjectState['id'];
}

export class ProjectDocPersistence {
  private logger: PersistenceLogger;
  private ctx: StorageContext;
  private rowCount = 0;

  constructor(ctx: StorageContext, logger: PersistenceLogger = defaultLogger) {
    this.ctx = ctx;
    this.logger = logger;
  }

  setLogger(logger: PersistenceLogger): void {
    this.logger = logger;
  }

  /**
   * Ensure the yjs_updates table exists. Idempotent across reloads.
   *
   * The `kind` column distinguishes incremental update rows (`'update'`)
   * from snapshot chunk rows (`'snapshot'`). For tables created before
   * the `kind` column existed, we ALTER TABLE to add it with a default.
   */
  ensureSchema(): void {
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS yjs_updates (
         seq        INTEGER PRIMARY KEY AUTOINCREMENT,
         kind       TEXT NOT NULL DEFAULT 'update',
         payload    BLOB NOT NULL,
         created_at INTEGER NOT NULL
       )`,
    );

    const cols = this.ctx.storage.sql
      .exec<{ name: string }>('PRAGMA table_info(yjs_updates)')
      .toArray();
    const hasKind = cols.some(c => c.name === 'kind');
    if (!hasKind) {
      this.ctx.storage.sql.exec(
        "ALTER TABLE yjs_updates ADD COLUMN kind TEXT NOT NULL DEFAULT 'update'",
      );
    }
  }

  /**
   * Apply all rows from the yjs_updates table to the in-memory Y.Doc.
   *
   * `'update'` rows are applied individually. Contiguous runs of
   * `'snapshot'` rows are concatenated into a single buffer before
   * applying -- a single chunk on its own is not a valid Yjs update.
   */
  loadUpdatesIntoDoc(doc: Y.Doc): void {
    const cursor = this.ctx.storage.sql.exec<{ seq: number; kind: string; payload: ArrayBuffer }>(
      'SELECT seq, kind, payload FROM yjs_updates ORDER BY seq',
    );

    let snapshotChunks: Uint8Array[] = [];
    let count = 0;

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
      count++;
      const bytes = new Uint8Array(row.payload);
      if (row.kind === 'snapshot') {
        snapshotChunks.push(bytes);
      } else {
        flushSnapshot();
        // A corrupt update row must not brick the DO: an unguarded throw here
        // propagates out of initializeDoc, turning EVERY subsequent request
        // (including websocket upgrades) into an internal error until the row
        // is manually removed. Skip the row and report it loudly instead --
        // that one update is lost, but connected clients holding it will
        // re-push it via the sync handshake. Snapshot chunks stay unguarded:
        // a corrupt snapshot means the doc's base state is gone and loading a
        // partial doc would let clients "heal" us into a forked history.
        try {
          Y.applyUpdate(doc, bytes);
        } catch (err) {
          this.logger.error('persistence_corrupt_update_row', {
            projectId: this.ctx.id.toString(),
            seq: row.seq,
            byteLength: bytes.length,
            error: err,
          });
        }
      }
    }
    flushSnapshot();
    this.rowCount = count;
  }

  /**
   * Insert a Y.Doc update row.
   *
   * Returns 'compact' when the row count has crossed the compaction threshold,
   * and 'oversized' / 'failed' when the update was NOT durably stored -- the
   * caller must then persist the full in-memory doc via `forceCompact(doc)`,
   * or the update survives only until the next DO eviction.
   */
  persistUpdate(update: Uint8Array): PersistResult {
    if (update.length > MAX_UPDATE_ROW_BYTES) {
      this.logger.warn('persistence_update_oversized', {
        projectId: this.ctx.id.toString(),
        byteLength: update.length,
      });
      return 'oversized';
    }

    try {
      this.ctx.storage.sql.exec(
        'INSERT INTO yjs_updates (payload, created_at) VALUES (?, ?)',
        uint8ArrayToBuffer(update),
        Date.now(),
      );
      this.rowCount++;
    } catch (err) {
      this.logger.error('persistence_insert_failed', {
        projectId: this.ctx.id.toString(),
        byteLength: update.length,
        error: err,
      });
      return 'failed';
    }

    return this.rowCount >= COMPACTION_ROW_THRESHOLD ? 'compact' : 'ok';
  }

  /**
   * Persist the full in-memory doc as a chunked snapshot, bypassing compact()'s
   * "nothing to do" bail-outs. This is the durability fallback when an
   * individual update could not be stored (oversized or insert failure):
   * the snapshot necessarily contains that update since it was already applied
   * to the in-memory doc. Throwing here would crash the doc update handler
   * mid-transaction, so failures are captured instead; the update then only
   * survives until eviction (pre-existing behavior, now loudly reported).
   */
  forceCompact(doc: Y.Doc): void {
    try {
      const snapshot = Y.encodeStateAsUpdate(doc);
      this.writeSnapshotChunked(snapshot);
    } catch (err) {
      this.logger.error('force_compaction_failed', {
        projectId: this.ctx.id.toString(),
        error: err,
      });
    }
  }

  /**
   * Compact all rows into a fresh chunked snapshot. Bails out if there's
   * nothing to compact (< 2 rows or no update rows). Runs in a
   * transactionSync so partial failure preserves pre-compaction rows.
   */
  compact(doc: Y.Doc): void {
    try {
      if (this.rowCount < 2) return;

      const hasUpdates = this.ctx.storage.sql
        .exec<{ n: number }>(`SELECT COUNT(*) AS n FROM yjs_updates WHERE kind = 'update' LIMIT 1`)
        .one();
      if (hasUpdates.n === 0) return;

      const snapshot = Y.encodeStateAsUpdate(doc);
      this.writeSnapshotChunked(snapshot);
    } catch (err) {
      this.logger.error('compaction_failed', {
        projectId: this.ctx.id.toString(),
        error: err,
      });
    }
  }

  maybeOpportunisticCompact(doc: Y.Doc): void {
    try {
      if (this.rowCount >= OPPORTUNISTIC_COMPACTION_MIN) {
        this.compact(doc);
      }
    } catch (err) {
      this.logger.warn('opportunistic_compaction_check_failed', {
        projectId: this.ctx.id.toString(),
        error: err,
      });
    }
  }

  getRowCount(): number {
    return this.rowCount;
  }

  getRowBreakdown(): {
    snapshot: number;
    update: number;
    snapshotBytes: number;
    updateBytes: number;
  } {
    const breakdown = this.ctx.storage.sql
      .exec<{ kind: string; n: number; bytes: number }>(
        `SELECT kind, COUNT(*) AS n, COALESCE(SUM(LENGTH(payload)), 0) AS bytes
         FROM yjs_updates
         GROUP BY kind`,
      )
      .toArray();

    let snapshotRows = 0;
    let updateRows = 0;
    let snapshotBytes = 0;
    let updateBytes = 0;
    for (const row of breakdown) {
      if (row.kind === 'snapshot') {
        snapshotRows = row.n;
        snapshotBytes = row.bytes;
      } else if (row.kind === 'update') {
        updateRows = row.n;
        updateBytes = row.bytes;
      }
    }
    return { snapshot: snapshotRows, update: updateRows, snapshotBytes, updateBytes };
  }

  getTimestamps(): { oldestRowAt: number | null; newestRowAt: number | null } {
    const oldest = this.ctx.storage.sql
      .exec<{ created_at: number }>('SELECT created_at FROM yjs_updates ORDER BY seq ASC LIMIT 1')
      .toArray();
    const newest = this.ctx.storage.sql
      .exec<{ created_at: number }>('SELECT created_at FROM yjs_updates ORDER BY seq DESC LIMIT 1')
      .toArray();
    return {
      oldestRowAt: oldest[0]?.created_at ?? null,
      newestRowAt: newest[0]?.created_at ?? null,
    };
  }

  private chunkSnapshot(bytes: Uint8Array): Uint8Array[] {
    if (bytes.length === 0) return [];
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += SNAPSHOT_CHUNK_SIZE) {
      chunks.push(bytes.slice(i, i + SNAPSHOT_CHUNK_SIZE));
    }
    return chunks;
  }

  /**
   * Replace all rows with a fresh chunked snapshot. Runs inside
   * `transactionSync` so partial failure leaves pre-existing rows intact.
   */
  private writeSnapshotChunked(snapshot: Uint8Array): void {
    const chunks = this.chunkSnapshot(snapshot);
    const now = Date.now();
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec('DELETE FROM yjs_updates');
      for (const chunk of chunks) {
        this.ctx.storage.sql.exec(
          "INSERT INTO yjs_updates (kind, payload, created_at) VALUES ('snapshot', ?, ?)",
          uint8ArrayToBuffer(chunk),
          now,
        );
      }
    });
    this.rowCount = chunks.length;
  }
}
