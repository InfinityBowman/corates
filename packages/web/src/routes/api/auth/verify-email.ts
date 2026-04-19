/**
 * GET /api/auth/verify-email — branded HTML wrapper around better-auth's
 * verification endpoint.
 *
 * Forwards the inbound request (with original query) to better-auth, then
 * swaps the response body for a CoRATES-styled success/failure/error page
 * while preserving any Set-Cookie headers (auto-sign-in after verification).
 */
import { createFileRoute } from '@tanstack/react-router';
import { logMiddleware, type RequestLogger } from '@/server/middleware/log';
import { env } from 'cloudflare:workers';
import { createAuth } from '@corates/workers/auth-config';
import {
  getEmailVerificationSuccessPage,
  getEmailVerificationFailurePage,
  getEmailVerificationErrorPage,
} from '@/server/lib/authHtmlPages';

type HandlerArgs = { request: Request; context: { log: RequestLogger; cloudflareCtx?: ExecutionContext } };

export const handleGet = async ({ request, context }: HandlerArgs) => {
  try {
    const auth = createAuth(env, context?.cloudflareCtx);
    const url = new URL(request.url);
    const authUrl = new URL('/api/auth/verify-email', url.origin);
    authUrl.search = url.search;

    const authRequest = new Request(authUrl.toString(), {
      method: 'GET',
      headers: request.headers,
    });

    const response = await auth.handler(authRequest);

    if (response.status >= 200 && response.status < 400) {
      const setCookieHeaders = response.headers.getSetCookie?.() ?? [];

      const headers = new Headers();
      headers.set('Content-Type', 'text/html; charset=utf-8');
      for (const cookie of setCookieHeaders) {
        headers.append('Set-Cookie', cookie);
      }

      return new Response(getEmailVerificationSuccessPage(), { status: 200, headers });
    }

    return new Response(getEmailVerificationFailurePage(), {
      status: response.status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return new Response(getEmailVerificationErrorPage(), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
};

export const Route = createFileRoute('/api/auth/verify-email')({
  server: { middleware: [logMiddleware], handlers: { GET: handleGet } },
});
