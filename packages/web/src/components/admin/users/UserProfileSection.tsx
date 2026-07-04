import { ExternalLinkIcon } from 'lucide-react';
import { AdminBox } from '@/components/admin/ui';
import { CopyButton } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/formatDate';
import type { UserData } from './types';

const getStripeCustomerUrl = (customerId: string | undefined): string | null => {
  if (!customerId) return null;
  return `https://dashboard.stripe.com/customers/${customerId}`;
};

export function UserProfileSection({ user }: { user: UserData['user'] }) {
  return (
    <AdminBox className='mb-6'>
      <h2 className='text-foreground mb-4 text-lg font-semibold'>Profile Information</h2>
      <dl className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <div>
          <dt className='text-muted-foreground text-sm font-medium'>User ID</dt>
          <dd className='text-foreground mt-1 flex items-center text-sm'>
            <span className='font-mono'>{user.id}</span>
            <CopyButton
              text={user.id}
              label='User ID'
              className='text-muted-foreground/70 hover:text-muted-foreground ml-2'
              iconSize='size-4'
            />
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-sm font-medium'>Username</dt>
          <dd className='text-foreground mt-1 text-sm'>{user.username || '-'}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-sm font-medium'>Persona</dt>
          <dd className='text-foreground mt-1 text-sm'>{user.persona || '-'}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-sm font-medium'>Created</dt>
          <dd className='text-foreground mt-1 text-sm'>{formatDateTime(user.createdAt)}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-sm font-medium'>Updated</dt>
          <dd className='text-foreground mt-1 text-sm'>{formatDateTime(user.updatedAt)}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-sm font-medium'>Stripe Customer</dt>
          <dd className='text-foreground mt-1 text-sm'>
            {user.stripeCustomerId ?
              <a
                href={getStripeCustomerUrl(user.stripeCustomerId) ?? '#'}
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary hover:text-primary/80 inline-flex items-center'
              >
                <span className='font-mono'>{user.stripeCustomerId}</span>
                <ExternalLinkIcon className='ml-1 size-3' />
              </a>
            : '-'}
          </dd>
        </div>
        {user.banned && (
          <>
            <div>
              <dt className='text-muted-foreground text-sm font-medium'>Ban Reason</dt>
              <dd className='text-destructive mt-1 text-sm'>{user.banReason || '-'}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground text-sm font-medium'>Ban Expires</dt>
              <dd className='text-foreground mt-1 text-sm'>
                {user.banExpires ? formatDateTime(user.banExpires) : 'Never'}
              </dd>
            </div>
          </>
        )}
      </dl>
    </AdminBox>
  );
}
