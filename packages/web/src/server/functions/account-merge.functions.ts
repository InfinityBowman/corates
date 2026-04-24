import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import {
  initiateMergeRequest,
  verifyMerge,
  completeMergeRequest,
  cancelMergeRequest,
} from './account-merge.server';

export const initiateAccountMerge = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      targetEmail: z.string().optional(),
      targetOrcidId: z.string().optional(),
    }),
  )
  .handler(async ({ data, context: { db, session, request } }) =>
    initiateMergeRequest(db, session, request, data),
  );

export const verifyAccountMergeCode = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      mergeToken: z.string().min(1),
      code: z.string().min(1),
    }),
  )
  .handler(async ({ data, context: { db, session, request } }) =>
    verifyMerge(db, session, request, data),
  );

export const completeAccountMerge = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ mergeToken: z.string().min(1) }))
  .handler(async ({ data, context: { db, session } }) =>
    completeMergeRequest(db, session, data.mergeToken),
  );

export const cancelAccountMerge = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ mergeToken: z.string().min(1) }))
  .handler(async ({ data, context: { db, session } }) =>
    cancelMergeRequest(db, session, data.mergeToken),
  );
