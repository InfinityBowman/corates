import { DurableObject } from 'cloudflare:workers';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { verifyAuth } from '../auth/config';
import { createDb } from '../db/client';
import { projectMembers, projects } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { Env } from '../types';

// y-websocket message types
const messageSync = 0;
const messageAwareness = 1;

// Debounce interval for persistence (ms)
const PERSIST_DEBOUNCE_MS = 500;

interface WebSocketAttachment {
  user: { id: string; [key: string]: unknown };
  awarenessClientId: number | null;
}

export interface SyncRequestBody {
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

export interface SyncMemberBody {
  userId: string;
  role?: string;
  joinedAt?: string | number;
  name?: string | null;
  email?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  image?: string | null;
}

export interface SyncPdfBody {
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

export interface MemberYMapFields {
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
 * BEFORE MODIFYING:
 * 1. Read: .cursor/rules/yjs-sync.mdc and durable-objects.mdc
 * 2. Run full test suite: cd packages/workers && pnpm test
 * 3. Test with multiple concurrent browser clients
 * 4. Verify WebSocket close codes don't break reconnection
 * 5. Check that member sync updates reflect correctly
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
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistPending = false;

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

    await this.schedulePersistenceIfNoConnections();
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

    await this.schedulePersistenceIfNoConnections();
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
    await this.schedulePersistenceIfNoConnections();
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
    await this.schedulePersistenceIfNoConnections();
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
    await this.schedulePersistenceIfNoConnections();
    return response.json();
  }

  async devReset(): Promise<unknown> {
    await this.initializeDoc();
    const devHandlers = await import('./dev-handlers');
    const response = await devHandlers.handleDevReset(this.devCtx);
    await this.schedulePersistenceIfNoConnections();
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

  async devApplyTemplate(template: string, mode: string = 'replace'): Promise<unknown> {
    await this.initializeDoc();
    const devHandlers = await import('./dev-handlers');
    const fakeRequest = new Request(
      `https://internal/dev/apply-template?template=${template}&mode=${mode}`,
      {
        method: 'POST',
      },
    );
    const response = await devHandlers.handleDevApplyTemplate(this.devCtx, fakeRequest);
    await this.schedulePersistenceIfNoConnections();
    return response.json();
  }

  // --- Y.Doc initialization and persistence ---

  async initializeDoc(): Promise<void> {
    if (!this.doc) {
      this.doc = new Y.Doc();
      this.awareness = new awarenessProtocol.Awareness(this.doc);

      const persistedState = await this.ctx.storage.get<number[]>('yjs-state');
      if (persistedState) {
        Y.applyUpdate(this.doc, new Uint8Array(persistedState));
      }

      // On doc update: broadcast immediately, debounce persistence
      this.doc.on('update', (update: Uint8Array, origin: unknown) => {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        const message = encoding.toUint8Array(encoder);
        this.broadcastBinary(message, origin as WebSocket | null);

        this.schedulePersistence();
      });

      // Broadcast awareness updates to all clients
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
  }

  /**
   * Schedule debounced persistence. While WebSockets are active, the DO stays awake,
   * so setTimeout is safe to use for debouncing.
   */
  private schedulePersistence(): void {
    this.persistPending = true;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.flushPersistence();
    }, PERSIST_DEBOUNCE_MS);
  }

  /**
   * Flush persistence if changes are pending (RPC methods with no connections).
   * Must be awaited -- if the DO evicts before flush completes, mutations are lost.
   */
  private async schedulePersistenceIfNoConnections(): Promise<void> {
    if (this.ctx.getWebSockets().length === 0) {
      await this.flushPersistence();
    }
  }

  /**
   * Write full Y.Doc state to storage
   */
  private async flushPersistence(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (!this.doc) return;
    this.persistPending = false;
    const fullState = Y.encodeStateAsUpdate(this.doc);
    await this.ctx.storage.put('yjs-state', Array.from(fullState));
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
          awarenessProtocol.applyAwarenessUpdate(this.awareness!, awarenessUpdate, ws);

          // Store the client's awareness ID in the attachment
          const awarenessDecoder = decoding.createDecoder(awarenessUpdate);
          const len = decoding.readVarUint(awarenessDecoder);
          if (len > 0) {
            const clientId = decoding.readVarUint(awarenessDecoder);
            const attachment = ws.deserializeAttachment() as WebSocketAttachment;
            if (attachment && attachment.awarenessClientId === null) {
              attachment.awarenessClientId = clientId;
              ws.serializeAttachment(attachment);
            }
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
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        [attachment.awarenessClientId],
        ws,
      );
    }

    // Flush persistence if this was the last connection
    if (this.ctx.getWebSockets().length === 0 && this.persistPending) {
      await this.flushPersistence();
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
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        [attachment.awarenessClientId],
        ws,
      );
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
        awarenessProtocol.removeAwarenessStates(
          this.awareness,
          [attachment.awarenessClientId],
          ws,
        );
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(closeCode, reason);
      }
    }
  }
}
