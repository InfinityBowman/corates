import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { subscription } from '@corates/db/schema';
import { resetTestDatabase } from '@/__tests__/server/helpers';

/**
 * Guards the `subscription_referenceId_incomplete_uidx` partial unique index.
 *
 * Checkout initiation writes an `incomplete` placeholder row per request. Two
 * concurrent checkout requests for the same org would each create their own
 * placeholder, orphaning the one whose Stripe Checkout Session is never
 * completed. The index makes the duplicate INSERT fail so only one pending
 * subscription can exist per org.
 */
function insertSub(
  db: ReturnType<typeof createDb>,
  id: string,
  referenceId: string,
  status: string,
) {
  return db.insert(subscription).values({ id, plan: 'starter_team', referenceId, status });
}

beforeEach(async () => {
  await resetTestDatabase();
});

describe('subscription incomplete-uniqueness constraint', () => {
  it('rejects a second incomplete subscription for the same org', async () => {
    const db = createDb(env.DB);
    await insertSub(db, 'sub-a', 'org-1', 'incomplete');

    await expect(insertSub(db, 'sub-b', 'org-1', 'incomplete')).rejects.toThrow();

    const rows = await db.select().from(subscription);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('sub-a');
  });

  it('allows an incomplete subscription alongside a non-incomplete one for the same org', async () => {
    const db = createDb(env.DB);
    // An active subscription plus a later pending upgrade attempt must coexist:
    // the index only constrains rows in `incomplete` status.
    await insertSub(db, 'sub-active', 'org-1', 'active');
    await expect(insertSub(db, 'sub-pending', 'org-1', 'incomplete')).resolves.not.toThrow();
    await expect(
      insertSub(db, 'sub-expired', 'org-1', 'incomplete_expired'),
    ).resolves.not.toThrow();
  });

  it('allows incomplete subscriptions for different orgs', async () => {
    const db = createDb(env.DB);
    await insertSub(db, 'sub-1', 'org-1', 'incomplete');
    await expect(insertSub(db, 'sub-2', 'org-2', 'incomplete')).resolves.not.toThrow();
  });
});
