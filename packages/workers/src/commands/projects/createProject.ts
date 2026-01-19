/**
 * Create a new project within an organization
 *
 * @throws ValidationError FIELD_REQUIRED if name is empty or whitespace-only
 * @throws DomainError QUOTA_EXCEEDED if org at project limit
 * @throws DomainError DB_TRANSACTION_FAILED on database error
 */

import { createDb } from '@/db/client';
import { projects, projectMembers, user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { insertWithQuotaCheck } from '@/lib/quotaTransaction';
import { syncProjectToDO } from '@/commands/lib/doSync';
import { createValidationError, VALIDATION_ERRORS } from '@corates/shared';
import type { Env } from '@/types';
import type { ProjectRole } from '@/policies/lib/roles';

export interface CreateProjectActor {
  id: string;
}

export interface CreateProjectParams {
  orgId: string;
  name: string;
  description?: string;
}

export interface CreateProjectResult {
  project: {
    id: string;
    name: string;
    description: string | null;
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
  { orgId, name, description }: CreateProjectParams,
): Promise<CreateProjectResult> {
  const db = createDb(env.DB);

  const projectId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const now = new Date();
  const trimmedName = name?.trim() || '';
  const trimmedDescription = description?.trim() || null;

  if (!trimmedName) {
    throw createValidationError('name', VALIDATION_ERRORS.FIELD_REQUIRED.code, null);
  }

  const insertStatements = [
    db.insert(projects).values({
      id: projectId,
      name: trimmedName,
      description: trimmedDescription,
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

  const quotaResult = await insertWithQuotaCheck(db, {
    orgId,
    quotaKey: 'projects.max',
    countTable: projects,
    countColumn: projects.orgId,
    insertStatements,
  });

  if (!quotaResult.success) {
    throw quotaResult.error;
  }

  const creator = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      givenName: user.givenName,
      familyName: user.familyName,
      image: user.image,
    })
    .from(user)
    .where(eq(user.id, actor.id))
    .get();

  try {
    await syncProjectToDO(
      env,
      projectId,
      {
        name: trimmedName,
        description: trimmedDescription,
        orgId,
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      },
      [
        {
          userId: actor.id,
          role: 'owner',
          joinedAt: now.getTime(),
          name: creator?.name || null,
          email: creator?.email || null,
          givenName: creator?.givenName || null,
          familyName: creator?.familyName || null,
          image: creator?.image || null,
        },
      ],
    );
  } catch (err) {
    console.error('Failed to sync project to DO:', err);
  }

  return {
    project: {
      id: projectId,
      name: trimmedName,
      description: trimmedDescription,
      orgId,
      createdBy: actor.id,
      role: 'owner',
      createdAt: now,
      updatedAt: now,
    },
  };
}
