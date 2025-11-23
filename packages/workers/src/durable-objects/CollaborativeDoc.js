import * as Y from 'yjs';

export class CollaborativeDoc {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
    this.doc = null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
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
    await this.initializeDoc();

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();
    this.sessions.add(server);

    // Send current document state to new client
    const currentState = Y.encodeStateAsUpdate(this.doc);
    server.send(
      JSON.stringify({
        type: 'sync',
        update: Array.from(currentState),
      }),
    );

    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'update') {
          // Apply update to server doc
          const update = new Uint8Array(data.update);
          Y.applyUpdate(this.doc, update);

          // Broadcast to all other clients
          this.broadcast(
            JSON.stringify({
              type: 'update',
              update: data.update,
            }),
            server,
          );
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    server.addEventListener('close', () => {
      this.sessions.delete(server);
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
