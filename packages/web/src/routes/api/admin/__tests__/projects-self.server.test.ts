/**
 * W1/W2 spike — invokes the admin/projects/$projectId route end-to-end via
 * SELF.fetch instead of calling the handler directly. Validates the full
 * createStartHandler -> middleware -> handler chain in the test pool.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SELF } from 'cloudflare:test';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildAdminUser, buildProject, resetCounter } from '@/__tests__/server/factories';

let sessionResult: {
  user: { id: string; email: string; name: string; role?: string };
  session: { id: string; userId: string; activeOrganizationId: string | null };
} | null = null;

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => sessionResult,
}));

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  sessionResult = null;
});

async function asAdmin() {
  const admin = await buildAdminUser();
  sessionResult = {
    user: { id: admin.id, email: admin.email, name: admin.name, role: 'admin' },
    session: { id: 'admin-sess', userId: admin.id, activeOrganizationId: null },
  };
  return admin;
}

describe('SELF.fetch /api/admin/projects/$projectId', () => {
  it('returns 401 with no session', async () => {
    const res = await SELF.fetch('http://example.com/api/admin/projects/x');
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin', async () => {
    const admin = await buildAdminUser();
    sessionResult = {
      user: { id: admin.id, email: admin.email, name: admin.name, role: 'user' },
      session: { id: 's', userId: admin.id, activeOrganizationId: null },
    };
    const res = await SELF.fetch('http://example.com/api/admin/projects/x');
    expect(res.status).toBe(403);
  });

  it('returns 404 with admin session and missing project', async () => {
    await asAdmin();
    const res = await SELF.fetch('http://example.com/api/admin/projects/no-such');
    expect(res.status).toBe(404);
  });

  it('returns 200 with admin session and existing project', async () => {
    await asAdmin();
    const { project } = await buildProject();
    const res = await SELF.fetch(`http://example.com/api/admin/projects/${project.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { project: { id: string } };
    expect(body.project.id).toBe(project.id);
  });

  it('rejects DELETE without trusted origin (CSRF)', async () => {
    await asAdmin();
    const res = await SELF.fetch('http://example.com/api/admin/projects/x', {
      method: 'DELETE',
      // intentionally no Origin header
    });
    expect(res.status).toBe(403);
  });

  it('accepts DELETE with trusted origin', async () => {
    await asAdmin();
    const { project } = await buildProject();
    const res = await SELF.fetch(`http://example.com/api/admin/projects/${project.id}`, {
      method: 'DELETE',
      headers: { origin: 'http://localhost:3010' },
    });
    expect(res.status).toBe(200);
  });
});
