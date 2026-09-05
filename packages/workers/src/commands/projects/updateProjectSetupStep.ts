/**
 * Move a project's first-run setup to another step, or clear it (null) to finish.
 *
 * @throws DomainError DB_ERROR on database error
 */

import { createDb } from '@corates/db/client';
import { projects } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS, type ProjectSetupStep } from '@corates/shared';
import { info } from '../../lib/logger';
import type { Env } from '../../types';

interface UpdateProjectSetupStepParams {
  projectId: string;
  setupStep: ProjectSetupStep | null;
}

export async function updateProjectSetupStep(
  env: Env,
  { projectId, setupStep }: UpdateProjectSetupStepParams,
): Promise<{ projectId: string; setupStep: ProjectSetupStep | null }> {
  const db = createDb(env.DB);

  try {
    await db.update(projects).set({ setupStep }).where(eq(projects.id, projectId));
  } catch (err) {
    throw createDomainError(
      SYSTEM_ERRORS.DB_ERROR,
      { operation: 'update_project_setup_step', projectId, originalError: (err as Error).message },
      'Failed to update project setup',
    );
  }

  info('project.setupStep', { projectId, setupStep });

  return { projectId, setupStep };
}
