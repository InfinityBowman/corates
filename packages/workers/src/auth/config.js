import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth, magicLink, twoFactor, admin } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema.js';
import { createEmailService } from './email.js';
import { getAllowedOrigins } from '../config/origins.js';
import { isAdminUser } from './admin.js';
import { MAGIC_LINK_EXPIRY_MINUTES } from './emailTemplates.js';

export function createAuth(env, ctx) {
  // Initialize Drizzle with D1
  const db = drizzle(env.DB, { schema });

  // Create email service
  const emailService = createEmailService(env);

  // Build social providers config if credentials are present
  const socialProviders = {};

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // Required so Google issues a refresh token (needed for Drive access when access tokens expire)
      accessType: 'offline',
      // Request Drive read-only access for PDF import
      scope: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.readonly'],
    };
  } else {
    console.error(
      '[Auth] Google OAuth NOT configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET',
    );
  }

  // Build plugins array
  const plugins = [];

  // ORCID OAuth provider for researcher authentication (using genericOAuth plugin)
  if (env.ORCID_CLIENT_ID && env.ORCID_CLIENT_SECRET) {
    plugins.push(
      genericOAuth({
        config: [
          {
            providerId: 'orcid',
            clientId: env.ORCID_CLIENT_ID,
            clientSecret: env.ORCID_CLIENT_SECRET,
            authorizationUrl: 'https://orcid.org/oauth/authorize',
            tokenUrl: 'https://orcid.org/oauth/token',
            userInfoUrl: 'https://orcid.org/oauth/userinfo',
            scopes: ['openid'],
            // Map ORCID profile to user fields
            getUserInfo: async ({ accessToken }) => {
              const response = await fetch('https://orcid.org/oauth/userinfo', {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              });
              const profile = await response.json();
              return {
                id: profile.sub,
                name:
                  profile.name ||
                  `${profile.given_name || ''} ${profile.family_name || ''}`.trim() ||
                  profile.sub,
                email: profile.email || `${profile.sub}@orcid.org`,
                emailVerified: !!profile.email,
                image: null,
              };
            },
          },
        ],
      }),
    );
  } else {
    console.error(
      '[Auth] ORCID OAuth NOT configured - missing ORCID_CLIENT_ID or ORCID_CLIENT_SECRET',
    );
  }

  // Magic Link plugin for passwordless authentication
  plugins.push(
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        console.log('[Auth] Queuing magic link email to:', email, 'URL:', url);
        if (ctx && ctx.waitUntil) {
          ctx.waitUntil(
            (async () => {
              try {
                await emailService.sendMagicLink(email, url);
              } catch (err) {
                console.error('[Auth:waitUntil] Magic link email error:', err);
              }
            })(),
          );
        }
      },
      expiresIn: 60 * MAGIC_LINK_EXPIRY_MINUTES,
    }),
  );

  // Two-Factor Authentication plugin
  plugins.push(
    twoFactor({
      issuer: 'CoRATES',
      // Customize backup codes
      backupCodes: {
        length: 10, // 10 backup codes
        characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      },
    }),
  );

  // Admin plugin for user management and impersonation
  plugins.push(
    admin({
      async isAdmin(user) {
        return isAdminUser(user);
      },
      defaultRole: 'user',
      impersonationSessionDuration: 60 * 60, // 1 hour
    }),
  );

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
      },
    }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      // Password reset - sendResetPassword is required for requestPasswordReset to work
      sendResetPassword: async ({ user, url }) => {
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

    // Social/OAuth providers
    socialProviders,

    // Plugins (including genericOAuth for ORCID)
    plugins,

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
        role: {
          type: 'string',
          required: false,
        },
        persona: {
          type: 'string',
          required: false,
        },
        profileCompletedAt: {
          type: 'number',
          required: false,
        },
        twoFactorEnabled: {
          type: 'boolean',
          required: false,
        },
      },
    },

    baseURL: env.AUTH_BASE_URL || 'http://localhost:8787',

    // Use centralized origin configuration
    trustedOrigins: getAllowedOrigins(env),

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

    secret: getAuthSecret(env),
  });
}

/**
 * Get AUTH_SECRET with proper validation
 * Throws in production if not configured
 */
function getAuthSecret(env) {
  if (env.AUTH_SECRET) {
    return env.AUTH_SECRET;
  }

  throw new Error('AUTH_SECRET must be configured');
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
