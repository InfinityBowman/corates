import { z } from 'zod';
import { info, warn } from '@corates/workers/logger';
import { sanitizeClientLogData } from '@/lib/clientLogSanitize';

export const CLIENT_LOG_SERVICE = 'corates-web-client';

export const clientLogEntrySchema = z.object({
  level: z.enum(['info', 'warn', 'error']),
  message: z.string().min(1).max(200),
  ts: z.string().max(40).optional(),
  route: z.string().max(500).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const clientLogBodySchema = z.object({
  entries: z.array(clientLogEntrySchema).min(1).max(20),
});

export type ClientLogEntry = z.infer<typeof clientLogEntrySchema>;

export function emitClientLogEntry(entry: ClientLogEntry, userId?: string): void {
  const data = sanitizeClientLogData(entry.data);
  delete data.userId;

  const payload = {
    source: 'browser',
    service: CLIENT_LOG_SERVICE,
    ...(entry.route && { route: entry.route }),
    ...(userId && { userId }),
    ...data,
  };

  if (entry.level === 'warn' || entry.level === 'error') {
    warn(entry.message, payload);
    return;
  }

  info(entry.message, payload);
}
