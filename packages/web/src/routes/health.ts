/**
 * GET /health — deep dependency check used by uptime monitors.
 *
 * Probes D1 (`SELECT 1`), R2 (`list({ limit: 1 })`), and presence of the
 * UserSession + ProjectDoc DO bindings. Returns 200 with `status: 'healthy'`
 * when all checks pass, 503 with `status: 'degraded'` and per-service detail
 * otherwise. Mirrors the original Hono shape (`@/routes/health.ts` in the
 * deleted Hono app) so existing monitors stay compatible.
 *
 * Liveness probe is the separate `/healthz` route (returns plain "OK").
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';

interface ServiceStatus {
  status: 'healthy' | 'unhealthy';
  type: string;
  error?: string;
  bindings?: { USER_SESSION?: boolean; PROJECT_DOC?: boolean };
}

interface HealthChecks {
  status: 'healthy' | 'degraded';
  timestamp: string;
  services: {
    database?: ServiceStatus;
    storage?: ServiceStatus;
    durableObjects?: ServiceStatus;
  };
}

export const handleGet = async () => {
  const checks: HealthChecks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {},
  };

  try {
    const result = await env.DB.prepare('SELECT 1 as ok').first<{ ok: number }>();
    checks.services.database = {
      status: result?.ok === 1 ? 'healthy' : 'unhealthy',
      type: 'D1',
    };
  } catch (error) {
    checks.services.database = {
      status: 'unhealthy',
      type: 'D1',
      error: (error as Error).message,
    };
    checks.status = 'degraded';
  }

  try {
    await env.PDF_BUCKET.list({ limit: 1 });
    checks.services.storage = { status: 'healthy', type: 'R2' };
  } catch (error) {
    checks.services.storage = {
      status: 'unhealthy',
      type: 'R2',
      error: (error as Error).message,
    };
    checks.status = 'degraded';
  }

  const doHealthy = !!env.USER_SESSION && !!env.PROJECT_DOC;
  checks.services.durableObjects = {
    status: doHealthy ? 'healthy' : 'unhealthy',
    type: 'Durable Objects',
    bindings: {
      USER_SESSION: !!env.USER_SESSION,
      PROJECT_DOC: !!env.PROJECT_DOC,
    },
  };
  if (!doHealthy) checks.status = 'degraded';

  return Response.json(checks, { status: checks.status === 'healthy' ? 200 : 503 });
};

export const Route = createFileRoute('/health')({
  server: { handlers: { GET: handleGet } },
});
