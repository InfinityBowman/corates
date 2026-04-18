import { createDb } from '@corates/db/client';
import { account } from '@corates/db/schema';
import { and, eq } from 'drizzle-orm';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';

interface GoogleTokens {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
}

export async function getGoogleTokens(
  db: ReturnType<typeof createDb>,
  userId: string,
): Promise<GoogleTokens | undefined> {
  return db
    .select({
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      accessTokenExpiresAt: account.accessTokenExpiresAt,
    })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'google')))
    .get();
}

async function refreshGoogleToken(
  env: { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string },
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw createDomainError(AUTH_ERRORS.INVALID, {
      context: 'google_token_refresh',
      originalError: errorText,
    });
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function getValidAccessToken(
  env: { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string },
  db: ReturnType<typeof createDb>,
  userId: string,
  tokens: GoogleTokens,
): Promise<string> {
  const now = new Date();
  const expiresAt = tokens.accessTokenExpiresAt;
  const bufferTime = 60 * 1000;

  if (expiresAt && new Date(expiresAt).getTime() - now.getTime() > bufferTime) {
    return tokens.accessToken!;
  }

  if (!expiresAt || Number.isNaN(new Date(expiresAt).getTime())) {
    if (tokens.accessToken) return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    throw createDomainError(AUTH_ERRORS.INVALID, {
      context: 'google_no_refresh_token',
      message: 'No refresh token available. User needs to reconnect Google account.',
    });
  }

  const newTokens = await refreshGoogleToken(env, tokens.refreshToken);
  const newExpiresAt = new Date(Date.now() + newTokens.expiresIn * 1000);

  await db
    .update(account)
    .set({
      accessToken: newTokens.accessToken,
      accessTokenExpiresAt: newExpiresAt,
      updatedAt: new Date(),
    })
    .where(and(eq(account.userId, userId), eq(account.providerId, 'google')));

  return newTokens.accessToken;
}
