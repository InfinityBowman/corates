/**
 * Admin /users handler-logic tests.
 *
 * Tests invoke the pure business logic functions in admin-users.server.ts.
 * Auth/CSRF/admin-role enforcement is validated once in `projects-self.server.test.ts`.
 * Impersonation tests call the server function directly since it returns a Response.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import {
  buildAdminUser,
  buildOrg,
  buildProject,
  buildUser,
  resetCounter,
} from '@/__tests__/server/factories';
import { createDb } from '@corates/db/client';
import { account, session, user } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import type { Session } from '@/server/middleware/auth';
import { handleGet as statsHandler } from '../stats';
import {
  listAdminUsers,
  getAdminUserDetails,
  deleteAdminUser,
  banAdminUser,
  unbanAdminUser,
  revokeAllAdminSessions,
  revokeAdminSession,
  impersonateAdminUser,
} from '@/server/functions/admin-users.server';

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

function mockAdminSession(overrides?: { userId?: string }): Session {
  return {
    user: {
      id: overrides?.userId ?? 'admin-id',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
    },
    session: {
      id: 'admin-sess',
      userId: overrides?.userId ?? 'admin-id',
    },
  } as Session;
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

    const res = await statsHandler({ context: { db: createDb(env.DB) } });
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

    const body = await listAdminUsers(mockAdminSession({ userId: admin.id }), createDb(env.DB), {
      page: 1,
      limit: 10,
    });
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

    const body = await listAdminUsers(mockAdminSession(), createDb(env.DB), {
      search: 'SEARCHABLE',
    });
    expect(body.pagination.total).toBe(1);
    expect(body.users[0].id).toBe(u.id);
  });
});

describe('GET /api/admin/users/:userId', () => {
  it('returns 404 when user does not exist', async () => {
    const admin = await buildAdminUser();
    try {
      await getAdminUserDetails(mockAdminSession({ userId: admin.id }), createDb(env.DB), 'missing');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(404);
    }
  });

  it('returns full details with projects/sessions/accounts/orgs+billing', async () => {
    const admin = await buildAdminUser();
    const { project, owner, org } = await buildProject();
    await seedSessionRow('s-detail', owner.id, { ip: '1.2.3.4' });
    await seedAccountRow('a-detail', owner.id, 'google');

    const body = await getAdminUserDetails(
      mockAdminSession({ userId: admin.id }),
      createDb(env.DB),
      owner.id,
    );
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
    try {
      await banAdminUser(mockAdminSession({ userId: admin.id }), createDb(env.DB), admin.id, {});
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { details?: { constraint?: string } };
      expect(body.details?.constraint).toBe('cannot_ban_self');
    }
  });

  it('bans the user and revokes their sessions', async () => {
    const admin = await buildAdminUser();
    const target = await buildUser();
    await seedSessionRow('s-ban-1', target.id);
    await seedSessionRow('s-ban-2', target.id);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await banAdminUser(mockAdminSession({ userId: admin.id }), createDb(env.DB), target.id, {
      reason: 'Spam',
      expiresAt,
    });

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
    await banAdminUser(mockAdminSession({ userId: admin.id }), createDb(env.DB), target.id, {});

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

    await unbanAdminUser(mockAdminSession(), createDb(env.DB), target.id);

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
    const request = new Request('http://localhost/api/admin/users/impersonate', {
      method: 'POST',
      headers: { cookie: 'session=abc', origin: 'http://localhost:3010' },
    });

    try {
      await impersonateAdminUser(mockAdminSession({ userId: admin.id }), request, admin.id);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { details?: { constraint?: string } };
      expect(body.details?.constraint).toBe('cannot_impersonate_self');
    }
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

    const request = new Request('http://localhost/api/admin/users/impersonate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'session=abc',
        origin: 'http://localhost:3010',
      },
    });

    const res = await impersonateAdminUser(
      mockAdminSession({ userId: admin.id }),
      request,
      target.id,
    );
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

    await revokeAllAdminSessions(mockAdminSession(), createDb(env.DB), target.id);

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
    try {
      await revokeAdminSession(mockAdminSession(), createDb(env.DB), target.id, 'missing');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(404);
    }
  });

  it('returns 404 when session belongs to a different user', async () => {
    const target = await buildUser();
    const other = await buildUser();
    await seedSessionRow('s-other', other.id);

    try {
      await revokeAdminSession(mockAdminSession(), createDb(env.DB), target.id, 's-other');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(404);
    }
  });

  it('deletes a single matching session', async () => {
    const target = await buildUser();
    await seedSessionRow('s-keep', target.id);
    await seedSessionRow('s-drop', target.id);

    await revokeAdminSession(mockAdminSession(), createDb(env.DB), target.id, 's-drop');

    const db = createDb(env.DB);
    const remaining = await db.select().from(session).where(eq(session.userId, target.id));
    expect(remaining.map(r => r.id)).toEqual(['s-keep']);
  });
});

describe('DELETE /api/admin/users/:userId', () => {
  it('rejects self-delete with 400', async () => {
    const admin = await buildAdminUser();
    try {
      await deleteAdminUser(mockAdminSession({ userId: admin.id }), createDb(env.DB), admin.id);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { details?: { constraint?: string } };
      expect(body.details?.constraint).toBe('cannot_delete_self');
    }
  });

  it('returns 404 for non-existent user', async () => {
    const admin = await buildAdminUser();
    try {
      await deleteAdminUser(mockAdminSession({ userId: admin.id }), createDb(env.DB), 'missing');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(404);
    }
  });

  it('cascades delete: syncs DOs, deletes user + related rows', async () => {
    const admin = await buildAdminUser();
    const { project, owner } = await buildProject();
    await seedSessionRow('del-s', owner.id);
    await seedAccountRow('del-a', owner.id, 'credential');

    await deleteAdminUser(mockAdminSession({ userId: admin.id }), createDb(env.DB), owner.id);

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
