import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';

const handler = createStartHandler(defaultStreamHandler);

// Routes owned by the SolidJS SPA (served via app.html)
// Auth routes migrated to React: /signin, /signup, /check-email, /reset-password, /complete-profile
const SPA_ROUTE_PREFIXES = [
  // '/dashboard', // migrated to React
  // '/checklist', // migrated to React (Phase 4.9)
  // '/settings', // migrated to React
  // '/admin', // migrated to React (Phase 4.10)
  // '/projects', // migrated to React (Phase 4.5-4.8)
  // '/orgs', // migrated to React
  '/mocks',
];

function isSpaRoute(pathname: string): boolean {
  return SPA_ROUTE_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(prefix + '/'),
  );
}

export default {
  async fetch(
    request: Request,
    env: { ASSETS: { fetch: (_req: Request) => Promise<Response> } },
  ): Promise<Response> {
    const url = new URL(request.url);

    if (isSpaRoute(url.pathname)) {
      // Serve the SolidJS SPA shell from static assets
      const appRequest = new Request(new URL('/app.html', request.url));
      return env.ASSETS.fetch(appRequest);
    }

    // Let TanStack Start handle everything else (landing pages, etc.)
    return handler(request);
  },
};
