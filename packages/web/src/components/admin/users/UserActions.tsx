import { LogInIcon, UserCheckIcon, UserXIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UserData } from './types';

interface UserActionsProps {
  user: UserData['user'];
  loading: boolean;
  onImpersonate: () => void;
  onUnban: () => void;
  onBan: () => void;
  onDelete: () => void;
}

export function UserActions({
  user,
  loading,
  onImpersonate,
  onUnban,
  onBan,
  onDelete,
}: UserActionsProps) {
  return (
    <div className='flex gap-2'>
      <Button variant='outline' onClick={onImpersonate} disabled={loading}>
        <LogInIcon data-icon='inline-start' />
        Impersonate
      </Button>
      {user.banned ?
        <Button variant='success' onClick={onUnban} disabled={loading}>
          <UserCheckIcon data-icon='inline-start' />
          Unban
        </Button>
      : <Button
          variant='outline'
          className='text-destructive hover:text-destructive'
          onClick={onBan}
          disabled={loading}
        >
          <UserXIcon data-icon='inline-start' />
          Ban
        </Button>
      }
      <Button variant='destructive' onClick={onDelete} disabled={loading}>
        <Trash2Icon data-icon='inline-start' />
        Delete
      </Button>
    </div>
  );
}
