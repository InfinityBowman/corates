import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildUser, resetCounter } from '@/__tests__/server/factories';
import { handleGet, handlePost } from '../users';
import { handler as migrateHandler } from '../migrate';

let currentUser: { id: string; email: string } | null = { id: 'user-1', email: 'user1@example.com' };

vi.mock('@corates/workers/auth', () => ({
  getSession: async () =>
    currentUser ?
      {
        user: { id: currentUser.id, email: currentUser.email, name: 'Test User' },
        session: { id: 'test-session', userId: currentUser.id },
      }
    : null,
}));

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  await clearProjectDOs(['project-1']);
  currentUser = { id: 'user-1', email: 'user1@example.com' };
});

describe('GET /api/db/users', () => {
  it('returns 401 when unauthenticated', async () => {
    currentUser = null;
    const res = await handleGet({
      request: new Request('http://localhost/api/db/users'),
    });
    expect(res.status).toBe(401);
  });

  it('returns list of users', async () => {
    const u1 = await buildUser({ email: 'user1@example.com' });
    await buildUser({ email: 'user2@example.com' });
    currentUser = { id: u1.id, email: u1.email };

    const res = await handleGet({
      request: new Request('http://localhost/api/db/users'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { users: Array<{ id: string; email: string }> };
    expect(body.users.length).toBeGreaterThanOrEqual(2);
    expect(body.users[0].email).toBeDefined();
  });
});

describe('POST /api/db/users', () => {
  it('returns deprecation error', async () => {
    const res = await handlePost();
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('VALIDATION_INVALID_INPUT');
  });
});

describe('POST /api/db/migrate', () => {
  it('returns success when user table exists', async () => {
    const res = await migrateHandler();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; message: string };
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/completed/i);
  });
});
