/**
 * Project URLs from before workspace slugs (/projects/<id>/...), still in
 * sent emails, notifications and bookmarks.
 */

import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceRedirect } from '@/components/workspace/WorkspaceRedirect';

export const Route = createFileRoute('/_app/_protected/projects/$')({
  component: LegacyProjectRedirect,
});

function LegacyProjectRedirect() {
  const { _splat } = Route.useParams();
  return <WorkspaceRedirect toPath={slug => `/${slug}/projects/${_splat}`} />;
}
