import { verifyAuth } from '../auth/config.js';

export class UserSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Dynamic CORS headers for credentialed requests
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:8787',
      'https://corates.org',
      'https://www.corates.org',
    ];
    const requestOrigin = request.headers.get('Origin');
    const corsHeaders = {
      'Access-Control-Allow-Origin':
        allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
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
