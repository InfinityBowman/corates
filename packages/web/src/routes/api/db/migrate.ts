import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';

export const handler = async () => {
  try {
    const tableCheck = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user'",
    ).first();

    if (!tableCheck) {
      return Response.json({
        success: false,
        message: 'Please run: pnpm db:migrate in the workers directory',
      });
    }

    return Response.json({ success: true, message: 'Migration completed' });
  } catch (err) {
    const error = err as Error;
    console.error('Migration error:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'check_migration',
      originalError: error.message,
    });
    return Response.json(dbError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/db/migrate')({
  server: {
    handlers: {
      POST: handler,
    },
  },
});
