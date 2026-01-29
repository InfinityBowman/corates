import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import {
  genericOAuth,
  magicLink,
  twoFactor,
  admin,
  organization,
  oAuthProxy,
} from 'better-auth/plugins';
import { stripe } from '@better-auth/stripe';
import Stripe from 'stripe';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema';
import { createEmailService } from './email';
import { getAllowedOrigins } from '../config/origins';
import { isAdminUser } from './admin';
import { MAGIC_LINK_EXPIRY_MINUTES } from './emailTemplates';
import { notifyOrgMembers, EventTypes } from '../lib/notify';
import { copyAvatarToR2, isExternalAvatarUrl, isInternalAvatarUrl } from '../lib/avatar-copy';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import type { Env } from '../types';

interface ExecutionContext {
  waitUntil: (_promise: Promise<unknown>) => void;
}

interface BetterAuthUser {
  id: string;
  email: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  image?: string | null;
  username?: string;
  role?: string;
  [key: string]: unknown;
}

interface BetterAuthSession {
  id: string;
  userId: string;
}

interface NewSessionData {
  user: BetterAuthUser;
  session: BetterAuthSession;
}

interface SubscriptionData {
  referenceId: string;
  plan: string;
  status: string;
  periodEnd?: Date | number | null;
  cancelAtPeriodEnd?: boolean | null;
  cancelAt?: Date | number | null;
  canceledAt?: Date | number | null;
}

interface AuthorizeReferenceParams {
  user: BetterAuthUser;
  session: BetterAuthSession;
  referenceId: string;
  action: string;
}

interface OrcidProfile {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
}

export function createAuth(env: Env, ctx?: ExecutionContext) {
  // Initialize Drizzle with D1
  const db = drizzle(env.DB, { schema });

  // Create email service
  const emailService = createEmailService(env);

  // Build social providers config if credentials are present
  const socialProviders: Record<string, unknown> = {};

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // Production redirect URI for OAuth proxy (allows localhost dev without registering redirect URIs)
      redirectURI: 'https://corates.org/api/auth/callback/google',
      // Required so Google issues a refresh token (needed for Drive access when access tokens expire)
      accessType: 'offline',
      // Request Drive read-only access for PDF import
      scope: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.readonly'],
      // Map Google's given_name/family_name to our schema
      mapProfileToUser: (profile: {
        given_name?: string;
        family_name?: string;
        name?: string;
        [key: string]: unknown;
      }) => ({
        givenName: profile.given_name || null,
        familyName: profile.family_name || null,
      }),
    };
  } else {
    console.error(
      '[Auth] Google OAuth NOT configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET',
    );
  }

  // Build plugins array
  const plugins: any[] = [];

  // OAuth Proxy plugin for local development
  // Proxies OAuth callbacks through production server so localhost works without registering redirect URIs
  // currentURL must be explicitly set so the plugin knows where to redirect back to
  const isProduction = env.AUTH_BASE_URL === 'https://corates.org';
  plugins.push(
    oAuthProxy({
      productionURL: 'https://corates.org',
      currentURL: isProduction ? undefined : (env.AUTH_BASE_URL || 'http://localhost:8787'),
    }),
  );

  // ORCID OAuth provider for researcher authentication (using genericOAuth plugin)
  if (env.ORCID_CLIENT_ID && env.ORCID_CLIENT_SECRET) {
    plugins.push(
      genericOAuth({
        config: [
          {
            providerId: 'orcid',
            clientId: env.ORCID_CLIENT_ID,
            clientSecret: env.ORCID_CLIENT_SECRET,
            redirectURI: 'https://corates.org/api/auth/callback/orcid',
            authorizationUrl: 'https://orcid.org/oauth/authorize',
            tokenUrl: 'https://orcid.org/oauth/token',
            userInfoUrl: 'https://orcid.org/oauth/userinfo',
            scopes: ['openid'],
            // Map ORCID profile to user fields
            getUserInfo: async (tokens: { accessToken?: string }) => {
              if (!tokens.accessToken) return null;
              const response = await fetch('https://orcid.org/oauth/userinfo', {
                headers: {
                  Authorization: `Bearer ${tokens.accessToken}`,
                },
              });
              const profile = (await response.json()) as OrcidProfile;
              const givenName = profile.given_name || null;
              const familyName = profile.family_name || null;
              const name =
                profile.name || [givenName, familyName].filter(Boolean).join(' ') || profile.sub;
              return {
                id: profile.sub,
                name,
                givenName,
                familyName,
                email: profile.email || `${profile.sub}@orcid.org`,
                emailVerified: !!profile.email,
                image: undefined,
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
      sendMagicLink: async ({ email, url }: { email: string; url: string }) => {
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
      async isAdmin(user: BetterAuthUser) {
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
  // IMPORTANT: Stripe price amounts must match prices defined in @corates/shared/plans/pricing.ts
  // - starter_team: $8/month, $80/year
  // - team: $29/month, $290/year
  // - unlimited_team: $59/month, $590/year
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET_AUTH) {
    const stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
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
              annualDiscountPriceId:
                env.STRIPE_PRICE_ID_STARTER_TEAM_YEARLY || 'price_starter_team_yearly',
            },
            {
              name: 'team',
              priceId: env.STRIPE_PRICE_ID_TEAM_MONTHLY || 'price_team_monthly',
              annualDiscountPriceId: env.STRIPE_PRICE_ID_TEAM_YEARLY || 'price_team_yearly',
            },
            {
              name: 'unlimited_team',
              priceId: env.STRIPE_PRICE_ID_UNLIMITED_TEAM_MONTHLY || 'price_unlimited_team_monthly',
              annualDiscountPriceId:
                env.STRIPE_PRICE_ID_UNLIMITED_TEAM_YEARLY || 'price_unlimited_team_yearly',
            },
          ],
          // Real-time notifications for subscription changes
          onSubscriptionComplete: async ({ subscription }: { subscription: SubscriptionData }) => {
            // Notify all org members when subscription is created/upgraded
            console.log(
              '[Auth] Queuing subscription complete notification for org:',
              subscription.referenceId,
            );
            if (ctx && ctx.waitUntil) {
              ctx.waitUntil(
                (async () => {
                  try {
                    const result = await notifyOrgMembers(env, db, subscription.referenceId, {
                      type: EventTypes.SUBSCRIPTION_UPDATED,
                      data: {
                        tier: subscription.plan,
                        status: subscription.status,
                        periodEnd: subscription.periodEnd,
                      },
                    });
                    console.log('[Auth:waitUntil] Subscription complete notification sent:', {
                      orgId: subscription.referenceId,
                      notified: result.notified,
                      failed: result.failed,
                    });
                  } catch (err) {
                    const error = err as Error;
                    console.error('[Auth:waitUntil] Subscription complete notification error:', {
                      orgId: subscription.referenceId,
                      error: error.message,
                    });
                  }
                })(),
              );
            }
          },
          onSubscriptionUpdate: async ({ subscription }: { subscription: SubscriptionData }) => {
            // Notify all org members when subscription changes
            console.log(
              '[Auth] Queuing subscription update notification for org:',
              subscription.referenceId,
            );
            if (ctx && ctx.waitUntil) {
              ctx.waitUntil(
                (async () => {
                  try {
                    const result = await notifyOrgMembers(env, db, subscription.referenceId, {
                      type: EventTypes.SUBSCRIPTION_UPDATED,
                      data: {
                        tier: subscription.plan,
                        status: subscription.status,
                        periodEnd: subscription.periodEnd,
                        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                      },
                    });
                    console.log('[Auth:waitUntil] Subscription update notification sent:', {
                      orgId: subscription.referenceId,
                      notified: result.notified,
                      failed: result.failed,
                    });
                  } catch (err) {
                    const error = err as Error;
                    console.error('[Auth:waitUntil] Subscription update notification error:', {
                      orgId: subscription.referenceId,
                      error: error.message,
                    });
                  }
                })(),
              );
            }
          },
          onSubscriptionCancel: async ({ subscription }: { subscription: SubscriptionData }) => {
            // Notify all org members when subscription is canceled
            console.log(
              '[Auth] Queuing subscription cancel notification for org:',
              subscription.referenceId,
            );
            if (ctx && ctx.waitUntil) {
              ctx.waitUntil(
                (async () => {
                  try {
                    const result = await notifyOrgMembers(env, db, subscription.referenceId, {
                      type: EventTypes.SUBSCRIPTION_CANCELED,
                      data: {
                        tier: subscription.plan,
                        cancelAt: subscription.cancelAt,
                        canceledAt: subscription.canceledAt,
                      },
                    });
                    console.log('[Auth:waitUntil] Subscription cancel notification sent:', {
                      orgId: subscription.referenceId,
                      notified: result.notified,
                      failed: result.failed,
                    });
                  } catch (err) {
                    const error = err as Error;
                    console.error('[Auth:waitUntil] Subscription cancel notification error:', {
                      orgId: subscription.referenceId,
                      error: error.message,
                    });
                  }
                })(),
              );
            }
          },
          authorizeReference: async ({
            user,
            session: _session,
            referenceId,
            action,
          }: AuthorizeReferenceParams) => {
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
          // Enable promo codes and billing address collection
          getCheckoutSessionParams: async () => {
            return {
              params: {
                allow_promotion_codes: true,
                billing_address_collection: 'auto',
              },
            };
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
      sendResetPassword: async ({ user, url }: { user: BetterAuthUser; url: string }) => {
        console.log('[Auth] Queuing reset email to:', user.email, 'URL:', url);
        if (ctx && ctx.waitUntil) {
          ctx.waitUntil(
            (async () => {
              try {
                await emailService.sendPasswordReset(
                  user.email,
                  url,
                  user.givenName || user.name || user.username,
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
      sendVerificationEmail: async ({ user, url }: { user: BetterAuthUser; url: string }) => {
        console.log('[Auth] Queuing verification email to:', user.email, 'URL:', url);
        if (ctx && ctx.waitUntil) {
          ctx.waitUntil(
            (async () => {
              try {
                await emailService.sendEmailVerification(
                  user.email,
                  url,
                  user.givenName || user.name || user.username,
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
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },

    user: {
      additionalFields: {
        givenName: {
          type: 'string',
          required: false,
        },
        familyName: {
          type: 'string',
          required: false,
        },
        username: {
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
        title: {
          type: 'string',
          required: false,
        },
        institution: {
          type: 'string',
          required: false,
        },
        department: {
          type: 'string',
          required: false,
        },
        country: {
          type: 'string',
          required: false,
        },
        bio: {
          type: 'string',
          required: false,
        },
        timezone: {
          type: 'string',
          required: false,
        },
        locale: {
          type: 'string',
          required: false,
        },
        preferences: {
          type: 'string',
          required: false,
        },
        lastActiveAt: {
          type: 'number',
          required: false,
        },
      },
    },

    baseURL: env.AUTH_BASE_URL || 'http://localhost:8787',

    // Use centralized origin configuration
    trustedOrigins: getAllowedOrigins(env),

    secret: getAuthSecret(env),

    // Hooks for custom auth behavior
    hooks: {
      // After hook: bootstrap personal org and copy OAuth avatar on first successful authentication
      after: createAuthMiddleware(async (authCtx: { context: { newSession?: NewSessionData } }) => {
        const newSession = authCtx.context.newSession;
        if (!newSession) return;

        const userId = newSession.user.id;
        const userImage = newSession.user.image;
        const userName =
          newSession.user.givenName ||
          newSession.user.name ||
          newSession.user.email?.split('@')[0] ||
          'User';

        // Copy external OAuth avatar to R2 in the background
        // This ensures all avatars are served from our storage, avoiding external URL issues
        if (
          ctx &&
          ctx.waitUntil &&
          isExternalAvatarUrl(userImage) &&
          !isInternalAvatarUrl(userImage)
        ) {
          console.log(`[Auth] Queuing avatar copy for user ${userId} from ${userImage}`);
          ctx.waitUntil(
            (async () => {
              try {
                const result = await copyAvatarToR2(env, userId, userImage);
                if (result.success && result.url) {
                  // Update user's image field with the R2 URL
                  await db
                    .update(schema.user)
                    .set({ image: result.url })
                    .where(eq(schema.user.id, userId));
                  console.log(`[Auth:waitUntil] Avatar copied for user ${userId}: ${result.url}`);
                } else if (result.error) {
                  console.error(`[Auth:waitUntil] Avatar copy failed for user ${userId}:`, {
                    code: result.error.code,
                    message: result.error.message,
                    details: result.error.details,
                  });
                }
              } catch (err) {
                console.error('[Auth:waitUntil] Avatar copy error:', err);
              }
            })(),
          );
        }

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
function getAuthSecret(env: Env): string {
  if (env.AUTH_SECRET) {
    return env.AUTH_SECRET;
  }

  throw createDomainError(
    SYSTEM_ERRORS.INTERNAL_ERROR,
    { key: 'AUTH_SECRET' },
    'AUTH_SECRET must be configured',
  );
}

// Auth middleware to verify sessions
export async function verifyAuth(
  request: Request,
  env: Env,
): Promise<{ user: BetterAuthUser | null; session: BetterAuthSession | null }> {
  try {
    const auth = createAuth(env);
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return { user: null, session: null };
    }

    return { user: session.user as BetterAuthUser, session: session.session as BetterAuthSession };
  } catch (error) {
    console.error('Auth verification error:', error);
    return { user: null, session: null };
  }
}
