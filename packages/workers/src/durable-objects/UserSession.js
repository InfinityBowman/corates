import { verifyAuth } from '../auth/config.js';
import { getAccessControlOrigin } from '../config/origins.js';

export class UserSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.connections = new Set();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Dynamic CORS headers for credentialed requests using centralized config
    const requestOrigin = request.headers.get('Origin');
    const corsHeaders = {
      'Access-Control-Allow-Origin': getAccessControlOrigin(requestOrigin, this.env),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, User-Agent',
      'Access-Control-Allow-Credentials': 'true',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Handle internal notification requests (from other workers/DOs)
    if (path.endsWith('/notify') && request.method === 'POST') {
      return await this.handleNotification(request, corsHeaders);
    }

    // Handle WebSocket upgrade for real-time notifications
    if (request.headers.get('Upgrade') === 'websocket') {
      return await this.handleWebSocket(request);
    }

    try {
      // Verify authentication for all requests
      const { user } = await verifyAuth(request, this.env);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Ensure user can only access their own session
      const sessionId = await this.state.id.toString();
      if (sessionId !== user.id) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      request.user = user;

      // Get session data
      if (request.method === 'GET') {
        return await this.getSession(corsHeaders);
      }

      // Update session data
      if (request.method === 'PUT') {
        return await this.updateSession(request, corsHeaders);
      }

      // Create new session
      if (request.method === 'POST') {
        return await this.createSession(request, corsHeaders);
      }

      // Delete session
      if (request.method === 'DELETE') {
        return await this.deleteSession(corsHeaders);
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('UserSession error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  async getSession(corsHeaders) {
    try {
      const sessionData = (await this.state.storage.get('session')) || {
        id: await this.state.id.toString(),
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        data: {},
      };

      // Update last active
      sessionData.lastActive = new Date().toISOString();
      await this.state.storage.put('session', sessionData);

      return new Response(JSON.stringify(sessionData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Get session error:', error);
      return new Response(JSON.stringify({ error: 'Failed to retrieve session' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  async createSession(request, corsHeaders) {
    try {
      const body = await request.json();

      const sessionData = {
        id: await this.state.id.toString(),
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        data: body.data || {},
      };

      await this.state.storage.put('session', sessionData);

      return new Response(JSON.stringify(sessionData), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Create session error:', error);
      return new Response(JSON.stringify({ error: 'Failed to create session' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  async updateSession(request, corsHeaders) {
    try {
      const body = await request.json();
      const sessionData = await this.state.storage.get('session');

      if (!sessionData) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const updatedSession = {
        ...sessionData,
        lastActive: new Date().toISOString(),
        data: { ...sessionData.data, ...body.data },
      };

      await this.state.storage.put('session', updatedSession);

      return new Response(JSON.stringify(updatedSession), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Update session error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update session' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  async deleteSession(corsHeaders) {
    try {
      await this.state.storage.deleteAll();

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Delete session error:', error);
      return new Response(JSON.stringify({ error: 'Failed to delete session' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Handle WebSocket connections for real-time notifications
   */
  async handleWebSocket(request) {
    // Try to authenticate via cookies
    let user = null;
    try {
      const authResult = await verifyAuth(request, this.env);
      user = authResult.user;
    } catch (err) {
      console.error('WebSocket auth error:', err);
    }

    // Require authentication
    if (!user) {
      return new Response('Authentication required', { status: 401 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();
    server.user = user;
    this.connections.add(server);

    // Send any pending notifications
    const pending = (await this.state.storage.get('pendingNotifications')) || [];
    if (pending.length > 0) {
      for (const notification of pending) {
        server.send(JSON.stringify(notification));
      }
      await this.state.storage.put('pendingNotifications', []);
    }

    server.addEventListener('message', async event => {
      try {
        const data = JSON.parse(event.data);
        // Handle ping/pong for keepalive
        if (data.type === 'ping') {
          server.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    server.addEventListener('close', () => {
      this.connections.delete(server);
    });

    server.addEventListener('error', () => {
      this.connections.delete(server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle notification requests from other workers/DOs
   * This is called internally when a user is added to a project
   */
  async handleNotification(request, corsHeaders) {
    try {
      const notification = await request.json();

      // Add timestamp if not present
      if (!notification.timestamp) {
        notification.timestamp = Date.now();
      }

      // Broadcast to all connected clients
      let delivered = false;
      for (const conn of this.connections) {
        if (conn.readyState === WebSocket.READY_STATE_OPEN) {
          conn.send(JSON.stringify(notification));
          delivered = true;
        }
      }

      // If no active connections, store for later delivery
      if (!delivered) {
        const pending = (await this.state.storage.get('pendingNotifications')) || [];
        pending.push(notification);
        // Keep only last 50 notifications
        if (pending.length > 50) {
          pending.shift();
        }
        await this.state.storage.put('pendingNotifications', pending);
      }

      return new Response(JSON.stringify({ success: true, delivered }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Notification error:', error);
      return new Response(JSON.stringify({ error: 'Failed to send notification' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // Auto-cleanup expired sessions
  async alarm() {
    const sessionData = await this.state.storage.get('session');

    if (sessionData) {
      const lastActive = new Date(sessionData.lastActive);
      const now = new Date();
      const hoursSinceActive = (now - lastActive) / (1000 * 60 * 60);

      // Delete session if inactive for more than 24 hours
      if (hoursSinceActive > 24) {
        await this.state.storage.deleteAll();
      } else {
        // Schedule next cleanup check
        const nextCheck = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
        await this.state.storage.setAlarm(nextCheck);
      }
    }
  }
}
