import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { user, organization, member, subscription } from '@corates/db/schema';
import { devModeGate } from '@/server/devModeGate';

interface SeedBody {
  users: Array<{
    id: string;
    name: string;
    email: string;
    givenName?: string;
    familyName?: string;
    role?: string;
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
}

export const handler = async ({ request }: { request: Request }) => {
  const gated = devModeGate(env);
  if (gated) return gated;

  try {
    const db = drizzle(env.DB);
    const body = (await request.json()) as SeedBody;

    const savedUsers = [];

    for (const u of body.users) {
      await db.insert(user).values({
        id: u.id,
        name: u.name,
        email: u.email,
        givenName: u.givenName || null,
        familyName: u.familyName || null,
        role: u.role || 'user',
        emailVerified: true,
        profileCompletedAt: Math.floor(Date.now() / 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      savedUsers.push({ id: u.id, name: u.name, email: u.email });
    }

    const orgSlug = body.org.slug || body.org.name.toLowerCase().replace(/\s+/g, '-');
    await db.insert(organization).values({
      id: body.org.id,
      name: body.org.name,
      slug: orgSlug,
      createdAt: new Date(),
    });

    const subOpts = body.subscription ?? {};
    await db.insert(subscription).values({
      id: `${body.org.id}-sub`,
      plan: subOpts.plan ?? 'starter_team',
      referenceId: body.org.id,
      status: subOpts.status ?? 'active',
      periodStart: new Date(),
      periodEnd:
        subOpts.periodEnd ?
          new Date(subOpts.periodEnd * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: subOpts.cancelAtPeriodEnd ?? false,
      trialEnd: subOpts.trialEnd ? new Date(subOpts.trialEnd * 1000) : undefined,
      seats: subOpts.seats ?? 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    for (const m of body.orgMembers) {
      await db.insert(member).values({
        id: `${m.userId}-${body.org.id}`,
        userId: m.userId,
        organizationId: body.org.id,
        role: m.role,
        createdAt: new Date(),
      });
    }

    return Response.json({
      success: true,
      users: savedUsers,
      org: { id: body.org.id, name: body.org.name, slug: orgSlug },
    });
  } catch (err) {
    console.error('[test-seed] Seed error:', err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/test/seed')({
  server: {
    handlers: {
      POST: handler,
    },
  },
});
