import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import { HydrationScript } from 'solid-js/web'
import { Suspense } from 'solid-js'

import AppErrorBoundary from '../components/ErrorBoundary'
import { cleanupExpiredStates } from '@lib/formStatePersistence'
import { initBfcacheHandler } from '@lib/bfcache-handler'
import { checkSession } from '@lib/landing/auth'
import { getDefaultSeoMeta } from '@components/landing/DefaultSeo'

import styleCss from '../styles.css?url'

// Clean up any expired form state entries from IndexedDB on app load
if (typeof window !== 'undefined') {
  cleanupExpiredStates().catch(() => {
    // Silent fail - cleanup is best-effort
  })

  // Initialize bfcache restoration handler
  // This detects when Safari (and other browsers) restore pages from bfcache
  // and refreshes auth session and project list to ensure state is current
  initBfcacheHandler()

  // Check session for landing page auth state
  checkSession().catch(() => {
    // Silent fail - auth check is best-effort
  })
}

export const Route = createRootRouteWithContext()({
  head: () => {
    const defaultSeo = getDefaultSeoMeta()
    return {
      links: [{ rel: 'stylesheet', href: styleCss }],
      meta: defaultSeo.meta,
    }
  },
  shellComponent: RootComponent,
})

function RootComponent() {
  return (
    <html>
      <head>
        <HydrationScript />
      </head>
      <body>
        <HeadContent />
        <Suspense>
          <AppErrorBoundary>
            <Outlet />
          </AppErrorBoundary>
          <TanStackRouterDevtools />
        </Suspense>
        <Scripts />
      </body>
    </html>
  )
}
