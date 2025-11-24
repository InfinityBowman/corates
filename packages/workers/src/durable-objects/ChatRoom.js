import { verifyAuth } from '../auth/config.js';

export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

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
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    let authenticatedUser = null;

    // Try to verify auth via session cookies first
    try {
      const { user } = await verifyAuth(request, this.env);
      if (user) {
        authenticatedUser = user;
      }
    } catch (error) {
      console.log('Cookie auth failed, trying token auth:', error.message);
    }

    // If cookie auth failed, try token-based auth
    if (!authenticatedUser && token) {
      try {
        // Create a mock request with the token in Authorization header
        const authRequest = new Request(request.url, {
          headers: {
            ...request.headers,
            Authorization: `Bearer ${token}`,
            Cookie: `better-auth.session_token=${token}`, // Try as session token
          },
        });

        const { user } = await verifyAuth(authRequest, this.env);
        if (user) {
          authenticatedUser = user;
        }
      } catch (error) {
        console.log('Token auth failed:', error.message);
      }
    }

    // For development, allow unauthenticated connections with warning
    if (!authenticatedUser) {
      console.warn('WebSocket connection without authentication - allowing for development');
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();
    this.sessions.add(server);

    // Store authenticated user on the WebSocket
    if (authenticatedUser) {
      server.user = authenticatedUser;
    }

    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle authentication via WebSocket message
        if (data.type === 'auth' && data.token) {
          try {
            const authRequest = new Request(request.url, {
              headers: {
                ...request.headers,
                Cookie: `better-auth.session_token=${data.token}`,
              },
            });

            const { user } = await verifyAuth(authRequest, this.env);
            if (user) {
              server.user = user;
              server.send(JSON.stringify({ type: 'auth', success: true, user }));
            } else {
              server.send(JSON.stringify({ type: 'auth', success: false, message: 'Invalid token' }));
            }
          } catch (error) {
            console.error('WebSocket auth error:', error);
            server.send(JSON.stringify({ type: 'auth', success: false, message: 'Authentication failed' }));
          }
          return;
        }

        // Handle chat messages
        if (data.type === 'message') {
          // Use authenticated user info if available, otherwise fall back to provided data
          const user = server.user;
          const message = {
            id: crypto.randomUUID(),
            type: 'message',
            content: data.content,
            userId: user?.id || data.userId || 'anonymous',
            username: user?.username || data.username || 'Anonymous',
            displayName: user?.displayName || data.displayName || user?.username || data.username || 'Anonymous',
            timestamp: new Date().toISOString(),
          };

          // Store in Durable Object storage
          await this.storeMessage(message);

          // Broadcast to all sessions
          this.broadcast(JSON.stringify(message));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        server.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    server.addEventListener('close', () => {
      this.sessions.delete(server);
    });

    server.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
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
        // Ensure every message has a timestamp
        if (!value.timestamp) {
          value.timestamp = new Date().toISOString();
        }
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
      const user = request.user; // User attached during auth verification

      const message = {
        id: crypto.randomUUID(),
        type: 'message',
        content: data.content,
        userId: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
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
