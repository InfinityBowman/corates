/**
 * Admin organizations list
 *
 * GET /api/admin/orgs — paginated/searchable list of all organizations with
 * member and project counts. Admin only.
 */
import { createFileRoute } from '@tanstack/react-router';
import type { Database } from '@corates/db/client';
import { organization, member, projects } from '@corates/db/schema';
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
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const search = url.searchParams.get('search') || undefined;

    const offset = (page - 1) * limit;

    const searchCondition =
      search ?
        or(
          like(sql`LOWER(${organization.name})`, `%${search.toLowerCase()}%`),
          like(sql`LOWER(${organization.slug})`, `%${search.toLowerCase()}%`),
        )
      : undefined;

    const totalCountQuery =
      searchCondition ?
        db.select({ count: count() }).from(organization).where(searchCondition)
      : db.select({ count: count() }).from(organization);

    const [totalResult] = await totalCountQuery.all();
    const total = totalResult?.count || 0;

    const baseQuery = db.select().from(organization);
    const orgs = await (searchCondition ? baseQuery.where(searchCondition) : baseQuery)
      .orderBy(desc(organization.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    const orgIds = orgs.map(org => org.id);
    const statsMap: Record<string, { memberCount?: number; projectCount?: number }> = {};

    if (orgIds.length > 0) {
      const memberCounts = await db
        .select({
          organizationId: member.organizationId,
          count: count(),
        })
        .from(member)
        .where(
          sql`${member.organizationId} IN (${sql.join(
            orgIds.map(id => sql`${id}`),
            sql`, `,
          )})`,
        )
        .groupBy(member.organizationId)
        .all();

      const projectCounts = await db
        .select({
          orgId: projects.orgId,
          count: count(),
        })
        .from(projects)
        .where(
          sql`${projects.orgId} IN (${sql.join(
            orgIds.map(id => sql`${id}`),
            sql`, `,
          )})`,
        )
        .groupBy(projects.orgId)
        .all();

      memberCounts.forEach(({ organizationId, count: cnt }) => {
        if (!statsMap[organizationId]) statsMap[organizationId] = {};
        statsMap[organizationId].memberCount = cnt;
      });

      projectCounts.forEach(({ orgId, count: cnt }) => {
        if (!statsMap[orgId]) statsMap[orgId] = {};
        statsMap[orgId].projectCount = cnt;
      });
    }

    const orgsWithStats = orgs.map(org => ({
      ...org,
      stats: {
        memberCount: statsMap[org.id]?.memberCount || 0,
        projectCount: statsMap[org.id]?.projectCount || 0,
      },
    }));

    return Response.json(
      {
        orgs: orgsWithStats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching orgs:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_orgs',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/orgs')({
  server: {
    middleware: [adminMiddleware],
    handlers: { GET: handleGet },
  },
});
