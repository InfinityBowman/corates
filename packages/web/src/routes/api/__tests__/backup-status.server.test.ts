import { beforeEach, describe, expect, it } from 'vitest';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { handleGet } from '../backup-status';

const get = (headers: Record<string, string> = {}) =>
  handleGet({ request: new Request('http://localhost/api/backup-status', { headers }) });

describe('GET /api/backup-status', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('rejects a missing or wrong token', async () => {
    expect((await get()).status).toBe(401);
    expect((await get({ authorization: 'Bearer wrong' })).status).toBe(401);
  });

  it('returns the R2 snapshot check for the bearer token', async () => {
    const res = await get({ authorization: 'Bearer test-backup-status-token' });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toMatchObject({
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      missing: expect.any(Number),
      missingProjectIds: expect.any(Array),
    });
  });
});
