import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { createDb } from '@corates/db/client';
import { user } from '@corates/db/schema';
import { addMember } from '@corates/workers/commands/members';
import type { OrgId, ProjectId, UserId } from '@corates/shared/ids';
import { devModeGate } from '@/server/devModeGate';

export const handler = async ({ request }: { request: Request }) => {
  const gated = devModeGate(env);
  if (gated) return gated;

  try {
    const body = (await request.json()) as {
      projectId: string;
      orgId: string;
      userId: string;
      role?: string;
    };

    const db = createDb(env.DB);
    const userToAdd = await db
      .select({ id: user.id, name: user.name, email: user.email, image: user.image })
      .from(user)
      .where(eq(user.id, body.userId))
      .get();

    if (!userToAdd) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const result = await addMember(
      env,
      { id: body.userId as UserId },
      {
        orgId: body.orgId as OrgId,
        projectId: body.projectId as ProjectId,
        userToAdd: userToAdd as typeof userToAdd & { id: UserId },
        role: (body.role || 'member') as 'owner' | 'member',
      },
    );

    return Response.json({ success: true, ...result });
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
