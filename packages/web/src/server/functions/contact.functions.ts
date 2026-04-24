import { createServerFn } from '@tanstack/react-start';
import { createMiddleware } from '@tanstack/react-start';
import { z } from 'zod';
import { logMiddleware } from '@/server/middleware/log';
import { sendContactEmail } from './contact.server';

const requestMiddleware = createMiddleware()
  .middleware([logMiddleware])
  .server(async ({ next, request }) => {
    return next({ context: { request } });
  });

export const submitContactForm = createServerFn({ method: 'POST' })
  .middleware([requestMiddleware])
  .inputValidator(
    z.object({
      name: z.string().trim().min(1).max(100),
      email: z.string().trim().min(1).max(254).email(),
      subject: z.string().trim().max(150).optional().default(''),
      message: z.string().trim().min(1).max(2000),
    }),
  )
  .handler(async ({ data, context: { request } }) => sendContactEmail(request, data));
