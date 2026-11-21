import { createStart, createCsrfMiddleware } from '@tanstack/react-start';
import { domainErrorAdapter } from '@/lib/domainErrorAdapter';
import { serverFnLogMiddleware } from '@/server/middleware/serverFnLog';

// Start installs this CSRF check implicitly only when no start.ts exists
const csrfMiddleware = createCsrfMiddleware({ filter: ctx => ctx.handlerType === 'serverFn' });

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  functionMiddleware: [serverFnLogMiddleware],
  serializationAdapters: [domainErrorAdapter],
}));
