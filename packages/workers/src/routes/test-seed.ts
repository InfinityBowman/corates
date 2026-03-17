/**
 * Test seed endpoints for e2e testing
 * Only available when DEV_MODE is enabled
 *
 * These endpoints create test users, organizations, sessions, and projects
 * using Better Auth's testUtils plugin. They are called from Vitest Browser
 * Mode custom commands during e2e tests.
 */

import { Hono } from 'hono';
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
 * Creates users, an organization, and org members in one call.
 */
testSeedRoutes.post('/seed', async c => {
  try {
    const auth = createAuth(c.env);
    const ctx = await auth.$context;
    const test = (ctx as any).test;

    if (!test) {
      return c.json({ error: 'testUtils plugin not available' }, 500);
    }

    const body = await c.req.json<{
      users: Array<{
        id?: string;
        name: string;
        email: string;
        givenName?: string;
        familyName?: string;
      }>;
      org: { id?: string; name: string; slug?: string };
      orgMembers: Array<{ userId: string; role: string }>;
    }>();

    const savedUsers = [];

    // Create users
    for (const userData of body.users) {
      const user = test.createUser({
        ...userData,
        emailVerified: true,
      });
      const saved = await test.saveUser(user);
      savedUsers.push(saved);
    }

    // Create organization
    const org = test.createOrganization({
      id: body.org.id,
      name: body.org.name,
      slug: body.org.slug || body.org.name.toLowerCase().replace(/\s+/g, '-'),
    });
    const savedOrg = await test.saveOrganization(org);

    // Add members to organization
    for (const memberData of body.orgMembers) {
      await test.addMember({
        userId: memberData.userId,
        organizationId: savedOrg.id,
        role: memberData.role,
      });
    }

    return c.json({
      success: true,
      users: savedUsers,
      org: savedOrg,
    });
  } catch (err) {
    console.error('[test-seed] Seed error:', err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

/**
 * POST /api/test/session
 * Creates a session for a user and returns the cookie value.
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
      headers: Object.fromEntries(result.headers.entries()),
    });
  } catch (err) {
    console.error('[test-seed] Session error:', err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

/**
 * POST /api/test/cleanup
 * Deletes test data by user IDs and org ID.
 */
testSeedRoutes.post('/cleanup', async c => {
  try {
    const auth = createAuth(c.env);
    const ctx = await auth.$context;
    const test = (ctx as any).test;

    if (!test) {
      return c.json({ error: 'testUtils plugin not available' }, 500);
    }

    const body = await c.req.json<{
      userIds?: string[];
      orgId?: string;
    }>();

    if (body.userIds) {
      for (const userId of body.userIds) {
        try {
          await test.deleteUser(userId);
        } catch {
          // User may already be deleted
        }
      }
    }

    if (body.orgId) {
      try {
        await test.deleteOrganization(body.orgId);
      } catch {
        // Org may already be deleted
      }
    }

    return c.json({ success: true });
  } catch (err) {
    console.error('[test-seed] Cleanup error:', err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

export { testSeedRoutes };
