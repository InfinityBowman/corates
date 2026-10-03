/**
 * Settings URLs from before the account/workspace split. Stripe checkouts
 * started before the change return to /settings/billing.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';
import { WorkspaceRedirect } from '@/components/workspace/WorkspaceRedirect';

const WORKSPACE_PAGES = new Set(['billing', 'plans']);

export const Route = createFileRoute('/_app/_protected/settings/$')({
  beforeLoad: ({ params }) => {
    const page = (params._splat ?? '').split('/')[0];
    if (WORKSPACE_PAGES.has(page)) return;
    // Workspace pages need the user's workspace list, so only they render.
    const accountPage =
      ['security', 'preferences', 'integrations'].includes(page) ? page : 'profile';
    throw redirect({
      to: `/settings/account/${accountPage}` as string,
      search: true,
      replace: true,
    });
  },
  component: LegacyWorkspaceSettingsRedirect,
});

function LegacyWorkspaceSettingsRedirect() {
  const { _splat = '' } = Route.useParams();
  const page = _splat.split('/')[0];
  return <WorkspaceRedirect toPath={slug => `/${slug}/settings/${page}`} />;
}
