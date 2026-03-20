/**
 * Org Quick Actions component
 * Provides quick action buttons for common billing operations
 */

import { PlusIcon } from 'lucide-react';

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
        <button
          onClick={() => onGrantTrial?.()}
          disabled={loading}
          className='inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50'
        >
          <PlusIcon className='size-4' />
          <span>Grant Trial (14 days)</span>
        </button>
        <button
          onClick={() => onGrantSingleProject?.()}
          disabled={loading}
          className='inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50'
        >
          <PlusIcon className='size-4' />
          <span>Grant Single Project (6 months)</span>
        </button>
        <button
          onClick={() => onCreateSubscription?.()}
          disabled={loading}
          className='border-border bg-card text-secondary-foreground hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50'
        >
          <PlusIcon className='size-4' />
          <span>Create Subscription</span>
        </button>
        <button
          onClick={() => onCreateGrant?.()}
          disabled={loading}
          className='border-border bg-card text-secondary-foreground hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50'
        >
          <PlusIcon className='size-4' />
          <span>Create Grant</span>
        </button>
      </div>
    </div>
  );
}
