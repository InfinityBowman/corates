import * as Y from 'yjs';
import { verifyAuth } from '../auth/config.js';

export class ProjectDoc {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
    this.doc = null;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Dynamic CORS headers for credentialed requests
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:8787'];
    const requestOrigin = request.headers.get('Origin');
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // For HTTP requests verify auth (unless it's an upgrade to websocket)
      if (request.headers.get('Upgrade') !== 'websocket') {
        const { user } = await verifyAuth(request, this.env);
        if (!user) {
          return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        return await this.getProjectInfo(corsHeaders);
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('ProjectDoc error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

      // Keep the Y.Doc persisted
      this.doc.on('update', async (update) => {
        // Persist the most recent update (overwrite last saved state)
        await this.state.storage.put('yjs-state', Array.from(update));
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
      this.broadcast(JSON.stringify({ type: 'user-joined', user: { id: user.id, username: user.username } }), server);
    }

    server.addEventListener('message', async (event) => {
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
          this.broadcast(JSON.stringify({ type: 'user-joined', user: { id: authUser.id, username: authUser.username } }), server);
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
        this.broadcast(JSON.stringify({ type: 'user-left', user: { id: server.user.id, username: server.user.username } }));
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async getProjectInfo(corsHeaders) {
    await this.initializeDoc();

    const checklistsMap = this.doc.getMap('checklists');
    const ids = [];
    for (const key of checklistsMap.keys()) {
      const meta = checklistsMap.get(key);
      // assume each checklist stored as a Y.Map with at least a 'title'
      ids.push({ id: key, title: meta?.get ? meta.get('title') : null });
    }

    return new Response(JSON.stringify({ id: await this.state.id.toString(), checklists: ids }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  broadcast(message, exclude = null) {
    this.sessions.forEach((session) => {
      if (session !== exclude && session.readyState === WebSocket.READY_STATE_OPEN) {
        session.send(message);
      }
    });
  }
}
