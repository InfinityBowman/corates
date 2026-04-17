import { DurableObject } from 'cloudflare:workers';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { verifyAuth } from '../auth/config';
import { createDb } from '@corates/db/client';
import { projectMembers, projects } from '@corates/db/schema';
import { eq, and } from 'drizzle-orm';
import type { Env } from '../types';

// y-websocket message types
const messageSync = 0;
const messageAwareness = 1;

// Compaction is triggered when the updates table has this many rows
const COMPACTION_ROW_THRESHOLD = 500;
// Opportunistic compaction (on last WebSocket close) only runs above this floor
const OPPORTUNISTIC_COMPACTION_MIN = 50;
// Maximum size in bytes of a single snapshot chunk row. Cloudflare DO SQLite
// has a 2 MB limit on entire row size; we leave headroom for the other columns
// and use 512 KiB chunks. This both keeps row count manageable and stays well
// under the hard limit. Inspired by partykit's storage chunking pattern, which
// uses 128 KiB on top of the legacy KV-style DO storage backend.
const SNAPSHOT_CHUNK_SIZE = 512 * 1024;

/**
 * Convert a Uint8Array to an ArrayBuffer for SQL BLOB binding.
 *
 * `SqlStorageValue` only accepts `ArrayBuffer | string | number | null`, not
 * `Uint8Array`. Yjs encoded updates are `Uint8Array`, so we convert at the
 * bind site. We always allocate a fresh ArrayBuffer to avoid type narrowing
 * issues with `Uint8Array.buffer` being `ArrayBuffer | SharedArrayBuffer`
 * and to guarantee the returned buffer exactly matches the Uint8Array view.
 */
function uint8ArrayToBuffer(u8: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(u8.byteLength);
  new Uint8Array(copy).set(u8);
  return copy;
}

/**
 * Structured logger for persistence events. Kept as an injectable interface
 * so tests can assert against captured calls without needing to spy on
 * `console.*`. The default implementation delegates to `console.warn` /
 * `console.error` with a JSON-serialised context object so the output is
 * greppable in `wrangler tail` and persisted production logs.
 *
 * Note: Durable Objects in this project are not currently instrumented with
 * Sentry (`Sentry.withSentry` only wraps the fetch handler in index.ts).
 * When DO-wide Sentry instrumentation lands as a separate follow-up, these
 * log lines will start flowing to Sentry without any change at the call
 * sites.
 */
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

const defaultLogger: PersistenceLogger = {
  warn(event, ctx) {
    console.warn(`[ProjectDoc] ${event}`, serializeCtx(ctx));
  },
  error(event, ctx) {
    console.error(`[ProjectDoc] ${event}`, serializeCtx(ctx));
  },
};

interface WebSocketAttachment {
  user: { id: string; [key: string]: unknown };
  awarenessClientId: number | null;
}

interface SyncRequestBody {
  meta?: Record<string, unknown>;
  members?: Array<{
    userId: string;
    role: string;
    joinedAt?: string | number;
    name?: string | null;
    email?: string | null;
    givenName?: string | null;
    familyName?: string | null;
    image?: string | null;
  }>;
}

interface SyncMemberBody {
  userId: string;
  role?: string;
  joinedAt?: string | number;
  name?: string | null;
  email?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  image?: string | null;
}

interface SyncPdfBody {
  action: 'add' | 'remove';
  studyId: string;
  studyName?: string;
  pdf?: {
    key: string;
    fileName: string;
    size: number;
    uploadedBy: string;
    uploadedAt: string;
  };
  fileName?: string;
}

interface MemberYMapFields {
  role?: string | null;
  joinedAt?: string | number;
  name?: string | null;
  email?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  image?: string | null;
}

export function buildMemberYMap(fields: MemberYMapFields): Y.Map<unknown> {
  const yMap = new Y.Map<unknown>();
  yMap.set('role', fields.role);
  yMap.set('joinedAt', fields.joinedAt);
  yMap.set('name', fields.name || null);
  yMap.set('email', fields.email || null);
  yMap.set('givenName', fields.givenName || null);
  yMap.set('familyName', fields.familyName || null);
  yMap.set('image', fields.image || null);
  return yMap;
}

interface ProjectInfo {
  id: string;
  meta: Record<string, unknown>;
  members: Array<{ userId: string; [key: string]: unknown }>;
  reviews: Review[];
}

interface Review {
  id: string;
  name?: unknown;
  description?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  checklists: Checklist[];
  pdfs: Pdf[];
}

interface Checklist {
  id: string;
  title?: unknown;
  assignedTo?: unknown;
  status: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  answers: Record<string, unknown>;
}

interface Pdf {
  fileName: string;
  key?: unknown;
  size?: unknown;
  uploadedBy?: unknown;
  uploadedAt?: unknown;
}

/**
 * Result of `ProjectDoc.getStorageStats()`. Used by the admin dashboard
 * to surface DO storage metrics for an individual project.
 *
 * `encodedSnapshotBytes` is the size of `Y.encodeStateAsUpdate(doc)` right
 * now, which is the value that actually matters against the 128 MB DO
 * isolate memory limit. The row-level numbers in `rows` show how the data
 * is currently arranged on disk (snapshot chunks vs incremental updates).
 */
interface ProjectDocStorageStats {
  rows: {
    total: number;
    snapshot: number;
    update: number;
    snapshotBytes: number;
    updateBytes: number;
    totalBytes: number;
  };
  encodedSnapshotBytes: number;
  /** Encoded snapshot size as a percentage of the 128 MB DO isolate memory limit. */
  memoryUsagePercent: number;
  content: {
    members: number;
    studies: number;
    checklists: number;
    pdfs: number;
  };
  timestamps: {
    /** ms since epoch — the created_at of the lowest-seq row, or null if empty. */
    oldestRowAt: number | null;
    /** ms since epoch — the created_at of the highest-seq row, or null if empty. */
    newestRowAt: number | null;
  };
}

/**
 * The 128 MB Cloudflare Workers/DO isolate memory limit. The Y.Doc lives
 * in the JS heap inside this isolate, so encoded snapshot size is bounded
 * by this number minus headroom for the in-memory Y.Doc representation,
 * the encoding buffer during compaction, and runtime overhead. We expose
 * `memoryUsagePercent` against this constant for the admin dashboard.
 *
 * Source: https://developers.cloudflare.com/workers/platform/limits/
 */
const DO_ISOLATE_MEMORY_BYTES = 128 * 1024 * 1024;

/**
 * ProjectDoc Durable Object
 *
 * WARNING: HIGH BLAST RADIUS FILE
 *
 * This file affects ALL real-time collaboration features.
 * Changes here impact:
 * - Y.js document state and sync protocol
 * - Project data persistence (all collaborative edits)
 * - WebSocket connections for all active users
 * - Member authorization for project access
 * - Awareness protocol (user presence indicators)
 *
 * See: packages/docs/guides/yjs-sync.md for architecture details
 *
 * Holds the authoritative Y.Doc for a project with hierarchical structure:
 *
 * Project (this DO)
 *   - meta: Y.Map (project metadata: name, description, createdAt, etc.)
 *   - members: Y.Map (userId => { role, joinedAt })
 *   - reviews: Y.Map (reviewId => {
 *       id, name, description, createdAt, updatedAt,
 *       checklists: Y.Map (checklistId => {
 *         id, title, assignedTo (userId), status, createdAt, updatedAt,
 *         answers: Y.Map (questionKey => { value, notes, updatedAt, updatedBy })
 *       })
 *     })
 */
export class ProjectDoc extends DurableObject<Env> {
  private doc: Y.Doc | null = null;
  private awareness: awarenessProtocol.Awareness | null = null;
  private logger: PersistenceLogger = defaultLogger;

  /**
   * Override the logger. Used by tests to capture persistence events without
   * spying on console. Not used in production.
   */
  _setLoggerForTest(logger: PersistenceLogger): void {
    this.logger = logger;
  }

  /**
   * fetch() is kept only for WebSocket upgrade and the GET / project info path
   */
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');

    try {
      if (upgradeHeader === 'websocket') {
        return await this.handleWebSocket(request);
      }

      // GET returns project-level info (authenticated HTTP)
      if (request.method === 'GET') {
        const { user } = await verifyAuth(request, this.env);
        if (!user) {
          return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const info = await this.getProjectInfo();
        return new Response(JSON.stringify(info), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('ProjectDoc error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // --- RPC Methods (replace fetch-based internal calls) ---

  /**
   * RPC: Sync project metadata and initial members from D1
   */
  async syncProject(data: SyncRequestBody): Promise<void> {
    await this.initializeDoc();

    if (data.meta) {
      const metaMap = this.doc!.getMap('meta');
      for (const [key, value] of Object.entries(data.meta)) {
        if (value !== undefined) {
          metaMap.set(key, value);
        }
      }
    }

    if (data.members && Array.isArray(data.members)) {
      const membersMap = this.doc!.getMap('members');
      const newMembers = data.members;
      this.doc!.transact(() => {
        const existingKeys = Array.from(membersMap.keys());
        for (const key of existingKeys) {
          membersMap.delete(key);
        }
        for (const member of newMembers) {
          membersMap.set(member.userId, buildMemberYMap(member));
        }
      });
    }
  }

  /**
   * RPC: Sync a single member add/update/remove
   */
  async syncMember(action: 'add' | 'update' | 'remove', member: SyncMemberBody): Promise<void> {
    await this.initializeDoc();

    const membersMap = this.doc!.getMap('members');

    if (action === 'add') {
      membersMap.set(member.userId, buildMemberYMap(member));
    } else if (action === 'update') {
      const existingMember = membersMap.get(member.userId) as Y.Map<unknown> | undefined;
      if (existingMember) {
        if (member.role !== undefined) {
          existingMember.set('role', member.role);
        }
        if (member.image !== undefined) {
          existingMember.set('image', member.image);
        }
        if (member.givenName !== undefined) {
          existingMember.set('givenName', member.givenName);
        }
        if (member.familyName !== undefined) {
          existingMember.set('familyName', member.familyName);
        }
        if (member.name !== undefined) {
          existingMember.set('name', member.name);
        }
      }
    } else if (action === 'remove') {
      membersMap.delete(member.userId);
      this.disconnectUser(member.userId, 'membership-revoked');
    }
  }

  /**
   * RPC: Sync PDF metadata for a study
   */
  async syncPdf(data: SyncPdfBody): Promise<void> {
    await this.initializeDoc();

    const { action, studyId, studyName, pdf, fileName } = data;
    const studiesMap = this.doc!.getMap('reviews');
    let studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;

    if (!studyYMap) {
      studyYMap = new Y.Map<unknown>();
      studyYMap.set('name', studyName || 'Untitled Study');
      studyYMap.set('createdAt', Date.now());
      studyYMap.set('updatedAt', Date.now());
      studyYMap.set('checklists', new Y.Map<unknown>());
      studiesMap.set(studyId, studyYMap);
    }

    let pdfsMap = studyYMap.get('pdfs') as Y.Map<unknown> | undefined;
    if (!pdfsMap) {
      pdfsMap = new Y.Map<unknown>();
      studyYMap.set('pdfs', pdfsMap);
    }

    if (action === 'add' && pdf) {
      const pdfYMap = new Y.Map<unknown>();
      pdfYMap.set('key', pdf.key);
      pdfYMap.set('fileName', pdf.fileName);
      pdfYMap.set('size', pdf.size);
      pdfYMap.set('uploadedBy', pdf.uploadedBy);
      pdfYMap.set('uploadedAt', pdf.uploadedAt);
      pdfsMap.set(pdf.fileName, pdfYMap);
    } else if (action === 'remove' && fileName) {
      pdfsMap.delete(fileName);
    }

    studyYMap.set('updatedAt', Date.now());
  }

  /**
   * RPC: Disconnect all WebSocket connections (e.g., project deleted)
   */
  async disconnectAllConnections(reason: string = 'project-deleted'): Promise<void> {
    const closeCode = 1000;
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(closeCode, reason);
      }
    }
  }

  /**
   * RPC: Get project info (replaces GET /)
   */
  async getProjectInfo(): Promise<ProjectInfo> {
    await this.initializeDoc();

    const result: ProjectInfo = {
      id: this.ctx.id.toString(),
      meta: this.yMapToPlain(this.doc!.getMap('meta')) as Record<string, unknown>,
      members: [],
      reviews: [],
    };

    const membersMap = this.doc!.getMap('members');
    for (const [userId, value] of membersMap.entries()) {
      result.members.push({
        userId,
        ...(this.yMapToPlain(value as Y.Map<unknown>) as Record<string, unknown>),
      });
    }

    const reviewsMap = this.doc!.getMap('reviews');
    for (const [reviewId, reviewValue] of reviewsMap.entries()) {
      const reviewYMap = reviewValue as Y.Map<unknown>;
      const reviewData = this.yMapToPlain(reviewYMap) as Record<string, unknown>;
      const review: Review = {
        id: reviewId,
        name: reviewData.name,
        description: reviewData.description,
        createdAt: reviewData.createdAt,
        updatedAt: reviewData.updatedAt,
        checklists: [],
        pdfs: [],
      };

      const checklistsMap = reviewYMap.get('checklists') as Y.Map<unknown> | undefined;
      if (checklistsMap && checklistsMap.entries) {
        for (const [checklistId, checklistValue] of checklistsMap.entries()) {
          const checklistData = this.yMapToPlain(checklistValue as Y.Map<unknown>) as Record<
            string,
            unknown
          >;
          review.checklists.push({
            id: checklistId,
            title: checklistData.title,
            assignedTo: checklistData.assignedTo,
            status: (checklistData.status as string) || 'pending',
            createdAt: checklistData.createdAt,
            updatedAt: checklistData.updatedAt,
            answers: (checklistData.answers as Record<string, unknown>) || {},
          });
        }
      }

      const pdfsMap = reviewYMap.get('pdfs') as Y.Map<unknown> | undefined;
      if (pdfsMap && pdfsMap.entries) {
        for (const [fName, pdfValue] of pdfsMap.entries()) {
          const pdfData = this.yMapToPlain(pdfValue as Y.Map<unknown>) as Record<string, unknown>;
          review.pdfs.push({
            fileName: fName,
            key: pdfData.key,
            size: pdfData.size,
            uploadedBy: pdfData.uploadedBy,
            uploadedAt: pdfData.uploadedAt,
          });
        }
      }

      result.reviews.push(review);
    }

    return result;
  }

  /**
   * RPC: Return DO storage stats for the admin dashboard.
   *
   * Read-only. Computes:
   *  - Row counts and byte totals broken down by `kind` (snapshot vs update)
   *  - The encoded snapshot size of the current in-memory Y.Doc — this is
   *    the value that binds against the 128 MB isolate memory limit, not
   *    the on-disk row totals
   *  - Logical content counts (members, studies, checklists, pdfs)
   *  - Timestamps of the oldest and newest rows for back-of-the-envelope
   *    "how active is this project" questions
   *
   * Initialization is mandatory because computing the encoded size and
   * the logical counts both require an in-memory Y.Doc.
   */
  async getStorageStats(): Promise<ProjectDocStorageStats> {
    await this.initializeDoc();

    // Row-level breakdown by kind. We use a single query so we never read
    // a partial view of the table mid-write. The COALESCE on the SUM
    // protects against the empty-table case where SUM returns NULL.
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

    // Oldest / newest row timestamps for "how stale is this snapshot" view.
    // Two cheap queries on indexed columns.
    const oldest = this.ctx.storage.sql
      .exec<{ created_at: number }>('SELECT created_at FROM yjs_updates ORDER BY seq ASC LIMIT 1')
      .toArray();
    const newest = this.ctx.storage.sql
      .exec<{ created_at: number }>('SELECT created_at FROM yjs_updates ORDER BY seq DESC LIMIT 1')
      .toArray();

    // The number that actually matters: the encoded snapshot size right
    // now. This is what compaction would write and what determines the
    // memory pressure on the next cold load.
    const encodedSnapshotBytes = Y.encodeStateAsUpdate(this.doc!).byteLength;
    const memoryUsagePercent = (encodedSnapshotBytes / DO_ISOLATE_MEMORY_BYTES) * 100;

    // Logical content counts. We walk the doc maps directly rather than
    // routing through the dev export path because we only need counts.
    const membersMap = this.doc!.getMap('members');
    const reviewsMap = this.doc!.getMap('reviews');
    let studies = 0;
    let checklists = 0;
    let pdfs = 0;
    for (const reviewValue of reviewsMap.values()) {
      studies++;
      const reviewYMap = reviewValue as Y.Map<unknown>;
      const checklistsMap = reviewYMap.get('checklists') as Y.Map<unknown> | undefined;
      if (checklistsMap && typeof checklistsMap.entries === 'function') {
        checklists += checklistsMap.size;
      }
      const pdfsMap = reviewYMap.get('pdfs') as Y.Map<unknown> | undefined;
      if (pdfsMap && typeof pdfsMap.entries === 'function') {
        pdfs += pdfsMap.size;
      }
    }

    return {
      rows: {
        total: snapshotRows + updateRows,
        snapshot: snapshotRows,
        update: updateRows,
        snapshotBytes,
        updateBytes,
        totalBytes: snapshotBytes + updateBytes,
      },
      encodedSnapshotBytes,
      memoryUsagePercent,
      content: {
        members: membersMap.size,
        studies,
        checklists,
        pdfs,
      },
      timestamps: {
        oldestRowAt: oldest[0]?.created_at ?? null,
        newestRowAt: newest[0]?.created_at ?? null,
      },
    };
  }

  // --- Dev RPC methods (only callable when DEV_MODE is enabled) ---

  private get devCtx() {
    return {
      doc: this.doc!,
      stateId: this.ctx.id.toString(),
      yMapToPlain: this.yMapToPlain.bind(this),
    };
  }

  async devExport(): Promise<unknown> {
    await this.initializeDoc();
    const devHandlers = await import('./dev-handlers');
    const response = await devHandlers.handleDevExport(this.devCtx);
    return response.json();
  }

  async devImport(data: unknown): Promise<unknown> {
    await this.initializeDoc();
    const devHandlers = await import('./dev-handlers');
    const fakeRequest = {
      json: async () => data,
    };
    const response = await devHandlers.handleDevImport(this.devCtx, fakeRequest as Request);
    return response.json();
  }

  async devPatch(operations: unknown): Promise<unknown> {
    await this.initializeDoc();
    const devHandlers = await import('./dev-handlers');
    const fakeRequest = new Request('https://internal/dev/patch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(operations),
    });
    const response = await devHandlers.handleDevPatch(this.devCtx, fakeRequest);
    return response.json();
  }

  async devReset(): Promise<unknown> {
    await this.initializeDoc();
    const devHandlers = await import('./dev-handlers');
    const response = await devHandlers.handleDevReset(this.devCtx);
    return response.json();
  }

  async devRaw(): Promise<unknown> {
    await this.initializeDoc();
    const devHandlers = await import('./dev-handlers');
    const response = await devHandlers.handleDevRaw(this.devCtx);
    return response.json();
  }

  async devTemplates(): Promise<unknown> {
    const devHandlers = await import('./dev-handlers');
    const response = await devHandlers.handleDevTemplates();
    return response.json();
  }

  async devApplyTemplate(
    template: string,
    mode: string = 'replace',
    userMapping?: Record<string, string>,
  ): Promise<unknown> {
    await this.initializeDoc();
    const devHandlers = await import('./dev-handlers');
    const fakeRequest = new Request(
      `https://internal/dev/apply-template?template=${template}&mode=${mode}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMapping }),
      },
    );
    const response = await devHandlers.handleDevApplyTemplate(this.devCtx, fakeRequest);
    return response.json();
  }

  async devAddStudy(data: unknown): Promise<unknown> {
    await this.initializeDoc();
    const devHandlers = await import('./dev-handlers');
    const fakeRequest = new Request('https://internal/dev/add-study', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const response = await devHandlers.handleDevAddStudy(this.devCtx, fakeRequest);
    return response.json();
  }

  // --- Y.Doc initialization and persistence ---
  //
  // Persistence model: incremental Yjs updates are stored as individual rows
  // in a SQL table. Each Y.Doc update is inserted synchronously. Periodic
  // compaction merges accumulated updates into a single snapshot row to keep
  // cold-load times bounded.
  //
  // See: packages/docs/audits/yjs-persistence-redesign.md

  /**
   * Ensure the yjs_updates table exists. Idempotent across reloads.
   *
   * The `kind` column distinguishes incremental update rows (`'update'`,
   * each row is a self-contained Y.Doc update) from snapshot chunk rows
   * (`'snapshot'`, each row is a slice of one large encoded snapshot
   * spanning multiple consecutive rows). The loader uses `kind` to decide
   * whether to apply a row directly or gather a contiguous run of snapshot
   * chunks and apply them as one reassembled update.
   *
   * For tables created before the `kind` column existed, we ALTER TABLE
   * to add it. SQLite allows `ADD COLUMN ... NOT NULL DEFAULT ...` so
   * existing rows are filled in with the default `'update'` value.
   */
  private ensureSchema(): void {
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS yjs_updates (
         seq        INTEGER PRIMARY KEY AUTOINCREMENT,
         kind       TEXT NOT NULL DEFAULT 'update',
         payload    BLOB NOT NULL,
         created_at INTEGER NOT NULL
       )`,
    );

    // Backfill the kind column on tables created by the previous schema.
    // PRAGMA table_info returns one row per column; we check whether `kind`
    // is among them and add it if not.
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
   * Idempotent: if the table already has rows, the migration is skipped and
   * we just try to clean up the legacy key. If validation or insert fails,
   * the legacy key is preserved for forensics and the call throws to fail
   * the connection loudly.
   */
  private async migrateLegacyState(): Promise<void> {
    // If the table already has rows, assume we've migrated before. Still try
    // to delete the legacy key in case a previous migration partially failed.
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

    // Validate the legacy bytes are decodable before inserting. We'd rather
    // surface corruption here, where we have full context, than later in a
    // normal load.
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
      // Throw so the connection fails loudly. Do NOT delete the legacy key --
      // keep the original bytes for forensic inspection. We use a plain
      // Error here (not createDomainError) because this is an internal
      // failure that propagates through the DO runtime, not an HTTP response
      // payload, and we want a real Error stack trace for debugging.
      // eslint-disable-next-line corates/corates-error-helpers
      throw new Error(`ProjectDoc migration failed for project ${projectId}: legacy state corrupt`);
    }

    // Write the legacy snapshot via the chunking helper so oversized blobs
    // (anything past the per-row 2 MB DO SQLite limit) split cleanly into
    // multiple snapshot rows. Pre-redesign the legacy `yjs-state` value was
    // stored via `state.storage.put`, which has the same 2 MB cell limit, so
    // in practice no legacy blob should exceed it. The chunking is defensive
    // and lets us avoid bricking a DO if anyone hits the edge.
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

    // Only delete the legacy key after the new row is committed. If this
    // fails, next wake will see a populated table and skip straight to the
    // early-return cleanup path above.
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
   * Walks rows in `seq` order, distinguishing two row kinds:
   *
   *   - `'update'` rows are independent Y.Doc updates and are applied
   *     individually with `Y.applyUpdate`.
   *   - `'snapshot'` rows are slices of one larger encoded snapshot. A
   *     contiguous run of `'snapshot'` rows must be concatenated into a
   *     single buffer and applied as one update -- a single chunk on its
   *     own is not a valid Yjs update.
   *
   * The "snapshot run ends" condition is "next row is `'update'`" or end of
   * cursor. This handles the common case where compaction has just produced
   * N snapshot rows and zero or more update rows have been appended since.
   */
  private loadUpdatesIntoDoc(): void {
    if (!this.doc) return;
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
      Y.applyUpdate(this.doc!, combined);
      snapshotChunks = [];
    };

    for (const row of cursor) {
      const bytes = new Uint8Array(row.payload);
      if (row.kind === 'snapshot') {
        snapshotChunks.push(bytes);
      } else {
        flushSnapshot();
        Y.applyUpdate(this.doc, bytes);
      }
    }
    flushSnapshot();
  }

  /**
   * Slice a snapshot blob into chunks bounded by `SNAPSHOT_CHUNK_SIZE`. Used
   * by both compaction and legacy migration so the same code path handles
   * both cases.
   */
  private chunkSnapshot(bytes: Uint8Array): Uint8Array[] {
    if (bytes.length === 0) return [];
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += SNAPSHOT_CHUNK_SIZE) {
      chunks.push(bytes.slice(i, i + SNAPSHOT_CHUNK_SIZE));
    }
    return chunks;
  }

  /**
   * Replace all rows in yjs_updates with a fresh chunked snapshot of the
   * given bytes. Runs inside `transactionSync` so partial failure leaves the
   * pre-existing rows intact.
   *
   * The caller is responsible for producing the snapshot bytes (typically via
   * `Y.encodeStateAsUpdate(doc)` or by passing through legacy migration
   * data).
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

  /**
   * Compact every row in yjs_updates into a fresh chunked snapshot.
   *
   * The full Y.Doc state is encoded once via `Y.encodeStateAsUpdate`, then
   * sliced into `SNAPSHOT_CHUNK_SIZE`-bounded rows so no individual row hits
   * the 2 MB DO SQLite per-row limit. Both the DELETE and the INSERTs run in
   * a single `transactionSync` -- if any INSERT fails (e.g. forced by a test
   * trigger or an underlying storage failure), the transaction rolls back
   * and the pre-compaction rows are preserved untouched.
   *
   * Bails out early if there's nothing meaningfully to compact (zero or one
   * row already, OR a single existing snapshot chunk that already represents
   * a fully-compacted state).
   */
  private compact(): void {
    try {
      // Cheap check first: if there's nothing worth compacting, skip the
      // encode + transaction entirely. We avoid double-compacting a
      // single-row table that was already compacted previously, but allow
      // re-compaction of multi-chunk snapshots since new updates may have
      // landed since the last compaction.
      const counts = this.ctx.storage.sql
        .exec<{ total: number; updates: number }>(
          `SELECT
             COUNT(*) AS total,
             SUM(CASE WHEN kind = 'update' THEN 1 ELSE 0 END) AS updates
           FROM yjs_updates`,
        )
        .one();
      // Nothing or just one row: no point compacting.
      if (counts.total < 2) return;
      // Already a pure snapshot (all rows are kind='snapshot') AND no new
      // updates have arrived since: no point re-encoding.
      if (counts.updates === 0) return;

      if (!this.doc) return;
      const snapshot = Y.encodeStateAsUpdate(this.doc);
      this.writeSnapshotChunked(snapshot);
    } catch (err) {
      this.logger.error('compaction_failed', {
        projectId: this.ctx.id.toString(),
        error: err,
      });
      // Pre-compaction rows are still present (transaction rolled back).
      // Compaction will be retried next time the threshold is crossed.
    }
  }

  /**
   * Check if compaction is warranted after a new row was inserted.
   */
  private maybeCompact(): void {
    const result = this.ctx.storage.sql
      .exec<{ n: number }>('SELECT COUNT(*) AS n FROM yjs_updates')
      .one();
    if (result.n >= COMPACTION_ROW_THRESHOLD) {
      this.compact();
    }
  }

  async initializeDoc(): Promise<void> {
    if (this.doc) return;

    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    this.ensureSchema();
    await this.migrateLegacyState();
    this.loadUpdatesIntoDoc();

    // On doc update: broadcast to connected clients, then persist synchronously.
    // Synchronous persistence means there is no in-memory window where updates
    // could be lost on crash / eviction -- every update received is durable the
    // instant this handler returns.
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);
      this.broadcastBinary(message, origin as WebSocket | null);

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
        // Swallow. The update was broadcast to clients and lives in the
        // in-memory Y.Doc; clients with the update in IndexedDB will re-sync
        // it on reconnect. We do not want a transient SQL error to tear down
        // the sync session.
        return;
      }

      this.maybeCompact();
    });

    // Broadcast awareness updates to all clients. Awareness state is ephemeral
    // (presence indicators) and is deliberately NOT persisted.
    this.awareness.on(
      'update',
      (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
      ) => {
        const changedClients = added.concat(updated, removed);
        if (changedClients.length > 0) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageAwareness);
          encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(this.awareness!, changedClients),
          );
          const message = encoding.toUint8Array(encoder);
          this.broadcastBinary(message, origin as WebSocket | null);
        }
      },
    );
  }

  // --- WebSocket handling (Hibernatable API) ---

  async handleWebSocket(request: Request): Promise<Response> {
    let user: { id: string; [key: string]: unknown } | null = null;

    try {
      const authResult = await verifyAuth(request, this.env);
      user = authResult.user as { id: string; [key: string]: unknown } | null;
    } catch (err) {
      console.error('WebSocket auth error:', err);
    }

    if (!user) {
      return new Response('Authentication required', { status: 401 });
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const projectId = pathParts[3];

    if (!projectId) {
      return new Response('Invalid URL: projectId required', {
        status: 400,
        headers: { 'X-Close-Reason': 'invalid-url' },
      });
    }

    if (!this.env.DB) {
      console.error('No DB binding available for WebSocket auth check');
      return new Response('Server configuration error', { status: 500 });
    }

    const db = createDb(this.env.DB);

    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    if (!project) {
      return new Response('Project not found', {
        status: 404,
        headers: { 'X-Close-Reason': 'project-not-found' },
      });
    }

    const projectMembership = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)))
      .get();

    if (!projectMembership) {
      return new Response('Not a project member', {
        status: 403,
        headers: { 'X-Close-Reason': 'not-a-member' },
      });
    }

    // Sync member to Yjs if not present
    await this.initializeDoc();
    const membersMap = this.doc!.getMap('members');
    const existingMember = membersMap.get(user.id) as Y.Map<unknown> | undefined;
    if (!existingMember) {
      membersMap.set(
        user.id,
        buildMemberYMap({
          role: projectMembership.role,
          joinedAt: Date.now(),
          name: (user.name as string) || null,
          email: (user.email as string) || null,
          givenName: (user.givenName as string) || null,
          familyName: (user.familyName as string) || null,
          image: (user.image as string) || null,
        }),
      );
    } else {
      const storedImage = existingMember.get('image') as string | null;
      const userImage = (user.image as string) || null;
      if (userImage !== storedImage) {
        existingMember.set('image', userImage);
      }
      if (!existingMember.get('name') && user.name) {
        existingMember.set('name', user.name as string);
      }
      if (!existingMember.get('givenName') && user.givenName) {
        existingMember.set('givenName', user.givenName as string);
      }
      if (!existingMember.get('familyName') && user.familyName) {
        existingMember.set('familyName', user.familyName as string);
      }
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept with hibernation support and tag with user ID
    this.ctx.acceptWebSocket(server, ['user:' + user.id]);
    server.serializeAttachment({
      user,
      awarenessClientId: null,
    } satisfies WebSocketAttachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Hibernatable WebSocket API: handle incoming messages
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Doc may not exist after hibernation wake
    await this.initializeDoc();

    try {
      let data: Uint8Array;
      if (message instanceof ArrayBuffer) {
        data = new Uint8Array(message);
      } else {
        console.warn('Received unexpected string WebSocket message');
        return;
      }

      const decoder = decoding.createDecoder(data);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case messageSync: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.readSyncMessage(decoder, encoder, this.doc!, ws);
          if (encoding.length(encoder) > 1) {
            ws.send(encoding.toUint8Array(encoder));
          }
          break;
        }
        case messageAwareness: {
          const awarenessUpdate = decoding.readVarUint8Array(decoder);

          // Capture clientId from the awareness update event instead of
          // manually re-decoding the binary message format
          const attachment = ws.deserializeAttachment() as WebSocketAttachment;
          const needsClientId = attachment && attachment.awarenessClientId === null;

          let capturedClientId: number | null = null;
          const onUpdate =
            needsClientId ?
              ({ added, updated }: { added: number[]; updated: number[]; removed: number[] }) => {
                const ids = [...added, ...updated];
                if (ids.length > 0) capturedClientId = ids[0];
              }
            : null;

          if (onUpdate) this.awareness!.on('update', onUpdate);
          awarenessProtocol.applyAwarenessUpdate(this.awareness!, awarenessUpdate, ws);
          if (onUpdate) this.awareness!.off('update', onUpdate);

          if (capturedClientId !== null && needsClientId) {
            attachment.awarenessClientId = capturedClientId;
            ws.serializeAttachment(attachment);
          }
          break;
        }
        default:
          console.warn('Unknown message type:', messageType);
      }
    } catch (error) {
      console.error('WebSocket message error (ProjectDoc):', error);
    }
  }

  /**
   * Hibernatable WebSocket API: handle close
   */
  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    // Remove awareness state for this client
    await this.initializeDoc();
    const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
    if (attachment && attachment.awarenessClientId != null && this.awareness) {
      awarenessProtocol.removeAwarenessStates(this.awareness, [attachment.awarenessClientId], ws);
    }

    // Opportunistic compaction when the last WebSocket drops. Writes are
    // already durable (synchronous INSERT in the update handler), so there
    // is nothing to flush. We only compact to leave the next cold wake with
    // a cleaner snapshot.
    if (this.ctx.getWebSockets().length === 0) {
      try {
        const result = this.ctx.storage.sql
          .exec<{ n: number }>('SELECT COUNT(*) AS n FROM yjs_updates')
          .one();
        if (result.n >= OPPORTUNISTIC_COMPACTION_MIN) {
          this.compact();
        }
      } catch (err) {
        this.logger.warn('opportunistic_compaction_check_failed', {
          projectId: this.ctx.id.toString(),
          error: err,
        });
      }
    }
  }

  /**
   * Hibernatable WebSocket API: handle errors
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error in ProjectDoc:', error);
    await this.initializeDoc();
    const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
    if (attachment && attachment.awarenessClientId != null && this.awareness) {
      awarenessProtocol.removeAwarenessStates(this.awareness, [attachment.awarenessClientId], ws);
    }
    try {
      ws.close(1011, 'Internal error');
    } catch {
      // Socket may already be closed
    }
  }

  // --- Internal helpers ---

  yMapToPlain(yMap: Y.Map<unknown>): Record<string, unknown> {
    if (!yMap || typeof yMap.toJSON !== 'function') {
      return {};
    }
    return yMap.toJSON();
  }

  /**
   * Broadcast binary message to all connected clients
   */
  broadcastBinary(message: Uint8Array, exclude: WebSocket | null = null): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  /**
   * Disconnect a specific user from WebSocket
   */
  disconnectUser(userId: string, reason: string = 'membership-revoked'): void {
    const closeCode = 1008; // Policy Violation
    const userSockets = this.ctx.getWebSockets('user:' + userId);
    for (const ws of userSockets) {
      const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
      if (attachment && attachment.awarenessClientId != null && this.awareness) {
        awarenessProtocol.removeAwarenessStates(this.awareness, [attachment.awarenessClientId], ws);
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(closeCode, reason);
      }
    }
  }
}
