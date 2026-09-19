import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { notifications } from '@corates/db/schema';
import { DomainErrorException } from '@corates/shared';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildUser, resetCounter } from '@/__tests__/server/factories';
import type { Session } from '@/server/middleware/auth';
import { sendAnnouncement } from '@/server/functions/admin-announcements.server';

function sessionFor(user: { id: string; email: string; role?: string | null }): Session {
  return {
    user: { id: user.id, email: user.email, name: 'Test', role: user.role ?? null },
    session: { id: `sess-${user.id}`, userId: user.id },
  } as unknown as Session;
}

const announcement = { title: 'New instrument', body: 'ROBINS-I V2 is available.', href: null };

describe('sendAnnouncement', () => {
  beforeEach(async () => {
    await resetTestDatabase();
    resetCounter();
  });

  it('rejects non-admin users', async () => {
    const user = await buildUser();
    await expect(sendAnnouncement(sessionFor(user), announcement)).rejects.toBeInstanceOf(
      DomainErrorException,
    );
    const rows = await createDb(env.DB).select().from(notifications);
    expect(rows).toHaveLength(0);
  });

  it('fans out to every user, including the sender', async () => {
    const admin = await buildUser({ role: 'admin' });
    await buildUser();
    await buildUser();

    const result = await sendAnnouncement(sessionFor(admin), announcement);
    expect(result.sent).toBe(3);

    const rows = await createDb(env.DB).select().from(notifications);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map(r => r.userId)).size).toBe(3);
    expect(rows.every(r => r.type === 'announcement')).toBe(true);
  });
});
