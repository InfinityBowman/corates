import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { createEmailService } from './email.js';
import { errorResponse } from '../middleware/cors.js';

export function createAuth(env, ctx) {
  // Initialize Drizzle with D1
  const db = drizzle(env.DB, { schema });

  // Create email service
  const emailService = createEmailService(env);

  // Check if we're in production environment
  const isProduction = env.ENVIRONMENT === 'production';
  // const sendEmails = env.SEND_EMAILS_IN_DEV === 'true' || isProduction;
  // console.log(`Email sending is ${sendEmails ? 'ENABLED' : 'DISABLED'}`, env.SEND_EMAILS_IN_DEV);

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
      // Custom password hashing using PBKDF2 with Web Crypto API
      // The default scrypt exceeds Cloudflare Workers' 10ms CPU limit
      // password: {
      //   hash: async password => {
      //     const encoder = new TextEncoder();
      //     const salt = crypto.getRandomValues(new Uint8Array(16));
      //     const keyMaterial = await crypto.subtle.importKey(
      //       'raw',
      //       encoder.encode(password),
      //       'PBKDF2',
      //       false,
      //       ['deriveBits'],
      //     );
      //     const hash = await crypto.subtle.deriveBits(
      //       {
      //         name: 'PBKDF2',
      //         salt: salt,
      //         iterations: 100000,
      //         hash: 'SHA-256',
      //       },
      //       keyMaterial,
      //       256,
      //     );
      //     const hashArray = new Uint8Array(hash);
      //     const combined = new Uint8Array(salt.length + hashArray.length);
      //     combined.set(salt);
      //     combined.set(hashArray, salt.length);
      //     return btoa(String.fromCharCode(...combined));
      //   },
      //   verify: async ({ password, hash: storedHash }) => {
      //     const encoder = new TextEncoder();
      //     const combined = Uint8Array.from(atob(storedHash), c => c.charCodeAt(0));
      //     const salt = combined.slice(0, 16);
      //     const storedHashBytes = combined.slice(16);
      //     const keyMaterial = await crypto.subtle.importKey(
      //       'raw',
      //       encoder.encode(password),
      //       'PBKDF2',
      //       false,
      //       ['deriveBits'],
      //     );
      //     const hash = await crypto.subtle.deriveBits(
      //       {
      //         name: 'PBKDF2',
      //         salt: salt,
      //         iterations: 100000,
      //         hash: 'SHA-256',
      //       },
      //       keyMaterial,
      //       256,
      //     );
      //     const hashArray = new Uint8Array(hash);
      //     if (hashArray.length !== storedHashBytes.length) return false;
      //     for (let i = 0; i < hashArray.length; i++) {
      //       if (hashArray[i] !== storedHashBytes[i]) return false;
      //     }
      //     return true;
      //   },
      // },
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
          // Pass a NEW promise that hasn't started yet
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
        // Return immediately without doing any email work
        return;
      },
    },

    resetPassword: {
      enabled: true,
      sendEmail: async ({ user, url, token }) => {
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
      'https://api.corates.org',
      env.AUTH_BASE_URL || 'http://localhost:8787',
    ],

    advanced: {
      crossSubDomainCookies: {
        enabled: false, // Disable for localhost development
        domain: env.COOKIE_DOMAIN, // Set via environment variable for production
      },
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
