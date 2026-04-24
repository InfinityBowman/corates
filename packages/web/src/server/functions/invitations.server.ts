import { env } from 'cloudflare:workers';
import { acceptInvitation } from '@corates/workers/commands/invitations';
import { createDomainError, isDomainError, SYSTEM_ERRORS, type DomainError } from '@corates/shared';
import type { Session } from '@/server/middleware/auth';

export interface AcceptResult {
  success: true;
  orgId: string | null;
  orgSlug?: string;
  projectId: string;
  projectName: string;
  role?: string;
  alreadyMember?: boolean;
}

export async function handleAcceptInvitation(
  session: Session,
  data: { token: string },
): Promise<AcceptResult> {
  try {
    const result = await acceptInvitation(env, { id: session.user.id }, { token: data.token });
    return {
      success: true,
      orgId: result.orgId,
      orgSlug: result.orgSlug ?? undefined,
      projectId: result.projectId,
      projectName: result.projectName,
      role: result.role ?? undefined,
      alreadyMember: result.alreadyMember || undefined,
    };
  } catch (err) {
    if (isDomainError(err)) {
      const de = err as DomainError;
      throw Response.json(de, { status: de.statusCode });
    }
    console.error('Error accepting invitation:', err);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'accept_invitation',
      originalError: (err as Error).message,
    });
    throw Response.json(dbError, { status: 500 });
  }
}
