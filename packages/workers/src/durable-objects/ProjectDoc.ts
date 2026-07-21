import { DurableObject } from 'cloudflare:workers';
import { captureError, warn } from '../lib/logger';
import { instrumentDurableObjectWithSentry } from '@sentry/cloudflare';
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
import { ProjectDocPersistence, type PersistenceLogger } from './ProjectDocPersistence';
import { ensureDocContainers } from './ensure-containers';

// y-websocket message types
const messageSync = 0;
const messageAwareness = 1;

interface WebSocketAttachment {
  user: { id: string; [key: string]: unknown };
  awarenessClientId: number | null;
  // Whether we've sent our own sync step 1 to this connection yet (see
  // webSocketMessage). Absent/false on connections opened before this field
  // existed; treated as not-yet-sent.
  serverSyncStep1Sent?: boolean;
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
  type?: unknown;
  outcomeId?: unknown;
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
class ProjectDocBase extends DurableObject<Env> {
  private doc: Y.Doc | null = null;
  private awareness: awarenessProtocol.Awareness | null = null;
  private persistence: ProjectDocPersistence = new ProjectDocPersistence(this.ctx);
  // Set when a durability fallback (forceCompact) failed and the in-memory doc
  // holds state that storage does not; retried on the next update.
  private forceCompactPending = false;

  _setLoggerForTest(logger: PersistenceLogger): void {
    this.persistence.setLogger(logger);
  }

  // Test-only proxies -- tests reach these via type casts to exercise
  // persistence internals through the DO instance.
  private ensureSchema(): void {
    this.persistence.ensureSchema();
  }
  private compact(): void {
    if (this.doc) this.persistence.compact(this.doc);
  }
  /**
   * fetch() is kept only for the WebSocket upgrade. Project info is served by
   * the getProjectInfo() RPC; all other HTTP methods are rejected.
   */
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');

    try {
      if (upgradeHeader === 'websocket') {
        return await this.handleWebSocket(request);
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      captureError(error, { tags: { component: 'project-doc' } });
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
            type: checklistData.type,
            outcomeId: checklistData.outcomeId,
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

    const {
      snapshot: snapshotRows,
      update: updateRows,
      snapshotBytes,
      updateBytes,
    } = this.persistence.getRowBreakdown();
    const { oldestRowAt, newestRowAt } = this.persistence.getTimestamps();

    const encodedSnapshotBytes = Y.encodeStateAsUpdate(this.doc!).byteLength;
    const memoryUsagePercent = (encodedSnapshotBytes / DO_ISOLATE_MEMORY_BYTES) * 100;

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
      timestamps: { oldestRowAt, newestRowAt },
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
    targetOrgId?: string,
  ): Promise<unknown> {
    await this.initializeDoc();
    const devHandlers = await import('./dev-handlers');
    const fakeRequest = new Request(
      `https://internal/dev/apply-template?template=${template}&mode=${mode}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMapping, targetOrgId }),
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

  async initializeDoc(): Promise<void> {
    if (this.doc) return;

    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.awareness.setLocalState(null);
    // The awareness protocol starts a setInterval (every ~3s) that renews
    // the local clock and removes stale peers. This prevents the DO from
    // ever hibernating. We handle peer cleanup in webSocketClose instead.
    clearInterval(
      (this.awareness as unknown as { _checkInterval: ReturnType<typeof setInterval> })
        ._checkInterval,
    );

    this.persistence.ensureSchema();
    try {
      this.persistence.loadUpdatesIntoDoc(this.doc);
    } catch (err) {
      // A corrupt snapshot chunk (the one unguarded load path) means the
      // doc's base state is unreadable. this.doc was already assigned above,
      // so without this reset every later initializeDoc call would early
      // return and silently serve a PARTIAL doc -- clients would then "heal"
      // us into a forked history. Reset so each request retries the load and
      // fails loudly until the storage is repaired.
      this.doc = null;
      this.awareness = null;
      captureError(err, { tags: { component: 'project-doc', action: 'initialize-doc-load' } });
      throw err;
    }

    // After hibernation wake-up, existing WebSocket connections survive but
    // the in-memory Y.Doc was lost. Send sync step 1 to all existing
    // connections so they respond with any state the server might be missing.
    const existingWs = this.ctx.getWebSockets();
    if (existingWs.length > 0) {
      const syncEncoder = encoding.createEncoder();
      encoding.writeVarUint(syncEncoder, messageSync);
      syncProtocol.writeSyncStep1(syncEncoder, this.doc);
      const syncMsg = encoding.toUint8Array(syncEncoder);
      for (const ws of existingWs) {
        this.safeSend(ws, syncMsg);
      }
    }

    // On doc update: persist synchronously FIRST, then broadcast. DO output
    // gates hold outgoing messages behind storage writes initiated before the
    // send, so this ordering means clients only ever observe updates that
    // durably landed -- broadcasting first would let clients see state that a
    // failed write then silently discards.
    //
    // When the single-row insert cannot store the update (oversized -- e.g. a
    // large merged offline backlog -- or an SQL failure), fall back to
    // persisting the full in-memory doc as a chunked snapshot. Without that
    // fallback the update lives only in memory and is silently lost on the
    // next eviction, while unrelated smaller updates persist fine -- which
    // reads as one reviewer's work vanishing. If the fallback itself fails,
    // retry it on every subsequent update instead of waiting for the
    // compaction threshold.
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      const result = this.persistence.persistUpdate(update);
      if (result === 'compact') {
        this.persistence.compact(this.doc!);
      } else if (result === 'oversized' || result === 'failed') {
        this.forceCompactPending = !this.persistence.forceCompact(this.doc!);
      } else if (this.forceCompactPending) {
        this.forceCompactPending = !this.persistence.forceCompact(this.doc!);
      }

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);
      this.broadcastBinary(message, origin as WebSocket | null);
    });

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

    // Backfill lazily-created containers for docs that predate pre-creation.
    // Must run after the update handler above is attached so the migration
    // update is persisted and broadcast like any other write.
    ensureDocContainers(this.doc);
  }

  // --- WebSocket handling (Hibernatable API) ---

  /**
   * Denies a WebSocket upgrade by accepting it and immediately closing with a
   * policy-violation code and reason. A browser WebSocket cannot read HTTP
   * rejection status or headers, so an HTTP 403/404 here is indistinguishable
   * from the server being unreachable; the close reason is the only channel
   * that reaches the client's access-denied handling.
   */
  private rejectWebSocket(reason: string): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    server.close(1008, reason);
    return new Response(null, { status: 101, webSocket: client });
  }

  async handleWebSocket(request: Request): Promise<Response> {
    let user: { id: string; [key: string]: unknown } | null = null;

    try {
      const authResult = await verifyAuth(request, this.env);
      user = authResult.user as { id: string; [key: string]: unknown } | null;
    } catch (err) {
      captureError(err, { tags: { component: 'project-doc', action: 'websocket-auth' } });
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
      captureError(new Error('No DB binding available for WebSocket auth check'), {
        tags: { component: 'project-doc' },
      });
      return new Response('Server configuration error', { status: 500 });
    }

    const db = createDb(this.env.DB);

    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    if (!project) {
      return this.rejectWebSocket('project-deleted');
    }

    const projectMembership = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)))
      .get();

    if (!projectMembership) {
      return this.rejectWebSocket('not-a-member');
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

    // Proactively send the full doc state and awareness to the new client.
    // The reference y-websocket server does this on every connection; our
    // original code relied solely on the client's sync step 1 round-trip.
    // That single-path dependency means any failure in the round-trip
    // (send error, hibernation timing, message ordering) leaves the client
    // stuck forever with no retry. Sending proactively adds a redundant
    // sync path that resolves the client even if its own step 1 is delayed.
    const syncEncoder = encoding.createEncoder();
    encoding.writeVarUint(syncEncoder, messageSync);
    syncProtocol.writeSyncStep2(syncEncoder, this.doc!);
    this.safeSend(server, encoding.toUint8Array(syncEncoder));

    if (this.awareness && this.awareness.getStates().size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, messageAwareness);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(
          this.awareness,
          Array.from(this.awareness.getStates().keys()),
        ),
      );
      this.safeSend(server, encoding.toUint8Array(awarenessEncoder));
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Hibernatable WebSocket API: handle incoming messages
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Doc may not exist after hibernation wake
    await this.initializeDoc();

    try {
      // On the first message from a connection, send our own sync step 1 so the
      // client answers with a sync step 2 carrying any state we lack. Without this
      // pull the server only ever learns client state from live `update`
      // broadcasts, so any change a client made while not actively connected
      // (offline edits, a reconnect window before the socket was live) is never
      // synced and is silently lost (#520). The reference y-websocket server sends
      // sync step 1 on connect; we send it here, on the first inbound message, so
      // the socket is guaranteed OPEN (the post-acceptWebSocket / pre-101 window
      // can drop sends -- which is why the proactive sync step 2 alone is not
      // enough).
      const firstMsgAttachment = ws.deserializeAttachment() as WebSocketAttachment | null;
      if (firstMsgAttachment && !firstMsgAttachment.serverSyncStep1Sent) {
        const syncStep1Encoder = encoding.createEncoder();
        encoding.writeVarUint(syncStep1Encoder, messageSync);
        syncProtocol.writeSyncStep1(syncStep1Encoder, this.doc!);
        this.safeSend(ws, encoding.toUint8Array(syncStep1Encoder));
        firstMsgAttachment.serverSyncStep1Sent = true;
        ws.serializeAttachment(firstMsgAttachment);
      }

      let data: Uint8Array;
      if (message instanceof ArrayBuffer) {
        data = new Uint8Array(message);
      } else {
        warn('Received unexpected string WebSocket message in ProjectDoc');
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
          warn('Unknown WebSocket message type: %s', [String(messageType)]);
      }
    } catch (error) {
      captureError(error, { tags: { component: 'project-doc', action: 'websocket-message' } });
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

    if (this.ctx.getWebSockets().length === 0 && this.doc) {
      this.persistence.maybeOpportunisticCompact(this.doc);
    }
  }

  /**
   * Hibernatable WebSocket API: handle errors
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    captureError(error, { tags: { component: 'project-doc', action: 'websocket-error' } });
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

  private safeSend(ws: WebSocket, message: Uint8Array): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(message);
    } catch {
      // Connection already broken; skip silently.
    }
  }

  /**
   * Broadcast binary message to all connected clients
   */
  broadcastBinary(message: Uint8Array, exclude: WebSocket | null = null): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== exclude) {
        this.safeSend(ws, message);
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

export const ProjectDoc = instrumentDurableObjectWithSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN ?? '',
    release: env.CF_VERSION_METADATA?.id,
    environment: env.ENVIRONMENT,
    enabled: !!env.SENTRY_DSN,
    tracesSampleRate: env.ENVIRONMENT === 'production' ? 0.1 : 1.0,
  }),
  ProjectDocBase,
);
// eslint-disable-next-line no-redeclare
export type ProjectDoc = ProjectDocBase;
export type { PersistenceLogger } from './ProjectDocPersistence';
