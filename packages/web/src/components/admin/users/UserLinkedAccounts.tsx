import { MailIcon } from 'lucide-react';
import { AdminEmpty, AdminPanel } from '@/components/admin/ui';
import { formatDate } from '@/lib/formatDate';
import type { AdminUserAccount } from '@/server/functions/admin-users.server';

const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google',
  orcid: 'ORCID',
  credential: 'Email/Password',
};

const PROVIDER_LOGO: Record<string, string> = {
  google: '/logos/google.svg',
  orcid: '/logos/orcid.svg',
};

export function UserLinkedAccounts({ accounts }: { accounts?: AdminUserAccount[] }) {
  const rows = accounts ?? [];

  return (
    <AdminPanel title='Linked Accounts' bodyClassName='divide-border divide-y'>
      {rows.length === 0 ?
        <AdminEmpty title='No linked accounts' />
      : rows.map((account, idx) => {
          const logo = PROVIDER_LOGO[account.providerId];
          return (
            <div key={idx} className='flex items-center gap-3 px-4 py-3'>
              <span className='bg-muted inline-flex size-7 shrink-0 items-center justify-center rounded-full'>
                {logo ?
                  <img
                    src={logo}
                    alt={PROVIDER_LABEL[account.providerId] ?? account.providerId}
                    className='size-4'
                  />
                : <MailIcon className='text-muted-foreground size-4' />}
              </span>
              <div className='min-w-0'>
                <p className='text-foreground text-[13px] font-medium'>
                  {PROVIDER_LABEL[account.providerId] ?? account.providerId}
                </p>
                <p className='text-muted-foreground text-xs'>
                  Connected {formatDate(account.createdAt)}
                </p>
              </div>
            </div>
          );
        })
      }
    </AdminPanel>
  );
}
