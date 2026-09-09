import { AdminPanel, AdminField, AdminFieldGrid } from '@/components/admin/ui';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface BillingPlan {
  name?: string;
  entitlements?: Record<string, boolean | string | number>;
  quotas?: Record<string, number | null | undefined>;
}

interface BillingState {
  plan?: BillingPlan;
  effectivePlanId?: string;
  accessMode?: 'full' | 'readOnly';
  source?: 'free' | 'subscription' | 'grant';
  subscription?: { plan?: string } | null;
  grant?: { type?: string } | null;
}

interface OrgBillingSummaryProps {
  billing: BillingState | null | undefined;
  isLoading?: boolean;
}

const humanize = (key: string) => key.replace(/([A-Z])/g, ' $1').trim();

export function OrgBillingSummary({ billing, isLoading }: OrgBillingSummaryProps) {
  if (isLoading || !billing) {
    return (
      <AdminPanel title='Billing Summary' padded>
        <Skeleton className='h-32 w-full' />
      </AdminPanel>
    );
  }

  const accessMode = billing.accessMode || 'readOnly';
  const billingSource = billing.source || 'free';
  const entitlementEntries = Object.entries(billing.plan?.entitlements || {});
  const quotaEntries = Object.entries(billing.plan?.quotas || {});

  const sourceReason =
    billingSource === 'subscription' && billing.subscription ?
      `Active subscription (${billing.subscription.plan})`
    : billingSource === 'grant' && billing.grant ? `Active grant (${billing.grant.type})`
    : 'No active subscription or grant';

  return (
    <AdminPanel title='Billing Summary' padded>
      <AdminFieldGrid>
        <AdminField label='Effective plan'>
          <span className='font-medium'>{billing.plan?.name || 'Free'}</span>
          <code className='text-muted-foreground font-mono text-xs'>
            {billing.effectivePlanId || 'free'}
          </code>
        </AdminField>
        <AdminField label='Access mode'>
          {accessMode === 'full' ?
            <Badge variant='success'>Full access</Badge>
          : <Badge variant='warning'>Read only</Badge>}
        </AdminField>
        <AdminField label='Source'>
          <span className='capitalize'>{billingSource}</span>
          <span className='text-muted-foreground'>- {sourceReason}</span>
        </AdminField>
      </AdminFieldGrid>

      <div className='mt-6 grid grid-cols-1 gap-6 md:grid-cols-2'>
        <div>
          <h3 className='text-foreground mb-2 text-[13px] font-medium'>Entitlements</h3>
          <dl className='divide-border divide-y'>
            {entitlementEntries.length === 0 ?
              <p className='text-muted-foreground text-[13px]'>No entitlements</p>
            : entitlementEntries.map(([key, value]) => (
                <div key={key} className='flex justify-between py-1.5 text-[13px]'>
                  <dt className='text-muted-foreground capitalize'>{humanize(key)}</dt>
                  <dd className='text-foreground font-medium'>
                    {typeof value === 'boolean' ?
                      value ?
                        'Yes'
                      : 'No'
                    : String(value)}
                  </dd>
                </div>
              ))
            }
          </dl>
        </div>
        <div>
          <h3 className='text-foreground mb-2 text-[13px] font-medium'>Quotas</h3>
          <dl className='divide-border divide-y'>
            {quotaEntries.length === 0 ?
              <p className='text-muted-foreground text-[13px]'>No quotas</p>
            : quotaEntries.map(([key, value]) => (
                <div key={key} className='flex justify-between py-1.5 text-[13px]'>
                  <dt className='text-muted-foreground capitalize'>{humanize(key)}</dt>
                  <dd className='text-foreground font-medium tabular-nums'>
                    {value === null || value === undefined ? 'Unlimited' : String(value)}
                  </dd>
                </div>
              ))
            }
          </dl>
        </div>
      </div>
    </AdminPanel>
  );
}
