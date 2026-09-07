/**
 * AccountMenu - top-left sidebar trigger: logo plus the user's name, opening
 * the account and app-level actions. Becomes the workspace switcher once
 * workspaces exist. Signed out it is a plain link to Home.
 */

import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronDownIcon } from 'lucide-react';
import { useAuthStore, selectUser, selectIsAuthLoading } from '@/stores/authStore';
import { useFeedbackStore } from '@/stores/feedbackStore';
import { useAdminStore } from '@/stores/adminStore';
import { APP_NAME } from '@/config/app';
import { PlanBadge } from '@/components/billing/PlanBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
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

  // Anti-flash: AppLayout caches the name so it shows while the session loads
  const [storedName] = useState(() => localStorage.getItem('userName'));
  const showUser = user || (isAuthLoading && !!storedName);
  const displayName = user?.name || storedName || 'Loading...';

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
        <DropdownMenuItem asChild>
          <Link to={'/settings/profile' as string}>Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to='/settings'>Settings</Link>
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
