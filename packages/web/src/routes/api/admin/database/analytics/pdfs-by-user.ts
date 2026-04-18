/**
 * Admin analytics: PDFs by user
 *
 * GET /api/admin/database/analytics/pdfs-by-user — uploads grouped by uploader.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { mediaFiles, user } from '@corates/db/schema';
import { count, desc, eq, sum } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { requireAdmin } from '@/server/guards/requireAdmin';

export const handleGet = async ({ request }: { request: Request }) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  try {
    const db = createDb(env.DB);
    const results = await db
      .select({
        userId: mediaFiles.uploadedBy,
        userName: user.name,
        userEmail: user.email,
        userGivenName: user.givenName,
        pdfCount: count(mediaFiles.id),
        totalStorage: sum(mediaFiles.fileSize),
      })
      .from(mediaFiles)
      .leftJoin(user, eq(mediaFiles.uploadedBy, user.id))
      .groupBy(mediaFiles.uploadedBy, user.name, user.email, user.givenName)
      .orderBy(desc(count(mediaFiles.id)));

    const analytics = results
      .filter(row => row.userId)
      .map(row => ({
        userId: row.userId as string,
        userName: row.userName,
        userEmail: row.userEmail,
        userDisplayName: row.userGivenName,
        pdfCount: Number(row.pdfCount || 0),
        totalStorage: Number(row.totalStorage || 0),
      }));

    return Response.json({ analytics }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('PDFs by user analytics error:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'analytics_pdfs_by_user',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/database/analytics/pdfs-by-user')({
  server: { handlers: { GET: handleGet } },
});
