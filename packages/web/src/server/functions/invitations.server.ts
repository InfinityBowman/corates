import { captureError } from '@corates/workers/logger';
import { env } from 'cloudflare:workers';
import {
  acceptInvitation,
  getInvitationByToken,
  type InvitationSummary,
} from '@corates/workers/commands/invitations';
import {
  createDomainError,
  isDomainError,
  DomainErrorException,
  SYSTEM_ERRORS,
  type DomainError,
} from '@corates/shared';
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
      throw new DomainErrorException(de);
    }
    captureError(err, { tags: { component: 'invitations', action: 'accept' } });
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'accept_invitation',
      originalError: (err as Error).message,
    });
    throw new DomainErrorException(dbError);
  }
}

export async function handleGetInvitation(data: { token: string }): Promise<InvitationSummary> {
  try {
    return await getInvitationByToken(env, { token: data.token });
  } catch (err) {
    if (isDomainError(err)) {
      throw new DomainErrorException(err as DomainError);
    }
    captureError(err, { tags: { component: 'invitations', action: 'get' } });
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'get_invitation',
      originalError: (err as Error).message,
    });
    throw new DomainErrorException(dbError);
  }
}
