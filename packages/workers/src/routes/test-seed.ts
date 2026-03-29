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
  projectMembers,
  verification,
  account,
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
      subscription?: {
        plan?: string;
        status?: string;
        periodEnd?: number;
        cancelAtPeriodEnd?: boolean;
        trialEnd?: number;
        seats?: number;
      };
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

    // Create subscription for the org (defaults to starter_team/active)
    const subOpts = body.subscription ?? {};
    await db.insert(subscription).values({
      id: `${body.org.id}-sub`,
      plan: subOpts.plan ?? 'starter_team',
      referenceId: body.org.id,
      status: subOpts.status ?? 'active',
      periodStart: new Date(),
      periodEnd: subOpts.periodEnd
        ? new Date(subOpts.periodEnd * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: subOpts.cancelAtPeriodEnd ?? false,
      trialEnd: subOpts.trialEnd ? new Date(subOpts.trialEnd * 1000) : undefined,
      seats: subOpts.seats ?? 5,
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
 * POST /api/test/update-subscription
 * Updates the subscription for an org. Used in billing e2e tests to change plan/status mid-test.
 */
testSeedRoutes.post('/update-subscription', async c => {
  try {
    const db = drizzle(c.env.DB);
    const body = await c.req.json<{
      orgId: string;
      plan?: string;
      status?: string;
      periodEnd?: number;
      cancelAtPeriodEnd?: boolean;
    }>();

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.plan !== undefined) updates.plan = body.plan;
    if (body.status !== undefined) updates.status = body.status;
    if (body.periodEnd !== undefined) updates.periodEnd = new Date(body.periodEnd * 1000);
    if (body.cancelAtPeriodEnd !== undefined) updates.cancelAtPeriodEnd = body.cancelAtPeriodEnd;

    await db
      .update(subscription)
      .set(updates)
      .where(eq(subscription.referenceId, body.orgId));

    return c.json({ success: true });
  } catch (err) {
    console.error('[test-seed] Update subscription error:', err);
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

/**
 * GET /api/test/auth-url?email=<email>&type=<magic-link|verification|reset-password>
 * Returns the full auth URL stored by the DEV_MODE callbacks in auth/config.ts.
 * The URL is stored in the verification table with identifier `test-url:{type}:{email}`.
 */
testSeedRoutes.get('/auth-url', async c => {
  try {
    const db = drizzle(c.env.DB);
    const email = c.req.query('email');
    const type = c.req.query('type');

    if (!email || !type) {
      return c.json({ error: 'email and type query params required' }, 400);
    }

    const identifier = `test-url:${type}:${email}`;
    const rows = await db
      .select()
      .from(verification)
      .where(eq(verification.identifier, identifier))
      .all();

    if (!rows.length) {
      return c.json({ error: `No ${type} URL found for ${email}` }, 404);
    }

    // Return the most recently created URL
    const latest = rows.sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    )[0];

    return c.json({ success: true, url: latest.value });
  } catch (err) {
    console.error('[test-seed] Auth URL error:', err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

/**
 * POST /api/test/verify-email
 * Marks a user's email as verified and optionally their profile as complete.
 * Used in e2e tests to skip the email verification step.
 */
testSeedRoutes.post('/verify-email', async c => {
  try {
    const db = drizzle(c.env.DB);
    const body = await c.req.json<{ email: string; completeProfile?: boolean }>();

    const updates: Record<string, unknown> = {
      emailVerified: true,
      updatedAt: new Date(),
    };
    if (body.completeProfile) {
      updates.profileCompletedAt = Math.floor(Date.now() / 1000);
    }

    await db.update(user).set(updates).where(eq(user.email, body.email));

    return c.json({ success: true });
  } catch (err) {
    console.error('[test-seed] Verify email error:', err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

/**
 * POST /api/test/cleanup-user-by-email
 * Deletes a user and related data by email. Used for auth flow tests where
 * the user ID is not known ahead of time (created via real signup).
 */
testSeedRoutes.post('/cleanup-user-by-email', async c => {
  try {
    const db = drizzle(c.env.DB);
    const body = await c.req.json<{ email: string }>();

    const users = await db.select().from(user).where(eq(user.email, body.email)).all();

    for (const u of users) {
      await db.delete(session).where(eq(session.userId, u.id));
      await db.delete(account).where(eq(account.userId, u.id));
      await db.delete(member).where(eq(member.userId, u.id));
      await db.delete(user).where(eq(user.id, u.id));
    }

    // Clean up verification tokens for this email (direct + test-url prefixed)
    await db.delete(verification).where(eq(verification.identifier, body.email));
    for (const prefix of [
      'test-url:magic-link:',
      'test-url:verification:',
      'test-url:reset-password:',
    ]) {
      await db.delete(verification).where(eq(verification.identifier, `${prefix}${body.email}`));
    }

    return c.json({ success: true, deletedCount: users.length });
  } catch (err) {
    console.error('[test-seed] Cleanup by email error:', err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

export { testSeedRoutes };
