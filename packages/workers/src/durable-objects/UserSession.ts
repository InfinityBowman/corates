import { DurableObject } from 'cloudflare:workers';
import { captureError, info, runWithLogger } from '../lib/logger';
import { instrumentDurableObjectWithSentry } from '@sentry/cloudflare';
import { verifyAuth } from '../auth/config';
import { getAccessControlOrigin } from '../config/origins';
import type { Env } from '../types';

interface Notification {
  type: string;
  timestamp?: number;
  [key: string]: unknown;
}

interface WebSocketAttachment {
  user: { id: string; [key: string]: unknown };
}

class UserSessionBase extends DurableObject<Env> {
  // The calling worker's scope cannot follow the request across the isolate
  // boundary, so it forwards its id as a header and we reopen a scope here.
  // Requests that arrive without one still get a scope, just an unlinked one.
  async fetch(request: Request): Promise<Response> {
    return runWithLogger(
      {
        requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
        cfRay: request.headers.get('cf-ray'),
        env: this.env.ENVIRONMENT,
        context: { durableObject: 'UserSession' },
      },
      () => this.handleFetch(request),
    );
  }

  private async handleFetch(request: Request): Promise<Response> {
    const requestOrigin = request.headers.get('Origin');
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': getAccessControlOrigin(requestOrigin),
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
      captureError(err, { tags: { component: 'user-session', action: 'websocket-auth' } });
    }

    if (!user) {
      return new Response('Authentication required', { status: 401 });
    }

    const url = new URL(request.url);
    const sessionUserId = this.extractUserIdFromPath(url.pathname);

    if (!sessionUserId || sessionUserId !== user.id) {
      return new Response('Access denied', { status: 403 });
    }

    try {
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

      info('user-session websocket connected', {
        action: 'websocket-upgrade',
        userId: user.id,
        pendingDelivered: pending.length,
      });

      return new Response(null, { status: 101, webSocket: client });
    } catch (err) {
      captureError(err, { tags: { component: 'user-session', action: 'websocket-upgrade' } });
      return new Response('WebSocket upgrade failed', { status: 500 });
    }
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
      const pending = (await this.ctx.storage.get<Notification[]>('pendingNotifications')) || [];
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
      captureError(err, { tags: { component: 'user-session', action: 'websocket-message' } });
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
    captureError(error, { tags: { component: 'user-session', action: 'websocket-error' } });
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

export const UserSession = instrumentDurableObjectWithSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN ?? '',
    release: env.CF_VERSION_METADATA?.id,
    environment: env.ENVIRONMENT,
    enabled: !!env.SENTRY_DSN,
    tracesSampleRate: env.ENVIRONMENT === 'production' ? 0.1 : 1.0,
  }),
  UserSessionBase,
);
// eslint-disable-next-line no-redeclare
export type UserSession = UserSessionBase;
