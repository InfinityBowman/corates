import { DurableObject } from 'cloudflare:workers';
import { verifyAuth } from '../auth/config';
import { getAccessControlOrigin } from '../config/origins';
import type { Env } from '../types';

export interface Notification {
  type: string;
  timestamp?: number;
  [key: string]: unknown;
}

interface WebSocketAttachment {
  user: { id: string; [key: string]: unknown };
}

export class UserSession extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const requestOrigin = request.headers.get('Origin');
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': getAccessControlOrigin(requestOrigin, this.env),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, User-Agent',
      'Access-Control-Allow-Credentials': 'true',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // WebSocket upgrade is the only fetch-based path remaining
    if (request.headers.get('Upgrade') === 'websocket') {
      return await this.handleWebSocket(request);
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  /**
   * Handle WebSocket connections for real-time notifications (Hibernatable API)
   */
  async handleWebSocket(request: Request): Promise<Response> {
    let user: { id: string; [key: string]: unknown } | null = null;
    try {
      const authResult = await verifyAuth(request, this.env);
      user = authResult.user as { id: string; [key: string]: unknown } | null;
    } catch (err) {
      console.error('WebSocket auth error:', err);
    }

    if (!user) {
      return new Response('Authentication required', { status: 401 });
    }

    const url = new URL(request.url);
    const sessionUserId = this.extractUserIdFromPath(url.pathname);

    if (!sessionUserId || sessionUserId !== user.id) {
      return new Response('Access denied', { status: 403 });
    }

    const webSocketPair = new WebSocketPair();
    const client = webSocketPair[0];
    const server = webSocketPair[1];

    // Accept with hibernation support and tag with user ID for targeted lookups
    this.ctx.acceptWebSocket(server, ['user:' + user.id]);
    server.serializeAttachment({ user } satisfies WebSocketAttachment);

    // Send any pending notifications
    const pending = (await this.ctx.storage.get<Notification[]>('pendingNotifications')) || [];
    if (pending.length > 0) {
      for (const notification of pending) {
        server.send(JSON.stringify(notification));
      }
      await this.ctx.storage.put('pendingNotifications', []);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * RPC method: send a notification to connected clients or queue for later
   */
  async notify(notification: Notification): Promise<{ success: boolean; delivered: boolean }> {
    if (!notification.timestamp) {
      notification.timestamp = Date.now();
    }

    const sockets = this.ctx.getWebSockets();
    let delivered = false;

    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(notification));
        delivered = true;
      }
    }

    if (!delivered) {
      const pending =
        (await this.ctx.storage.get<Notification[]>('pendingNotifications')) || [];
      pending.push(notification);
      if (pending.length > 50) {
        pending.shift();
      }
      await this.ctx.storage.put('pendingNotifications', pending);
    }

    return { success: true, delivered };
  }

  /**
   * Hibernatable WebSocket API: handle incoming messages
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const data = JSON.parse(message as string) as { type?: string };
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  }

  /**
   * Hibernatable WebSocket API: handle close
   */
  async webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    // No cleanup needed -- the runtime removes closed sockets from getWebSockets()
  }

  /**
   * Hibernatable WebSocket API: handle errors
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error in UserSession:', error);
    try {
      ws.close(1011, 'Internal error');
    } catch {
      // Socket may already be closed
    }
  }

  /**
   * Extract user ID from the URL path
   * Expected pattern: /api/sessions/:userId/...
   */
  extractUserIdFromPath(path: string): string | null {
    const match = path.match(/\/api\/sessions\/([^/]+)/);
    return match ? match[1] : null;
  }
}
