import * as Y from 'yjs';
import { verifyAuth } from '../auth/config.js';

export class CollaborativeDoc {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
    this.doc = null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    // Dynamic CORS headers for credentialed requests
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:8787',
      // Add production origins here
    ];
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
      // Verify authentication for all non-WebSocket requests
      if (request.headers.get('Upgrade') !== 'websocket') {
        const { user } = await verifyAuth(request, this.env);
        if (!user) {
          return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        request.user = user; // Attach user to request
      }

      // WebSocket upgrade for real-time collaboration
      if (request.headers.get('Upgrade') === 'websocket') {
        return await this.handleWebSocket(request);
      }

      // Get document content
      if (request.method === 'GET') {
        return await this.getDocument(corsHeaders);
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('CollaborativeDoc error:', error);
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

      // Listen for updates to persist them
      this.doc.on('update', async (update) => {
        await this.state.storage.put('yjs-state', Array.from(update));
      });
    }
  }

  async handleWebSocket(request) {
    // Verify auth for WebSocket connections
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    let user = null;
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
    }

    await this.initializeDoc();

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();
    server.user = user;
    this.sessions.add(server);

    // Send current document state to new client
    const currentState = Y.encodeStateAsUpdate(this.doc);
    server.send(
      JSON.stringify({
        type: 'sync',
        update: Array.from(currentState),
      }),
    );

    // Send user info to other clients
    if (user) {
      this.broadcast(
        JSON.stringify({
          type: 'user-joined',
          user: { id: user.id, username: user.username, displayName: user.displayName },
        }),
        server,
      );
    }

    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle authentication via WebSocket message
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

          // Notify other clients
          this.broadcast(
            JSON.stringify({
              type: 'user-joined',
              user: { id: authUser.id, username: authUser.username, displayName: authUser.displayName },
            }),
            server,
          );
          return;
        }

        // Require authentication for document updates
        if (!server.user && !token) {
          server.send(JSON.stringify({ type: 'error', message: 'Authentication required for editing' }));
          return;
        }

        if (data.type === 'update') {
          // Apply update to server doc
          const update = new Uint8Array(data.update);
          Y.applyUpdate(this.doc, update);

          // Broadcast to all other clients with user info
          this.broadcast(
            JSON.stringify({
              type: 'update',
              update: data.update,
              user:
                server.user ?
                  {
                    id: server.user.id,
                    username: server.user.username,
                    displayName: server.user.displayName,
                  }
                : null,
            }),
            server,
          );
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        server.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    server.addEventListener('close', () => {
      this.sessions.delete(server);

      // Notify other clients that user left
      if (server.user) {
        this.broadcast(
          JSON.stringify({
            type: 'user-left',
            user: { id: server.user.id, username: server.user.username, displayName: server.user.displayName },
          }),
        );
      }
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async getDocument(corsHeaders) {
    try {
      await this.initializeDoc();

      // Get text content for HTTP requests
      const yText = this.doc.getText('content');
      const content = yText.toString();

      return new Response(
        JSON.stringify({
          content,
          connectedUsers: this.sessions.size,
          lastModified: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Get document error:', error);
      return new Response(JSON.stringify({ error: 'Failed to retrieve document' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  broadcast(message, exclude = null) {
    this.sessions.forEach((session) => {
      if (session !== exclude && session.readyState === WebSocket.READY_STATE_OPEN) {
        session.send(message);
      }
    });
  }
}
