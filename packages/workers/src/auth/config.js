import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth, magicLink, twoFactor, admin, organization } from 'better-auth/plugins';
import { stripe } from '@better-auth/stripe';
import Stripe from 'stripe';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
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

  // Organization plugin for multi-tenant support
  plugins.push(
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: 'owner',
      membershipLimit: 100,
    }),
  );

  // Stripe plugin for org-scoped subscriptions
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET_AUTH) {
    const stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
    });

    plugins.push(
      stripe({
        stripeClient,
        stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET_AUTH,
        createCustomerOnSignUp: true,
        subscription: {
          enabled: true,
          plans: [
            {
              name: 'starter_team',
              priceId: env.STRIPE_PRICE_ID_STARTER_TEAM_MONTHLY || 'price_starter_team_monthly',
              annualDiscountPriceId: env.STRIPE_PRICE_ID_STARTER_TEAM_YEARLY || 'price_starter_team_yearly',
            },
            {
              name: 'team',
              priceId: env.STRIPE_PRICE_ID_TEAM_MONTHLY || 'price_team_monthly',
              annualDiscountPriceId: env.STRIPE_PRICE_ID_TEAM_YEARLY || 'price_team_yearly',
            },
            {
              name: 'unlimited_team',
              priceId: env.STRIPE_PRICE_ID_UNLIMITED_TEAM_MONTHLY || 'price_unlimited_team_monthly',
              annualDiscountPriceId: env.STRIPE_PRICE_ID_UNLIMITED_TEAM_YEARLY || 'price_unlimited_team_yearly',
            },
          ],
          authorizeReference: async ({ user, session: _session, referenceId, action }) => {
            // Check if user is org owner for subscription management actions
            if (
              action === 'upgrade-subscription' ||
              action === 'cancel-subscription' ||
              action === 'restore-subscription' ||
              action === 'list-subscription'
            ) {
              const membership = await db
                .select({ role: schema.member.role })
                .from(schema.member)
                .where(
                  and(
                    eq(schema.member.organizationId, referenceId),
                    eq(schema.member.userId, user.id),
                  ),
                )
                .get();

              return membership?.role === 'owner';
            }
            return true;
          },
        },
      }),
    );
  } else {
    console.error(
      '[Auth] Stripe plugin NOT configured - missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET_AUTH',
    );
  }

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
        organization: schema.organization,
        member: schema.member,
        invitation: schema.invitation,
        subscription: schema.subscription,
      },
    }),

    // Enable account linking so users with the same email are merged
    account: {
      accountLinking: {
        enabled: true,
        // Trust Google since it verifies emails; ORCID may not always have verified emails
        trustedProviders: ['google'],
        // Allow linking accounts with different emails (user must be authenticated first)
        allowDifferentEmails: true,
        // Allow unlinking all OAuth accounts (user can still sign in with magic link if email is verified)
        allowUnlinkingAll: true,
      },
    },

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

    // Hooks for custom auth behavior
    hooks: {
      // After hook: bootstrap personal org on first successful authentication
      after: createAuthMiddleware(async ctx => {
        const newSession = ctx.context.newSession;
        if (!newSession) return;

        const userId = newSession.user.id;
        const userName = newSession.user.name || newSession.user.email?.split('@')[0] || 'User';

        try {
          // Check if user has any org memberships
          const existingMembership = await db
            .select({ id: schema.member.id })
            .from(schema.member)
            .where(eq(schema.member.userId, userId))
            .limit(1)
            .get();

          if (existingMembership) {
            // User already has at least one org, no bootstrap needed
            return;
          }

          // Create personal org for the user
          const orgId = crypto.randomUUID();
          const memberId = crypto.randomUUID();
          const now = new Date();
          const slug = `${userName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${orgId.slice(0, 8)}`;

          // Insert org and membership
          await db.insert(schema.organization).values({
            id: orgId,
            name: `${userName}'s Workspace`,
            slug,
            metadata: JSON.stringify({ type: 'personal' }),
            createdAt: now,
          });

          await db.insert(schema.member).values({
            id: memberId,
            userId,
            organizationId: orgId,
            role: 'owner',
            createdAt: now,
          });

          // Update the session to set activeOrganizationId
          await db
            .update(schema.session)
            .set({ activeOrganizationId: orgId })
            .where(eq(schema.session.id, newSession.session.id));

          console.log(`[Auth] Created personal org ${orgId} for user ${userId}`);
        } catch (err) {
          // Log but don't fail the auth - user can create org later
          console.error('[Auth] Failed to bootstrap personal org:', err);
        }
      }),
    },
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
