/**
 * Shown for a workspace URL the user cannot open: an unknown slug, or one they
 * are not a member of. Project links are rescued instead, since a project id
 * alone identifies its workspace (the old slug may simply have been renamed).
 */

import { useEffect } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { CompassIcon } from 'lucide-react';
import { PageLoader } from '@/components/ui/spinner';
import { pickDefaultWorkspace, useWorkspaces } from '@/hooks/useWorkspaces';
import { useRedirectIfCurrent } from '@/hooks/useRedirectIfCurrent';
import { workspaceHomePath } from '@/lib/workspacePaths';

const PROJECT_PATH = /^\/[^/]+(\/projects\/.+)$/;

export function WorkspaceNotFound() {
  const { pathname, searchStr } = useLocation();
  const redirect = useRedirectIfCurrent();
  const { workspaces } = useWorkspaces();
  const fallback = pickDefaultWorkspace(workspaces);
  const projectRest = pathname.match(PROJECT_PATH)?.[1];

  useEffect(() => {
    if (projectRest && fallback) redirect(`/${fallback.slug}${projectRest}${searchStr}`);
  }, [projectRest, fallback, searchStr]); // eslint-disable-line react-hooks/exhaustive-deps

  if (projectRest && fallback) return <PageLoader label='Opening project...' />;

  return (
    <div className='flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center'>
      <div className='bg-secondary flex size-12 items-center justify-center rounded-full'>
        <CompassIcon className='text-muted-foreground size-6' />
      </div>
      <h1 className='text-foreground text-lg font-semibold'>Workspace not found</h1>
      <p className='text-muted-foreground max-w-sm text-sm'>
        This workspace does not exist, its URL has changed, or you are not a member of it.
      </p>
      {fallback && (
        <Link
          to={workspaceHomePath(fallback.slug) as string}
          className='text-primary text-sm font-medium underline-offset-4 hover:underline'
        >
          Go to {fallback.name}
        </Link>
      )}
    </div>
  );
}
