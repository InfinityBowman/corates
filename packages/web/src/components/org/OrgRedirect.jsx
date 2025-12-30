/**
 * OrgRedirect - Redirects to the appropriate org context
 *
 * On /dashboard (or /):
 * - If logged in with orgs → navigate to last/first org
 * - If logged in with no orgs → navigate to /orgs/new
 * - If not logged in → show sign-in prompt
 */

import { createEffect, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useOrgContext, getLastOrgSlug } from '@primitives/useOrgContext.js';

export default function OrgRedirect() {
  const navigate = useNavigate();
  const { isLoggedIn, authLoading } = useBetterAuth();
  const { orgs, isLoading, hasNoOrgs } = useOrgContext();

  createEffect(() => {
    // Wait for auth and orgs to load
    if (authLoading() || isLoading()) return;

    // Not logged in - let the layout/guard handle this
    if (!isLoggedIn()) return;

    // User has no orgs - redirect to create org page
    if (hasNoOrgs()) {
      navigate('/orgs/new', { replace: true });
      return;
    }

    // User has orgs - redirect to last used or first org
    const orgsList = orgs();
    if (orgsList && orgsList.length > 0) {
      const lastSlug = getLastOrgSlug();
      const targetOrg =
        lastSlug ? orgsList.find(o => o.slug === lastSlug) || orgsList[0] : orgsList[0];

      navigate(`/orgs/${targetOrg.slug}`, { replace: true });
    }
  });

  return (
    <div class='flex min-h-[60vh] items-center justify-center'>
      <Show
        when={!authLoading() && !isLoading()}
        fallback={
          <div class='text-center'>
            <div class='mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent' />
            <p class='text-gray-500'>Loading...</p>
          </div>
        }
      >
        <Show when={!isLoggedIn()}>
          <div class='text-center'>
            <h2 class='mb-2 text-xl font-semibold text-gray-900'>Welcome to CoRATES</h2>
            <p class='mb-4 text-gray-600'>Sign in to access your workspaces</p>
            <a
              href='/signin'
              class='inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700'
            >
              Sign In
            </a>
          </div>
        </Show>
      </Show>
    </div>
  );
}
