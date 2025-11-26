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

    try {
      // For HTTP requests verify auth (unless it's an upgrade to websocket)
      if (request.headers.get('Upgrade') !== 'websocket') {
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
      if (request.headers.get('Upgrade') === 'websocket') {
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
    // For development, allow unauthenticated connections
    // In production, we'd need to implement proper WebSocket auth
    const isDevelopment = this.env.ENVIRONMENT !== 'production';

    let user = null;
    if (!isDevelopment) {
      // Verify auth for WebSocket connections in production
      const url = new URL(request.url);
      const token = url.searchParams.get('token');

      if (token) {
        const authRequest = new Request(request.url, {
          headers: {
            ...request.headers,
            Authorization: `Bearer ${token}`,
          },
        });

        const authResult = await verifyAuth(authRequest, this.env);
        user = authResult.user;

        if (!user) {
          return new Response('Unauthorized', { status: 401 });
        }
      } else {
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

    // Get reviews with nested checklists
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

      result.reviews.push(review);
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  broadcast(message, exclude = null) {
    this.sessions.forEach(session => {
      if (session !== exclude && session.readyState === WebSocket.READY_STATE_OPEN) {
        session.send(message);
      }
    });
  }
}
