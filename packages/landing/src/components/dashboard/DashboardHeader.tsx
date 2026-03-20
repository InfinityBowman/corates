/**
 * DashboardHeader - Welcome section with user info and new project button
 */

import { PlusIcon } from 'lucide-react';
import { getRoleLabel } from '@/components/auth/RoleSelector';
import { useAnimation } from './useInitialAnimation';

interface DashboardHeaderProps {
  user: { name?: string; givenName?: string; persona?: string; email?: string } | null;
  canCreateProject: boolean;
  isOnline: boolean;
  onCreateProject: () => void;
}

export function DashboardHeader({
  user,
  canCreateProject,
  isOnline,
  onCreateProject,
}: DashboardHeaderProps) {
  const animation = useAnimation();

  const firstName = user?.givenName || user?.name || '';

  return (
    <header className='mb-10' style={animation.fadeUp(0)}>
      <div className='flex items-start justify-between'>
        <div>
          {firstName ?
            <>
              <p className='text-primary mb-1 text-sm font-medium'>Welcome back,</p>
              <h1 className='text-foreground text-3xl font-semibold tracking-tight sm:text-4xl'>
                {firstName}
              </h1>
            </>
          : <p className='text-primary mb-1 text-sm font-medium'>Welcome to CoRATES!</p>}
          {(user?.persona || user?.email) && (
            <p className='text-muted-foreground mt-2'>
              {user.persona ? getRoleLabel(user.persona) : user.email}
            </p>
          )}
        </div>
        <div className='flex items-center gap-3'>
          {canCreateProject && (
            <button
              onClick={onCreateProject}
              disabled={!isOnline}
              title={!isOnline ? 'Cannot create projects while offline' : ''}
              className='bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50'
            >
              <PlusIcon className='size-4' />
              New Project
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
