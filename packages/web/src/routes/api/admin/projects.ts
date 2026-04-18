/**
 * Admin projects list
 *
 * GET /api/admin/projects — paginated/searchable list of all projects with org,
 * creator, member, and file count. Optional `?orgId=` filter. Admin only.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { projects, projectMembers, mediaFiles, organization, user } from '@corates/db/schema';
import { and, count, desc, eq, like, sql } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { requireAdmin } from '@/server/guards/requireAdmin';

interface ProjectStats {
  memberCount: number;
  fileCount: number;
}

export const handleGet = async ({ request }: { request: Request }) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const db = createDb(env.DB);

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const search = url.searchParams.get('search') || undefined;
    const orgId = url.searchParams.get('orgId') || undefined;

    const offset = (page - 1) * limit;

    const conditions = [];
    if (search) {
      conditions.push(like(sql`LOWER(${projects.name})`, `%${search.toLowerCase()}%`));
    }
    if (orgId) conditions.push(eq(projects.orgId, orgId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const totalCountQuery =
      whereClause ?
        db.select({ count: count() }).from(projects).where(whereClause)
      : db.select({ count: count() }).from(projects);

    const [totalResult] = await totalCountQuery.all();
    const total = totalResult?.count || 0;

    const baseQuery = db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        orgId: projects.orgId,
        orgName: organization.name,
        orgSlug: organization.slug,
        createdBy: projects.createdBy,
        creatorName: user.name,
        creatorGivenName: user.givenName,
        creatorEmail: user.email,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .leftJoin(organization, eq(projects.orgId, organization.id))
      .leftJoin(user, eq(projects.createdBy, user.id));

    const projectList = await (whereClause ? baseQuery.where(whereClause) : baseQuery)
      .orderBy(desc(projects.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    const projectIds = projectList.map(p => p.id);
    const statsMap: Record<string, ProjectStats> = {};

    if (projectIds.length > 0) {
      const memberCounts = await db
        .select({ projectId: projectMembers.projectId, count: count() })
        .from(projectMembers)
        .where(
          sql`${projectMembers.projectId} IN (${sql.join(
            projectIds.map(id => sql`${id}`),
            sql`, `,
          )})`,
        )
        .groupBy(projectMembers.projectId)
        .all();

      const fileCounts = await db
        .select({ projectId: mediaFiles.projectId, count: count() })
        .from(mediaFiles)
        .where(
          sql`${mediaFiles.projectId} IN (${sql.join(
            projectIds.map(id => sql`${id}`),
            sql`, `,
          )})`,
        )
        .groupBy(mediaFiles.projectId)
        .all();

      for (const mc of memberCounts) {
        statsMap[mc.projectId] = { memberCount: mc.count, fileCount: 0 };
      }
      for (const fc of fileCounts) {
        if (!statsMap[fc.projectId]) {
          statsMap[fc.projectId] = { memberCount: 0, fileCount: fc.count };
        } else {
          statsMap[fc.projectId].fileCount = fc.count;
        }
      }
    }

    const projectsWithStats = projectList.map(p => ({
      ...p,
      memberCount: statsMap[p.id]?.memberCount || 0,
      fileCount: statsMap[p.id]?.fileCount || 0,
    }));

    return Response.json(
      {
        projects: projectsWithStats,
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
    console.error('Error fetching admin projects:', error);
    return Response.json(createDomainError(SYSTEM_ERRORS.DB_ERROR, { message: error.message }), {
      status: 500,
    });
  }
};

export const Route = createFileRoute('/api/admin/projects')({
  server: { handlers: { GET: handleGet } },
});
