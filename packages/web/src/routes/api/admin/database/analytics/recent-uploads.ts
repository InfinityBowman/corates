/**
 * Admin analytics: recent uploads
 *
 * GET /api/admin/database/analytics/recent-uploads?limit=N — newest mediaFiles
 * rows with org/project/uploader joins (default 50, max 100).
 */
import { createFileRoute } from '@tanstack/react-router';
import type { Database } from '@corates/db/client';
import { mediaFiles, organization, projects, user } from '@corates/db/schema';
import { desc, eq } from 'drizzle-orm';
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
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1),
      100,
    );
    const results = await db
      .select({
        id: mediaFiles.id,
        filename: mediaFiles.filename,
        originalName: mediaFiles.originalName,
        fileSize: mediaFiles.fileSize,
        createdAt: mediaFiles.createdAt,
        orgId: mediaFiles.orgId,
        orgName: organization.name,
        orgSlug: organization.slug,
        projectId: mediaFiles.projectId,
        projectName: projects.name,
        uploadedBy: mediaFiles.uploadedBy,
        uploadedByName: user.name,
        uploadedByEmail: user.email,
        uploadedByGivenName: user.givenName,
      })
      .from(mediaFiles)
      .leftJoin(organization, eq(mediaFiles.orgId, organization.id))
      .leftJoin(projects, eq(mediaFiles.projectId, projects.id))
      .leftJoin(user, eq(mediaFiles.uploadedBy, user.id))
      .orderBy(desc(mediaFiles.createdAt))
      .limit(limit);

    const uploads = results.map(row => ({
      id: row.id,
      filename: row.filename,
      originalName: row.originalName,
      fileSize: row.fileSize,
      createdAt: row.createdAt,
      org: { id: row.orgId, name: row.orgName, slug: row.orgSlug },
      project: { id: row.projectId, name: row.projectName },
      uploadedBy:
        row.uploadedBy ?
          {
            id: row.uploadedBy,
            name: row.uploadedByName,
            email: row.uploadedByEmail,
            givenName: row.uploadedByGivenName,
          }
        : null,
    }));

    return Response.json({ uploads }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Recent uploads analytics error:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'analytics_recent_uploads',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/database/analytics/recent-uploads')({
  server: {
    middleware: [adminMiddleware],
    handlers: { GET: handleGet },
  },
});
