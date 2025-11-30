import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema.js';
import { createEmailService } from './email.js';
import { errorResponse } from '../middleware/cors.js';

export function createAuth(env, ctx) {
  // Initialize Drizzle with D1
  const db = drizzle(env.DB, { schema });

  // Create email service
  const emailService = createEmailService(env);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
    },
    // Add email verification and password reset functionality
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      // CRITICAL: Wrap the email sending in a function passed to waitUntil
      // This ensures NO email work happens during the request - it all runs after response
      sendVerificationEmail: async ({ user, url }) => {
        console.log('[Auth] Queuing verification email to:', user.email, 'URL:', url);
        if (ctx && ctx.waitUntil) {
          ctx.waitUntil(
            (async () => {
              try {
                await emailService.sendEmailVerification(
                  user.email,
                  url,
                  user.displayName || user.username || user.name,
                );
              } catch (err) {
                console.error('[Auth:waitUntil] Background email error:', err);
              }
            })(),
          );
        } else {
          console.log('[Auth] No ctx.waitUntil available, email will not be sent');
        }
        return;
      },
    },

    resetPassword: {
      enabled: true,
      sendEmail: async ({ user, url }) => {
        console.log('[Auth] Queuing reset email to:', user.email, 'URL:', url);
        if (ctx && ctx.waitUntil) {
          ctx.waitUntil(
            (async () => {
              try {
                await emailService.sendPasswordReset(
                  user.email,
                  url,
                  user.displayName || user.username || user.name,
                );
              } catch (err) {
                console.error('Background email error:', err);
              }
            })(),
          );
        }
        return;
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },

    user: {
      additionalFields: {
        username: {
          type: 'string',
          required: false,
        },
        displayName: {
          type: 'string',
          required: false,
        },
        avatarUrl: {
          type: 'string',
          required: false,
        },
      },
    },

    secret: env.AUTH_SECRET || 'fallback-secret-change-in-production',
    baseURL: env.AUTH_BASE_URL || 'http://localhost:8787',

    trustedOrigins: [
      'http://localhost:5173', // Vite dev server
      'http://localhost:8787', // Worker dev server
      'https://corates.org',
      'https://www.corates.org',
      'https://app.corates.org', // Main app subdomain
      'https://api.corates.org',
      env.AUTH_BASE_URL || 'http://localhost:8787',
    ],

    advanced: {
      crossSubDomainCookies: {
        enabled: !!env.COOKIE_DOMAIN,
        domain: env.COOKIE_DOMAIN,
      },
      // Don't use useSecureCookies as it adds __Secure- prefix which conflicts with custom cookie names
      // Instead, we set secure: true in individual cookie attributes
      useSecureCookies: false,
      // Override ALL cookie settings to use SameSite=None for cross-subdomain
      cookies:
        env.COOKIE_DOMAIN ?
          {
            session_token: {
              name: 'better-auth.session_token',
              attributes: {
                sameSite: 'none',
                secure: true,
                httpOnly: true,
                path: '/',
                domain: env.COOKIE_DOMAIN,
              },
            },
            dont_remember: {
              name: 'better-auth.dont_remember',
              attributes: {
                sameSite: 'none',
                secure: true,
                httpOnly: true,
                path: '/',
                domain: env.COOKIE_DOMAIN,
              },
            },
            session_data: {
              name: 'better-auth.session_data',
              attributes: {
                sameSite: 'none',
                secure: true,
                httpOnly: true,
                path: '/',
                domain: env.COOKIE_DOMAIN,
              },
            },
          }
        : {},
      generateId: () => crypto.randomUUID(),
    },
  });
}

// Auth middleware to verify sessions
export async function verifyAuth(request, env) {
  try {
    const auth = createAuth(env);
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return { user: null, session: null };
    }

    return { user: session.user, session: session.session };
  } catch (error) {
    console.error('Auth verification error:', error);
    return { user: null, session: null };
  }
}

// Require authentication middleware
export async function requireAuth(request, env) {
  const authResult = await verifyAuth(request, env);

  if (!authResult.user) {
    return errorResponse('Authentication required', 401, request);
  }

  return authResult;
}
