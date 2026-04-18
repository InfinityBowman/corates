import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { projectMembers } from '@corates/db/schema';
import { devModeGate } from '@/server/devModeGate';

export const handler = async ({ request }: { request: Request }) => {
  const gated = devModeGate(env);
  if (gated) return gated;

  try {
    const db = drizzle(env.DB);
    const body = (await request.json()) as {
      projectId: string;
      userId: string;
      role?: string;
    };

    await db.insert(projectMembers).values({
      id: crypto.randomUUID(),
      projectId: body.projectId,
      userId: body.userId,
      role: body.role || 'collaborator',
      joinedAt: new Date(),
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error('[test-seed] Add project member error:', err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/test/add-project-member')({
  server: {
    handlers: {
      POST: handler,
    },
  },
});
