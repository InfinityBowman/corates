import { captureError, warn, info } from '../lib/logger';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import {
  genericOAuth,
  emailOTP,
  twoFactor,
  admin,
  organization,
  testUtils,
} from 'better-auth/plugins';
import { oAuthRelay } from './oauth-relay';
import { stripe } from '@better-auth/stripe';
import { createStripeClient } from '@corates/shared/stripe';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, count } from 'drizzle-orm';
import * as schema from '@corates/db/schema';
import { getAllowedOrigins } from '../config/origins';
import { isAdminUser } from './admin';
import { getAuthCodeEmail, AUTH_CODE_EXPIRY_MINUTES } from './emailTemplates';
import { queueEmail, isSyntheticEmail, makeSyntheticEmail } from '@corates/shared/email';
import { onboardingEmail } from './onboarding-email';
import { fetchOrcidPublicEmail } from './orcid-public-email';
import { refreshOrgWorkspaceSessions } from '../sync/admin';
import { notifyOrgMembers, EventTypes } from '../lib/notify';
import { copyAvatarToR2, isExternalAvatarUrl, isInternalAvatarUrl } from '../lib/avatar-copy';
import { buildAppUrl } from '../lib/app-url';
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

// Stripe hands these fields back as epoch seconds on some events and as Date on
// others (depending on whether the value came off the raw payload or the DB
// row). Normalize so the log field has one type to query on.
function toIsoTimestamp(value: Date | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return (value instanceof Date ? value : new Date(value * 1000)).toISOString();
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

  // Build social providers config if credentials are present
  const socialProviders: Record<string, unknown> = {};

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // Production redirect URI for OAuth proxy (allows localhost dev without registering redirect URIs)
      redirectURI: 'https://corates.org/api/auth/callback/google',
      // Provider-level so the Drive link-social flow gets refresh tokens
      accessType: 'offline',
      // Drive scope is requested incrementally at connect time; the restricted scope at sign-in scares users off
      scope: ['openid', 'email', 'profile'],
      // An unknown identity on the sign-in page must not silently mint a second
      // account; the sign-up page opts in with requestSignUp
      disableImplicitSignUp: true,
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
    warn('Google OAuth NOT configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  }

  // Build plugins array
  const plugins: any[] = [];

  // Test utilities for e2e testing (dev only)
  if (env.DEV_MODE) {
    plugins.push(testUtils());
  }

  // OAuth Relay plugin for local development
  // Relays OAuth tokens through production so localhost can create its own sessions
  // Unlike oAuthProxy, this works with separate databases (no session sharing needed)
  plugins.push(
    oAuthRelay({
      productionURL: 'https://corates.org',
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
            // Same sign-in gate as Google; see socialProviders.google above
            disableImplicitSignUp: true,
            // Account rows are keyed on (issuer, accountId). createAuth runs per
            // request, so pin ORCID's OIDC issuer rather than paying for a
            // discovery fetch on every cold path. Must match the backfill in
            // the account.issuer migration.
            accountIssuer: 'https://orcid.org',
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
              // OIDC userinfo has no email claim; fall back to a verified public address
              const publicEmail =
                profile.email || (await fetchOrcidPublicEmail(profile.sub, tokens.accessToken));
              info('auth.orcid_public_email', { found: !!publicEmail });
              return {
                id: profile.sub,
                name,
                givenName,
                familyName,
                email: publicEmail || makeSyntheticEmail(profile.sub),
                emailVerified: !!publicEmail,
                image: undefined,
              };
            },
            // Only email/name/image survive from getUserInfo; extra user fields
            // have to come through mapProfileToUser
            mapProfileToUser: profile => ({
              givenName: (profile.givenName as string | null | undefined) ?? null,
              familyName: (profile.familyName as string | null | undefined) ?? null,
            }),
          },
        ],
      }),
    );
  } else {
    warn('ORCID OAuth NOT configured - missing ORCID_CLIENT_ID or ORCID_CLIENT_SECRET');
  }

  // Codes instead of links: mail scanners burn single-use links, and a link
  // opened on another device loses the browser state the flow needs
  const sendAuthCode = async (
    email: string,
    code: string,
    purpose: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email',
  ) => {
    // Placeholder ORCID addresses are not mailboxes; sending would hard-bounce
    if (isSyntheticEmail(email)) {
      info('auth.code_skipped_synthetic', { purpose });
      return;
    }
    if (env.ENVIRONMENT === 'production') {
      info('auth.code_requested', { purpose, email });
    } else {
      // Bold yellow so the code stands out in the dev server log
      console.log(`\x1b[1;33m[Auth] ${purpose} code for ${email}: ${code}\x1b[0m`);
    }
    const { subject, html, text } = getAuthCodeEmail({ purpose, code });
    await queueEmail(env.EMAIL_QUEUE, { to: email, subject, html, text });
  };

  plugins.push(
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * AUTH_CODE_EXPIRY_MINUTES,
      allowedAttempts: 5,
      overrideDefaultEmailVerification: true,
      sendVerificationOnSignUp: true,
      sendVerificationOTP: async ({ email, otp, type }) => sendAuthCode(email, otp, type),
    }),
  );

  plugins.push(
    onboardingEmail({
      db,
      expiresIn: 60 * AUTH_CODE_EXPIRY_MINUTES,
      sendCode: async ({ email, code }) => sendAuthCode(email, code, 'change-email'),
      // A user that created or joined a project is not a throwaway sign-in
      canDiscardUser: async userId => {
        const owned = await db
          .select({ n: count() })
          .from(schema.projects)
          .where(eq(schema.projects.createdBy, userId))
          .get();
        const joined = await db
          .select({ n: count() })
          .from(schema.projectMembers)
          .where(eq(schema.projectMembers.userId, userId))
          .get();
        return (owned?.n ?? 0) === 0 && (joined?.n ?? 0) === 0;
      },
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
  // - team: $30/month, $300/year
  // - lab: $90/month, $900/year
  // Enterprise is provisioned by hand in the admin UI and has no Stripe price.
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET_AUTH) {
    const stripeClient = createStripeClient(env.STRIPE_SECRET_KEY);

    const requiredPriceIds = {
      STRIPE_PRICE_ID_TEAM_MONTHLY: env.STRIPE_PRICE_ID_TEAM_MONTHLY,
      STRIPE_PRICE_ID_TEAM_YEARLY: env.STRIPE_PRICE_ID_TEAM_YEARLY,
      STRIPE_PRICE_ID_LAB_MONTHLY: env.STRIPE_PRICE_ID_LAB_MONTHLY,
      STRIPE_PRICE_ID_LAB_YEARLY: env.STRIPE_PRICE_ID_LAB_YEARLY,
    } as const;

    const missing = Object.entries(requiredPriceIds)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length > 0) {
      // eslint-disable-next-line corates/corates-error-helpers -- startup config validation, not a domain/transport error
      throw new Error(`Stripe is configured but missing price IDs: ${missing.join(', ')}`);
    }

    plugins.push(
      stripe({
        stripeClient,
        stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET_AUTH,
        createCustomerOnSignUp: true,
        subscription: {
          enabled: true,
          plans: [
            {
              name: 'team',
              priceId: requiredPriceIds.STRIPE_PRICE_ID_TEAM_MONTHLY,
              annualDiscountPriceId: requiredPriceIds.STRIPE_PRICE_ID_TEAM_YEARLY,
            },
            {
              name: 'lab',
              priceId: requiredPriceIds.STRIPE_PRICE_ID_LAB_MONTHLY,
              annualDiscountPriceId: requiredPriceIds.STRIPE_PRICE_ID_LAB_YEARLY,
            },
          ],
          // Real-time notifications for subscription changes
          onSubscriptionComplete: async ({ subscription }: { subscription: SubscriptionData }) => {
            // Logged outside the waitUntil block so the transition is recorded
            // even when the notification side effects cannot be scheduled.
            info('billing.subscription_completed', {
              orgId: subscription.referenceId,
              plan: subscription.plan,
              status: subscription.status,
              periodEnd: toIsoTimestamp(subscription.periodEnd),
            });

            if (ctx && ctx.waitUntil) {
              ctx.waitUntil(
                (async () => {
                  try {
                    await notifyOrgMembers(env, db, subscription.referenceId, {
                      type: EventTypes.SUBSCRIPTION_UPDATED,
                      data: {
                        tier: subscription.plan,
                        status: subscription.status,
                        periodEnd: subscription.periodEnd,
                      },
                    });
                  } catch (err) {
                    captureError(err, {
                      tags: { component: 'auth', action: 'subscription-complete-notify' },
                      extra: { orgId: subscription.referenceId },
                    });
                  }
                  // Entitlement may have flipped: refresh-disconnect the org's
                  // live sync sessions so reconnects re-run authorize and pick
                  // up a fresh writeAllowed stamp.
                  try {
                    await refreshOrgWorkspaceSessions(env, db, subscription.referenceId);
                  } catch (err) {
                    captureError(err, {
                      tags: { component: 'auth', action: 'subscription-complete-refresh-sync' },
                      extra: { orgId: subscription.referenceId },
                    });
                  }
                })(),
              );
            }
          },
          onSubscriptionUpdate: async ({ subscription }: { subscription: SubscriptionData }) => {
            info('billing.subscription_updated', {
              orgId: subscription.referenceId,
              plan: subscription.plan,
              status: subscription.status,
              periodEnd: toIsoTimestamp(subscription.periodEnd),
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
            });

            if (ctx && ctx.waitUntil) {
              ctx.waitUntil(
                (async () => {
                  try {
                    await notifyOrgMembers(env, db, subscription.referenceId, {
                      type: EventTypes.SUBSCRIPTION_UPDATED,
                      data: {
                        tier: subscription.plan,
                        status: subscription.status,
                        periodEnd: subscription.periodEnd,
                        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                      },
                    });
                  } catch (err) {
                    captureError(err, {
                      tags: { component: 'auth', action: 'subscription-update-notify' },
                      extra: { orgId: subscription.referenceId },
                    });
                  }
                  // Entitlement may have flipped: refresh-disconnect the org's
                  // live sync sessions so reconnects re-run authorize and pick
                  // up a fresh writeAllowed stamp.
                  try {
                    await refreshOrgWorkspaceSessions(env, db, subscription.referenceId);
                  } catch (err) {
                    captureError(err, {
                      tags: { component: 'auth', action: 'subscription-update-refresh-sync' },
                      extra: { orgId: subscription.referenceId },
                    });
                  }
                })(),
              );
            }
          },
          onSubscriptionCancel: async ({ subscription }: { subscription: SubscriptionData }) => {
            info('billing.subscription_canceled', {
              orgId: subscription.referenceId,
              plan: subscription.plan,
              status: subscription.status,
              cancelAt: toIsoTimestamp(subscription.cancelAt),
              canceledAt: toIsoTimestamp(subscription.canceledAt),
            });

            if (ctx && ctx.waitUntil) {
              ctx.waitUntil(
                (async () => {
                  try {
                    await notifyOrgMembers(env, db, subscription.referenceId, {
                      type: EventTypes.SUBSCRIPTION_CANCELED,
                      data: {
                        tier: subscription.plan,
                        cancelAt: subscription.cancelAt,
                        canceledAt: subscription.canceledAt,
                      },
                    });
                  } catch (err) {
                    captureError(err, {
                      tags: { component: 'auth', action: 'subscription-cancel-notify' },
                      extra: { orgId: subscription.referenceId },
                    });
                  }
                  // Entitlement may have flipped: refresh-disconnect the org's
                  // live sync sessions so reconnects re-run authorize and pick
                  // up a fresh writeAllowed stamp.
                  try {
                    await refreshOrgWorkspaceSessions(env, db, subscription.referenceId);
                  } catch (err) {
                    captureError(err, {
                      tags: { component: 'auth', action: 'subscription-cancel-refresh-sync' },
                      extra: { orgId: subscription.referenceId },
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

              if (membership?.role !== 'owner') {
                warn('billing.subscription_action_denied', {
                  orgId: referenceId,
                  userId: user.id,
                  action,
                  role: membership?.role ?? null,
                });
                return false;
              }
              return true;
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
    warn('Stripe plugin NOT configured - missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET_AUTH');
  }

  return betterAuth({
    rateLimit: { enabled: false },
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
        // Allow unlinking all OAuth accounts (a verified email can always sign in with a code)
        allowUnlinkingAll: true,
      },
      // Use cookie-based state storage for OAuth flows
      // Required for oAuthProxy to work - database mode stores state locally which breaks cross-origin proxy
      storeStateStrategy: 'cookie',
    },

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
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

    // Send auth failures that have no errorCallbackURL (relay failures, state
    // parse errors) to the signin page, which already maps ?error= codes,
    // instead of Better Auth's built-in error page
    onAPIError: {
      errorURL: buildAppUrl(env, '/signin'),
    },

    // Use centralized origin configuration
    trustedOrigins: [...getAllowedOrigins()],

    secret: getAuthSecret(env),

    // Hooks for custom auth behavior
    hooks: {
      // Without a start event, OAuth drop-offs leave no server-side trace
      before: createAuthMiddleware(
        async (authCtx: { path: string; body?: { provider?: string } }) => {
          if (authCtx.path === '/sign-in/social') {
            info('auth.social_signin_started', {
              provider: authCtx.body?.provider || 'unknown',
            });
          }
        },
      ),
      // After hook: bootstrap personal org and copy OAuth avatar on first successful authentication
      after: createAuthMiddleware(
        async (authCtx: {
          path: string;
          context: { newSession?: NewSessionData; returned?: unknown };
        }) => {
          if (CODE_PATHS.has(authCtx.path) && authCtx.context.returned instanceof APIError) {
            info('auth.code_rejected', {
              path: authCtx.path,
              reason: authCtx.context.returned.body?.code,
            });
          }
          const newSession = authCtx.context.newSession;
          if (!newSession) return;

          const userId = newSession.user.id;
          const userImage = newSession.user.image;
          const userName =
            newSession.user.givenName ||
            newSession.user.name ||
            newSession.user.email?.split('@')[0] ||
            'User';

          // Name and email ride along so dashboards can show who is active without a
          // separate lookup against the DB. This is the only event that carries them.
          info('auth.session_created', {
            userId,
            sessionId: newSession.session.id,
            userName,
            userEmail: newSession.user.email,
          });

          // Copy external OAuth avatar to R2 in the background
          // This ensures all avatars are served from our storage, avoiding external URL issues
          if (
            ctx &&
            ctx.waitUntil &&
            isExternalAvatarUrl(userImage) &&
            !isInternalAvatarUrl(userImage)
          ) {
            ctx.waitUntil(
              (async () => {
                try {
                  const result = await copyAvatarToR2(env, userId, userImage);
                  if (result.success && result.url) {
                    await db
                      .update(schema.user)
                      .set({ image: result.url })
                      .where(eq(schema.user.id, userId));
                  } else if (result.error) {
                    captureError(new Error(`Avatar copy failed: ${result.error.code}`), {
                      tags: { component: 'auth', action: 'avatar-copy' },
                      extra: { userId, error: result.error },
                    });
                  }
                } catch (err) {
                  captureError(err, {
                    tags: { component: 'auth', action: 'avatar-copy' },
                    extra: { userId },
                  });
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

            info('Created personal org %s for user %s', [orgId, userId]);
          } catch (err) {
            captureError(err, {
              tags: { component: 'auth', action: 'bootstrap-personal-org' },
              extra: { userId },
            });
          }
        },
      ),
    },

    databaseHooks: {
      user: {
        create: {
          after: async user => {
            info('auth.user_created', { userId: user.id, synthetic: isSyntheticEmail(user.email) });
          },
        },
      },
    },
  });
}

// Endpoints that verify an emailed code; rejections are worth watching for abuse
const CODE_PATHS = new Set([
  '/sign-in/email-otp',
  '/email-otp/verify-email',
  '/email-otp/reset-password',
]);

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
    captureError(error, { tags: { component: 'auth', action: 'verify-session' } });
    return { user: null, session: null };
  }
}
