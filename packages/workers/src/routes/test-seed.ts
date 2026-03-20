/**
 * Test seed endpoints for e2e testing
 * Only available when DEV_MODE is enabled
 *
 * Uses direct Drizzle inserts (same pattern as workers test helpers)
 * rather than Better Auth testUtils which has schema compatibility issues.
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import {
  user,
  organization,
  member,
  session,
  subscription,
  projects,
  projectMembers,
} from '@/db/schema.js';
import { createAuth } from '@/auth/config.js';
import type { Env } from '../types';

const testSeedRoutes = new Hono<{ Bindings: Env }>();

// Gate all routes behind DEV_MODE
testSeedRoutes.use('*', async (c, next) => {
  if (!c.env.DEV_MODE) {
    return c.json({ error: 'Test endpoints disabled' }, 403);
  }
  await next();
});

/**
 * POST /api/test/seed
 * Creates users, an organization, and org members via direct Drizzle inserts.
 */
testSeedRoutes.post('/seed', async c => {
  try {
    const db = drizzle(c.env.DB);

    const body = await c.req.json<{
      users: Array<{
        id: string;
        name: string;
        email: string;
        givenName?: string;
        familyName?: string;
      }>;
      org: { id: string; name: string; slug?: string };
      orgMembers: Array<{ userId: string; role: string }>;
    }>();

    const savedUsers = [];

    // Create users
    for (const u of body.users) {
      await db.insert(user).values({
        id: u.id,
        name: u.name,
        email: u.email,
        givenName: u.givenName || null,
        familyName: u.familyName || null,
        emailVerified: true,
        profileCompletedAt: Math.floor(Date.now() / 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      savedUsers.push({ id: u.id, name: u.name, email: u.email });
    }

    // Create organization
    const orgSlug = body.org.slug || body.org.name.toLowerCase().replace(/\s+/g, '-');
    await db.insert(organization).values({
      id: body.org.id,
      name: body.org.name,
      slug: orgSlug,
      createdAt: new Date(),
    });

    // Create a starter_team subscription for the org so users can create projects
    await db.insert(subscription).values({
      id: `${body.org.id}-sub`,
      plan: 'starter_team',
      referenceId: body.org.id,
      status: 'active',
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      seats: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Add members to organization
    for (const m of body.orgMembers) {
      await db.insert(member).values({
        id: `${m.userId}-${body.org.id}`,
        userId: m.userId,
        organizationId: body.org.id,
        role: m.role,
        createdAt: new Date(),
      });
    }

    return c.json({
      success: true,
      users: savedUsers,
      org: { id: body.org.id, name: body.org.name, slug: orgSlug },
    });
  } catch (err) {
    console.error('[test-seed] Seed error:', err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

/**
 * POST /api/test/session
 * Creates a session via Better Auth's testUtils (handles token hashing correctly).
 */
testSeedRoutes.post('/session', async c => {
  try {
    const auth = createAuth(c.env);
    const ctx = await auth.$context;
    const test = (ctx as any).test;

    if (!test) {
      return c.json({ error: 'testUtils plugin not available' }, 500);
    }

    const body = await c.req.json<{ userId: string }>();
    const result = await test.login({ userId: body.userId });

    return c.json({
      success: true,
      token: result.token,
      cookies: result.cookies,
    });
  } catch (err) {
    console.error('[test-seed] Session error:', err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

/**
 * POST /api/test/add-project-member
 * Adds a user as a project member via direct insert.
 */
testSeedRoutes.post('/add-project-member', async c => {
  try {
    const db = drizzle(c.env.DB);
    const body = await c.req.json<{
      projectId: string;
      userId: string;
      role?: string;
    }>();

    await db.insert(projectMembers).values({
      id: crypto.randomUUID(),
      projectId: body.projectId,
      userId: body.userId,
      role: body.role || 'collaborator',
      joinedAt: new Date(),
    });

    return c.json({ success: true });
  } catch (err) {
    console.error('[test-seed] Add project member error:', err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

/**
 * POST /api/test/cleanup
 * Deletes test data by user IDs and org ID.
 */
testSeedRoutes.post('/cleanup', async c => {
  try {
    const db = drizzle(c.env.DB);

    const body = await c.req.json<{
      userIds?: string[];
      orgId?: string;
    }>();

    // Delete sessions, members, then users
    if (body.userIds) {
      for (const userId of body.userIds) {
        await db.delete(session).where(eq(session.userId, userId));
        await db.delete(member).where(eq(member.userId, userId));
        await db.delete(user).where(eq(user.id, userId));
      }
    }

    if (body.orgId) {
      await db.delete(subscription).where(eq(subscription.referenceId, body.orgId));
      await db.delete(member).where(eq(member.organizationId, body.orgId));
      await db.delete(organization).where(eq(organization.id, body.orgId));
    }

    return c.json({ success: true });
  } catch (err) {
    console.error('[test-seed] Cleanup error:', err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

export { testSeedRoutes };
