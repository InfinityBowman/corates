/**
 * Create a new project within an organization
 *
 * @throws ValidationError FIELD_REQUIRED if name is empty or whitespace-only
 * @throws DomainError QUOTA_EXCEEDED if org at project limit
 * @throws DomainError DB_TRANSACTION_FAILED on database error
 */

import { createDb } from '@corates/db/client';
import { projects, projectMembers } from '@corates/db/schema';
import { insertWithQuotaCheck, type InsertRollbackMeta } from '../../lib/quotaTransaction';
import { info } from '../../lib/logger';
import { createValidationError, VALIDATION_ERRORS } from '@corates/shared';
import type { OrgId, ProjectId, ProjectMemberId, UserId } from '@corates/shared/ids';
import type { Env } from '../../types';
import type { ProjectRole } from '../../policies/lib/roles';

interface CreateProjectActor {
  id: UserId;
}

interface CreateProjectParams {
  orgId: OrgId;
  name: string;
}

interface CreateProjectResult {
  project: {
    id: string;
    name: string;
    orgId: string;
    createdBy: string;
    role: ProjectRole;
    createdAt: Date;
    updatedAt: Date;
  };
}

export async function createProject(
  env: Env,
  actor: CreateProjectActor,
  { orgId, name }: CreateProjectParams,
): Promise<CreateProjectResult> {
  const db = createDb(env.DB);

  const projectId = crypto.randomUUID() as ProjectId;
  const memberId = crypto.randomUUID() as ProjectMemberId;
  const now = new Date();
  const trimmedName = name?.trim() || '';

  if (!trimmedName) {
    throw createValidationError('name', VALIDATION_ERRORS.FIELD_REQUIRED.code, null);
  }

  const insertStatements = [
    db.insert(projects).values({
      id: projectId,
      name: trimmedName,
      orgId,
      createdBy: actor.id,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(projectMembers).values({
      id: memberId,
      projectId,
      userId: actor.id,
      role: 'owner',
      joinedAt: now,
    }),
  ];

  // Rollback metadata for race condition handling
  // Array is processed in reverse order: projectMembers deleted first, then projects (FK constraint)
  const rollbackMeta: InsertRollbackMeta[] = [
    { table: projects, idColumn: projects.id, id: projectId },
    { table: projectMembers, idColumn: projectMembers.id, id: memberId },
  ];

  const quotaResult = await insertWithQuotaCheck(db, {
    orgId,
    quotaKey: 'projects.max',
    countTable: projects,
    countColumn: projects.orgId,
    insertStatements,
    rollbackMeta,
  });

  if (!quotaResult.success) {
    throw quotaResult.error;
  }

  info('project.created', { orgId, projectId, userId: actor.id });

  return {
    project: {
      id: projectId,
      name: trimmedName,
      orgId,
      createdBy: actor.id,
      role: 'owner',
      createdAt: now,
      updatedAt: now,
    },
  };
}
