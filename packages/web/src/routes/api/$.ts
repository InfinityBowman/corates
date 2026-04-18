/**
 * Catch-all 404 for unmatched /api/* paths.
 *
 * TanStack's specificity sort puts splats last, so this only fires for paths
 * that no concrete API route claims. Returns the documented
 * `SYSTEM_ROUTE_NOT_FOUND` JSON shape so API clients see a parseable error
 * instead of the SPA HTML shell.
 */
import { createFileRoute } from '@tanstack/react-router';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';

const handle = ({ request }: { request: Request }) => {
  const path = (() => {
    try {
      return new URL(request.url).pathname;
    } catch {
      return request.url;
    }
  })();
  return Response.json(createDomainError(SYSTEM_ERRORS.ROUTE_NOT_FOUND, { path }), { status: 404 });
};

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
      OPTIONS: handle,
      HEAD: handle,
    },
  },
});
