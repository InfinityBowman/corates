/**
 * DashboardHeader - the Home page bar: title plus the two create actions
 */

import { useAuthStore, selectIsLoggedIn } from '@/stores/authStore';
import { NewAppraisalMenu } from './NewAppraisalMenu';
import { NewProjectButton } from './NewProjectButton';

interface DashboardHeaderProps {
  onNewProject: () => void;
}

export function DashboardHeader({ onNewProject }: DashboardHeaderProps) {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);

  return (
    <header className='border-border bg-card sticky top-0 z-20 border-b'>
      <div className='mx-auto flex h-11 max-w-7xl items-center justify-between px-6'>
        <h1 className='text-sm font-semibold'>Home</h1>
        <div className='flex items-center gap-2'>
          <NewAppraisalMenu />
          {isLoggedIn && <NewProjectButton onClick={onNewProject} />}
        </div>
      </div>
    </header>
  );
}
