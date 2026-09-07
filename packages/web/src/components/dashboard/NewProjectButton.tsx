/**
 * NewProjectButton - opens the create modal, or explains why the user cannot
 * create another project when their plan blocks it.
 */

import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSubscription } from '@/hooks/useSubscription';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getRestrictionCopy } from './ContactPrompt';

interface NewProjectButtonProps {
  onClick: () => void;
  variant?: 'default' | 'outline';
}

export function useProjectCreateRestriction() {
  const { hasEntitlement, hasQuota, quotas, subscription, isLoading } = useSubscription();
  // Server-computed count the project cap is enforced against: on Free that is the
  // projects the user created, not projects shared with them from other workspaces.
  const projectCount = subscription.projectCount;

  // Local-first: assume the user can create until we know they cannot
  const restrictionType: 'entitlement' | 'quota' | null =
    isLoading ? null
    : !hasEntitlement('project.create') ? 'entitlement'
    : !hasQuota('projects.max', { used: projectCount, requested: 1 }) ? 'quota'
    : null;

  return { restrictionType, projectCount, quotaLimit: quotas?.['projects.max'] };
}

export function NewProjectButton({ onClick, variant = 'default' }: NewProjectButtonProps) {
  const isOnline = useOnlineStatus();
  const { restrictionType, projectCount, quotaLimit } = useProjectCreateRestriction();

  const button = (
    <Button
      variant={variant}
      size='sm'
      onClick={restrictionType ? undefined : onClick}
      disabled={!isOnline}
    >
      <PlusIcon data-icon='inline-start' />
      New project
    </Button>
  );

  if (!restrictionType) return button;

  const { title, message } = getRestrictionCopy({ restrictionType, projectCount, quotaLimit });
  return (
    <Popover>
      <PopoverTrigger asChild>{button}</PopoverTrigger>
      <PopoverContent align='end'>
        <div className='flex flex-col gap-3'>
          <div>
            <p className='text-popover-foreground font-medium'>{title}</p>
            <p className='text-muted-foreground mt-1 text-sm'>{message}</p>
          </div>
          <Button size='sm' asChild>
            <a href='/pricing'>View plans</a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
