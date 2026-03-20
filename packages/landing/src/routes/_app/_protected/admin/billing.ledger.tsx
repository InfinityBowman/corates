/**
 * Admin Billing Ledger route
 * Displays Stripe event ledger entries with filtering and search
 */

import { useState, useCallback, useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { LoaderIcon, CopyIcon, CheckIcon, ExternalLinkIcon, FilterIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdminBillingLedger } from '@/hooks/useAdminQueries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { showToast } from '@/components/ui/toast';
import { DashboardHeader, AdminBox, AdminDataTable } from '@/components/admin/ui';
import { input } from '@/components/admin/styles/admin-tokens';
import type { ColumnDef } from '@tanstack/react-table';

interface LedgerEntry {
  receivedAt?: string | number;
  processedAt?: string | number;
  status: string;
  type?: string;
  stripeEventId?: string;
  orgId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeCheckoutSessionId?: string;
  requestId?: string;
  error?: string;
  httpStatus?: number;
}

interface LedgerStats {
  total?: number;
  byStatus?: Record<string, number>;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'received', label: 'Received' },
  { value: 'processed', label: 'Processed' },
  { value: 'skipped_duplicate', label: 'Skipped (Duplicate)' },
  { value: 'failed', label: 'Failed' },
  { value: 'ignored_unverified', label: 'Ignored (Unverified)' },
];

const LIMIT_OPTIONS = [25, 50, 100, 200];

const formatDate = (timestamp: string | number | Date | null | undefined): string => {
  if (!timestamp) return '-';
  const date =
    timestamp instanceof Date ? timestamp
    : typeof timestamp === 'string' ? new Date(timestamp)
    : new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getStatusVariant = (
  status: string,
): 'success' | 'destructive' | 'warning' | 'info' | 'secondary' => {
  switch (status) {
    case 'processed':
      return 'success';
    case 'failed':
      return 'destructive';
    case 'ignored_unverified':
      return 'warning';
    case 'skipped_duplicate':
      return 'secondary';
    case 'received':
      return 'info';
    default:
      return 'secondary';
  }
};

const getStripeUrl = (type: string, id: string | undefined): string | null => {
  if (!id) return null;
  const base = 'https://dashboard.stripe.com';
  switch (type) {
    case 'customer':
      return `${base}/customers/${id}`;
    case 'subscription':
      return `${base}/subscriptions/${id}`;
    case 'event':
      return `${base}/events/${id}`;
    default:
      return null;
  }
};

export const Route = createFileRoute('/_app/_protected/admin/billing/ledger')({
  component: AdminBillingLedgerPage,
});

function AdminBillingLedgerPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [limit, setLimit] = useState(50);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const debouncedTypeFilter = useDebouncedValue(typeFilter, 300);

  const ledgerQuery = useAdminBillingLedger({
    limit,
    status: statusFilter || undefined,
    type: debouncedTypeFilter || undefined,
  });

  const data = ledgerQuery.data as { entries: LedgerEntry[]; stats: LedgerStats } | undefined;
  const entries = data?.entries || [];
  const stats = data?.stats || {};

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

  const columns = useMemo<ColumnDef<LedgerEntry, unknown>[]>(
    () => [
      {
        accessorKey: 'receivedAt',
        header: 'Time',
        cell: info => {
          const entry = info.row.original;
          return (
            <div className='text-muted-foreground whitespace-nowrap'>
              <div>{formatDate(entry.receivedAt)}</div>
              {entry.processedAt && (
                <div className='text-muted-foreground/70 text-xs'>
                  Processed: {formatDate(entry.processedAt)}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: info => {
          const value = info.getValue() as string;
          return (
            <Badge variant={getStatusVariant(value)} className='whitespace-nowrap'>
              {value.replace(/_/g, ' ')}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: info => (
          <code className='text-xs whitespace-nowrap'>{(info.getValue() as string) || '-'}</code>
        ),
      },
      {
        accessorKey: 'stripeEventId',
        header: 'Event ID',
        cell: info => {
          const entry = info.row.original;
          if (!entry.stripeEventId) {
            return <span className='text-muted-foreground/70'>-</span>;
          }
          return (
            <div className='flex items-center gap-1 whitespace-nowrap'>
              <code className='text-foreground font-mono text-xs'>
                {entry.stripeEventId.slice(0, 12)}...
              </code>
              <button
                type='button'
                onClick={() => handleCopy(entry.stripeEventId!, 'Event ID')}
                className='text-muted-foreground/70 hover:text-muted-foreground'
                title='Copy event ID'
              >
                {copiedId === `Event ID-${entry.stripeEventId}` ?
                  <CheckIcon className='size-3 text-green-600' />
                : <CopyIcon className='size-3' />}
              </button>
              <a
                href={getStripeUrl('event', entry.stripeEventId) || '#'}
                target='_blank'
                rel='noopener noreferrer'
                className='text-muted-foreground/70 hover:text-muted-foreground'
                title='Open in Stripe'
              >
                <ExternalLinkIcon className='size-3' />
              </a>
            </div>
          );
        },
      },
      {
        accessorKey: 'orgId',
        header: 'Org ID',
        cell: info => {
          const entry = info.row.original;
          if (!entry.orgId) {
            return <span className='text-muted-foreground/70'>-</span>;
          }
          return (
            <div className='flex items-center gap-1 whitespace-nowrap'>
              <Link
                to={'/admin/orgs/$orgId' as string}
                params={{ orgId: entry.orgId } as Record<string, string>}
                className='text-blue-600 hover:text-blue-800'
              >
                <code className='font-mono text-xs'>{entry.orgId.slice(0, 8)}...</code>
              </Link>
              <button
                type='button'
                onClick={() => handleCopy(entry.orgId!, 'Org ID')}
                className='text-muted-foreground/70 hover:text-muted-foreground'
                title='Copy org ID'
              >
                {copiedId === `Org ID-${entry.orgId}` ?
                  <CheckIcon className='size-3 text-green-600' />
                : <CopyIcon className='size-3' />}
              </button>
            </div>
          );
        },
      },
      {
        id: 'stripeIds',
        header: 'Stripe IDs',
        cell: info => {
          const entry = info.row.original;
          return (
            <div className='flex flex-col gap-1'>
              {entry.stripeCustomerId && (
                <div className='flex items-center gap-1'>
                  <span className='text-muted-foreground text-xs'>C:</span>
                  <code className='text-foreground font-mono text-xs'>
                    {entry.stripeCustomerId.slice(0, 12)}...
                  </code>
                  <button
                    type='button'
                    onClick={() => handleCopy(entry.stripeCustomerId!, 'Customer ID')}
                    className='text-muted-foreground/70 hover:text-muted-foreground'
                    title='Copy customer ID'
                  >
                    {copiedId === `Customer ID-${entry.stripeCustomerId}` ?
                      <CheckIcon className='size-3 text-green-600' />
                    : <CopyIcon className='size-3' />}
                  </button>
                  <a
                    href={getStripeUrl('customer', entry.stripeCustomerId) || '#'}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-muted-foreground/70 hover:text-muted-foreground'
                    title='Open in Stripe'
                  >
                    <ExternalLinkIcon className='size-3' />
                  </a>
                </div>
              )}
              {entry.stripeSubscriptionId && (
                <div className='flex items-center gap-1'>
                  <span className='text-muted-foreground text-xs'>S:</span>
                  <code className='text-foreground font-mono text-xs'>
                    {entry.stripeSubscriptionId.slice(0, 12)}...
                  </code>
                  <button
                    type='button'
                    onClick={() => handleCopy(entry.stripeSubscriptionId!, 'Subscription ID')}
                    className='text-muted-foreground/70 hover:text-muted-foreground'
                    title='Copy subscription ID'
                  >
                    {copiedId === `Subscription ID-${entry.stripeSubscriptionId}` ?
                      <CheckIcon className='size-3 text-green-600' />
                    : <CopyIcon className='size-3' />}
                  </button>
                  <a
                    href={getStripeUrl('subscription', entry.stripeSubscriptionId) || '#'}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-muted-foreground/70 hover:text-muted-foreground'
                    title='Open in Stripe'
                  >
                    <ExternalLinkIcon className='size-3' />
                  </a>
                </div>
              )}
              {entry.stripeCheckoutSessionId && (
                <div className='flex items-center gap-1'>
                  <span className='text-muted-foreground text-xs'>CS:</span>
                  <code className='text-foreground font-mono text-xs'>
                    {entry.stripeCheckoutSessionId.slice(0, 12)}...
                  </code>
                  <button
                    type='button'
                    onClick={() =>
                      handleCopy(entry.stripeCheckoutSessionId!, 'Checkout Session ID')
                    }
                    className='text-muted-foreground/70 hover:text-muted-foreground'
                    title='Copy checkout session ID'
                  >
                    {copiedId === `Checkout Session ID-${entry.stripeCheckoutSessionId}` ?
                      <CheckIcon className='size-3 text-green-600' />
                    : <CopyIcon className='size-3' />}
                  </button>
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'requestId',
        header: 'Request ID',
        cell: info => {
          const entry = info.row.original;
          if (!entry.requestId) {
            return <span className='text-muted-foreground/70'>-</span>;
          }
          return (
            <div className='flex items-center gap-1 whitespace-nowrap'>
              <code className='text-foreground font-mono text-xs'>
                {entry.requestId.slice(0, 8)}...
              </code>
              <button
                type='button'
                onClick={() => handleCopy(entry.requestId!, 'Request ID')}
                className='text-muted-foreground/70 hover:text-muted-foreground'
                title='Copy request ID'
              >
                {copiedId === `Request ID-${entry.requestId}` ?
                  <CheckIcon className='size-3 text-green-600' />
                : <CopyIcon className='size-3' />}
              </button>
            </div>
          );
        },
      },
      {
        accessorKey: 'error',
        header: 'Error',
        cell: info => {
          const entry = info.row.original;
          if (entry.error) {
            return (
              <span className='text-xs text-red-600' title={entry.error}>
                {entry.error.length > 50 ? `${entry.error.slice(0, 50)}...` : entry.error}
              </span>
            );
          }
          if (entry.httpStatus) {
            return <span className='text-muted-foreground text-xs'>{entry.httpStatus}</span>;
          }
          return <span className='text-muted-foreground/70'>-</span>;
        },
      },
    ],
    [handleCopy, copiedId],
  );

  return (
    <>
      <DashboardHeader
        icon={FilterIcon}
        title='Billing Ledger'
        description='Stripe event ledger entries with filtering and search'
        actions={
          <button
            type='button'
            onClick={() => ledgerQuery.refetch()}
            className='border-border bg-card text-secondary-foreground hover:bg-muted inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium shadow-xs focus:ring-[3px] focus:ring-blue-100 focus:outline-none'
            disabled={ledgerQuery.isFetching}
          >
            {ledgerQuery.isFetching ?
              <LoaderIcon className='size-4 animate-spin' />
            : 'Refresh'}
          </button>
        }
      />

      {/* Stats Summary */}
      {stats && (
        <div className='mb-6 grid grid-cols-2 gap-4 md:grid-cols-5'>
          <div className='border-border bg-card rounded-xl border p-4 shadow-xs'>
            <p className='text-muted-foreground text-sm'>Total</p>
            <p className='text-foreground text-2xl font-bold'>{stats.total || 0}</p>
          </div>
          {Object.entries(stats.byStatus || {}).map(([status, count]) => (
            <div key={status} className='border-border bg-card rounded-xl border p-4 shadow-xs'>
              <p className='text-muted-foreground text-sm capitalize'>
                {status.replace(/_/g, ' ')}
              </p>
              <p className='text-foreground text-2xl font-bold'>{count as number}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <AdminBox className='mb-6'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
          <div>
            <label className='text-secondary-foreground block text-sm font-medium'>Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className={`mt-1 block w-full ${input.base}`}
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className='text-secondary-foreground block text-sm font-medium'>
              Event Type
            </label>
            <input
              type='text'
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              placeholder='e.g., checkout.session.completed'
              className={`mt-1 block w-full ${input.base}`}
            />
          </div>
          <div>
            <label className='text-secondary-foreground block text-sm font-medium'>Limit</label>
            <select
              value={limit}
              onChange={e => setLimit(parseInt(e.target.value, 10))}
              className={`mt-1 block w-full ${input.base}`}
            >
              {LIMIT_OPTIONS.map(opt => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AdminBox>

      {/* Table */}
      <AdminDataTable
        columns={columns}
        data={entries}
        loading={ledgerQuery.isLoading}
        emptyMessage='No ledger entries found'
        enableSorting
        pageSize={limit}
      />
    </>
  );
}
