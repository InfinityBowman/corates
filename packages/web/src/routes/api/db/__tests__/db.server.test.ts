import { beforeEach, describe, expect, it } from 'vitest';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { handler as migrateHandler } from '../migrate';

beforeEach(async () => {
  await resetTestDatabase();
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
