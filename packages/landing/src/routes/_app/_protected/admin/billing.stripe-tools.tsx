/**
 * Admin Stripe Tools route
 * Customer lookup, portal link generation, and invoice/subscription viewing
 */

import { useState, useCallback } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  SearchIcon,
  LoaderIcon,
  ExternalLinkIcon,
  UserIcon,
  HomeIcon,
  CreditCardIcon,
  FileTextIcon,
  DollarSignIcon,
  CopyIcon,
  CheckCircleIcon,
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
import { apiFetch } from '@/lib/apiFetch';
import { showToast } from '@/components/ui/toast';
import { DashboardHeader, AdminBox } from '@/components/admin/ui';
import { Input } from '@/components/ui/input';

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

const formatDate = (timestamp: number | null | undefined): string => {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

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

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(`${label}-${text}`);
      showToast.success('Copied', `${label} copied to clipboard`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.warn('Clipboard copy failed:', (err as Error).message);
      showToast.error('Error', 'Failed to copy to clipboard');
    }
  }, []);

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
      const params = new URLSearchParams();
      if (searchType === 'email') {
        params.set('email', searchInput.trim());
      } else {
        params.set('customerId', searchInput.trim());
      }

      const data = await apiFetch.get<CustomerData>(`/api/admin/stripe/customer?${params}`, {
        toastMessage: false,
      });
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
      const data = await apiFetch.get<{ invoices: StripeInvoice[] }>(
        `/api/admin/stripe/customer/${customerData.customer.id}/invoices`,
        { toastMessage: false },
      );
      setInvoices(data.invoices);
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
      const data = await apiFetch.get<{ paymentMethods: StripePaymentMethod[] }>(
        `/api/admin/stripe/customer/${customerData.customer.id}/payment-methods`,
        { toastMessage: false },
      );
      setPaymentMethods(data.paymentMethods);
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
      const data = await apiFetch.get<{ subscriptions: StripeSubscription[] }>(
        `/api/admin/stripe/customer/${customerData.customer.id}/subscriptions`,
        { toastMessage: false },
      );
      setSubscriptions(data.subscriptions);
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
      const data = await apiFetch.post<{ url: string }>(
        '/api/admin/stripe/portal-link',
        { customerId: customerData.customer.id },
        { toastMessage: false },
      );
      setPortalUrl(data.url);
      showToast.success('Success', 'Portal link generated');
    } catch (error) {
      showToast.error('Failed to generate portal link', (error as Error).message);
    } finally {
      setGeneratingPortal(false);
    }
  };

  return (
    <>
      <DashboardHeader
        icon={CreditCardIcon}
        title='Stripe Tools'
        description='Look up customers, view invoices, and manage billing'
        iconColor='purple'
      />

      {/* Search Section */}
      <AdminBox className='mb-6'>
        <h2 className='text-foreground mb-4 text-lg font-semibold'>Customer Lookup</h2>
        <form onSubmit={handleSearch} className='flex flex-col gap-4 sm:flex-row'>
          <select
            value={searchType}
            onChange={e => setSearchType(e.target.value as 'email' | 'customerId')}
            className='border-input h-8 rounded-lg border bg-transparent px-2.5 py-2 text-sm'
          >
            <option value='email'>Search by Email</option>
            <option value='customerId'>Search by Customer ID</option>
          </select>
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
          <button
            type='submit'
            disabled={searching || !searchInput.trim()}
            className='inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-blue-700 focus:ring-[3px] focus:ring-blue-100 focus:outline-none disabled:opacity-50'
          >
            {searching ?
              <LoaderIcon className='mr-2 size-4 animate-spin' />
            : <SearchIcon className='mr-2 size-4' />}
            Search
          </button>
        </form>

        {/* Search Error */}
        {searchError && (
          <div className='mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4'>
            <p className='text-sm text-yellow-700'>{searchError}</p>
          </div>
        )}
      </AdminBox>

      {/* Customer Results */}
      {customerData?.found && (
        <>
          {/* Customer Info Card */}
          <AdminBox className='mb-6'>
            <div className='mb-4 flex items-start justify-between'>
              <h2 className='text-foreground text-lg font-semibold'>Customer Details</h2>
              <a
                href={customerData.stripeDashboardUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center text-sm text-blue-600 hover:text-blue-700'
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
                  <button
                    type='button'
                    onClick={() => handleCopy(customerData.customer.id, 'Customer ID')}
                    className='text-muted-foreground/70 hover:text-muted-foreground ml-2'
                  >
                    {copiedId === `Customer ID-${customerData.customer.id}` ?
                      <CheckCircleIcon className='text-success size-4' />
                    : <CopyIcon className='size-4' />}
                  </button>
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
                  {formatDate(customerData.customer.created)}
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
                    className='inline-flex items-center text-sm text-blue-600 hover:text-blue-700'
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
                    className='inline-flex items-center text-sm text-blue-600 hover:text-blue-700'
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
          <AdminBox className='mb-6'>
            <h2 className='text-foreground mb-4 text-lg font-semibold'>Quick Actions</h2>
            <div className='flex flex-wrap gap-3'>
              <button
                type='button'
                onClick={generatePortalLink}
                disabled={generatingPortal}
                className='border-border bg-card text-secondary-foreground hover:bg-muted inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50'
              >
                {generatingPortal ?
                  <LoaderIcon className='mr-2 size-4 animate-spin' />
                : <ExternalLinkIcon className='mr-2 size-4' />}
                Generate Portal Link
              </button>
              <button
                type='button'
                onClick={loadInvoices}
                disabled={loadingInvoices}
                className='border-border bg-card text-secondary-foreground hover:bg-muted inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50'
              >
                {loadingInvoices ?
                  <LoaderIcon className='mr-2 size-4 animate-spin' />
                : <FileTextIcon className='mr-2 size-4' />}
                Load Invoices
              </button>
              <button
                type='button'
                onClick={loadPaymentMethods}
                disabled={loadingPaymentMethods}
                className='border-border bg-card text-secondary-foreground hover:bg-muted inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50'
              >
                {loadingPaymentMethods ?
                  <LoaderIcon className='mr-2 size-4 animate-spin' />
                : <CreditCardIcon className='mr-2 size-4' />}
                Load Payment Methods
              </button>
              <button
                type='button'
                onClick={loadSubscriptions}
                disabled={loadingSubscriptions}
                className='border-border bg-card text-secondary-foreground hover:bg-muted inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50'
              >
                {loadingSubscriptions ?
                  <LoaderIcon className='mr-2 size-4 animate-spin' />
                : <DollarSignIcon className='mr-2 size-4' />}
                Load Subscriptions
              </button>
            </div>

            {/* Portal Link Result */}
            {portalUrl && (
              <div className='border-success-border bg-success-bg mt-4 rounded-lg border p-4'>
                <p className='text-success mb-2 text-sm font-medium'>Portal Link Generated</p>
                <div className='flex items-center gap-2'>
                  <input
                    type='text'
                    value={portalUrl}
                    readOnly
                    className='bg-card border-success-border flex-1 rounded border px-3 py-1 text-sm'
                  />
                  <button
                    type='button'
                    onClick={() => handleCopy(portalUrl, 'Portal URL')}
                    className='bg-success hover:bg-success/80 rounded px-3 py-1 text-sm text-white'
                  >
                    Copy
                  </button>
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
            <AdminBox className='mb-6'>
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
                          className='text-blue-600 hover:text-blue-700'
                        >
                          <ExternalLinkIcon className='size-4' />
                        </a>
                      </div>
                      <div className='mt-3 grid grid-cols-2 gap-2 text-sm'>
                        <div>
                          <span className='text-muted-foreground'>Period:</span>{' '}
                          {formatDate(sub.currentPeriodStart)} - {formatDate(sub.currentPeriodEnd)}
                        </div>
                        {sub.cancelAtPeriodEnd && (
                          <div className='text-destructive'>Cancels at period end</div>
                        )}
                        {sub.trialEnd && sub.status === 'trialing' && (
                          <div>
                            <span className='text-muted-foreground'>Trial ends:</span>{' '}
                            {formatDate(sub.trialEnd)}
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
            <AdminBox className='mb-6'>
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
                          {formatDate(invoice.created)}
                        </TableCell>
                        <TableCell className='px-4 py-3 text-right'>
                          <div className='flex justify-end gap-2'>
                            {invoice.hostedInvoiceUrl && (
                              <a
                                href={invoice.hostedInvoiceUrl}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-blue-600 hover:text-blue-700'
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
            <AdminBox className='mb-6'>
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
    </>
  );
}
