/**
 * Org Quick Actions component
 * Provides quick action buttons for common billing operations
 */

import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OrgQuickActionsProps {
  onGrantTrial: () => void;
  onGrantSingleProject: () => void;
  onCreateSubscription: () => void;
  onCreateGrant: () => void;
  loading?: boolean;
}

export function OrgQuickActions({
  onGrantTrial,
  onGrantSingleProject,
  onCreateSubscription,
  onCreateGrant,
  loading,
}: OrgQuickActionsProps) {
  return (
    <div className='border-border bg-card rounded-lg border p-6 shadow-sm'>
      <h2 className='text-foreground mb-4 text-lg font-semibold'>Quick Actions</h2>
      <div className='flex flex-wrap gap-3'>
        <Button onClick={() => onGrantTrial?.()} disabled={loading}>
          <PlusIcon data-icon='inline-start' />
          Grant Trial (14 days)
        </Button>
        <Button onClick={() => onGrantSingleProject?.()} disabled={loading}>
          <PlusIcon data-icon='inline-start' />
          Grant Single Project (6 months)
        </Button>
        <Button variant='outline' onClick={() => onCreateSubscription?.()} disabled={loading}>
          <PlusIcon data-icon='inline-start' />
          Create Subscription
        </Button>
        <Button variant='outline' onClick={() => onCreateGrant?.()} disabled={loading}>
          <PlusIcon data-icon='inline-start' />
          Create Grant
        </Button>
      </div>
    </div>
  );
}
