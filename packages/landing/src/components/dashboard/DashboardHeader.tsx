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

export function DashboardHeader({ user, canCreateProject, isOnline, onCreateProject }: DashboardHeaderProps) {
  const animation = useAnimation();

  const firstName = user?.givenName || user?.name || '';

  return (
    <header className="mb-10" style={animation.fadeUp(0)}>
      <div className="flex items-start justify-between">
        <div>
          {firstName ? (
            <>
              <p className="mb-1 text-sm font-medium text-primary">Welcome back,</p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {firstName}
              </h1>
            </>
          ) : (
            <p className="mb-1 text-sm font-medium text-primary">Welcome to CoRATES!</p>
          )}
          {(user?.persona || user?.email) && (
            <p className="mt-2 text-muted-foreground">
              {user.persona ? getRoleLabel(user.persona) : user.email}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {canCreateProject && (
            <button
              onClick={onCreateProject}
              disabled={!isOnline}
              title={!isOnline ? 'Cannot create projects while offline' : ''}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusIcon className="h-4 w-4" />
              New Project
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
