import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  lookupAdminStripeCustomerAction,
  createAdminStripePortalLinkAction,
  getAdminStripeCustomerInvoicesAction,
  getAdminStripeCustomerPaymentMethodsAction,
  getAdminStripeCustomerSubscriptionsAction,
} from '@/server/functions/admin-stripe.functions';
import {
  SearchIcon,
  ExternalLinkIcon,
  UserIcon,
  HomeIcon,
  CreditCardIcon,
  FileTextIcon,
  DollarSignIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { showToast } from '@/components/ui/toast';
import { DashboardHeader, AdminBox, CopyButton } from '@/components/admin/ui';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDateTime } from '@/lib/formatDate';

interface StripeCustomer {
  id: string;
  email?: string;
  name?: string;
  created?: number;
  balance?: number;
  currency?: string;
  delinquent?: boolean;
  livemode?: boolean;
}

interface CustomerData {
  found: boolean;
  message?: string;
  customer: StripeCustomer;
  stripeDashboardUrl?: string;
  linkedUser?: { id: string; name?: string; email?: string };
  linkedOrg?: { id: string; name?: string };
}

interface StripeSubscription {
  id: string;
  status: string;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: number;
  currency?: string;
  items?: Array<{ unitAmount?: number; interval?: string }>;
}

interface StripeInvoice {
  id: string;
  number?: string;
  status: string;
  total?: number;
  currency?: string;
  created?: number;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
}

interface StripePaymentMethod {
  id: string;
  card?: {
    brand?: string;
    last4?: string;
    expMonth?: number;
    expYear?: number;
    funding?: string;
  };
}

const formatCurrency = (amount: number | null | undefined, currency = 'usd'): string => {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
};

const getStatusVariant = (
  status: string,
): 'success' | 'destructive' | 'warning' | 'info' | 'secondary' => {
  const variants: Record<string, 'success' | 'destructive' | 'warning' | 'info' | 'secondary'> = {
    active: 'success',
    trialing: 'info',
    past_due: 'warning',
    canceled: 'secondary',
    unpaid: 'destructive',
    incomplete: 'warning',
    incomplete_expired: 'destructive',
    paused: 'secondary',
    paid: 'success',
    open: 'info',
    draft: 'secondary',
    void: 'secondary',
    uncollectible: 'destructive',
  };
  return variants[status] || 'secondary';
};

export const Route = createFileRoute('/_app/_protected/admin/billing/stripe-tools')({
  component: StripeToolsPage,
});

function StripeToolsPage() {
  const [searchType, setSearchType] = useState<'email' | 'customerId'>('email');
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [invoices, setInvoices] = useState<StripeInvoice[] | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<StripePaymentMethod[] | null>(null);
  const [subscriptions, setSubscriptions] = useState<StripeSubscription[] | null>(null);

  const [generatingPortal, setGeneratingPortal] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    setSearching(true);
    setSearchError(null);
    setCustomerData(null);
    setInvoices(null);
    setPaymentMethods(null);
    setSubscriptions(null);
    setPortalUrl(null);

    try {
      const query =
        searchType === 'email' ? { email: searchInput.trim() } : { customerId: searchInput.trim() };

      const data = (await lookupAdminStripeCustomerAction({ data: query })) as CustomerData;
      setCustomerData(data);

      if (!data.found) {
        setSearchError(data.message || 'Customer not found');
      }
    } catch (error) {
      const message = (error as Error).message || 'Failed to search';
      showToast.error('Search failed', message);
      setSearchError(message);
    } finally {
      setSearching(false);
    }
  };

  const loadInvoices = async () => {
    if (!customerData?.customer?.id) return;

    setLoadingInvoices(true);
    try {
      const data = await getAdminStripeCustomerInvoicesAction({
        data: { customerId: customerData.customer.id },
      });
      setInvoices(data.invoices as StripeInvoice[]);
    } catch (error) {
      showToast.error('Failed to load invoices', (error as Error).message);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const loadPaymentMethods = async () => {
    if (!customerData?.customer?.id) return;

    setLoadingPaymentMethods(true);
    try {
      const data = await getAdminStripeCustomerPaymentMethodsAction({
        data: { customerId: customerData.customer.id },
      });
      setPaymentMethods(data.paymentMethods as StripePaymentMethod[]);
    } catch (error) {
      showToast.error('Failed to load payment methods', (error as Error).message);
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  const loadSubscriptions = async () => {
    if (!customerData?.customer?.id) return;

    setLoadingSubscriptions(true);
    try {
      const data = await getAdminStripeCustomerSubscriptionsAction({
        data: { customerId: customerData.customer.id },
      });
      setSubscriptions(data.subscriptions as StripeSubscription[]);
    } catch (error) {
      showToast.error('Failed to load subscriptions', (error as Error).message);
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  const generatePortalLink = async () => {
    if (!customerData?.customer?.id) return;

    setGeneratingPortal(true);
    try {
      const data = await createAdminStripePortalLinkAction({
        data: { customerId: customerData.customer.id },
      });
      setPortalUrl(data.url);
      showToast.success('Success', 'Portal link generated');
    } catch (error) {
      showToast.error('Failed to generate portal link', (error as Error).message);
    } finally {
      setGeneratingPortal(false);
    }
  };

  return (
    <div className='flex flex-col gap-8'>
      <DashboardHeader
        icon={CreditCardIcon}
        title='Stripe Tools'
        description='Look up customers, view invoices, and manage billing'
        iconColor='purple'
      />

      {/* Search Section */}
      <AdminBox>
        <h2 className='text-foreground mb-4 text-lg font-semibold'>Customer Lookup</h2>
        <form onSubmit={handleSearch} className='flex flex-col gap-4 sm:flex-row'>
          <Select
            value={searchType}
            onValueChange={v => setSearchType(v as 'email' | 'customerId')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='email'>Search by Email</SelectItem>
              <SelectItem value='customerId'>Search by Customer ID</SelectItem>
            </SelectContent>
          </Select>
          <div className='relative flex-1'>
            <SearchIcon className='text-muted-foreground/70 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
            <Input
              type='text'
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder={searchType === 'email' ? 'customer@example.com' : 'cus_xxxxxxxxxxxxx'}
              className='w-full pl-10'
            />
          </div>
          <Button type='submit' disabled={searching || !searchInput.trim()}>
            {searching ?
              <Spinner size='sm' variant='current' className='mr-2' />
            : <SearchIcon className='mr-2 size-4' />}
            Search
          </Button>
        </form>

        {/* Search Error */}
        {searchError && (
          <div className='border-warning-border bg-warning-bg mt-4 rounded-xl border p-4'>
            <p className='text-warning-foreground text-sm'>{searchError}</p>
          </div>
        )}
      </AdminBox>

      {/* Customer Results */}
      {customerData?.found && (
        <>
          {/* Customer Info Card */}
          <AdminBox>
            <div className='mb-4 flex items-start justify-between'>
              <h2 className='text-foreground text-lg font-semibold'>Customer Details</h2>
              <a
                href={customerData.stripeDashboardUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary hover:text-primary/80 inline-flex items-center text-sm'
              >
                View in Stripe
                <ExternalLinkIcon className='ml-1 size-4' />
              </a>
            </div>

            <dl className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Customer ID</dt>
                <dd className='text-foreground mt-1 flex items-center text-sm'>
                  <span className='font-mono'>{customerData.customer.id}</span>
                  <CopyButton
                    text={customerData.customer.id}
                    label='Customer ID'
                    className='text-muted-foreground/70 hover:text-muted-foreground ml-2'
                    iconSize='size-4'
                  />
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Email</dt>
                <dd className='text-foreground mt-1 text-sm'>
                  {customerData.customer.email || '-'}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Name</dt>
                <dd className='text-foreground mt-1 text-sm'>
                  {customerData.customer.name || '-'}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Created</dt>
                <dd className='text-foreground mt-1 text-sm'>
                  {formatDateTime(customerData.customer.created)}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Balance</dt>
                <dd className='text-foreground mt-1 text-sm'>
                  {formatCurrency(customerData.customer.balance, customerData.customer.currency)}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Delinquent</dt>
                <dd className='mt-1'>
                  <Badge variant={customerData.customer.delinquent ? 'destructive' : 'success'}>
                    {customerData.customer.delinquent ? 'Yes' : 'No'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Mode</dt>
                <dd className='mt-1'>
                  <Badge variant={customerData.customer.livemode ? 'success' : 'warning'}>
                    {customerData.customer.livemode ? 'Live' : 'Test'}
                  </Badge>
                </dd>
              </div>
            </dl>

            {/* Linked Resources */}
            <div className='border-border mt-6 border-t pt-4'>
              <h3 className='text-foreground mb-3 text-sm font-medium'>Linked Resources</h3>
              <div className='flex flex-wrap gap-4'>
                {customerData.linkedUser ?
                  <Link
                    to={'/admin/users/$userId' as string}
                    params={{ userId: customerData.linkedUser.id } as Record<string, string>}
                    className='text-primary hover:text-primary/80 inline-flex items-center text-sm'
                  >
                    <UserIcon className='mr-1 size-4' />
                    {customerData.linkedUser.name || customerData.linkedUser.email}
                  </Link>
                : <span className='text-muted-foreground inline-flex items-center text-sm'>
                    <UserIcon className='mr-1 size-4' />
                    No linked user
                  </span>
                }
                {customerData.linkedOrg ?
                  <Link
                    to={'/admin/orgs/$orgId' as string}
                    params={{ orgId: customerData.linkedOrg.id } as Record<string, string>}
                    className='text-primary hover:text-primary/80 inline-flex items-center text-sm'
                  >
                    <HomeIcon className='mr-1 size-4' />
                    {customerData.linkedOrg.name}
                  </Link>
                : <span className='text-muted-foreground inline-flex items-center text-sm'>
                    <HomeIcon className='mr-1 size-4' />
                    No linked organization
                  </span>
                }
              </div>
            </div>
          </AdminBox>

          {/* Quick Actions */}
          <AdminBox>
            <h2 className='text-foreground mb-4 text-lg font-semibold'>Quick Actions</h2>
            <div className='flex flex-wrap gap-3'>
              <Button
                type='button'
                variant='outline'
                onClick={generatePortalLink}
                disabled={generatingPortal}
              >
                {generatingPortal ?
                  <Spinner size='sm' variant='current' className='mr-2' />
                : <ExternalLinkIcon className='mr-2 size-4' />}
                Generate Portal Link
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={loadInvoices}
                disabled={loadingInvoices}
              >
                {loadingInvoices ?
                  <Spinner size='sm' variant='current' className='mr-2' />
                : <FileTextIcon className='mr-2 size-4' />}
                Load Invoices
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={loadPaymentMethods}
                disabled={loadingPaymentMethods}
              >
                {loadingPaymentMethods ?
                  <Spinner size='sm' variant='current' className='mr-2' />
                : <CreditCardIcon className='mr-2 size-4' />}
                Load Payment Methods
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={loadSubscriptions}
                disabled={loadingSubscriptions}
              >
                {loadingSubscriptions ?
                  <Spinner size='sm' variant='current' className='mr-2' />
                : <DollarSignIcon className='mr-2 size-4' />}
                Load Subscriptions
              </Button>
            </div>

            {/* Portal Link Result */}
            {portalUrl && (
              <div className='border-success-border bg-success-bg mt-4 rounded-lg border p-4'>
                <p className='text-success mb-2 text-sm font-medium'>Portal Link Generated</p>
                <div className='flex items-center gap-2'>
                  <Input
                    type='text'
                    value={portalUrl}
                    readOnly
                    className='border-success-border flex-1'
                  />
                  <Button
                    type='button'
                    variant='success'
                    onClick={() => navigator.clipboard.writeText(portalUrl)}
                  >
                    Copy
                  </Button>
                  <a
                    href={portalUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='bg-success hover:bg-success/80 rounded px-3 py-1 text-sm text-white'
                  >
                    Open
                  </a>
                </div>
                <p className='text-success mt-2 text-xs'>Link expires in 5 minutes</p>
              </div>
            )}
          </AdminBox>

          {/* Subscriptions Section */}
          {subscriptions && (
            <AdminBox>
              <h2 className='text-foreground mb-4 flex items-center text-lg font-semibold'>
                <DollarSignIcon className='mr-2 size-5' />
                Subscriptions ({subscriptions.length})
              </h2>
              {subscriptions.length === 0 ?
                <p className='text-muted-foreground text-sm'>No subscriptions found</p>
              : <div className='flex flex-col gap-4'>
                  {subscriptions.map(sub => (
                    <div
                      key={sub.id}
                      className='border-border-subtle bg-muted rounded-lg border p-4'
                    >
                      <div className='flex items-start justify-between'>
                        <div>
                          <p className='text-foreground font-mono text-sm'>{sub.id}</p>
                          <Badge variant={getStatusVariant(sub.status)} className='mt-1'>
                            {sub.status}
                          </Badge>
                        </div>
                        <a
                          href={`https://dashboard.stripe.com/subscriptions/${sub.id}`}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-primary hover:text-primary/80'
                        >
                          <ExternalLinkIcon className='size-4' />
                        </a>
                      </div>
                      <div className='mt-3 grid grid-cols-2 gap-2 text-sm'>
                        <div>
                          <span className='text-muted-foreground'>Period:</span>{' '}
                          {formatDateTime(sub.currentPeriodStart)} -{' '}
                          {formatDateTime(sub.currentPeriodEnd)}
                        </div>
                        {sub.cancelAtPeriodEnd && (
                          <div className='text-destructive'>Cancels at period end</div>
                        )}
                        {sub.trialEnd && sub.status === 'trialing' && (
                          <div>
                            <span className='text-muted-foreground'>Trial ends:</span>{' '}
                            {formatDateTime(sub.trialEnd)}
                          </div>
                        )}
                      </div>
                      {sub.items && sub.items.length > 0 && (
                        <div className='text-muted-foreground mt-2 text-sm'>
                          {sub.items.map((item, idx) => (
                            <span key={idx} className='mr-2'>
                              {formatCurrency(item.unitAmount, sub.currency)}/{item.interval}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              }
            </AdminBox>
          )}

          {/* Invoices Section */}
          {invoices && (
            <AdminBox>
              <h2 className='text-foreground mb-4 flex items-center text-lg font-semibold'>
                <FileTextIcon className='mr-2 size-5' />
                Recent Invoices ({invoices.length})
              </h2>
              {invoices.length === 0 ?
                <p className='text-muted-foreground text-sm'>No invoices found</p>
              : <Table>
                  <TableHeader>
                    <TableRow className='border-border bg-muted border-b'>
                      <TableHead className='text-muted-foreground px-4 py-2 text-xs font-medium uppercase'>
                        Invoice
                      </TableHead>
                      <TableHead className='text-muted-foreground px-4 py-2 text-xs font-medium uppercase'>
                        Status
                      </TableHead>
                      <TableHead className='text-muted-foreground px-4 py-2 text-right text-xs font-medium uppercase'>
                        Amount
                      </TableHead>
                      <TableHead className='text-muted-foreground px-4 py-2 text-xs font-medium uppercase'>
                        Created
                      </TableHead>
                      <TableHead className='text-muted-foreground px-4 py-2 text-right text-xs font-medium uppercase'>
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map(invoice => (
                      <TableRow key={invoice.id}>
                        <TableCell className='px-4 py-3'>
                          <span className='font-mono text-sm'>{invoice.number || invoice.id}</span>
                        </TableCell>
                        <TableCell className='px-4 py-3'>
                          <Badge variant={getStatusVariant(invoice.status)}>{invoice.status}</Badge>
                        </TableCell>
                        <TableCell className='px-4 py-3 text-right text-sm'>
                          {formatCurrency(invoice.total, invoice.currency)}
                        </TableCell>
                        <TableCell className='text-muted-foreground px-4 py-3 text-sm'>
                          {formatDateTime(invoice.created)}
                        </TableCell>
                        <TableCell className='px-4 py-3 text-right'>
                          <div className='flex justify-end gap-2'>
                            {invoice.hostedInvoiceUrl && (
                              <a
                                href={invoice.hostedInvoiceUrl}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-primary hover:text-primary/80'
                                title='View Invoice'
                              >
                                <ExternalLinkIcon className='size-4' />
                              </a>
                            )}
                            {invoice.invoicePdf && (
                              <a
                                href={invoice.invoicePdf}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-muted-foreground hover:text-secondary-foreground'
                                title='Download PDF'
                              >
                                <FileTextIcon className='size-4' />
                              </a>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              }
            </AdminBox>
          )}

          {/* Payment Methods Section */}
          {paymentMethods && (
            <AdminBox>
              <h2 className='text-foreground mb-4 flex items-center text-lg font-semibold'>
                <CreditCardIcon className='mr-2 size-5' />
                Payment Methods ({paymentMethods.length})
              </h2>
              {paymentMethods.length === 0 ?
                <p className='text-muted-foreground text-sm'>No payment methods found</p>
              : <div className='flex flex-col gap-3'>
                  {paymentMethods.map(pm => (
                    <div
                      key={pm.id}
                      className='border-border-subtle bg-muted flex items-center justify-between rounded-lg border p-4'
                    >
                      <div className='flex items-center gap-3'>
                        <CreditCardIcon className='text-muted-foreground/70 size-6' />
                        <div>
                          <p className='text-foreground text-sm font-medium capitalize'>
                            {pm.card?.brand} **** {pm.card?.last4}
                          </p>
                          <p className='text-muted-foreground text-xs'>
                            Expires {pm.card?.expMonth}/{pm.card?.expYear}
                          </p>
                        </div>
                      </div>
                      <span className='text-muted-foreground text-xs capitalize'>
                        {pm.card?.funding}
                      </span>
                    </div>
                  ))}
                </div>
              }
            </AdminBox>
          )}
        </>
      )}
    </div>
  );
}
