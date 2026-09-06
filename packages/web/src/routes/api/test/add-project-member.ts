import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { createDb } from '@corates/db/client';
import { projectMembers, user } from '@corates/db/schema';
import { addMember } from '@corates/workers/commands/members';
import { DomainErrorException, PROJECT_ERRORS } from '@corates/shared';
import type { OrgId, ProjectId, UserId } from '@corates/shared/ids';
import { devModeGate } from '@/server/devModeGate';
import { captureError } from '@corates/workers/logger';

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

    // Idempotent so the e2e helpers can retry after a lost response.
    const existing = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, body.projectId), eq(projectMembers.userId, body.userId)),
      )
      .get();
    if (existing) {
      return Response.json({ success: true, alreadyMember: true });
    }

    try {
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
      // A retried request whose first attempt landed after the pre-check.
      if (
        err instanceof DomainErrorException &&
        err.code === PROJECT_ERRORS.MEMBER_ALREADY_EXISTS.code
      ) {
        return Response.json({ success: true, alreadyMember: true });
      }
      throw err;
    }
  } catch (err) {
    captureError(err, { tags: { component: 'test-routes', action: 'add-project-member' } });
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
