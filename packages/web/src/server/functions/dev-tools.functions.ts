import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { OrgId, ProjectId } from '@corates/shared/ids';
import { authMiddleware } from '@/server/middleware/auth';
import {
  listDevTemplates,
  applyDevTemplate,
  devImportState,
  devResetState,
  devExportState,
  devAddStudy,
} from './dev-tools.server';

export const getDevTemplates = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string(), projectId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    listDevTemplates(session, db, data.orgId as OrgId, data.projectId as ProjectId),
  );

export const applyTemplate = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orgId: z.string(),
      projectId: z.string(),
      template: z.string().min(1),
      mode: z.enum(['replace', 'merge']).default('replace'),
      userMapping: z.record(z.string(), z.string()).optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => {
    const { orgId, projectId, ...templateData } = data;
    return applyDevTemplate(session, db, orgId as OrgId, projectId as ProjectId, templateData);
  });

export const importState = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orgId: z.string(),
      projectId: z.string(),
      data: z.record(z.string(), z.unknown()).optional(),
      mode: z.string().default('replace'),
      userMapping: z.record(z.string(), z.string()).optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => {
    const { orgId, projectId, ...body } = data;
    return devImportState(session, db, orgId as OrgId, projectId as ProjectId, body);
  });

export const resetState = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string(), projectId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    devResetState(session, db, data.orgId as OrgId, data.projectId as ProjectId),
  );

export const exportState = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string(), projectId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    devExportState(session, db, data.orgId as OrgId, data.projectId as ProjectId),
  );

export const addStudyAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orgId: z.string(),
      projectId: z.string(),
      type: z.string().optional(),
      fillMode: z.string().optional(),
      reviewer1: z.string().optional(),
      reviewer2: z.string().optional(),
      reconcile: z.boolean().optional(),
      outcomeId: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => {
    const { orgId, projectId, ...body } = data;
    return devAddStudy(session, db, orgId as OrgId, projectId as ProjectId, body);
  });
