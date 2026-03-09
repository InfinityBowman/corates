import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'

const handler = createStartHandler(defaultStreamHandler)

// Routes owned by the SolidJS SPA (served via app.html)
const SPA_ROUTE_PREFIXES = [
  '/dashboard',
  '/checklist',
  '/settings',
  '/admin',
  '/projects',
  '/orgs',
  '/mocks',
  '/signin',
  '/signup',
  '/check-email',
  '/complete-profile',
  '/reset-password',
]

function isSpaRoute(pathname: string): boolean {
  return SPA_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  )
}

export default {
  async fetch(
    request: Request,
    env: { ASSETS: { fetch: (req: Request) => Promise<Response> } },
  ): Promise<Response> {
    const url = new URL(request.url)

    if (isSpaRoute(url.pathname)) {
      // Serve the SolidJS SPA shell from static assets
      const appRequest = new Request(new URL('/app.html', request.url))
      return env.ASSETS.fetch(appRequest)
    }

    // Let TanStack Start handle everything else (landing pages, etc.)
    return handler(request)
  },
}
