/**
 * Sends a URL that predates workspace slugs to the same page inside the user's
 * default workspace. Project pages then correct the slug to the project's own
 * workspace, so old links, emails and bookmarks keep working.
 */

import { useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';
import { PageLoader } from '@/components/ui/spinner';
import { pickDefaultWorkspace, useWorkspaces } from '@/hooks/useWorkspaces';
import { useRedirectIfCurrent } from '@/hooks/useRedirectIfCurrent';

export function WorkspaceRedirect({
  toPath,
  fallback = null,
}: {
  toPath: (slug: string) => string;
  /** Rendered when the user has no workspace at all, which signup normally prevents. */
  fallback?: React.ReactNode;
}) {
  const redirect = useRedirectIfCurrent();
  const { searchStr } = useLocation();
  const { workspaces, isLoading } = useWorkspaces();
  const target = isLoading ? null : pickDefaultWorkspace(workspaces);
  const destination = target ? `${toPath(target.slug)}${searchStr}` : null;

  useEffect(() => {
    if (destination) redirect(destination);
  }, [destination]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isLoading && !target) return fallback;
  return <PageLoader label='Opening...' />;
}
