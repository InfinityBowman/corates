import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import { resetTestDatabase, seedOrganization } from '../../__tests__/helpers.js';
import { createDb } from '@corates/db/client';
import { pickAvailableWorkspaceSlug } from '../workspaceSlug.js';

const nowSec = Math.floor(Date.now() / 1000);

async function takeSlug(slug: string) {
  await seedOrganization({ id: `org-${slug}`, name: slug, slug, createdAt: nowSec });
}

describe('pickAvailableWorkspaceSlug', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('uses the slugified name when it is free', async () => {
    expect(await pickAvailableWorkspaceSlug(createDb(env.DB), 'Dana Y.')).toBe('dana-y');
  });

  it('numbers the slug when the name is taken', async () => {
    await takeSlug('patricia');
    await takeSlug('patricia-2');
    expect(await pickAvailableWorkspaceSlug(createDb(env.DB), 'Patricia')).toBe('patricia-3');
  });

  it('falls back to the email local part for names with no Latin letters', async () => {
    expect(
      await pickAvailableWorkspaceSlug(createDb(env.DB), '\u96c5\u8339', 'yaru.liang@example.com'),
    ).toBe('yaru-liang');
  });

  it('falls back to a generic slug when nothing usable is left', async () => {
    expect(await pickAvailableWorkspaceSlug(createDb(env.DB), '\u96c5\u8339', null)).toBe('my-workspace');
  });
});
