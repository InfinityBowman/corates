import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildUser, resetCounter } from '@/__tests__/server/factories';
import { handleGet, handlePost } from '../users';
import { handler as migrateHandler } from '../migrate';

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  await clearProjectDOs(['project-1']);
});

describe('GET /api/db/users', () => {
  it('returns list of users', async () => {
    await buildUser({ email: 'user1@example.com' });
    await buildUser({ email: 'user2@example.com' });

    const res = await handleGet({
      request: new Request('http://localhost/api/db/users'),
      context: { db: createDb(env.DB) },
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
