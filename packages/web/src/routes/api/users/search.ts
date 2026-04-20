import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import { user, projectMembers } from '@corates/db/schema';
import { eq, or, like, sql } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { checkRateLimit, SEARCH_RATE_LIMIT } from '@/server/rateLimit';
import { authMiddleware, type Session } from '@/server/middleware/auth';

export interface UserSearchResult {
  id: string;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  username: string | null;
  image: string | null;
  email: string | null;
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const masked = local.length > 2 ? local.slice(0, 2) + '***' : local + '***';
  return `${masked}@${domain}`;
}

export const handler = async ({
  request,
  context: { db, session },
}: {
  request: Request;
  context: { db: Database; session: Session };
}) => {
  const rate = checkRateLimit(request, env, SEARCH_RATE_LIMIT);
  if (rate.blocked) return rate.blocked;

  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  const projectId = url.searchParams.get('projectId') ?? undefined;
  const rawLimit = url.searchParams.get('limit');

  if (!q || q.length < 2) {
    const error = createValidationError('q', VALIDATION_ERRORS.FIELD_TOO_SHORT.code, q);
    error.message = 'Search query must be at least 2 characters';
    return Response.json(error, { status: 400 });
  }

  const parsedLimit = rawLimit ? Number(rawLimit) : 10;
  const limit = Math.min(Number.isFinite(parsedLimit) ? parsedLimit : 10, 20);

  const searchPattern = `%${q.toLowerCase()}%`;

  try {
    let results = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        givenName: user.givenName,
        familyName: user.familyName,
        image: user.image,
      })
      .from(user)
      .where(
        or(
          like(sql`lower(${user.email})`, searchPattern),
          like(sql`lower(${user.name})`, searchPattern),
          like(sql`lower(${user.givenName})`, searchPattern),
          like(sql`lower(${user.familyName})`, searchPattern),
          like(sql`lower(${user.username})`, searchPattern),
        ),
      )
      .limit(limit);

    if (projectId) {
      const existingMembers = await db
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, projectId));
      const existingUserIds = new Set(existingMembers.map(m => m.userId));
      results = results.filter(u => !existingUserIds.has(u.id));
    }

    results = results.filter(u => u.id !== session.user.id);

    const sanitized: UserSearchResult[] = results.map(u => ({
      id: u.id,
      name: u.name,
      givenName: u.givenName,
      familyName: u.familyName,
      username: u.username,
      image: u.image,
      email: q.includes('@') ? u.email : maskEmail(u.email),
    }));

    return Response.json(sanitized, { status: 200, headers: rate.headers });
  } catch (err) {
    const error = err as Error;
    console.error('Error searching users:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'search_users',
      originalError: error.message,
    });
    return Response.json(dbError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/users/search')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: handler,
    },
  },
});
