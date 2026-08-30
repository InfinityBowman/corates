import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { dbMiddleware } from '@/server/middleware/db';
import { submitContact } from './contact.server';

export const submitContactForm = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware])
  .validator(
    z.object({
      name: z.string().trim().min(1).max(100),
      email: z.string().trim().min(1).max(254).email(),
      subject: z.string().trim().max(150).optional().default(''),
      message: z.string().trim().min(1).max(2000),
    }),
  )
  .handler(async ({ data, context: { db } }) => submitContact(db, data));
