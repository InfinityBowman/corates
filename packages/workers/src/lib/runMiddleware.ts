/**
 * Helper to run Hono middleware manually and check for early response.
 * Useful when you need to conditionally apply middleware inside a route handler.
 */

import type { Context, MiddlewareHandler } from 'hono';

export async function runMiddleware(
  middleware: MiddlewareHandler,
  c: Context,
): Promise<Response | null> {
  let nextCalled = false;

  const result = await middleware(c, async () => {
    nextCalled = true;
  });

  // If middleware returned a Response (early return), return it
  if (result instanceof Response) {
    return result;
  }

  // If next() wasn't called, the middleware returned early via c.json()
  if (!nextCalled && c.res) {
    return c.res;
  }

  return null;
}
