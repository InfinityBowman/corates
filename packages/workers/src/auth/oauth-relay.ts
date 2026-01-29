/**
 * OAuth Relay Plugin for Better Auth
 *
 * Unlike oAuthProxy which transfers session cookies (requiring shared database),
 * this plugin relays OAuth tokens and user info, allowing each server to create
 * its own sessions in its own database.
 *
 * Flow:
 * 1. Localhost initiates OAuth, state includes relay marker with localhost origin
 * 2. Google/ORCID redirects to production's callback
 * 3. Production detects relay state, exchanges code for tokens, gets user info
 * 4. Production encrypts tokens + userInfo and redirects to localhost relay endpoint
 *    (skips session creation on production)
 * 5. Localhost decrypts, creates user/session locally, sets cookies
 *
 * This solves the "session in wrong database" problem with oAuthProxy.
 */

import type { BetterAuthPlugin } from 'better-auth';
import { createAuthEndpoint, createAuthMiddleware } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto';
import { handleOAuthUserInfo } from 'better-auth/oauth2';
import { z } from 'zod';

export interface OAuthRelayOptions {
  /**
   * The production URL that handles OAuth callbacks from providers.
   * On localhost, OAuth will redirect through production.
   */
  productionURL: string;

  /**
   * Maximum age in seconds for the encrypted relay payload.
   * @default 120 (2 minutes - allows for redirect time)
   */
  maxAge?: number;
}

interface RelayPayload {
  userInfo: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    emailVerified?: boolean;
  };
  account: {
    providerId: string;
    accountId: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: Date;
    refreshTokenExpiresAt?: Date;
    scope?: string;
    idToken?: string;
  };
  callbackURL: string;
  timestamp: number;
}

// State package that includes relay information
interface RelayStatePackage {
  isRelay: true;
  relayOrigin: string;
  originalState: string;
  originalStateCookie: string;
}

const relayQuerySchema = z.object({
  payload: z.string(),
});

function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function stripTrailingSlash(url: string | undefined): string {
  if (!url) return '';
  return url.replace(/\/+$/, '');
}

export const oAuthRelay = (opts: OAuthRelayOptions) => {
  const maxAge = opts.maxAge ?? 120;
  const productionOrigin = getOrigin(opts.productionURL);

  return {
    id: 'oauth-relay',
    endpoints: {
      /**
       * Endpoint that receives the relayed OAuth data from production.
       * Creates user/session locally and sets cookies.
       */
      oAuthRelayCallback: createAuthEndpoint(
        '/oauth-relay-callback',
        {
          method: 'GET',
          query: relayQuerySchema,
        },
        async (ctx) => {
          const { payload: encryptedPayload } = ctx.query;

          // Decrypt the payload
          let decrypted: string;
          try {
            decrypted = await symmetricDecrypt({
              key: ctx.context.secret,
              data: encryptedPayload,
            });
          } catch (e) {
            ctx.context.logger.error('Failed to decrypt OAuth relay payload:', e);
            throw ctx.redirect(
              `${ctx.context.baseURL}/error?error=oauth_relay_decrypt_failed`
            );
          }

          // Parse the payload
          let payload: RelayPayload;
          try {
            payload = JSON.parse(decrypted);
          } catch (e) {
            ctx.context.logger.error('Failed to parse OAuth relay payload:', e);
            throw ctx.redirect(
              `${ctx.context.baseURL}/error?error=oauth_relay_invalid_payload`
            );
          }

          // Check timestamp
          const age = (Date.now() - payload.timestamp) / 1000;
          if (age > maxAge || age < -10) {
            ctx.context.logger.error(
              `OAuth relay payload expired (age: ${age}s, maxAge: ${maxAge}s)`
            );
            throw ctx.redirect(
              `${ctx.context.baseURL}/error?error=oauth_relay_expired`
            );
          }

          // Create user and session locally using Better Auth's internal handler
          const result = await handleOAuthUserInfo(ctx, {
            userInfo: {
              ...payload.userInfo,
              id: payload.userInfo.id,
              email: payload.userInfo.email,
              name: payload.userInfo.name || payload.userInfo.email,
              emailVerified: payload.userInfo.emailVerified ?? false,
            },
            account: payload.account,
            callbackURL: payload.callbackURL,
          });

          if (result.error) {
            ctx.context.logger.error('OAuth relay user creation failed:', result.error);
            throw ctx.redirect(
              `${ctx.context.baseURL}/error?error=${encodeURIComponent(result.error)}`
            );
          }

          const { session, user } = result.data!;

          // Set session cookie
          await setSessionCookie(ctx, { session, user });

          // Redirect to the original callback URL
          throw ctx.redirect(payload.callbackURL);
        }
      ),
    },
    hooks: {
      before: [
        {
          /**
           * On sign-in initiation (localhost): Mark for relay processing.
           */
          matcher(context) {
            return !!(
              context.path?.startsWith('/sign-in/social') ||
              context.path?.startsWith('/sign-in/oauth2')
            );
          },
          handler: createAuthMiddleware(async (ctx) => {
            const currentOrigin = getOrigin(ctx.context.baseURL);

            // Skip if we're on production (no relay needed)
            if (currentOrigin === productionOrigin) {
              return;
            }

            // Mark this request for relay by storing the origin in context
            (ctx.context as any)._relayOrigin = currentOrigin;

            // Override baseURL to production so the OAuth redirect_uri points to production
            const productionBaseURL = `${stripTrailingSlash(opts.productionURL)}${ctx.context.options.basePath || '/api/auth'}`;
            ctx.context.baseURL = productionBaseURL;
          }),
        },
        {
          /**
           * On callback (production): Detect relay requests by checking if state is encrypted relay package.
           * If so, handle the entire callback ourselves and relay the data back.
           */
          matcher(context) {
            return !!(
              context.path?.startsWith('/callback') ||
              context.path?.startsWith('/oauth2/callback')
            );
          },
          handler: createAuthMiddleware(async (ctx) => {
            const state = ctx.query?.state || ctx.body?.state;
            if (!state || typeof state !== 'string') return;

            // Try to decrypt as relay package
            let relayPackage: RelayStatePackage | null = null;
            try {
              const decrypted = await symmetricDecrypt({
                key: ctx.context.secret,
                data: state,
              });
              const parsed = JSON.parse(decrypted);
              if (parsed.isRelay === true) {
                relayPackage = parsed;
              }
            } catch {
              // Not a relay state, continue with normal flow
              return;
            }

            if (!relayPackage) return;

            // This is a relay request - handle it ourselves
            const code = ctx.query?.code || ctx.body?.code;
            if (!code) {
              throw ctx.redirect(
                `${relayPackage.relayOrigin}/api/auth/error?error=no_code`
              );
            }

            // Get the provider ID from the request URL (not ctx.path which is the route pattern)
            // URL format: https://corates.org/api/auth/callback/google?...
            const requestUrl = ctx.request?.url;
            let providerId: string | undefined;
            if (requestUrl) {
              const url = new URL(requestUrl);
              const pathParts = url.pathname.split('/');
              // Find the part after "callback"
              const callbackIndex = pathParts.indexOf('callback');
              if (callbackIndex !== -1 && pathParts[callbackIndex + 1]) {
                providerId = pathParts[callbackIndex + 1];
              }
            }

            if (!providerId) {
              ctx.context.logger.error('Could not extract provider ID from URL:', requestUrl);
              throw ctx.redirect(
                `${relayPackage.relayOrigin}/api/auth/error?error=no_provider`
              );
            }

            // Find the OAuth provider
            const provider = ctx.context.socialProviders.find(
              (p) => p.id === providerId
            );

            if (!provider) {
              ctx.context.logger.error('Provider not found:', providerId);
              throw ctx.redirect(
                `${relayPackage.relayOrigin}/api/auth/error?error=provider_not_found`
              );
            }

            // Decrypt the original state cookie to get codeVerifier and callbackURL
            let stateData: { codeVerifier?: string; callbackURL?: string } | null = null;
            try {
              const decryptedCookie = await symmetricDecrypt({
                key: ctx.context.secret,
                data: relayPackage.originalStateCookie,
              });
              stateData = JSON.parse(decryptedCookie);
            } catch (e) {
              ctx.context.logger.error('Failed to decrypt state cookie:', e);
              throw ctx.redirect(
                `${relayPackage.relayOrigin}/api/auth/error?error=invalid_state_cookie`
              );
            }

            // Exchange code for tokens
            let tokens;
            try {
              tokens = await provider.validateAuthorizationCode({
                code: code as string,
                codeVerifier: stateData?.codeVerifier,
                redirectURI: `${ctx.context.baseURL}/callback/${provider.id}`,
              });
            } catch (e) {
              ctx.context.logger.error('Token exchange failed:', e);
              throw ctx.redirect(
                `${relayPackage.relayOrigin}/api/auth/error?error=token_exchange_failed`
              );
            }

            if (!tokens) {
              throw ctx.redirect(
                `${relayPackage.relayOrigin}/api/auth/error?error=no_tokens`
              );
            }

            // Get user info from provider
            const userInfoResponse = await provider.getUserInfo(tokens);
            const userInfo = userInfoResponse?.user;

            if (!userInfo || !userInfo.email) {
              ctx.context.logger.error('Failed to get user info');
              throw ctx.redirect(
                `${relayPackage.relayOrigin}/api/auth/error?error=no_user_info`
              );
            }

            // Build relay payload
            const payload: RelayPayload = {
              userInfo: {
                id: String(userInfo.id),
                email: userInfo.email,
                name: userInfo.name || userInfo.email,
                image: userInfo.image,
                emailVerified: userInfo.emailVerified,
              },
              account: {
                providerId: provider.id,
                accountId: String(userInfo.id),
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                accessTokenExpiresAt: tokens.accessTokenExpiresAt,
                refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
                scope: tokens.scopes?.join(','),
                idToken: tokens.idToken,
              },
              callbackURL: stateData?.callbackURL || '/',
              timestamp: Date.now(),
            };

            // Encrypt the payload
            const encrypted = await symmetricEncrypt({
              key: ctx.context.secret,
              data: JSON.stringify(payload),
            });

            // Build relay URL
            const basePath = ctx.context.options.basePath || '/api/auth';
            const relayURL = `${relayPackage.relayOrigin}${basePath}/oauth-relay-callback?payload=${encodeURIComponent(encrypted)}`;

            // Redirect to localhost with the payload
            // Use throw to prevent the normal callback handler from running
            throw ctx.redirect(relayURL);
          }),
        },
      ],
      after: [
        {
          /**
           * After sign-in initiation (localhost): Modify the OAuth redirect URL
           * to include relay information in the state.
           */
          matcher(context) {
            return !!(
              context.path?.startsWith('/sign-in/social') ||
              context.path?.startsWith('/sign-in/oauth2')
            );
          },
          handler: createAuthMiddleware(async (ctx) => {
            const relayOrigin = (ctx.context as any)._relayOrigin;
            if (!relayOrigin) return;

            // Only process in stateless (cookie) mode
            if (ctx.context.oauthConfig.storeStateStrategy !== 'cookie') {
              ctx.context.logger.warn(
                'OAuth relay requires storeStateStrategy: "cookie". Current:',
                ctx.context.oauthConfig.storeStateStrategy
              );
              return;
            }

            // Get the OAuth provider URL from the response
            const signInResponse = ctx.context.returned;
            if (
              !signInResponse ||
              typeof signInResponse !== 'object' ||
              !('url' in signInResponse)
            ) {
              return;
            }

            const { url: providerURL } = signInResponse;
            if (typeof providerURL !== 'string') return;

            // Parse provider URL and extract state
            const oauthURL = new URL(providerURL);
            const originalState = oauthURL.searchParams.get('state');
            if (!originalState) return;

            // Get the state cookie that was set
            const headers = ctx.context.responseHeaders;
            const setCookieHeader = headers?.get('set-cookie');
            if (!setCookieHeader) return;

            // Find the oauth_state cookie value
            const stateCookie = ctx.context.createAuthCookie('oauth_state');
            // Cookie header can have multiple cookies, need to find the right one
            // Format: "name=value; attributes, name2=value2; attributes"
            const cookieRegex = new RegExp(
              `(?:^|,\\s*)${stateCookie.name}=([^;]+)`,
              'i'
            );
            const match = setCookieHeader.match(cookieRegex);
            const stateCookieValue = match?.[1];

            if (!stateCookieValue) {
              ctx.context.logger.warn('Could not find oauth_state cookie');
              return;
            }

            // Create relay state package
            const relayPackage: RelayStatePackage = {
              isRelay: true,
              relayOrigin,
              originalState,
              originalStateCookie: stateCookieValue,
            };

            // Encrypt the relay package
            const encryptedPackage = await symmetricEncrypt({
              key: ctx.context.secret,
              data: JSON.stringify(relayPackage),
            });

            // Replace state parameter with encrypted relay package
            oauthURL.searchParams.set('state', encryptedPackage);

            // Update response URL
            ctx.context.returned = {
              ...signInResponse,
              url: oauthURL.toString(),
            };
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
};
