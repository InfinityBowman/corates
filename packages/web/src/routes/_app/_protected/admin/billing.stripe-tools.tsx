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
import { showToast } from '@/lib/toast';
import {
  AdminEmpty,
  AdminField,
  AdminFieldGrid,
  AdminPage,
  AdminPanel,
  CopyButton,
  ADMIN_TH,
  ADMIN_TD,
  ADMIN_TD_MUTED,
} from '@/components/admin/ui';
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
import type {
  AdminStripeCustomerFound,
  AdminStripeInvoice,
  AdminStripePaymentMethod,
  AdminStripeSubscription,
} from '@/server/functions/admin-stripe.server';

const formatCurrency = (amount: number | null | undefined, currency?: string | null): string => {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase(),
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
  const [customerData, setCustomerData] = useState<AdminStripeCustomerFound | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [invoices, setInvoices] = useState<{
    rows: AdminStripeInvoice[];
    hasMore: boolean;
  } | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<AdminStripePaymentMethod[] | null>(null);
  const [subscriptions, setSubscriptions] = useState<{
    rows: AdminStripeSubscription[];
    hasMore: boolean;
  } | null>(null);

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

      const data = await lookupAdminStripeCustomerAction({ data: query });

      if (data.found) {
        setCustomerData(data);
      } else {
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
      setInvoices({ rows: data.invoices, hasMore: data.hasMore });
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
      const data = await getAdminStripeCustomerSubscriptionsAction({
        data: { customerId: customerData.customer.id },
      });
      setSubscriptions({ rows: data.subscriptions, hasMore: data.hasMore });
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
    <AdminPage
      title='Stripe Tools'
      description='Look up customers, view invoices, and manage billing'
    >
      <AdminPanel title='Customer Lookup' padded>
        <form onSubmit={handleSearch} className='flex flex-col gap-2 sm:flex-row'>
          <Select
            value={searchType}
            onValueChange={v => setSearchType(v as 'email' | 'customerId')}
          >
            <SelectTrigger className='w-full text-[13px] sm:w-48'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='email'>By email</SelectItem>
              <SelectItem value='customerId'>By customer ID</SelectItem>
            </SelectContent>
          </Select>
          <div className='relative flex-1'>
            <SearchIcon className='text-muted-foreground/70 pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
            <Input
              type='text'
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder={searchType === 'email' ? 'customer@example.com' : 'cus_xxxxxxxxxxxxx'}
              aria-label='Customer lookup'
              className='w-full pl-8 text-[13px]'
            />
          </div>
          <Button type='submit' size='sm' disabled={searching || !searchInput.trim()}>
            {searching ?
              <Spinner size='sm' variant='current' data-icon='inline-start' />
            : <SearchIcon data-icon='inline-start' />}
            Search
          </Button>
        </form>

        {searchError && <p className='text-warning mt-3 text-[13px]'>{searchError}</p>}
      </AdminPanel>

      {customerData?.found && (
        <>
          <AdminPanel
            title='Customer Details'
            padded
            action={
              <a
                href={customerData.stripeDashboardUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary hover:text-primary/80 inline-flex items-center gap-1 text-[13px]'
              >
                View in Stripe
                <ExternalLinkIcon className='size-3.5' />
              </a>
            }
          >
            <AdminFieldGrid>
              <AdminField label='Customer ID' mono>
                <span className='truncate'>{customerData.customer.id}</span>
                <CopyButton text={customerData.customer.id} label='Customer ID' />
              </AdminField>
              <AdminField label='Email'>{customerData.customer.email || '-'}</AdminField>
              <AdminField label='Name'>{customerData.customer.name || '-'}</AdminField>
              <AdminField label='Created'>
                {formatDateTime(customerData.customer.created)}
              </AdminField>
              <AdminField label='Balance'>
                {formatCurrency(customerData.customer.balance, customerData.customer.currency)}
              </AdminField>
              <AdminField label='Status'>
                <Badge variant={customerData.customer.delinquent ? 'destructive' : 'success'}>
                  {customerData.customer.delinquent ? 'Delinquent' : 'Current'}
                </Badge>
                <Badge variant={customerData.customer.livemode ? 'success' : 'warning'}>
                  {customerData.customer.livemode ? 'Live' : 'Test'}
                </Badge>
              </AdminField>
              <AdminField label='Linked user'>
                {customerData.linkedUser ?
                  <Link
                    to={'/admin/users/$userId' as string}
                    params={{ userId: customerData.linkedUser.id } as Record<string, string>}
                    className='text-primary hover:text-primary/80'
                  >
                    {customerData.linkedUser.name || customerData.linkedUser.email}
                  </Link>
                : <span className='text-muted-foreground/60'>-</span>}
              </AdminField>
              <AdminField label='Linked organization'>
                {customerData.linkedOrg ?
                  <Link
                    to={'/admin/orgs/$orgId' as string}
                    params={{ orgId: customerData.linkedOrg.id } as Record<string, string>}
                    className='text-primary hover:text-primary/80'
                  >
                    {customerData.linkedOrg.name}
                  </Link>
                : <span className='text-muted-foreground/60'>-</span>}
              </AdminField>
            </AdminFieldGrid>
          </AdminPanel>

          <AdminPanel title='Quick Actions' padded>
            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={generatePortalLink}
                disabled={generatingPortal}
              >
                {generatingPortal ?
                  <Spinner size='sm' variant='current' data-icon='inline-start' />
                : <ExternalLinkIcon data-icon='inline-start' />}
                Generate portal link
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={loadInvoices}
                disabled={loadingInvoices}
              >
                {loadingInvoices ?
                  <Spinner size='sm' variant='current' data-icon='inline-start' />
                : <FileTextIcon data-icon='inline-start' />}
                Load invoices
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={loadPaymentMethods}
                disabled={loadingPaymentMethods}
              >
                {loadingPaymentMethods ?
                  <Spinner size='sm' variant='current' data-icon='inline-start' />
                : <CreditCardIcon data-icon='inline-start' />}
                Load payment methods
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={loadSubscriptions}
                disabled={loadingSubscriptions}
              >
                {loadingSubscriptions ?
                  <Spinner size='sm' variant='current' data-icon='inline-start' />
                : <DollarSignIcon data-icon='inline-start' />}
                Load subscriptions
              </Button>
            </div>

            {portalUrl && (
              <div className='border-border bg-muted/40 mt-4 rounded-lg border p-3'>
                <p className='text-foreground mb-2 text-[13px] font-medium'>
                  Portal link - expires in 5 minutes
                </p>
                <div className='flex items-center gap-2'>
                  <Input
                    type='text'
                    value={portalUrl}
                    readOnly
                    className='flex-1 font-mono text-xs'
                  />
                  <CopyButton text={portalUrl} label='Portal link' />
                  <Button asChild variant='outline' size='sm'>
                    <a href={portalUrl} target='_blank' rel='noopener noreferrer'>
                      Open
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </AdminPanel>

          {subscriptions && (
            <AdminPanel
              title={`Subscriptions (${subscriptions.rows.length}${subscriptions.hasMore ? '+' : ''})`}
              bodyClassName='divide-border divide-y'
            >
              {subscriptions.rows.length === 0 ?
                <AdminEmpty title='No subscriptions' />
              : subscriptions.rows.map(sub => (
                  <div key={sub.id} className='flex items-start justify-between gap-4 px-4 py-3'>
                    <div className='min-w-0'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <code className='text-foreground font-mono text-[13px]'>{sub.id}</code>
                        <Badge variant={getStatusVariant(sub.status)}>{sub.status}</Badge>
                        {sub.cancelAtPeriodEnd && (
                          <Badge variant='warning'>Cancels at period end</Badge>
                        )}
                      </div>
                      <p className='text-muted-foreground mt-1 text-xs'>
                        {formatDateTime(sub.items[0]?.currentPeriodStart)} -{' '}
                        {formatDateTime(sub.items[0]?.currentPeriodEnd)}
                        {sub.trialEnd &&
                          sub.status === 'trialing' &&
                          ` - trial ends ${formatDateTime(sub.trialEnd)}`}
                      </p>
                      {sub.items.length > 0 && (
                        <p className='text-muted-foreground mt-1 text-xs'>
                          {sub.items
                            .map(
                              item =>
                                `${formatCurrency(item.unitAmount, sub.currency)}/${item.interval}`,
                            )
                            .join(', ')}
                        </p>
                      )}
                    </div>
                    <a
                      href={`https://dashboard.stripe.com/subscriptions/${sub.id}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-muted-foreground/70 hover:text-foreground shrink-0'
                      aria-label='Open in Stripe'
                    >
                      <ExternalLinkIcon className='size-4' />
                    </a>
                  </div>
                ))
              }
            </AdminPanel>
          )}

          {invoices && (
            <AdminPanel
              title={`Recent Invoices (${invoices.rows.length}${invoices.hasMore ? '+' : ''})`}
            >
              {invoices.rows.length === 0 ?
                <AdminEmpty title='No invoices' />
              : <Table>
                  <TableHeader className='bg-muted/40'>
                    <TableRow className='border-border hover:bg-transparent'>
                      <TableHead className={ADMIN_TH}>Invoice</TableHead>
                      <TableHead className={ADMIN_TH}>Status</TableHead>
                      <TableHead className={`${ADMIN_TH} text-right`}>Amount</TableHead>
                      <TableHead className={ADMIN_TH}>Created</TableHead>
                      <TableHead className={`${ADMIN_TH} text-right`}>Links</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.rows.map(invoice => (
                      <TableRow key={invoice.id} className='border-border'>
                        <TableCell className={`${ADMIN_TD} font-mono`}>
                          {invoice.number || invoice.id}
                        </TableCell>
                        <TableCell className={ADMIN_TD}>
                          <Badge variant={getStatusVariant(invoice.status ?? 'unknown')}>
                            {invoice.status ?? 'unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className={`${ADMIN_TD} text-right tabular-nums`}>
                          {formatCurrency(invoice.total, invoice.currency)}
                        </TableCell>
                        <TableCell className={`${ADMIN_TD_MUTED} tabular-nums`}>
                          {formatDateTime(invoice.created)}
                        </TableCell>
                        <TableCell className={`${ADMIN_TD} text-right`}>
                          <div className='flex justify-end gap-2'>
                            {invoice.hostedInvoiceUrl && (
                              <a
                                href={invoice.hostedInvoiceUrl}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-muted-foreground/70 hover:text-foreground'
                                aria-label='View invoice'
                              >
                                <ExternalLinkIcon className='size-4' />
                              </a>
                            )}
                            {invoice.invoicePdf && (
                              <a
                                href={invoice.invoicePdf}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-muted-foreground/70 hover:text-foreground'
                                aria-label='Download PDF'
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
            </AdminPanel>
          )}

          {paymentMethods && (
            <AdminPanel
              title={`Payment Methods (${paymentMethods.length})`}
              bodyClassName='divide-border divide-y'
            >
              {paymentMethods.length === 0 ?
                <AdminEmpty title='No payment methods' />
              : paymentMethods.map(pm => (
                  <div key={pm.id} className='flex items-center justify-between gap-4 px-4 py-3'>
                    <div className='flex items-center gap-3'>
                      <CreditCardIcon className='text-muted-foreground/70 size-5' />
                      <div>
                        <p className='text-foreground text-[13px] font-medium capitalize'>
                          {pm.card?.brand} **** {pm.card?.last4}
                        </p>
                        <p className='text-muted-foreground text-xs tabular-nums'>
                          Expires {pm.card?.expMonth}/{pm.card?.expYear}
                        </p>
                      </div>
                    </div>
                    <span className='text-muted-foreground text-xs capitalize'>
                      {pm.card?.funding}
                    </span>
                  </div>
                ))
              }
            </AdminPanel>
          )}
        </>
      )}
    </AdminPage>
  );
}
