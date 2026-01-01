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

    // All other requests are not supported (only WebSocket and /notify are used)
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

    // Extract userId from URL path and verify it matches authenticated user
    const url = new URL(request.url);
    const sessionUserId = this.extractUserIdFromPath(url.pathname);

    if (!sessionUserId || sessionUserId !== user.id) {
      return new Response('Access denied', { status: 403 });
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
        if (conn.readyState === 1) {
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

  /**
   * Extract user ID from the URL path
   * Expected pattern: /api/sessions/:userId/...
   * @param {string} path - URL pathname
   * @returns {string|null} - The user ID or null if not found
   */
  extractUserIdFromPath(path) {
    const match = path.match(/\/api\/sessions\/([^/]+)/);
    return match ? match[1] : null;
  }
}
