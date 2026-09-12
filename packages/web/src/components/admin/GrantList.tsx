import { Trash2Icon } from 'lucide-react';
import { AdminEmpty, AdminPanel } from '@/components/admin/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/formatDate';
import type { AdminOrgGrant } from '@/server/functions/admin-orgs.server';

interface GrantListProps {
  grants: AdminOrgGrant[];
  loading: boolean;
  isLoading: boolean;
  onRevoke: (_grantId: string) => void;
}

export function GrantList({ grants: grantsProp, loading, isLoading, onRevoke }: GrantListProps) {
  const grants = grantsProp || [];

  return (
    <AdminPanel title='Grants' bodyClassName='divide-border divide-y'>
      {isLoading ?
        <div className='p-4'>
          <Skeleton className='h-20 w-full' />
        </div>
      : grants.length === 0 ?
        <AdminEmpty title='No grants' />
      : grants.map(grant => (
          <div key={grant.id} className='flex items-start justify-between gap-4 px-4 py-3'>
            <div className='min-w-0'>
              <div className='flex items-center gap-2'>
                <p className='text-foreground text-[13px] font-medium capitalize'>{grant.type}</p>
                {grant.revokedAt ?
                  <Badge variant='destructive'>Revoked</Badge>
                : <Badge variant='success'>Active</Badge>}
              </div>
              <p className='text-muted-foreground mt-1 text-xs'>
                {formatDateTime(grant.startsAt)} - {formatDateTime(grant.expiresAt)}
                {grant.revokedAt && ` - revoked ${formatDateTime(grant.revokedAt)}`}
              </p>
            </div>
            {!grant.revokedAt && (
              <Button
                variant='ghost'
                size='icon-sm'
                onClick={() => onRevoke(grant.id)}
                disabled={loading}
                className='text-muted-foreground/70 hover:text-destructive shrink-0'
                aria-label='Revoke grant'
              >
                <Trash2Icon />
              </Button>
            )}
          </div>
        ))
      }
    </AdminPanel>
  );
}
