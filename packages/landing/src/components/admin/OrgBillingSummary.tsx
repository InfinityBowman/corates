/**
 * Org Billing Summary component
 * Displays current billing state for an organization including plan, entitlements, and quotas
 */

interface BillingPlan {
  name?: string;
  entitlements?: Record<string, boolean | string | number>;
  quotas?: Record<string, number | null | undefined>;
}

interface BillingSubscription {
  plan?: string;
}

interface BillingGrant {
  type?: string;
}

interface BillingState {
  plan?: BillingPlan;
  effectivePlanId?: string;
  accessMode?: 'full' | 'readOnly';
  source?: 'free' | 'subscription' | 'grant';
  subscription?: BillingSubscription | null;
  grant?: BillingGrant | null;
}

interface OrgBillingSummaryProps {
  billing: BillingState | null | undefined;
}

export function OrgBillingSummary({ billing }: OrgBillingSummaryProps) {
  if (!billing) return null;

  const currentPlan = billing.plan?.name || 'Free';
  const effectivePlanId = billing.effectivePlanId || 'free';
  const accessMode = billing.accessMode || 'readOnly';
  const billingSource = billing.source || 'free';
  const entitlements = billing.plan?.entitlements || {};
  const quotas = billing.plan?.quotas || {};
  const effectiveSubscription = billing.subscription;
  const effectiveGrant = billing.grant;

  const getSourceReason = (): string => {
    if (billingSource === 'subscription' && effectiveSubscription) {
      return `Active subscription (${effectiveSubscription.plan})`;
    }
    if (billingSource === 'grant' && effectiveGrant) {
      return `Active grant (${effectiveGrant.type})`;
    }
    if (billingSource === 'free') {
      return 'No active subscription or grant';
    }
    return `Source: ${billingSource}`;
  };

  const entitlementEntries = Object.entries(entitlements);
  const quotaEntries = Object.entries(quotas);

  return (
    <div className='border-border bg-card rounded-lg border p-6 shadow-sm'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='text-foreground text-lg font-semibold'>Billing Summary</h2>
      </div>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <div>
          <p className='text-muted-foreground text-sm'>Effective Plan</p>
          <p className='text-foreground mt-1 text-lg font-medium'>{currentPlan}</p>
          <p className='text-muted-foreground/70 mt-1 font-mono text-xs'>{effectivePlanId}</p>
        </div>
        <div>
          <p className='text-muted-foreground text-sm'>Access Mode</p>
          <p className='text-foreground mt-1 text-lg font-medium'>
            {accessMode === 'full' ?
              <span className='inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'>
                Full Access
              </span>
            : <span className='inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800'>
                Read Only
              </span>
            }
          </p>
        </div>
        <div>
          <p className='text-muted-foreground text-sm'>Source</p>
          <p className='text-foreground mt-1 text-lg font-medium capitalize'>{billingSource}</p>
        </div>
      </div>

      {/* Reason */}
      <div className='bg-muted mt-4 rounded-lg p-3'>
        <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
          Effective Because
        </p>
        <p className='text-secondary-foreground mt-1 text-sm'>{getSourceReason()}</p>
      </div>

      {/* Entitlements and Quotas */}
      <div className='mt-6 grid grid-cols-1 gap-6 md:grid-cols-2'>
        <div>
          <h3 className='text-foreground mb-3 text-sm font-semibold'>Entitlements</h3>
          <dl className='flex flex-col gap-2'>
            {entitlementEntries.length > 0 ?
              entitlementEntries.map(([key, value]) => (
                <div key={key} className='border-border-subtle flex justify-between border-b pb-2'>
                  <dt className='text-muted-foreground text-sm capitalize'>
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </dt>
                  <dd className='text-foreground text-sm font-medium'>
                    {typeof value === 'boolean' ?
                      value ?
                        'Yes'
                      : 'No'
                    : String(value)}
                  </dd>
                </div>
              ))
            : <p className='text-muted-foreground text-sm'>No entitlements</p>}
          </dl>
        </div>
        <div>
          <h3 className='text-foreground mb-3 text-sm font-semibold'>Quotas</h3>
          <dl className='flex flex-col gap-2'>
            {quotaEntries.length > 0 ?
              quotaEntries.map(([key, value]) => (
                <div key={key} className='border-border-subtle flex justify-between border-b pb-2'>
                  <dt className='text-muted-foreground text-sm capitalize'>
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </dt>
                  <dd className='text-foreground text-sm font-medium'>
                    {value === null || value === undefined ? 'Unlimited' : String(value)}
                  </dd>
                </div>
              ))
            : <p className='text-muted-foreground text-sm'>No quotas</p>}
          </dl>
        </div>
      </div>
    </div>
  );
}
