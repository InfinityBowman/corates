/**
 * GET /api/backup-status — which projects lack the latest daily snapshot in R2.
 * Polled by the Grafana backup alert with BACKUP_STATUS_TOKEN.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { bearerTokenAuth } from '@cf-sync/server';
import { createDb } from '@corates/db/client';
import { getBackupStatus } from '@corates/workers/commands/backups';

const authorized = bearerTokenAuth((e: typeof env) => e.BACKUP_STATUS_TOKEN);

export const handleGet = async ({ request }: { request: Request }) => {
  if (!authorized(request, { env })) {
    return new Response(null, { status: 401 });
  }
  const status = await getBackupStatus(env as never, createDb(env.DB));
  return Response.json(status, { headers: { 'cache-control': 'no-store' } });
};

export const Route = createFileRoute('/api/backup-status')({
  server: {
    middleware: [],
    handlers: {
      GET: handleGet,
    },
  },
});
