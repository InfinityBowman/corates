/**
 * useRedirectIfCurrent - a replace-navigation that yields to any navigation
 * already under way. A page that redirects itself once data loads (the
 * /dashboard hop, a slug correction) must not override a newer navigation the
 * user or another handler started meanwhile: the router keeps the old page
 * mounted while the new route loads, so its effect would otherwise win.
 */

import { useLocation, useRouter } from '@tanstack/react-router';

export function useRedirectIfCurrent() {
  const router = useRouter();
  const { pathname } = useLocation();
  return (to: string) => {
    if (router.latestLocation.pathname !== pathname) return;
    router.navigate({ to, replace: true });
  };
}
