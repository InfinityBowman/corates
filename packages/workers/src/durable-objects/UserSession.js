import { verifyAuth } from '../auth/config.js';
import { getAccessControlOrigin } from '../config/origins.js';
import { SESSION_CONFIG } from '../config/constants.js';

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
        return Response.json(
          { error: 'Authentication required' },
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      // Extract the userId from the URL path
      // URL pattern: /api/sessions/:sessionId/*
      const sessionUserId = this.extractUserIdFromPath(path);

      // Ensure user can only access their own session
      if (!sessionUserId || sessionUserId !== user.id) {
        return Response.json(
          { error: 'Access denied' },
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
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

      return Response.json(
        { error: 'Method not allowed' },
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('UserSession error:', error);
      return Response.json(
        { error: 'Internal Server Error' },
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
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

      // Schedule cleanup alarm if not already set
      await this.scheduleCleanupAlarm();

      return Response.json(sessionData, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Get session error:', error);
      return Response.json(
        { error: 'Failed to retrieve session' },
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
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

      // Schedule cleanup alarm
      await this.scheduleCleanupAlarm();

      return Response.json(sessionData, {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Create session error:', error);
      return Response.json(
        { error: 'Failed to create session' },
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
  }

  async updateSession(request, corsHeaders) {
    try {
      const body = await request.json();
      const sessionData = await this.state.storage.get('session');

      if (!sessionData) {
        return Response.json(
          { error: 'Session not found' },
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const updatedSession = {
        ...sessionData,
        lastActive: new Date().toISOString(),
        data: { ...sessionData.data, ...body.data },
      };

      await this.state.storage.put('session', updatedSession);

      return Response.json(updatedSession, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Update session error:', error);
      return Response.json(
        { error: 'Failed to update session' },
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
  }

  async deleteSession(corsHeaders) {
    try {
      await this.state.storage.deleteAll();

      return Response.json(
        { success: true },
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Delete session error:', error);
      return Response.json(
        { error: 'Failed to delete session' },
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
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

      return Response.json(
        { success: true, delivered },
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Notification error:', error);
      return Response.json(
        { error: 'Failed to send notification' },
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
  }

  // Auto-cleanup expired sessions
  async alarm() {
    const sessionData = await this.state.storage.get('session');

    if (sessionData) {
      const lastActive = new Date(sessionData.lastActive);
      const now = new Date();
      const hoursSinceActive = (now - lastActive) / (1000 * 60 * 60);

      // Delete session if inactive for configured hours
      if (hoursSinceActive > SESSION_CONFIG.CLEANUP_HOURS) {
        await this.state.storage.deleteAll();
        console.log('UserSession: cleaned up inactive session');
      } else {
        // Schedule next cleanup check
        await this.state.storage.setAlarm(now.getTime() + SESSION_CONFIG.ALARM_INTERVAL_MS);
      }
    }
  }

  /**
   * Schedule cleanup alarm if not already set
   */
  async scheduleCleanupAlarm() {
    const currentAlarm = await this.state.storage.getAlarm();
    if (!currentAlarm) {
      await this.state.storage.setAlarm(Date.now() + SESSION_CONFIG.ALARM_INTERVAL_MS);
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
