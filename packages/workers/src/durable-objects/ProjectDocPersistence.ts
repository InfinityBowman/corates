import * as Y from 'yjs';

const COMPACTION_ROW_THRESHOLD = 500;
const OPPORTUNISTIC_COMPACTION_MIN = 50;
// 512 KiB chunks keep individual rows well under the 2 MB DO SQLite row limit.
const SNAPSHOT_CHUNK_SIZE = 512 * 1024;

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
    console.warn(`[ProjectDoc] ${event}`, serializeCtx(ctx));
  },
  error(event, ctx) {
    console.error(`[ProjectDoc] ${event}`, serializeCtx(ctx));
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
   * Migrate legacy `yjs-state` KV blob into the `yjs_updates` table.
   *
   * Idempotent: if the table already has rows, the migration is skipped.
   * Validates the legacy bytes are decodable before inserting -- if
   * corrupt, throws to fail the connection loudly and preserves the
   * legacy key for forensic inspection.
   *
   * Safe to remove once all production DOs have been woken at least once
   * on the SQL-backed persistence path (i.e. no `yjs-state` KV keys
   * remain in any DO).
   */
  async migrateLegacyState(): Promise<void> {
    const existing = this.ctx.storage.sql
      .exec<{ seq: number }>('SELECT seq FROM yjs_updates LIMIT 1')
      .toArray();
    if (existing.length > 0) {
      try {
        await this.ctx.storage.delete('yjs-state');
      } catch (err) {
        this.logger.warn('migration_legacy_delete_failed', {
          projectId: this.ctx.id.toString(),
          error: err,
        });
      }
      return;
    }

    const legacyState = await this.ctx.storage.get('yjs-state');
    if (!legacyState) return;

    const legacyBytes =
      legacyState instanceof Uint8Array ? legacyState : new Uint8Array(legacyState as number[]);

    try {
      const probeDoc = new Y.Doc();
      Y.applyUpdate(probeDoc, legacyBytes);
      probeDoc.destroy();
    } catch (err) {
      const projectId = this.ctx.id.toString();
      this.logger.error('migration_legacy_state_corrupt', {
        projectId,
        byteLength: legacyBytes.length,
        error: err,
      });
      // eslint-disable-next-line corates/corates-error-helpers
      throw new Error(`ProjectDoc migration failed for project ${projectId}: legacy state corrupt`);
    }

    try {
      this.writeSnapshotChunked(legacyBytes);
    } catch (err) {
      this.logger.error('migration_insert_failed', {
        projectId: this.ctx.id.toString(),
        byteLength: legacyBytes.length,
        error: err,
      });
      throw err;
    }

    try {
      await this.ctx.storage.delete('yjs-state');
    } catch (err) {
      this.logger.warn('migration_legacy_delete_failed', {
        projectId: this.ctx.id.toString(),
        error: err,
      });
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
    const cursor = this.ctx.storage.sql.exec<{ kind: string; payload: ArrayBuffer }>(
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
  }

  /**
   * Insert a Y.Doc update row. Returns true if the row count has crossed
   * the compaction threshold so the caller can trigger `compact(doc)`.
   */
  persistUpdate(update: Uint8Array): boolean {
    try {
      this.ctx.storage.sql.exec(
        'INSERT INTO yjs_updates (payload, created_at) VALUES (?, ?)',
        uint8ArrayToBuffer(update),
        Date.now(),
      );
    } catch (err) {
      this.logger.error('persistence_insert_failed', {
        projectId: this.ctx.id.toString(),
        byteLength: update.length,
        error: err,
      });
      return false;
    }

    const result = this.ctx.storage.sql
      .exec<{ n: number }>('SELECT COUNT(*) AS n FROM yjs_updates')
      .one();
    return result.n >= COMPACTION_ROW_THRESHOLD;
  }

  /**
   * Compact all rows into a fresh chunked snapshot. Bails out if there's
   * nothing to compact (< 2 rows or no update rows). Runs in a
   * transactionSync so partial failure preserves pre-compaction rows.
   */
  compact(doc: Y.Doc): void {
    try {
      const counts = this.ctx.storage.sql
        .exec<{ total: number; updates: number }>(
          `SELECT
             COUNT(*) AS total,
             SUM(CASE WHEN kind = 'update' THEN 1 ELSE 0 END) AS updates
           FROM yjs_updates`,
        )
        .one();
      if (counts.total < 2) return;
      if (counts.updates === 0) return;

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
      const result = this.ctx.storage.sql
        .exec<{ n: number }>('SELECT COUNT(*) AS n FROM yjs_updates')
        .one();
      if (result.n >= OPPORTUNISTIC_COMPACTION_MIN) {
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
    return this.ctx.storage.sql
      .exec<{ n: number }>('SELECT COUNT(*) AS n FROM yjs_updates')
      .one().n;
  }

  getRowBreakdown(): { snapshot: number; update: number; snapshotBytes: number; updateBytes: number } {
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
  }
}
