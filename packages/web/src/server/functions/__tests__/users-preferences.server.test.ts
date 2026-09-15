import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildUser, resetCounter } from '@/__tests__/server/factories';
import { dismissHint } from '@/server/functions/users.server';

function sessionFor(u: { id: string; email: string }) {
  return {
    user: { id: u.id, email: u.email, name: 'Test User' },
    session: { id: 'test-session', userId: u.id },
  };
}

async function storedPreferences(userId: string) {
  const row = await env.DB.prepare('SELECT preferences FROM user WHERE id = ?1')
    .bind(userId)
    .first<{ preferences: string | null }>();
  return row?.preferences ?? null;
}

async function setStoredPreferences(userId: string, value: string) {
  await env.DB.prepare('UPDATE user SET preferences = ?1 WHERE id = ?2').bind(value, userId).run();
}

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
});

describe('dismissHint', () => {
  it('records the hint when the user has no preferences yet', async () => {
    const u = await buildUser();
    const result = await dismissHint(createDb(env.DB), sessionFor(u), 'studiesExplainer');

    expect(result.dismissedHints).toEqual(['studiesExplainer']);
    expect(JSON.parse((await storedPreferences(u.id))!)).toEqual({
      dismissedHints: ['studiesExplainer'],
    });
  });

  it('is idempotent', async () => {
    const u = await buildUser();
    const db = createDb(env.DB);
    await dismissHint(db, sessionFor(u), 'studiesExplainer');
    const result = await dismissHint(db, sessionFor(u), 'studiesExplainer');

    expect(result.dismissedHints).toEqual(['studiesExplainer']);
  });

  it('keeps preference keys it does not know about', async () => {
    const u = await buildUser();
    await setStoredPreferences(u.id, JSON.stringify({ theme: 'dark', dismissedHints: ['other'] }));

    await dismissHint(createDb(env.DB), sessionFor(u), 'studiesExplainer');

    expect(JSON.parse((await storedPreferences(u.id))!)).toEqual({
      theme: 'dark',
      dismissedHints: ['other', 'studiesExplainer'],
    });
  });

  it('starts over when the stored value is not readable', async () => {
    const u = await buildUser();
    await setStoredPreferences(u.id, '{broken');

    const result = await dismissHint(createDb(env.DB), sessionFor(u), 'studiesExplainer');

    expect(result).toEqual({ dismissedHints: ['studiesExplainer'] });
  });

  it('only touches the calling user', async () => {
    const a = await buildUser();
    const b = await buildUser();

    await dismissHint(createDb(env.DB), sessionFor(a), 'studiesExplainer');

    expect(await storedPreferences(b.id)).toBeNull();
  });
});
