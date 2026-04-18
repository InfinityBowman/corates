import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, resetCounter } from '@/__tests__/server/factories';
import { handleGet } from '../members';

let sessionResult: {
  user: { id: string; email: string; name: string };
  session: { id: string; userId: string; activeOrganizationId: string | null };
} | null = null;

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => sessionResult,
}));

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
  sessionResult = null;
});

function membersReq(): Request {
  return new Request('http://localhost/api/billing/members', { method: 'GET' });
}

describe('GET /api/billing/members', () => {
  it('returns 401 when no session', async () => {
    const res = await handleGet({ request: membersReq() });
    expect(res.status).toBe(401);
    expect(listMembersMock).not.toHaveBeenCalled();
  });

  it('returns 403 when caller has no org', async () => {
    sessionResult = {
      user: { id: 'orphan', email: 'o@example.com', name: 'O' },
      session: { id: 'sess', userId: 'orphan', activeOrganizationId: null },
    };
    const res = await handleGet({ request: membersReq() });
    expect(res.status).toBe(403);
    expect(listMembersMock).not.toHaveBeenCalled();
  });

  it('returns members from better-auth listMembers', async () => {
    const { org, owner } = await buildOrg();
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess', userId: owner.id, activeOrganizationId: org.id },
    };
    listMembersMock.mockResolvedValueOnce({
      members: [
        { id: 'm1', userId: owner.id, organizationId: org.id, role: 'owner' },
        { id: 'm2', userId: 'other', organizationId: org.id, role: 'member' },
      ],
    });

    const res = await handleGet({ request: membersReq() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { members: unknown[]; count: number };
    expect(body.count).toBe(2);
    expect(body.members).toHaveLength(2);

    const callArg = listMembersMock.mock.calls[0][0] as { query: { organizationId: string } };
    expect(callArg.query.organizationId).toBe(org.id);
  });

  it('returns empty list when listMembers returns no members', async () => {
    const { org, owner } = await buildOrg();
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess', userId: owner.id, activeOrganizationId: org.id },
    };
    listMembersMock.mockResolvedValueOnce({});

    const res = await handleGet({ request: membersReq() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { members: unknown[]; count: number };
    expect(body.count).toBe(0);
    expect(body.members).toEqual([]);
  });
});
