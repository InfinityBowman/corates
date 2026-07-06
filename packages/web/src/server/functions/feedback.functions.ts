import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import { submitFeedback as submitFeedbackImpl } from './feedback.server';

export const submitFeedback = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      category: z.enum(['bug', 'idea', 'other']),
      message: z.string().trim().min(1).max(2000),
      context: z
        .object({
          route: z.string().max(500).optional(),
          userAgent: z.string().max(500).optional(),
          viewport: z.string().max(50).optional(),
          replayId: z.string().max(100).optional(),
        })
        .optional(),
    }),
  )
  .handler(async ({ data, context: { db, session } }) => submitFeedbackImpl(db, session, data));
