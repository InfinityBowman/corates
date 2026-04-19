/**
 * Admin analytics: PDFs by project
 *
 * GET /api/admin/database/analytics/pdfs-by-project — uploads grouped by
 * project, joined with org for context.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { mediaFiles, organization, projects } from '@corates/db/schema';
import { count, desc, eq, sum } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { adminMiddleware } from '@/server/middleware/admin';

export const handleGet = async () => {
  try {
    const db = createDb(env.DB);
    const results = await db
      .select({
        projectId: mediaFiles.projectId,
        projectName: projects.name,
        orgId: mediaFiles.orgId,
        orgName: organization.name,
        orgSlug: organization.slug,
        pdfCount: count(mediaFiles.id),
        totalStorage: sum(mediaFiles.fileSize),
      })
      .from(mediaFiles)
      .leftJoin(projects, eq(mediaFiles.projectId, projects.id))
      .leftJoin(organization, eq(mediaFiles.orgId, organization.id))
      .groupBy(
        mediaFiles.projectId,
        projects.name,
        mediaFiles.orgId,
        organization.name,
        organization.slug,
      )
      .orderBy(desc(count(mediaFiles.id)));

    const analytics = results.map(row => ({
      projectId: row.projectId,
      projectName: row.projectName,
      orgId: row.orgId,
      orgName: row.orgName,
      orgSlug: row.orgSlug,
      pdfCount: Number(row.pdfCount || 0),
      totalStorage: Number(row.totalStorage || 0),
    }));

    return Response.json({ analytics }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('PDFs by project analytics error:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'analytics_pdfs_by_project',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/database/analytics/pdfs-by-project')({
  server: {
    middleware: [adminMiddleware],
    handlers: { GET: handleGet },
  },
});
