import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { createDb } from '@corates/db/client';
import { feedback } from '@corates/db/schema';
import { DomainErrorException } from '@corates/shared';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildUser, resetCounter } from '@/__tests__/server/factories';
import type { Session } from '@/server/middleware/auth';
import { submitFeedback } from '@/server/functions/feedback.server';

let mockQueueSend: Mock;

function mockSession(user: { id: string; email: string; name: string }): Session {
  return {
    user: { id: user.id, email: user.email, name: user.name },
    session: { id: 'test-session', userId: user.id },
  } as Session;
}

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  resetCounter();
  mockQueueSend = vi.fn(async () => {});
  vi.spyOn(env.EMAIL_QUEUE, 'send').mockImplementation(mockQueueSend);
  (env as unknown as Record<string, string>).CONTACT_EMAIL = 'contact@example.com';
});

describe('submitFeedback', () => {
  it('stores feedback and sends a notification email', async () => {
    const user = await buildUser();
    const db = createDb(env.DB);

    const result = await submitFeedback(db, mockSession(user), {
      category: 'bug',
      message: 'The PDF viewer crashes on page 3',
      context: {
        route: '/projects/abc',
        userAgent: 'TestAgent/1.0',
        viewport: '1280x720',
        replayId: 'replay-123',
      },
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();

    const row = await db.select().from(feedback).where(eq(feedback.id, result.id)).get();
    expect(row).toBeDefined();
    expect(row!.userId).toBe(user.id);
    expect(row!.category).toBe('bug');
    expect(row!.status).toBe('new');
    expect(JSON.parse(row!.context!)).toMatchObject({
      route: '/projects/abc',
      replayId: 'replay-123',
    });

    expect(mockQueueSend).toHaveBeenCalledTimes(1);
    const payload = mockQueueSend.mock.calls[0][0];
    expect(payload.to).toBe('contact@example.com');
    expect(payload.replyTo).toBe(user.email);
    expect(payload.subject).toContain('[Feedback] bug');
    expect(payload.text).toContain('The PDF viewer crashes on page 3');
    expect(payload.text).toContain('replay-123');
  });

  it('stores feedback without context', async () => {
    const user = await buildUser();
    const db = createDb(env.DB);

    const result = await submitFeedback(db, mockSession(user), {
      category: 'idea',
      message: 'Add dark mode',
    });

    expect(result.success).toBe(true);
    const row = await db.select().from(feedback).where(eq(feedback.id, result.id)).get();
    expect(row!.context).toBeNull();
  });

  it('still succeeds when the notification email fails', async () => {
    mockQueueSend.mockRejectedValueOnce(new Error('Queue unavailable'));
    const user = await buildUser();
    const db = createDb(env.DB);

    const result = await submitFeedback(db, mockSession(user), {
      category: 'other',
      message: 'General comment',
    });

    expect(result.success).toBe(true);
    const row = await db.select().from(feedback).where(eq(feedback.id, result.id)).get();
    expect(row).toBeDefined();
  });

  it('rejects the sixth submission within an hour', async () => {
    const user = await buildUser();
    const db = createDb(env.DB);
    const session = mockSession(user);

    for (let i = 0; i < 5; i++) {
      await submitFeedback(db, session, { category: 'idea', message: `Idea ${i}` });
    }

    try {
      await submitFeedback(db, session, { category: 'idea', message: 'One too many' });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(429);
      const body = res.toDomainError() as { code: string };
      expect(body.code).toBe('SYSTEM_RATE_LIMITED');
    }
  });

  it('does not count submissions older than an hour', async () => {
    const user = await buildUser();
    const db = createDb(env.DB);
    const session = mockSession(user);

    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000);
    for (let i = 0; i < 5; i++) {
      await db.insert(feedback).values({
        id: crypto.randomUUID() as never,
        userId: user.id,
        category: 'idea',
        message: `Old idea ${i}`,
        createdAt: twoHoursAgo,
      });
    }

    const result = await submitFeedback(db, session, { category: 'idea', message: 'Fresh idea' });
    expect(result.success).toBe(true);
  });

  it('does not count other users toward the cap', async () => {
    const heavyUser = await buildUser();
    const quietUser = await buildUser();
    const db = createDb(env.DB);

    for (let i = 0; i < 5; i++) {
      await submitFeedback(db, mockSession(heavyUser), { category: 'idea', message: `Idea ${i}` });
    }

    const result = await submitFeedback(db, mockSession(quietUser), {
      category: 'idea',
      message: 'From someone else',
    });
    expect(result.success).toBe(true);
  });
});
