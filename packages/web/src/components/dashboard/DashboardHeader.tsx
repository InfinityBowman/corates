/**
 * DashboardHeader - Welcome section with user info
 */

import { getRoleLabel } from '@/components/auth/RoleSelector';
import { useAnimation } from './useInitialAnimation';

interface DashboardHeaderProps {
  user: { name?: string; givenName?: string; persona?: string; email?: string } | null;
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
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
      </div>
    </header>
  );
}
