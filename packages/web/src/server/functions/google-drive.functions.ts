import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import { getStatus, disconnectGoogle, getPickerToken, importFromDrive } from './google-drive.server';

export const getDriveStatus = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => getStatus(db, session));

export const disconnectDrive = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => disconnectGoogle(db, session));

export const getDrivePickerToken = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => getPickerToken(db, session));

export const importFromDriveAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      fileId: z.string().min(1),
      projectId: z.string().min(1),
      studyId: z.string().min(1),
    }),
  )
  .handler(async ({ data, context: { db, session } }) => importFromDrive(db, session, data));
