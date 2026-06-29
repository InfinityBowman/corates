import { MailIcon } from 'lucide-react';
import { AdminBox } from '@/components/admin/ui';
import { formatDate } from '@/lib/formatDate';
import type { UserAccount } from './types';

export function UserLinkedAccounts({ accounts }: { accounts?: UserAccount[] }) {
  return (
    <AdminBox className='mb-6'>
      <h2 className='text-foreground mb-4 text-lg font-semibold'>Linked Accounts</h2>
      {(accounts?.length ?? 0) > 0 ?
        <div className='flex flex-col gap-2'>
          {accounts!.map((account, idx) => (
            <div
              key={idx}
              className='border-border bg-muted flex items-center justify-between rounded-lg border p-3'
            >
              <div className='flex items-center gap-3'>
                <span className='bg-card inline-flex size-8 items-center justify-center rounded-full'>
                  {account.providerId === 'google' && (
                    <img src='/logos/google.svg' alt='Google' className='size-5' />
                  )}
                  {account.providerId === 'orcid' && (
                    <img src='/logos/orcid.svg' alt='ORCID' className='size-5' />
                  )}
                  {account.providerId === 'credential' && (
                    <MailIcon className='text-muted-foreground size-5' />
                  )}
                </span>
                <div>
                  <p className='text-foreground text-sm font-medium capitalize'>
                    {account.providerId === 'credential' ? 'Email/Password' : account.providerId}
                  </p>
                  <p className='text-muted-foreground text-xs'>
                    Connected {formatDate(account.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      : <p className='text-muted-foreground text-sm'>No linked accounts</p>}
    </AdminBox>
  );
}
