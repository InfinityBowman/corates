import { createRouter } from '@tanstack/solid-router'

import { setupRouterSsrQueryIntegration } from '@tanstack/solid-router-ssr-query'
import { getContext } from './integrations/tanstack-query/provider'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Create a new router instance
export const getRouter = () => {
  const rqContext = getContext()

  const router = createRouter({
    routeTree,
    context: { ...rqContext },
    defaultPreload: 'intent',
  })

  setupRouterSsrQueryIntegration({ router, queryClient: rqContext.queryClient })

  return router
}
