/**
 * Tests for admin project routes.
 *
 * Currently focused on the doc-stats endpoint added with the chunked-snapshot
 * persistence redesign — it routes through a Durable Object (the only admin
 * project route that does), so the 404-without-waking-the-DO behavior and
 * the response shape both deserve coverage.
 *
 * The full project listing / details / delete routes are already covered by
 * end-to-end tests against the Hono router elsewhere; this file is scoped to
 * the doc-stats path.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono, type Context } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedProject,
  clearProjectDOs,
} from '../../../__tests__/helpers.js';
import { STATIC_ORIGINS } from '../../../config/origins';

const TRUSTED_ORIGIN = STATIC_ORIGINS[0];

vi.mock('@/middleware/requireAdmin.js', () => {
  return {
    isAdmin: () => true,
    requireAdmin: async (c: Context, next: () => Promise<void>) => {
      c.set('user', {
        id: 'admin-user',
        role: 'admin',
        email: 'admin@example.com',
        name: 'Admin User',
      });
      c.set('session', { id: 'admin-session' });
      c.set('isAdmin', true);
      await next();
    },
  };
});

let app: Hono;

interface FetchInit extends RequestInit {
  headers?: Record<string, string>;
}

async function fetchApp(path: string, init: FetchInit = {}) {
  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      origin: TRUSTED_ORIGIN,
      ...init.headers,
    },
  });
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

beforeAll(async () => {
  const { projectRoutes } = await import('../projects.js');
  app = new Hono();
  app.route('/api/admin', projectRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs(['admin-stats-project', 'admin-stats-populated']);
  vi.clearAllMocks();
});

describe('GET /api/admin/projects/:projectId/doc-stats', () => {
  it('returns 404 when the project does not exist in D1', async () => {
    const res = await fetchApp('/api/admin/projects/no-such-project/doc-stats');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code?: string };
    // The exact code comes from createDomainError(PROJECT_ERRORS.NOT_FOUND)
    expect(body).toBeDefined();
  });

  it('returns 200 with stat shape for an existing empty project', async () => {
    const now = Math.floor(Date.now() / 1000);

    // Seed the minimum required for the route's D1 existence check to pass.
    await seedUser({
      id: 'owner-1',
      email: 'owner@example.com',
      name: 'Owner',
      createdAt: now,
      updatedAt: now,
    });
    await seedOrganization({
      id: 'org-stats',
      name: 'Org',
      slug: 'org-stats',
      createdAt: now,
    });
    await seedProject({
      id: 'admin-stats-project',
      name: 'Stats Test Project',
      orgId: 'org-stats',
      createdBy: 'owner-1',
      createdAt: now,
      updatedAt: now,
    });

    const res = await fetchApp('/api/admin/projects/admin-stats-project/doc-stats');
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      rows: {
        total: number;
        snapshot: number;
        update: number;
        snapshotBytes: number;
        updateBytes: number;
        totalBytes: number;
      };
      encodedSnapshotBytes: number;
      memoryUsagePercent: number;
      content: { members: number; studies: number; checklists: number; pdfs: number };
      timestamps: { oldestRowAt: number | null; newestRowAt: number | null };
    };

    // Shape assertions
    expect(typeof body.rows.total).toBe('number');
    expect(typeof body.rows.snapshot).toBe('number');
    expect(typeof body.rows.update).toBe('number');
    expect(typeof body.encodedSnapshotBytes).toBe('number');
    expect(typeof body.memoryUsagePercent).toBe('number');
    expect(typeof body.content.members).toBe('number');
    expect(typeof body.content.studies).toBe('number');
    expect(typeof body.content.checklists).toBe('number');
    expect(typeof body.content.pdfs).toBe('number');

    // Empty doc invariants
    expect(body.content.members).toBe(0);
    expect(body.content.studies).toBe(0);
    expect(body.content.checklists).toBe(0);
    expect(body.content.pdfs).toBe(0);
    expect(body.memoryUsagePercent).toBeLessThan(0.01);

    // Cross-field consistency
    expect(body.rows.totalBytes).toBe(body.rows.snapshotBytes + body.rows.updateBytes);
  });
});
