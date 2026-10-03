/**
 * AccountMenu - top-left sidebar trigger and workspace switcher, as in Linear:
 * the current workspace's name, opening the user's workspaces, workspace and
 * account settings, and sign out. Signed out it is a plain link to Home.
 */

import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { CheckIcon, ChevronDownIcon, PlusIcon } from 'lucide-react';
import { useAuthStore, selectUser, selectIsAuthLoading } from '@/stores/authStore';
import { useFeedbackStore } from '@/stores/feedbackStore';
import { useAdminStore } from '@/stores/adminStore';
import { APP_NAME } from '@/config/app';
import { PlanBadge } from '@/components/billing/PlanBadge';
import { useCurrentWorkspace, useWorkspaces } from '@/hooks/useWorkspaces';
import { workspaceHomePath, workspaceSettingsPath } from '@/lib/workspacePaths';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const TRIGGER_CLASS =
  'text-foreground hover:bg-muted flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-sm font-semibold transition-colors';

function Logo() {
  return (
    <img src='/logo.svg' alt='' aria-hidden='true' className='size-[18px] shrink-0 rounded-sm' />
  );
}

export function AccountMenu() {
  const user = useAuthStore(selectUser);
  const isAuthLoading = useAuthStore(selectIsAuthLoading);
  const signout = useAuthStore(s => s.signout);
  const openFeedback = useFeedbackStore(s => s.open);
  const isAdmin = useAdminStore(s => s.isAdmin);
  const navigate = useNavigate();
  const { workspaces } = useWorkspaces();
  const { workspace: current } = useCurrentWorkspace();

  // Anti-flash: AppLayout caches the name so it shows while the session loads
  const [storedName] = useState(() => localStorage.getItem('userName'));
  const showUser = user || (isAuthLoading && !!storedName);
  const displayName = current?.name || user?.name || storedName || 'Loading...';

  async function handleSignOut() {
    try {
      await signout();
      navigate({ to: '/dashboard', replace: true });
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Sign out failed' });
    }
  }

  if (!showUser) {
    return (
      <Link to='/dashboard' className={TRIGGER_CLASS}>
        <Logo />
        <span className='truncate'>{APP_NAME}</span>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          className={`${TRIGGER_CLASS} aria-expanded:bg-muted`}
          data-testid='account-menu'
        >
          <Logo />
          <span className='truncate'>{displayName}</span>
          <ChevronDownIcon className='text-muted-foreground size-3.5 shrink-0' aria-hidden='true' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-56'>
        <DropdownMenuLabel>
          <div className='font-medium'>{user?.name || 'User'}</div>
          <div className='text-muted-foreground truncate text-xs'>{user?.email}</div>
          <PlanBadge />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className='text-muted-foreground text-xs font-normal'>
            Workspaces
          </DropdownMenuLabel>
          {workspaces.map(workspace => (
            <DropdownMenuItem key={workspace.id} asChild>
              <Link to={workspaceHomePath(workspace.slug) as string}>
                <span className='min-w-0 flex-1 truncate'>{workspace.name}</span>
                {workspace.id === current?.id && (
                  <CheckIcon className='text-muted-foreground size-4' aria-label='Current' />
                )}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem asChild>
            <Link to='/create-workspace'>
              <PlusIcon className='text-muted-foreground size-4' />
              Create workspace
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {current?.role === 'owner' && (
          <>
            <DropdownMenuItem asChild>
              <Link to={workspaceSettingsPath(current.slug, 'general') as string}>
                Workspace settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={workspaceSettingsPath(current.slug, 'members') as string}>Members</Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem asChild>
          <Link to='/settings/account/profile'>Account settings</Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link to={'/admin' as string}>Admin</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={openFeedback}>Give feedback</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className='text-destructive' onClick={handleSignOut}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
