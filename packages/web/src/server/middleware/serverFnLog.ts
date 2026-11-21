import { createMiddleware } from '@tanstack/react-start';
import { runWithContext } from '@corates/workers/logger';
import { logServerFnFailure } from '@/server/logServerFnFailure';

// start.ts loads in the browser too: keep every server-only import referenced
// only inside .server() so Start strips it, or the client bundle pulls in the
// logger and its AsyncLocalStorage, which throws on page load.
export const serverFnLogMiddleware = createMiddleware({ type: 'function' }).server(
  ({ next, serverFnMeta }) =>
    // Calls made during SSR carry only the id; browser RPCs carry the name too
    runWithContext({ serverFn: serverFnMeta.name ?? serverFnMeta.id }, async () => {
      try {
        return await next();
      } catch (error) {
        logServerFnFailure(error);
        throw error;
      }
    }),
);
