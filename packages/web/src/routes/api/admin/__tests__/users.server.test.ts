/**
 * Admin /users handler-logic tests.
 *
 * These directly invoke the route handlers with a stand-in admin context.
 * Auth/CSRF/admin-role enforcement is now in `adminMiddleware` and validated
 * once in `projects-self.server.test.ts` via `SELF.fetch`. We intentionally
 * skip per-route 401/403 tests to avoid duplicating that coverage.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildAdminUser, buildOrg, buildProject, buildUser, resetCounter } from '@/__tests__/server/factories';
import { createDb } from '@corates/db/client';
import { account, session, user } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import type { AdminContext } from '@/server/middleware/admin';
import { handleGet as statsHandler } from '../stats';
import { handleGet as listUsersHandler } from '../users';
import {
  handleGet as userDetailsHandler,
  handleDelete as deleteUserHandler,
} from '../users/$userId';
import { handlePost as banHandler } from '../users/$userId/ban';
import { handlePost as unbanHandler } from '../users/$userId/unban';
import { handlePost as impersonateHandler } from '../users/$userId/impersonate';
import { handleDelete as revokeAllSessionsHandler } from '../users/$userId/sessions';
import { handleDelete as revokeSessionHandler } from '../users/$userId/sessions/$sessionId';

const { mockSyncMemberToDO, mockAuthHandler } = vi.hoisted(() => ({
  mockSyncMemberToDO: vi.fn(async () => {}),
  mockAuthHandler: vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
}));

vi.mock('@corates/workers/project-sync', () => ({
  syncMemberToDO: mockSyncMemberToDO,
}));

vi.mock('@corates/workers/auth-config', () => ({
  createAuth: () => ({ handler: mockAuthHandler }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  resetCounter();
  mockAuthHandler.mockImplementation(
    async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  );
});

function adminCtx(adminUserId = 'admin-id'): { admin: AdminContext } {
  return {
    admin: {
      userId: adminUserId,
      userEmail: 'admin@example.com',
      userName: 'Admin',
      sessionId: 'admin-sess',
    },
  };
}

async function seedSessionRow(id: string, userId: string, opts: Partial<{ ip: string }> = {}) {
  const db = createDb(env.DB);
  const now = new Date();
  await db.insert(session).values({
    id,
    token: `${id}-token`,
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
    ipAddress: opts.ip ?? null,
    userAgent: null,
  });
}

async function seedAccountRow(
  id: string,
  userId: string,
  providerId: string,
  accountId = `${userId}-${providerId}`,
) {
  const db = createDb(env.DB);
  await db.insert(account).values({
    id,
    accountId,
    providerId,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('GET /api/admin/stats', () => {
  it('returns dashboard counts', async () => {
    const admin = await buildAdminUser();
    const u = await buildUser();
    await buildProject({ owner: u });
    await seedSessionRow('s-1', u.id);

    const res = await statsHandler();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      users: number;
      projects: number;
      activeSessions: number;
      recentSignups: number;
    };
    expect(body.users).toBeGreaterThanOrEqual(2);
    expect(body.projects).toBeGreaterThanOrEqual(1);
    expect(body.activeSessions).toBeGreaterThanOrEqual(1);
    expect(body.recentSignups).toBeGreaterThanOrEqual(2);
    void admin;
  });
});

describe('GET /api/admin/users', () => {
  it('paginates and includes providers', async () => {
    const admin = await buildAdminUser();
    const u1 = await buildUser();
    await buildUser();
    await seedAccountRow('a-1', u1.id, 'google');
    await seedAccountRow('a-2', u1.id, 'github');
    await seedAccountRow('a-3', admin.id, 'credential');

    const res = await listUsersHandler({
      request: new Request('http://localhost/api/admin/users?page=1&limit=10'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      users: { id: string; providers: string[] }[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    };
    expect(body.pagination.total).toBeGreaterThanOrEqual(3);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(10);
    const found = body.users.find(u => u.id === u1.id);
    expect(found).toBeDefined();
    expect(found!.providers.sort()).toEqual(['github', 'google']);
  });

  it('search filter is case-insensitive over email', async () => {
    const u = await buildUser({ email: 'searchable.user@example.com', name: 'Searchy' });
    await buildUser({ email: 'other@example.com' });

    const res = await listUsersHandler({
      request: new Request('http://localhost/api/admin/users?search=SEARCHABLE'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { users: { id: string }[]; pagination: { total: number } };
    expect(body.pagination.total).toBe(1);
    expect(body.users[0].id).toBe(u.id);
  });
});

describe('GET /api/admin/users/:userId', () => {
  it('returns 404 when user does not exist', async () => {
    const admin = await buildAdminUser();
    const res = await userDetailsHandler({
      request: new Request('http://localhost/api/admin/users/missing'),
      params: { userId: 'missing' },
      context: adminCtx(admin.id),
    });
    expect(res.status).toBe(404);
  });

  it('returns full details with projects/sessions/accounts/orgs+billing', async () => {
    const admin = await buildAdminUser();
    const { project, owner, org } = await buildProject();
    await seedSessionRow('s-detail', owner.id, { ip: '1.2.3.4' });
    await seedAccountRow('a-detail', owner.id, 'google');

    const res = await userDetailsHandler({
      request: new Request(`http://localhost/api/admin/users/${owner.id}`),
      params: { userId: owner.id },
      context: adminCtx(admin.id),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { id: string; email: string };
      projects: { id: string }[];
      sessions: { id: string; ipAddress: string | null }[];
      accounts: { providerId: string }[];
      orgs: {
        orgId: string;
        billing: { effectivePlanId: string; source: string; planName: string };
      }[];
    };
    expect(body.user.id).toBe(owner.id);
    expect(body.projects.find(p => p.id === project.id)).toBeDefined();
    expect(body.sessions.find(s => s.id === 's-detail')?.ipAddress).toBe('1.2.3.4');
    expect(body.accounts.find(a => a.providerId === 'google')).toBeDefined();
    const orgEntry = body.orgs.find(o => o.orgId === org.id);
    expect(orgEntry).toBeDefined();
    expect(orgEntry!.billing.effectivePlanId).toBeDefined();
    expect(orgEntry!.billing.planName).toBeDefined();
  });
});

describe('POST /api/admin/users/:userId/ban', () => {
  it('rejects self-ban with 400', async () => {
    const admin = await buildAdminUser();
    const res = await banHandler({
      request: new Request(`http://localhost/api/admin/users/${admin.id}/ban`, {
        method: 'POST',
        headers: { origin: 'http://localhost:3010' },
      }),
      params: { userId: admin.id },
      context: adminCtx(admin.id),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { details?: { constraint?: string } };
    expect(body.details?.constraint).toBe('cannot_ban_self');
  });

  it('bans the user and revokes their sessions', async () => {
    const admin = await buildAdminUser();
    const target = await buildUser();
    await seedSessionRow('s-ban-1', target.id);
    await seedSessionRow('s-ban-2', target.id);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await banHandler({
      request: new Request(`http://localhost/api/admin/users/${target.id}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3010' },
        body: JSON.stringify({ reason: 'Spam', expiresAt }),
      }),
      params: { userId: target.id },
      context: adminCtx(admin.id),
    });
    expect(res.status).toBe(200);

    const db = createDb(env.DB);
    const [row] = await db
      .select({ banned: user.banned, banReason: user.banReason, banExpires: user.banExpires })
      .from(user)
      .where(eq(user.id, target.id));
    expect(row.banned).toBe(true);
    expect(row.banReason).toBe('Spam');
    expect(row.banExpires).toBeInstanceOf(Date);

    const remaining = await db.select().from(session).where(eq(session.userId, target.id));
    expect(remaining.length).toBe(0);
  });

  it('uses defaults when no body is provided', async () => {
    const admin = await buildAdminUser();
    const target = await buildUser();
    const res = await banHandler({
      request: new Request(`http://localhost/api/admin/users/${target.id}/ban`, {
        method: 'POST',
        headers: { origin: 'http://localhost:3010' },
      }),
      params: { userId: target.id },
      context: adminCtx(admin.id),
    });
    expect(res.status).toBe(200);

    const db = createDb(env.DB);
    const [row] = await db
      .select({ banned: user.banned, banReason: user.banReason })
      .from(user)
      .where(eq(user.id, target.id));
    expect(row.banned).toBe(true);
    expect(row.banReason).toBe('Banned by administrator');
  });
});

describe('POST /api/admin/users/:userId/unban', () => {
  it('clears banned/banReason/banExpires', async () => {
    const target = await buildUser({
      banned: 1,
      banReason: 'Old reason',
      banExpires: Math.floor(Date.now() / 1000) + 86400,
    });

    const res = await unbanHandler({
      request: new Request(`http://localhost/api/admin/users/${target.id}/unban`, {
        method: 'POST',
        headers: { origin: 'http://localhost:3010' },
      }),
      params: { userId: target.id },
    });
    expect(res.status).toBe(200);

    const db = createDb(env.DB);
    const [row] = await db
      .select({ banned: user.banned, banReason: user.banReason, banExpires: user.banExpires })
      .from(user)
      .where(eq(user.id, target.id));
    expect(row.banned).toBe(false);
    expect(row.banReason).toBeNull();
    expect(row.banExpires).toBeNull();
  });
});

describe('POST /api/admin/users/:userId/impersonate', () => {
  it('rejects self-impersonation with 400', async () => {
    const admin = await buildAdminUser();
    const res = await impersonateHandler({
      request: new Request(`http://localhost/api/admin/users/${admin.id}/impersonate`, {
        method: 'POST',
        headers: { origin: 'http://localhost:3010' },
        body: JSON.stringify({ userId: admin.id }),
      }),
      params: { userId: admin.id },
      context: adminCtx(admin.id),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { details?: { constraint?: string } };
    expect(body.details?.constraint).toBe('cannot_impersonate_self');
  });

  it('returns 400 when body.userId is missing', async () => {
    const admin = await buildAdminUser();
    const target = await buildUser();
    const res = await impersonateHandler({
      request: new Request(`http://localhost/api/admin/users/${target.id}/impersonate`, {
        method: 'POST',
        headers: { origin: 'http://localhost:3010' },
        body: JSON.stringify({}),
      }),
      params: { userId: target.id },
      context: adminCtx(admin.id),
    });
    expect(res.status).toBe(400);
  });

  it('proxies to better-auth handler and returns its response', async () => {
    const admin = await buildAdminUser();
    const target = await buildUser();
    mockAuthHandler.mockImplementationOnce(
      async () =>
        new Response(JSON.stringify({ session: { id: 'imp-sess' } }), {
          status: 200,
          headers: { 'set-cookie': 'auth=fake; Path=/' },
        }),
    );

    const res = await impersonateHandler({
      request: new Request(`http://localhost/api/admin/users/${target.id}/impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: 'session=abc',
          origin: 'http://localhost:3010',
        },
        body: JSON.stringify({ userId: target.id }),
      }),
      params: { userId: target.id },
      context: adminCtx(admin.id),
    });
    expect(res.status).toBe(200);
    expect(mockAuthHandler).toHaveBeenCalledTimes(1);
    const forwardedReq = (mockAuthHandler as Mock).mock.calls[0][0] as Request;
    expect(forwardedReq.url).toContain('/api/auth/admin/impersonate-user');
    expect(forwardedReq.headers.get('cookie')).toBe('session=abc');
    const body = (await res.json()) as { session: { id: string } };
    expect(body.session.id).toBe('imp-sess');
  });
});

describe('DELETE /api/admin/users/:userId/sessions', () => {
  it('deletes all sessions for the user', async () => {
    const target = await buildUser();
    const other = await buildUser();
    await seedSessionRow('rs-1', target.id);
    await seedSessionRow('rs-2', target.id);
    await seedSessionRow('rs-other', other.id);

    const res = await revokeAllSessionsHandler({
      request: new Request(`http://localhost/api/admin/users/${target.id}/sessions`, {
        method: 'DELETE',
        headers: { origin: 'http://localhost:3010' },
      }),
      params: { userId: target.id },
    });
    expect(res.status).toBe(200);

    const db = createDb(env.DB);
    const remaining = await db.select().from(session).where(eq(session.userId, target.id));
    expect(remaining.length).toBe(0);
    const otherRemaining = await db.select().from(session).where(eq(session.userId, other.id));
    expect(otherRemaining.length).toBe(1);
  });
});

describe('DELETE /api/admin/users/:userId/sessions/:sessionId', () => {
  it('returns 404 for non-existent session', async () => {
    const target = await buildUser();
    const res = await revokeSessionHandler({
      request: new Request(`http://localhost/api/admin/users/${target.id}/sessions/missing`, {
        method: 'DELETE',
        headers: { origin: 'http://localhost:3010' },
      }),
      params: { userId: target.id, sessionId: 'missing' },
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 when session belongs to a different user', async () => {
    const target = await buildUser();
    const other = await buildUser();
    await seedSessionRow('s-other', other.id);

    const res = await revokeSessionHandler({
      request: new Request(`http://localhost/api/admin/users/${target.id}/sessions/s-other`, {
        method: 'DELETE',
        headers: { origin: 'http://localhost:3010' },
      }),
      params: { userId: target.id, sessionId: 's-other' },
    });
    expect(res.status).toBe(404);
  });

  it('deletes a single matching session', async () => {
    const target = await buildUser();
    await seedSessionRow('s-keep', target.id);
    await seedSessionRow('s-drop', target.id);

    const res = await revokeSessionHandler({
      request: new Request(`http://localhost/api/admin/users/${target.id}/sessions/s-drop`, {
        method: 'DELETE',
        headers: { origin: 'http://localhost:3010' },
      }),
      params: { userId: target.id, sessionId: 's-drop' },
    });
    expect(res.status).toBe(200);

    const db = createDb(env.DB);
    const remaining = await db.select().from(session).where(eq(session.userId, target.id));
    expect(remaining.map(r => r.id)).toEqual(['s-keep']);
  });
});

describe('DELETE /api/admin/users/:userId', () => {
  it('rejects self-delete with 400', async () => {
    const admin = await buildAdminUser();
    const res = await deleteUserHandler({
      request: new Request(`http://localhost/api/admin/users/${admin.id}`, {
        method: 'DELETE',
        headers: { origin: 'http://localhost:3010' },
      }),
      params: { userId: admin.id },
      context: adminCtx(admin.id),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { details?: { constraint?: string } };
    expect(body.details?.constraint).toBe('cannot_delete_self');
  });

  it('returns 404 for non-existent user', async () => {
    const admin = await buildAdminUser();
    const res = await deleteUserHandler({
      request: new Request('http://localhost/api/admin/users/missing', {
        method: 'DELETE',
        headers: { origin: 'http://localhost:3010' },
      }),
      params: { userId: 'missing' },
      context: adminCtx(admin.id),
    });
    expect(res.status).toBe(404);
  });

  it('cascades delete: syncs DOs, deletes user + related rows', async () => {
    const admin = await buildAdminUser();
    const { project, owner } = await buildProject();
    await seedSessionRow('del-s', owner.id);
    await seedAccountRow('del-a', owner.id, 'credential');

    const res = await deleteUserHandler({
      request: new Request(`http://localhost/api/admin/users/${owner.id}`, {
        method: 'DELETE',
        headers: { origin: 'http://localhost:3010' },
      }),
      params: { userId: owner.id },
      context: adminCtx(admin.id),
    });
    expect(res.status).toBe(200);

    expect(mockSyncMemberToDO).toHaveBeenCalledWith(env, project.id, 'remove', {
      userId: owner.id,
    });

    const db = createDb(env.DB);
    const [u] = await db.select().from(user).where(eq(user.id, owner.id));
    expect(u).toBeUndefined();
    const remainingSessions = await db.select().from(session).where(eq(session.userId, owner.id));
    expect(remainingSessions.length).toBe(0);
    const remainingAccounts = await db.select().from(account).where(eq(account.userId, owner.id));
    expect(remainingAccounts.length).toBe(0);
  });
});

void env;
void buildOrg;
