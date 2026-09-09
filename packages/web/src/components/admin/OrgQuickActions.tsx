import { PlusIcon } from 'lucide-react';
import { AdminPanel } from '@/components/admin/ui';
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
    <AdminPanel title='Quick Actions' padded>
      <div className='flex flex-wrap gap-2'>
        <Button size='sm' onClick={onGrantTrial} disabled={loading}>
          <PlusIcon data-icon='inline-start' />
          Grant trial (14 days)
        </Button>
        <Button size='sm' onClick={onGrantSingleProject} disabled={loading}>
          <PlusIcon data-icon='inline-start' />
          Grant single project (6 months)
        </Button>
        <Button size='sm' variant='outline' onClick={onCreateSubscription} disabled={loading}>
          <PlusIcon data-icon='inline-start' />
          Create subscription
        </Button>
        <Button size='sm' variant='outline' onClick={onCreateGrant} disabled={loading}>
          <PlusIcon data-icon='inline-start' />
          Create grant
        </Button>
      </div>
    </AdminPanel>
  );
}
