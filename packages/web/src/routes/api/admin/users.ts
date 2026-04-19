/**
 * Admin user list
 *
 * GET /api/admin/users — paginated list with optional case-insensitive search
 * across email/name/givenName/familyName/username. Each user row also includes
 * the providerIds of their linked auth accounts.
 */
import { createFileRoute } from '@tanstack/react-router';
import type { Database } from '@corates/db/client';
import { user, account } from '@corates/db/schema';
import { count, desc, like, or, sql } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { adminMiddleware } from '@/server/middleware/admin';

export const handleGet = async ({
  request,
  context: { db },
}: {
  request: Request;
  context: { db: Database };
}) => {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20),
    );
    const search = url.searchParams.get('search')?.trim() || undefined;
    const offset = (page - 1) * limit;

    const searchCondition =
      search ?
        or(
          like(sql`lower(${user.email})`, `%${search.toLowerCase()}%`),
          like(sql`lower(${user.name})`, `%${search.toLowerCase()}%`),
          like(sql`lower(${user.givenName})`, `%${search.toLowerCase()}%`),
          like(sql`lower(${user.familyName})`, `%${search.toLowerCase()}%`),
          like(sql`lower(${user.username})`, `%${search.toLowerCase()}%`),
        )
      : undefined;

    const [totalResult] = await db.select({ count: count() }).from(user).where(searchCondition);

    const selectFields = {
      id: user.id,
      name: user.name,
      email: user.email,
      givenName: user.givenName,
      familyName: user.familyName,
      username: user.username,
      image: user.image,
      avatarUrl: user.avatarUrl,
      role: user.role,
      emailVerified: user.emailVerified,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      stripeCustomerId: user.stripeCustomerId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const users =
      searchCondition ?
        await db
          .select(selectFields)
          .from(user)
          .where(searchCondition)
          .orderBy(desc(user.createdAt))
          .limit(limit)
          .offset(offset)
      : await db
          .select(selectFields)
          .from(user)
          .orderBy(desc(user.createdAt))
          .limit(limit)
          .offset(offset);

    const userIds = users.map(u => u.id);
    let accountsMap: Record<string, string[]> = {};

    if (userIds.length > 0) {
      const accounts = await db
        .select({ userId: account.userId, providerId: account.providerId })
        .from(account)
        .where(
          sql`${account.userId} IN (${sql.join(
            userIds.map(id => sql`${id}`),
            sql`, `,
          )})`,
        );

      accountsMap = accounts.reduce(
        (acc, a) => {
          if (!acc[a.userId]) acc[a.userId] = [];
          acc[a.userId].push(a.providerId);
          return acc;
        },
        {} as Record<string, string[]>,
      );
    }

    const usersWithProviders = users.map(u => ({
      ...u,
      providers: accountsMap[u.id] || [],
    }));

    return Response.json(
      {
        users: usersWithProviders,
        pagination: {
          page,
          limit,
          total: totalResult?.count || 0,
          totalPages: Math.ceil((totalResult?.count || 0) / limit),
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching users:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_users',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/users')({
  server: {
    middleware: [adminMiddleware],
    handlers: { GET: handleGet },
  },
});
