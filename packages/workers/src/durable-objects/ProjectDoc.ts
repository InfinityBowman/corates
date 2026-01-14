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

interface SessionData {
  user: { id: string; [key: string]: unknown };
  awarenessClientId: number | null;
}

interface SyncRequestBody {
  meta?: Record<string, unknown>;
  members?: Array<{
    userId: string;
    role: string;
    joinedAt: string | number;
    name?: string | null;
    email?: string | null;
    displayName?: string | null;
    image?: string | null;
  }>;
}

interface SyncMemberRequestBody {
  action: 'add' | 'update' | 'remove';
  member: {
    userId: string;
    role?: string;
    joinedAt?: string | number;
    name?: string | null;
    email?: string | null;
    displayName?: string | null;
    image?: string | null;
  };
}

interface SyncPdfRequestBody {
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

interface RequestWithUser extends Request {
  user?: { id: string; [key: string]: unknown };
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
export class ProjectDoc implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  // Map<WebSocket, { user, awarenessClientId }>
  private sessions: Map<WebSocket, SessionData>;
  private doc: Y.Doc | null;
  private awareness: awarenessProtocol.Awareness | null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.doc = null;
    this.awareness = null;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Note: CORS headers are added by the main worker (index.js) when wrapping responses
    // Do NOT add them here to avoid duplicate headers

    const upgradeHeader = request.headers.get('Upgrade');

    // Check for internal requests (from worker routes)
    const isInternalRequest = request.headers.get('X-Internal-Request') === 'true';

    try {
      // Internal sync endpoints (from D1 routes) - no auth required
      if (isInternalRequest) {
        if (url.pathname === '/sync') {
          return await this.handleSync(request);
        }
        if (url.pathname === '/sync-member') {
          return await this.handleSyncMember(request);
        }
        if (url.pathname === '/sync-pdf') {
          return await this.handleSyncPdf(request);
        }
        if (url.pathname === '/disconnect-all') {
          return await this.handleDisconnectAll();
        }

        // Dev-only endpoints for Yjs state inspection (dynamically imported)
        if (this.env.DEV_MODE) {
          if (url.pathname.startsWith('/dev/')) {
            const devHandlers = await import('./dev-handlers');
            await this.initializeDoc();
            const ctx = {
              doc: this.doc!,
              stateId: this.state.id.toString(),
              yMapToPlain: this.yMapToPlain.bind(this),
            };

            if (url.pathname === '/dev/export') {
              return await devHandlers.handleDevExport(ctx);
            }
            if (url.pathname === '/dev/import') {
              return await devHandlers.handleDevImport(ctx, request);
            }
            if (url.pathname === '/dev/patch') {
              return await devHandlers.handleDevPatch(ctx, request);
            }
            if (url.pathname === '/dev/reset') {
              return await devHandlers.handleDevReset(ctx);
            }
            if (url.pathname === '/dev/raw') {
              return await devHandlers.handleDevRaw(ctx);
            }
            if (url.pathname === '/dev/templates') {
              return await devHandlers.handleDevTemplates();
            }
            if (url.pathname === '/dev/apply-template') {
              return await devHandlers.handleDevApplyTemplate(ctx, request);
            }
          }
        }
      }

      // For HTTP requests verify auth (unless it's an upgrade to websocket)
      const reqWithUser = request as RequestWithUser;
      if (upgradeHeader !== 'websocket') {
        const { user } = await verifyAuth(request, this.env);
        if (!user) {
          return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        reqWithUser.user = user as { id: string; [key: string]: unknown };
      }

      // WebSocket upgrade / real-time sync
      if (upgradeHeader === 'websocket') {
        return await this.handleWebSocket(request);
      }

      // GET returns project-level info (list of checklist ids & metadata)
      if (request.method === 'GET') {
        return await this.getProjectInfo();
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

  /**
   * Handle sync request from D1 routes (project metadata and initial members)
   */
  async handleSync(request: Request): Promise<Response> {
    await this.initializeDoc();

    try {
      const { meta, members } = (await request.json()) as SyncRequestBody;

      // Update meta if provided
      if (meta) {
        const metaMap = this.doc!.getMap('meta');
        for (const [key, value] of Object.entries(meta)) {
          if (value !== undefined) {
            metaMap.set(key, value);
          }
        }
      }

      // Update members if provided (full replacement for initial sync)
      if (members && Array.isArray(members)) {
        const membersMap = this.doc!.getMap('members');
        // Clear existing members and set new ones
        for (const [userId] of membersMap.entries()) {
          membersMap.delete(userId);
        }
        for (const member of members) {
          const memberYMap = new Y.Map<unknown>();
          memberYMap.set('role', member.role);
          memberYMap.set('joinedAt', member.joinedAt);
          memberYMap.set('name', member.name || null);
          memberYMap.set('email', member.email || null);
          memberYMap.set('displayName', member.displayName || null);
          memberYMap.set('image', member.image || null);
          membersMap.set(member.userId, memberYMap);
        }
      }

      // Updates are automatically broadcast via Y.doc update listener

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('handleSync error:', error);
      return new Response(JSON.stringify({ error: 'Sync failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Handle member sync request from D1 routes (add/update/remove single member)
   */
  async handleSyncMember(request: Request): Promise<Response> {
    await this.initializeDoc();

    try {
      const { action, member } = (await request.json()) as SyncMemberRequestBody;
      const membersMap = this.doc!.getMap('members');

      if (action === 'add') {
        const memberYMap = new Y.Map<unknown>();
        memberYMap.set('role', member.role);
        memberYMap.set('joinedAt', member.joinedAt);
        memberYMap.set('name', member.name || null);
        memberYMap.set('email', member.email || null);
        memberYMap.set('displayName', member.displayName || null);
        memberYMap.set('image', member.image || null);
        membersMap.set(member.userId, memberYMap);
      } else if (action === 'update') {
        const existingMember = membersMap.get(member.userId) as Y.Map<unknown> | undefined;
        if (existingMember) {
          // Update role if provided
          if (member.role !== undefined) {
            existingMember.set('role', member.role);
          }
          // Update image if provided
          if (member.image !== undefined) {
            existingMember.set('image', member.image);
          }
          // Update display name if provided
          if (member.displayName !== undefined) {
            existingMember.set('displayName', member.displayName);
          }
          // Update name if provided
          if (member.name !== undefined) {
            existingMember.set('name', member.name);
          }
        }
      } else if (action === 'remove') {
        membersMap.delete(member.userId);
        // Force disconnect the removed user from WebSocket
        this.disconnectUser(member.userId, 'membership-revoked');
      }

      // Updates are automatically broadcast via Y.doc update listener

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('handleSyncMember error:', error);
      return new Response(JSON.stringify({ error: 'Sync failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Handle disconnect-all request (called when project is deleted)
   */
  async handleDisconnectAll(): Promise<Response> {
    this.disconnectAll('project-deleted');
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Handle PDF sync request from routes (add/remove PDF metadata for a study)
   * Note: Y.js map key remains 'reviews' for backward compatibility
   */
  async handleSyncPdf(request: Request): Promise<Response> {
    await this.initializeDoc();

    try {
      const { action, studyId, studyName, pdf, fileName } = (await request.json()) as SyncPdfRequestBody;

      // Note: Y.js map key remains 'reviews' for backward compatibility
      const studiesMap = this.doc!.getMap('reviews');
      let studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;

      // Create the study if it doesn't exist (handles race condition where
      // PDF upload arrives before Y.js sync creates the study)
      if (!studyYMap) {
        studyYMap = new Y.Map<unknown>();
        studyYMap.set('name', studyName || 'Untitled Study');
        studyYMap.set('createdAt', Date.now());
        studyYMap.set('updatedAt', Date.now());
        studyYMap.set('checklists', new Y.Map<unknown>());
        studiesMap.set(studyId, studyYMap);
      }

      // Get or create the pdfs Y.Map for this study
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

      // Update study's updatedAt
      studyYMap.set('updatedAt', Date.now());

      // Updates are automatically broadcast via Y.doc update listener

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('handleSyncPdf error:', error);
      return new Response(JSON.stringify({ error: 'Sync failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  async initializeDoc(): Promise<void> {
    if (!this.doc) {
      this.doc = new Y.Doc();
      this.awareness = new awarenessProtocol.Awareness(this.doc);

      // Load persisted state if exists
      const persistedState = await this.state.storage.get<number[]>('yjs-state');
      if (persistedState) {
        Y.applyUpdate(this.doc, new Uint8Array(persistedState));
      }

      // Persist the FULL document state on every update
      // This ensures we don't lose data when the DO restarts
      this.doc.on('update', async (update: Uint8Array, origin: unknown) => {
        // Encode the full document state, not just the incremental update
        const fullState = Y.encodeStateAsUpdate(this.doc!);
        await this.state.storage.put('yjs-state', Array.from(fullState));

        // Broadcast update to all connected clients (except origin)
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        const message = encoding.toUint8Array(encoder);
        this.broadcastBinary(message, origin as WebSocket | null);
      });

      // Broadcast awareness updates to all clients
      this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
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
      });
    }
  }

  async handleWebSocket(request: Request): Promise<Response> {
    let user: { id: string; [key: string]: unknown } | null = null;

    // Authenticate via cookies (standard HTTP cookie auth)
    try {
      const authResult = await verifyAuth(request, this.env);
      user = authResult.user as { id: string; [key: string]: unknown } | null;
    } catch (err) {
      console.error('WebSocket auth error:', err);
    }

    // Require authentication
    if (!user) {
      return new Response('Authentication required', { status: 401 });
    }

    // Extract projectId from URL: /api/project-doc/:projectId
    // y-websocket appends the room name as the last path segment
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    // pathParts: ["", "api", "project-doc", projectId] or ["", "api", "project-doc", projectId, ...]
    const projectId = pathParts[3];

    if (!projectId) {
      return new Response('Invalid URL: projectId required', {
        status: 400,
        headers: { 'X-Close-Reason': 'invalid-url' },
      });
    }

    // ALWAYS verify project membership against D1
    // Do NOT trust Yjs members map for authorization (it can be stale)
    if (!this.env.DB) {
      console.error('No DB binding available for WebSocket auth check');
      return new Response('Server configuration error', { status: 500 });
    }

    const db = createDb(this.env.DB);

    // Verify project exists
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

    // ALWAYS verify project membership on connect/reconnect (fresh D1 check)
    // Projects are invite-only: org membership does not grant project access
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

    // Now that we've verified auth, sync member to Yjs if not present (for awareness)
    await this.initializeDoc();
    const membersMap = this.doc!.getMap('members');
    if (!membersMap.has(user.id)) {
      const memberYMap = new Y.Map<unknown>();
      memberYMap.set('role', projectMembership.role);
      memberYMap.set('joinedAt', Date.now());
      membersMap.set(user.id, memberYMap);
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();
    // Store session with user info, awarenessClientId will be set when client sends awareness
    this.sessions.set(server, { user, awarenessClientId: null });

    // Note: We do NOT proactively send sync step 1 here.
    // The y-websocket client will send sync step 1 on connect,
    // and we respond via the message handler below.

    server.addEventListener('message', async (event: MessageEvent) => {
      try {
        // Handle binary messages (y-websocket protocol)
        let data: Uint8Array;
        if (event.data instanceof ArrayBuffer) {
          data = new Uint8Array(event.data);
        } else if (event.data instanceof Blob) {
          data = new Uint8Array(await event.data.arrayBuffer());
        } else {
          // String data - shouldn't happen with y-websocket binary protocol
          console.warn('Received unexpected string WebSocket message');
          return;
        }

        const decoder = decoding.createDecoder(data);
        const messageType = decoding.readVarUint(decoder);

        switch (messageType) {
          case messageSync: {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, messageSync);
            syncProtocol.readSyncMessage(decoder, encoder, this.doc!, server);
            // If there's a response to send (sync step 2 or update acknowledgment)
            if (encoding.length(encoder) > 1) {
              server.send(encoding.toUint8Array(encoder));
            }
            break;
          }
          case messageAwareness: {
            const awarenessUpdate = decoding.readVarUint8Array(decoder);
            awarenessProtocol.applyAwarenessUpdate(this.awareness!, awarenessUpdate, server);

            // Extract and store the client's awareness ID from the update
            // The first client ID in the update is typically the sender's ID
            const awarenessDecoder = decoding.createDecoder(awarenessUpdate);
            const len = decoding.readVarUint(awarenessDecoder);
            if (len > 0) {
              const clientId = decoding.readVarUint(awarenessDecoder);
              const session = this.sessions.get(server);
              if (session && session.awarenessClientId === null) {
                session.awarenessClientId = clientId;
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
    });

    server.addEventListener('close', () => {
      // Remove awareness state for this client using their stored clientID
      const session = this.sessions.get(server);
      if (session && session.awarenessClientId != null) {
        awarenessProtocol.removeAwarenessStates(
          this.awareness!,
          [session.awarenessClientId],
          server,
        );
      }
      this.sessions.delete(server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Helper to convert Y.Map to plain object recursively
   */
  yMapToPlain(yMap: Y.Map<unknown>): Record<string, unknown> {
    if (!yMap || typeof yMap.toJSON !== 'function') {
      return {};
    }
    return yMap.toJSON();
  }

  /**
   * Get comprehensive project info with hierarchical structure:
   * Project -> Reviews -> Checklists -> Answers
   */
  async getProjectInfo(): Promise<Response> {
    await this.initializeDoc();

    const result: ProjectInfo = {
      id: this.state.id.toString(),
      meta: this.yMapToPlain(this.doc!.getMap('meta')) as Record<string, unknown>,
      members: [],
      reviews: [],
    };

    // Get members
    const membersMap = this.doc!.getMap('members');
    for (const [userId, value] of membersMap.entries()) {
      result.members.push({
        userId,
        ...(this.yMapToPlain(value as Y.Map<unknown>) as Record<string, unknown>),
      });
    }

    // Get reviews with nested checklists and pdfs
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

      // Get checklists within this review
      const checklistsMap = reviewYMap.get('checklists') as Y.Map<unknown> | undefined;
      if (checklistsMap && checklistsMap.entries) {
        for (const [checklistId, checklistValue] of checklistsMap.entries()) {
          const checklistData = this.yMapToPlain(checklistValue as Y.Map<unknown>) as Record<string, unknown>;
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

      // Get PDFs within this review
      const pdfsMap = reviewYMap.get('pdfs') as Y.Map<unknown> | undefined;
      if (pdfsMap && pdfsMap.entries) {
        for (const [fileName, pdfValue] of pdfsMap.entries()) {
          const pdfData = this.yMapToPlain(pdfValue as Y.Map<unknown>) as Record<string, unknown>;
          review.pdfs.push({
            fileName,
            key: pdfData.key,
            size: pdfData.size,
            uploadedBy: pdfData.uploadedBy,
            uploadedAt: pdfData.uploadedAt,
          });
        }
      }

      result.reviews.push(review);
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Broadcast binary message to all connected clients
   */
  broadcastBinary(message: Uint8Array, exclude: WebSocket | null = null): void {
    this.sessions.forEach((_sessionData, ws) => {
      if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * Disconnect a specific user from the WebSocket
   */
  disconnectUser(userId: string, reason: string = 'membership-revoked'): void {
    const closeCode = 1008; // Policy Violation
    const sessionsToClose: Array<{ ws: WebSocket; sessionData: SessionData }> = [];
    this.sessions.forEach((sessionData, ws) => {
      if (sessionData.user?.id === userId && ws.readyState === WebSocket.OPEN) {
        sessionsToClose.push({ ws, sessionData });
      }
    });
    // Close websockets and remove sessions immediately
    // (don't wait for close event handler, which may not fire synchronously in tests)
    for (const { ws, sessionData } of sessionsToClose) {
      // Remove awareness state if present and awareness is initialized
      if (this.awareness && sessionData.awarenessClientId != null) {
        awarenessProtocol.removeAwarenessStates(
          this.awareness,
          [sessionData.awarenessClientId],
          ws,
        );
      }
      // Remove session immediately
      this.sessions.delete(ws);
      // Close the websocket
      ws.close(closeCode, reason);
    }
  }

  /**
   * Disconnect all users from the WebSocket (e.g., when project is deleted)
   */
  disconnectAll(reason: string = 'project-deleted'): void {
    const closeCode = 1000; // Normal closure
    this.sessions.forEach((_sessionData, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(closeCode, reason);
      }
    });
  }
}
