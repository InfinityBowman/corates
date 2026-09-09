import { ExternalLinkIcon } from 'lucide-react';
import { AdminPanel, AdminField, AdminFieldGrid, CopyButton } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/formatDate';
import type { UserData } from './types';

export function UserProfileSection({ user }: { user: UserData['user'] }) {
  return (
    <AdminPanel title='Profile Information' padded>
      <AdminFieldGrid>
        <AdminField label='User ID' mono>
          <span className='truncate'>{user.id}</span>
          <CopyButton text={user.id} label='User ID' />
        </AdminField>
        <AdminField label='Username'>{user.username || '-'}</AdminField>
        <AdminField label='Persona'>{user.persona || '-'}</AdminField>
        <AdminField label='Created'>{formatDateTime(user.createdAt)}</AdminField>
        <AdminField label='Updated'>{formatDateTime(user.updatedAt)}</AdminField>
        <AdminField label='Stripe customer'>
          {user.stripeCustomerId ?
            <a
              href={`https://dashboard.stripe.com/customers/${user.stripeCustomerId}`}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:text-primary/80 inline-flex items-center gap-1 font-mono'
            >
              <span className='truncate'>{user.stripeCustomerId}</span>
              <ExternalLinkIcon className='size-3 shrink-0' />
            </a>
          : '-'}
        </AdminField>
        {user.banned && (
          <>
            <AdminField label='Ban reason'>
              <span className='text-destructive'>{user.banReason || '-'}</span>
            </AdminField>
            <AdminField label='Ban expires'>
              {user.banExpires ? formatDateTime(user.banExpires) : 'Never'}
            </AdminField>
          </>
        )}
      </AdminFieldGrid>
    </AdminPanel>
  );
}
