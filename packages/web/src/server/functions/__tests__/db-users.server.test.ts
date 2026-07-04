import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { DomainErrorException } from '@corates/shared';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildUser, resetCounter } from '@/__tests__/server/factories';
import { listUsers, usersPostDeprecated } from '@/server/functions/db-users.server';

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  await clearProjectDOs(['project-1']);
});

describe('listUsers', () => {
  it('returns list of users', async () => {
    await buildUser({ email: 'user1@example.com' });
    await buildUser({ email: 'user2@example.com' });

    const result = await listUsers(createDb(env.DB));
    expect(result.users.length).toBeGreaterThanOrEqual(2);
    expect(result.users[0].email).toBeDefined();
  });
});

describe('usersPostDeprecated', () => {
  it('throws deprecation error', async () => {
    try {
      usersPostDeprecated();
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(400);
      const body = res.toDomainError() as { code: string };
      expect(body.code).toBe('VALIDATION_INVALID_INPUT');
    }
  });
});
