import { createAuth, verifyAuth } from './config.js';
import {
  getEmailVerificationSuccessPage,
  getEmailVerificationFailurePage,
  getEmailVerificationErrorPage,
} from './templates.js';
import { getCorsHeaders, handlePreflight } from '../middleware/cors.js';

export async function handleAuthRoutes(request, env, ctx, path) {
  // Use the shared CORS configuration
  const corsHeaders = getCorsHeaders(request);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = createAuth(env, ctx);
    const url = new URL(request.url);

    // Better Auth handles all its endpoints automatically
    // We just need to forward the request with the correct path
    // Create a new request with the auth path, preserving query parameters
    const authUrl = new URL(path, url.origin);
    authUrl.search = url.search; // Preserve query parameters like ?token=...
    const authRequest = new Request(authUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    // Handle session endpoint for WebSocket authentication
    if (path === '/api/auth/session' && request.method === 'GET') {
      try {
        const session = await auth.api.getSession({
          headers: request.headers,
        });

        const responseData = {
          user: session?.user || null,
          session: session?.session || null,
          sessionToken: session?.session?.id || null,
        };

        return new Response(JSON.stringify(responseData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Session fetch error:', error);
        return new Response(JSON.stringify({ user: null, session: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle email verification - custom handling for redirect
    if (path === '/api/auth/verify-email') {
      try {
        // Let Better Auth handle the verification
        const response = await auth.handler(authRequest);

        console.log('Email verification response status:', response.status);
        console.log(
          'Email verification response headers:',
          Object.fromEntries(response.headers.entries()),
        );

        // Check if verification was successful
        if (response.status >= 200 && response.status < 400) {
          // Get auth cookies from the response, but filter out content-type
          const preservedHeaders = {};
          for (const [key, value] of response.headers.entries()) {
            if (key.toLowerCase() !== 'content-type') {
              preservedHeaders[key] = value;
            }
          }

          // Use the existing template from templates.js
          return new Response(getEmailVerificationSuccessPage(), {
            status: 200,
            headers: {
              ...preservedHeaders, // Preserve auth cookies but not content-type
              ...corsHeaders,
              'Content-Type': 'text/html; charset=utf-8',
            },
          });
        } else {
          // Handle verification failure using existing template
          return new Response(getEmailVerificationFailurePage(), {
            status: response.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/html; charset=utf-8',
            },
          });
        }
      } catch (error) {
        console.error('Email verification error:', error);
        return new Response(getEmailVerificationErrorPage(), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
    }

    // Better Auth handles all its endpoints automatically
    // We just need to forward the request with the correct path
    // ...existing code...

    // Let Better Auth handle the request
    const response = await auth.handler(authRequest);

    // Add CORS headers to the response
    const corsResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        ...corsHeaders,
      },
    });

    return corsResponse;
  } catch (error) {
    console.error('Auth route error:', error);
    return new Response(JSON.stringify({ error: 'Authentication error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
