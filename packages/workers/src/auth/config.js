import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { createEmailService } from './email.js';

export function createAuth(env) {
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
    },
    // Add email verification and password reset functionality
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        console.log('📧 EMAIL VERIFICATION LINK (click to verify):');
        console.log('🔗', url);
        console.log('📨 Sending to:', user.email);
        console.log('👤 For user:', user.displayName || user.username || user.name);
        return await emailService.sendEmailVerification(user.email, url, user.displayName || user.username || user.name);
      },
    },

    resetPassword: {
      enabled: true,
      sendEmail: async ({ user, url, token }) => {
        console.log('🔑 PASSWORD RESET LINK (click to reset):');
        console.log('🔗', url);
        console.log('📨 Sending to:', user.email);
        console.log('👤 For user:', user.displayName || user.username || user.name);
        return await emailService.sendPasswordReset(user.email, url, user.displayName || user.username || user.name);
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
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  return authResult;
}
