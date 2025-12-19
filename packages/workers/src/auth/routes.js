/**
 * Auth routes for Hono
 * Handles better-auth integration and custom auth endpoints
 */

import { Hono } from 'hono';
import { createAuth } from './config.js';
import {
  getEmailVerificationSuccessPage,
  getEmailVerificationFailurePage,
  getEmailVerificationErrorPage,
} from './templates.js';
import { authRateLimit, sessionRateLimit } from '../middleware/rate-limit.js';

const auth = new Hono();

// Apply lenient rate limiting to session endpoints (called frequently)
auth.use('/get-session', sessionRateLimit);
auth.use('/session', sessionRateLimit);

// Apply strict rate limiting to sensitive auth endpoints (login, register, etc.)
// These are matched after the session routes above
auth.use('/sign-in/*', authRateLimit);
auth.use('/sign-up/*', authRateLimit);
auth.use('/forget-password/*', authRateLimit);
auth.use('/reset-password/*', authRateLimit);

/**
 * GET /api/auth/session
 * Custom session endpoint for WebSocket authentication
 */
auth.get('/session', async c => {
  try {
    const betterAuth = createAuth(c.env, c.executionCtx);
    const session = await betterAuth.api.getSession({
      headers: c.req.raw.headers,
    });

    return c.json({
      user: session?.user || null,
      session: session?.session || null,
      sessionToken: session?.session?.id || null,
    });
  } catch (error) {
    console.error('Session fetch error:', error);
    return c.json({ user: null, session: null });
  }
});

/**
 * Email verification handler
 * Provides custom HTML responses for email verification
 */
auth.get('/verify-email', async c => {
  try {
    const betterAuth = createAuth(c.env, c.executionCtx);
    const url = new URL(c.req.url);

    // Create request for better-auth
    const authUrl = new URL('/api/auth/verify-email', url.origin);
    authUrl.search = url.search;
    const authRequest = new Request(authUrl.toString(), {
      method: 'GET',
      headers: c.req.raw.headers,
    });

    // Let Better Auth handle the verification
    const response = await betterAuth.handler(authRequest);

    console.log('Email verification response status:', response.status);

    // Check if verification was successful
    if (response.status >= 200 && response.status < 400) {
      // Collect all Set-Cookie headers from the response
      const setCookieHeaders = response.headers.getSetCookie?.() || [];
      console.log('Set-Cookie headers from verification:', setCookieHeaders);

      // Build response with cookies preserved
      const headers = new Headers();
      headers.set('Content-Type', 'text/html; charset=utf-8');

      // Append all Set-Cookie headers
      for (const cookie of setCookieHeaders) {
        headers.append('Set-Cookie', cookie);
      }

      return new Response(getEmailVerificationSuccessPage(), {
        status: 200,
        headers,
      });
    } else {
      return new Response(getEmailVerificationFailurePage(), {
        status: response.status,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  } catch (error) {
    console.error('Email verification error:', error);
    return new Response(getEmailVerificationErrorPage(), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
});

/**
 * Catch-all handler for all other auth routes
 * Forwards to better-auth handler
 */
auth.all('/*', async c => {
  try {
    const betterAuth = createAuth(c.env, c.executionCtx);
    const url = new URL(c.req.url);
    const path = url.pathname;

    // Create a new request with the auth path, preserving query parameters
    const authUrl = new URL(path, url.origin);
    authUrl.search = url.search;
    const authRequest = new Request(authUrl.toString(), {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: c.req.raw.body,
    });

    // Let Better Auth handle the request
    const response = await betterAuth.handler(authRequest);

    // Return the response (CORS is handled by global middleware)
    return response;
  } catch (error) {
    console.error('Auth route error:', error);
    return c.json({ error: 'Authentication error', details: error.message }, 500);
  }
});

export { auth };
