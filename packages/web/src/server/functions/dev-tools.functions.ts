import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { OrgId, ProjectId } from '@corates/shared/ids';
import { authMiddleware } from '@/server/middleware/auth';
import { devExportState, devImportState, devResetState } from './dev-tools.server';

export const exportState = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string(), projectId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    devExportState(session, db, data.orgId as OrgId, data.projectId as ProjectId),
  );

export const importState = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      orgId: z.string(),
      projectId: z.string(),
      snapshot: z.record(z.string(), z.unknown()),
    }),
  )
  .handler(async ({ data, context: { session, db } }) =>
    devImportState(session, db, data.orgId as OrgId, data.projectId as ProjectId, data.snapshot),
  );

export const resetState = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string(), projectId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    devResetState(session, db, data.orgId as OrgId, data.projectId as ProjectId),
  );
