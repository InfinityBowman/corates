import { createStart, createCsrfMiddleware } from '@tanstack/react-start';
import { domainErrorAdapter } from '@/lib/domainErrorAdapter';

// Start installs this CSRF check implicitly only when no start.ts exists
const csrfMiddleware = createCsrfMiddleware({ filter: ctx => ctx.handlerType === 'serverFn' });

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  serializationAdapters: [domainErrorAdapter],
}));
