import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import { sendAnnouncement } from './admin-announcements.server';

export const ANNOUNCEMENT_TITLE_MAX = 80;
export const ANNOUNCEMENT_BODY_MAX = 280;

export const sendAnnouncementAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      title: z.string().trim().min(1).max(ANNOUNCEMENT_TITLE_MAX),
      body: z.string().trim().min(1).max(ANNOUNCEMENT_BODY_MAX),
      // In-app paths only; the row navigates with the router, not window.location.
      href: z.string().trim().startsWith('/').max(500).nullable(),
    }),
  )
  .handler(async ({ data, context: { session } }) => sendAnnouncement(session, data));
