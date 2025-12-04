import * as Y from 'yjs';
import { verifyAuth } from '../auth/config.js';

/**
 * ProjectDoc Durable Object
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
export class ProjectDoc {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
    this.doc = null;
    // this.saveTimeout = null;
    // this.pendingSave = false;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Note: CORS headers are added by the main worker (index.js) when wrapping responses
    // Do NOT add them here to avoid duplicate headers

    // Debug: log upgrade header
    const upgradeHeader = request.headers.get('Upgrade');
    console.log(
      'ProjectDoc fetch - Upgrade header:',
      upgradeHeader,
      'Method:',
      request.method,
      'Path:',
      url.pathname,
    );

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
      }

      // For HTTP requests verify auth (unless it's an upgrade to websocket)
      if (upgradeHeader !== 'websocket') {
        const { user } = await verifyAuth(request, this.env);
        if (!user) {
          return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        request.user = user;
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
  async handleSync(request) {
    await this.initializeDoc();

    try {
      const { meta, members } = await request.json();

      // Update meta if provided
      if (meta) {
        const metaMap = this.doc.getMap('meta');
        for (const [key, value] of Object.entries(meta)) {
          if (value !== undefined) {
            metaMap.set(key, value);
          }
        }
      }

      // Update members if provided (full replacement for initial sync)
      if (members && Array.isArray(members)) {
        const membersMap = this.doc.getMap('members');
        // Clear existing members and set new ones
        for (const [userId] of membersMap.entries()) {
          membersMap.delete(userId);
        }
        for (const member of members) {
          const memberYMap = new Y.Map();
          memberYMap.set('role', member.role);
          memberYMap.set('joinedAt', member.joinedAt);
          memberYMap.set('name', member.name || null);
          memberYMap.set('email', member.email || null);
          memberYMap.set('displayName', member.displayName || null);
          membersMap.set(member.userId, memberYMap);
        }
      }

      // Broadcast update to connected clients
      const update = Y.encodeStateAsUpdate(this.doc);
      this.broadcast(JSON.stringify({ type: 'update', update: Array.from(update) }));

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
  async handleSyncMember(request) {
    await this.initializeDoc();

    try {
      const { action, member } = await request.json();
      const membersMap = this.doc.getMap('members');

      if (action === 'add') {
        const memberYMap = new Y.Map();
        memberYMap.set('role', member.role);
        memberYMap.set('joinedAt', member.joinedAt);
        memberYMap.set('name', member.name || null);
        memberYMap.set('email', member.email || null);
        memberYMap.set('displayName', member.displayName || null);
        membersMap.set(member.userId, memberYMap);
      } else if (action === 'update') {
        const existingMember = membersMap.get(member.userId);
        if (existingMember) {
          existingMember.set('role', member.role);
        }
      } else if (action === 'remove') {
        membersMap.delete(member.userId);
      }

      // Broadcast update to connected clients
      const update = Y.encodeStateAsUpdate(this.doc);
      this.broadcast(JSON.stringify({ type: 'update', update: Array.from(update) }));

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
   * Handle PDF sync request from routes (add/remove PDF metadata for a study)
   * Note: Y.js map key remains 'reviews' for backward compatibility
   */
  async handleSyncPdf(request) {
    await this.initializeDoc();

    try {
      const { action, studyId, studyName, pdf, fileName } = await request.json();

      // Note: Y.js map key remains 'reviews' for backward compatibility
      const studiesMap = this.doc.getMap('reviews');
      let studyYMap = studiesMap.get(studyId);

      // Create the study if it doesn't exist (handles race condition where
      // PDF upload arrives before Y.js sync creates the study)
      if (!studyYMap) {
        studyYMap = new Y.Map();
        studyYMap.set('name', studyName || 'Untitled Study');
        studyYMap.set('createdAt', Date.now());
        studyYMap.set('updatedAt', Date.now());
        studyYMap.set('checklists', new Y.Map());
        studiesMap.set(studyId, studyYMap);
      }

      // Get or create the pdfs Y.Map for this study
      let pdfsMap = studyYMap.get('pdfs');
      if (!pdfsMap) {
        pdfsMap = new Y.Map();
        studyYMap.set('pdfs', pdfsMap);
      }

      if (action === 'add' && pdf) {
        const pdfYMap = new Y.Map();
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

      // Broadcast update to connected clients
      const update = Y.encodeStateAsUpdate(this.doc);
      this.broadcast(JSON.stringify({ type: 'update', update: Array.from(update) }));

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

  async initializeDoc() {
    if (!this.doc) {
      this.doc = new Y.Doc();

      // Load persisted state if exists
      const persistedState = await this.state.storage.get('yjs-state');
      if (persistedState) {
        Y.applyUpdate(this.doc, new Uint8Array(persistedState));
      }

      // Persist the FULL document state on every update
      // This ensures we don't lose data when the DO restarts
      this.doc.on('update', async () => {
        // Encode the full document state, not just the incremental update
        const fullState = Y.encodeStateAsUpdate(this.doc);
        await this.state.storage.put('yjs-state', Array.from(fullState));
      });
    }
  }

  async handleWebSocket(request) {
    console.log('handleWebSocket called, ENVIRONMENT:', this.env.ENVIRONMENT);

    let user = null;

    // Try to authenticate via cookies (same as HTTP requests)
    try {
      const authResult = await verifyAuth(request, this.env);
      user = authResult.user;
      console.log('WebSocket auth result:', user ? `User ${user.id}` : 'No user');
    } catch (err) {
      console.error('WebSocket auth error:', err);
    }

    // Require authentication - try token-based auth as fallback if cookie auth failed
    if (!user) {
      const url = new URL(request.url);
      const token = url.searchParams.get('token');

      if (token) {
        const authRequest = new Request(request.url, {
          headers: new Headers({
            ...Object.fromEntries(request.headers.entries()),
            Authorization: `Bearer ${token}`,
          }),
        });

        const authResult = await verifyAuth(authRequest, this.env);
        user = authResult.user;
      }

      if (!user) {
        console.log('WebSocket auth failed - no user');
        return new Response('Authentication required', { status: 401 });
      }
    }

    await this.initializeDoc();

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();
    server.user = user;
    this.sessions.add(server);

    // Send current full state to new client
    const currentState = Y.encodeStateAsUpdate(this.doc);
    server.send(JSON.stringify({ type: 'sync', update: Array.from(currentState) }));

    // If user joined broadcast presence message
    if (user) {
      this.broadcast(
        JSON.stringify({ type: 'user-joined', user: { id: user.id, username: user.username } }),
        server,
      );
    }

    server.addEventListener('message', async event => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'auth' && data.token) {
          const authRequest = new Request(request.url, {
            headers: {
              ...request.headers,
              Authorization: `Bearer ${data.token}`,
            },
          });

          const { user: authUser } = await verifyAuth(authRequest, this.env);
          if (!authUser) {
            server.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
            server.close();
            return;
          }

          server.user = authUser;
          server.send(JSON.stringify({ type: 'auth', success: true, user: authUser }));
          this.broadcast(
            JSON.stringify({
              type: 'user-joined',
              user: { id: authUser.id, username: authUser.username },
            }),
            server,
          );
          return;
        }

        // Require authentication for updates if auth is required (we allow development unauth'd if necessary)
        if (data.type === 'update') {
          const update = new Uint8Array(data.update);
          Y.applyUpdate(this.doc, update);

          // Broadcast to others
          this.broadcast(
            JSON.stringify({
              type: 'update',
              update: Array.from(update),
              user: server.user ? { id: server.user.id, username: server.user.username } : null,
            }),
            server,
          );
        }
      } catch (error) {
        console.error('WebSocket message error (ProjectDoc):', error);
        server.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    server.addEventListener('close', () => {
      this.sessions.delete(server);
      if (server.user) {
        this.broadcast(
          JSON.stringify({
            type: 'user-left',
            user: { id: server.user.id, username: server.user.username },
          }),
        );
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Helper to convert Y.Map to plain object recursively
   */
  yMapToPlain(yMap) {
    if (!yMap || typeof yMap.toJSON !== 'function') {
      return yMap;
    }
    return yMap.toJSON();
  }

  /**
   * Get comprehensive project info with hierarchical structure:
   * Project -> Reviews -> Checklists -> Answers
   */
  async getProjectInfo() {
    await this.initializeDoc();

    const result = {
      id: this.state.id.toString(),
      meta: this.yMapToPlain(this.doc.getMap('meta')),
      members: [],
      reviews: [],
    };

    // Get members
    const membersMap = this.doc.getMap('members');
    for (const [userId, value] of membersMap.entries()) {
      result.members.push({
        userId,
        ...this.yMapToPlain(value),
      });
    }

    // Get reviews with nested checklists and pdfs
    const reviewsMap = this.doc.getMap('reviews');
    for (const [reviewId, reviewValue] of reviewsMap.entries()) {
      const reviewData = this.yMapToPlain(reviewValue);
      const review = {
        id: reviewId,
        name: reviewData.name,
        description: reviewData.description,
        createdAt: reviewData.createdAt,
        updatedAt: reviewData.updatedAt,
        checklists: [],
        pdfs: [],
      };

      // Get checklists within this review
      const checklistsMap = reviewValue.get('checklists');
      if (checklistsMap && checklistsMap.entries) {
        for (const [checklistId, checklistValue] of checklistsMap.entries()) {
          const checklistData = this.yMapToPlain(checklistValue);
          review.checklists.push({
            id: checklistId,
            title: checklistData.title,
            assignedTo: checklistData.assignedTo,
            status: checklistData.status || 'pending',
            createdAt: checklistData.createdAt,
            updatedAt: checklistData.updatedAt,
            answers: checklistData.answers || {},
          });
        }
      }

      // Get PDFs within this review
      const pdfsMap = reviewValue.get('pdfs');
      if (pdfsMap && pdfsMap.entries) {
        for (const [fileName, pdfValue] of pdfsMap.entries()) {
          const pdfData = this.yMapToPlain(pdfValue);
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

  broadcast(message, exclude = null) {
    this.sessions.forEach(session => {
      if (session !== exclude && session.readyState === 1) {
        session.send(message);
      }
    });
  }
}
