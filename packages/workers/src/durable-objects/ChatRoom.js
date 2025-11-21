export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // WebSocket upgrade for real-time chat
      if (request.headers.get('Upgrade') === 'websocket') {
        return await this.handleWebSocket(request);
      }

      // Get chat history
      if (request.method === 'GET' && path.endsWith('/messages')) {
        return await this.getMessages(corsHeaders);
      }

      // Send message
      if (request.method === 'POST' && path.endsWith('/messages')) {
        return await this.sendMessage(request, corsHeaders);
      }

      // Get room info
      if (request.method === 'GET') {
        return await this.getRoomInfo(corsHeaders);
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('ChatRoom error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  async handleWebSocket(request) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();
    this.sessions.add(server);

    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data);

        // Broadcast message to all connected clients
        if (data.type === 'message') {
          const message = {
            id: crypto.randomUUID(),
            type: 'message',
            content: data.content,
            userId: data.userId,
            username: data.username,
            timestamp: new Date().toISOString(),
          };

          // Store in Durable Object storage
          await this.storeMessage(message);

          // Broadcast to all sessions
          this.broadcast(JSON.stringify(message));
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

  async getMessages(corsHeaders) {
    try {
      const messages = await this.state.storage.list({ prefix: 'message:' });
      const messageList = [];

      for (const [key, value] of messages) {
        messageList.push(value);
      }

      // Sort by timestamp
      messageList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      return new Response(JSON.stringify({ messages: messageList.slice(-50) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Get messages error:', error);
      return new Response(JSON.stringify({ error: 'Failed to retrieve messages' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  async sendMessage(request, corsHeaders) {
    try {
      const data = await request.json();

      const message = {
        id: crypto.randomUUID(),
        type: 'message',
        content: data.content,
        userId: data.userId,
        username: data.username,
        timestamp: new Date().toISOString(),
      };

      await this.storeMessage(message);
      this.broadcast(JSON.stringify(message));

      return new Response(JSON.stringify({ success: true, message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Send message error:', error);
      return new Response(JSON.stringify({ error: 'Failed to send message' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  async getRoomInfo(corsHeaders) {
    const info = {
      id: await this.state.id.toString(),
      connectedSessions: this.sessions.size,
      createdAt: (await this.state.storage.get('createdAt')) || new Date().toISOString(),
    };

    if (!(await this.state.storage.get('createdAt'))) {
      await this.state.storage.put('createdAt', info.createdAt);
    }

    return new Response(JSON.stringify(info), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  async storeMessage(message) {
    await this.state.storage.put(`message:${message.id}`, message);

    // Clean up old messages (keep last 100)
    const messages = await this.state.storage.list({ prefix: 'message:' });
    if (messages.size > 100) {
      const oldestKeys = Array.from(messages.keys()).slice(0, messages.size - 100);
      await this.state.storage.delete(oldestKeys);
    }
  }

  broadcast(message) {
    this.sessions.forEach((session) => {
      if (session.readyState === WebSocket.READY_STATE_OPEN) {
        session.send(message);
      }
    });
  }
}
