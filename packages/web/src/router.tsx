import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { initSentryRouterTracing } from '@/config/sentry';
import { SCROLL_TO_TOP_SELECTORS } from '@/config/scroll';

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    scrollToTopSelectors: SCROLL_TO_TOP_SELECTORS,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 30_000,
  });
  initSentryRouterTracing(router as never);
  return router;
};

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
