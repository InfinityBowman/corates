import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, resetCounter } from '@/__tests__/server/factories';
import { handleGet } from '../members';
import type { Session } from '@/server/middleware/auth';

function mockSession(overrides?: {
  userId?: string;
  email?: string;
  name?: string;
  activeOrganizationId?: string | null;
}): Session {
  return {
    user: {
      id: overrides?.userId ?? 'user-1',
      email: overrides?.email ?? 'user@example.com',
      name: overrides?.name ?? 'Test User',
    },
    session: {
      id: 'sess-1',
      userId: overrides?.userId ?? 'user-1',
      activeOrganizationId: overrides?.activeOrganizationId ?? null,
    },
  } as Session;
}

const listMembersMock = vi.fn();

vi.mock('@corates/workers/auth-config', () => ({
  createAuth: () => ({
    api: { listMembers: (...args: unknown[]) => listMembersMock(...args) },
  }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  vi.clearAllMocks();
  resetCounter();
});

function membersReq(): Request {
  return new Request('http://localhost/api/billing/members', { method: 'GET' });
}

describe('GET /api/billing/members', () => {
  it('returns 403 when caller has no org', async () => {
    const session = mockSession({ userId: 'orphan', email: 'o@example.com', name: 'O' });
    const res = await handleGet({ request: membersReq(), context: { db: createDb(env.DB), session } });
    expect(res.status).toBe(403);
    expect(listMembersMock).not.toHaveBeenCalled();
  });

  it('returns members from better-auth listMembers', async () => {
    const { org, owner } = await buildOrg();
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    listMembersMock.mockResolvedValueOnce({
      members: [
        { id: 'm1', userId: owner.id, organizationId: org.id, role: 'owner' },
        { id: 'm2', userId: 'other', organizationId: org.id, role: 'member' },
      ],
    });

    const res = await handleGet({ request: membersReq(), context: { db: createDb(env.DB), session } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { members: unknown[]; count: number };
    expect(body.count).toBe(2);
    expect(body.members).toHaveLength(2);

    const callArg = listMembersMock.mock.calls[0][0] as { query: { organizationId: string } };
    expect(callArg.query.organizationId).toBe(org.id);
  });

  it('returns empty list when listMembers returns no members', async () => {
    const { org, owner } = await buildOrg();
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    listMembersMock.mockResolvedValueOnce({});

    const res = await handleGet({ request: membersReq(), context: { db: createDb(env.DB), session } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { members: unknown[]; count: number };
    expect(body.count).toBe(0);
    expect(body.members).toEqual([]);
  });
});
