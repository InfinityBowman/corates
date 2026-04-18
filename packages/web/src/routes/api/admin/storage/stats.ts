/**
 * Admin storage stats
 *
 * GET /api/admin/storage/stats — totalFiles, totalSize, and per-project file
 * counts derived by walking R2 in 1000-key batches.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { requireAdmin } from '@/server/guards/requireAdmin';

function parseProjectId(key: string): string | null {
  const match = key.match(/^projects\/([^/]+)\/studies\/[^/]+\/.+$/);
  return match?.[1] ?? null;
}

export const handleGet = async ({ request }: { request: Request }) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  try {
    let cursor: string | undefined = undefined;
    let totalFiles = 0;
    let totalSize = 0;
    const filesByProject: Record<string, number> = {};

    let done = false;
    while (!done) {
      const listed = (await env.PDF_BUCKET.list({ limit: 1000, cursor })) as {
        objects: Array<{ key: string; size: number }>;
        truncated: boolean;
        cursor?: string;
      };

      for (const obj of listed.objects) {
        totalFiles++;
        totalSize += obj.size;

        const projectId = parseProjectId(obj.key);
        if (projectId) {
          filesByProject[projectId] = (filesByProject[projectId] || 0) + 1;
        }
      }

      if (listed.truncated) {
        cursor = listed.cursor;
      } else {
        done = true;
      }
    }

    return Response.json(
      {
        totalFiles,
        totalSize,
        filesByProject: Object.entries(filesByProject).map(([projectId, count]) => ({
          projectId,
          count,
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching storage stats:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'fetch_storage_stats',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/storage/stats')({
  server: { handlers: { GET: handleGet } },
});
