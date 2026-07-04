import { useState, useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { LoaderIcon, ExternalLinkIcon, FilterIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdminBillingLedger } from '@/hooks/useAdminQueries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DashboardHeader, AdminBox, AdminDataTable, CopyButton } from '@/components/admin/ui';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDateTime } from '@/lib/formatDate';
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

// Radix Select forbids empty-string item values; this sentinel maps to the
// "All Statuses" option while statusFilter state stays '' for the query.
const ALL_STATUSES_VALUE = 'all';

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
  const debouncedTypeFilter = useDebouncedValue(typeFilter, 300);

  const ledgerQuery = useAdminBillingLedger({
    limit,
    status: statusFilter || undefined,
    type: debouncedTypeFilter || undefined,
  });

  const data = ledgerQuery.data as { entries: LedgerEntry[]; stats: LedgerStats } | undefined;
  const entries = data?.entries || [];
  const stats = data?.stats || {};

  const columns = useMemo<ColumnDef<LedgerEntry, unknown>[]>(
    () => [
      {
        accessorKey: 'receivedAt',
        header: 'Time',
        cell: info => {
          const entry = info.row.original;
          return (
            <div className='text-muted-foreground whitespace-nowrap'>
              <div>{formatDateTime(entry.receivedAt)}</div>
              {entry.processedAt && (
                <div className='text-muted-foreground/70 text-xs'>
                  Processed: {formatDateTime(entry.processedAt)}
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
              <CopyButton text={entry.stripeEventId!} label='Event ID' />
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
                className='text-primary hover:text-primary/80'
              >
                <code className='font-mono text-xs'>{entry.orgId.slice(0, 8)}...</code>
              </Link>
              <CopyButton text={entry.orgId!} label='Org ID' />
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
                  <CopyButton text={entry.stripeCustomerId!} label='Customer ID' />
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
                  <CopyButton text={entry.stripeSubscriptionId!} label='Subscription ID' />
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
                  <CopyButton text={entry.stripeCheckoutSessionId!} label='Checkout Session ID' />
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
              <CopyButton text={entry.requestId!} label='Request ID' />
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
              <span className='text-destructive text-xs' title={entry.error}>
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
    [],
  );

  return (
    <div className='flex flex-col gap-8'>
      <DashboardHeader
        icon={FilterIcon}
        title='Billing Ledger'
        description='Stripe event ledger entries with filtering and search'
        actions={
          <Button
            type='button'
            variant='outline'
            onClick={() => ledgerQuery.refetch()}
            disabled={ledgerQuery.isFetching}
          >
            {ledgerQuery.isFetching ?
              <LoaderIcon className='size-4 animate-spin' />
            : 'Refresh'}
          </Button>
        }
      />

      {/* Stats Summary */}
      {stats && (
        <div className='grid grid-cols-2 gap-4 md:grid-cols-5'>
          <AdminBox className='p-4'>
            <p className='text-muted-foreground text-sm'>Total</p>
            <p className='text-foreground text-2xl font-bold'>{stats.total || 0}</p>
          </AdminBox>
          {Object.entries(stats.byStatus || {}).map(([status, count]) => (
            <AdminBox key={status} className='p-4'>
              <p className='text-muted-foreground text-sm capitalize'>
                {status.replace(/_/g, ' ')}
              </p>
              <p className='text-foreground text-2xl font-bold'>{count as number}</p>
            </AdminBox>
          ))}
        </div>
      )}

      {/* Filters */}
      <AdminBox>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
          <div>
            <label className='text-secondary-foreground block text-sm font-medium'>Status</label>
            <Select
              value={statusFilter === '' ? ALL_STATUSES_VALUE : statusFilter}
              onValueChange={v => setStatusFilter(v === ALL_STATUSES_VALUE ? '' : v)}
            >
              <SelectTrigger className='mt-1 w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(option => (
                  <SelectItem
                    key={option.value}
                    value={option.value === '' ? ALL_STATUSES_VALUE : option.value}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className='text-secondary-foreground block text-sm font-medium'>
              Event Type
            </label>
            <Input
              type='text'
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              placeholder='e.g., checkout.session.completed'
              className='mt-1 block w-full'
            />
          </div>
          <div>
            <label className='text-secondary-foreground block text-sm font-medium'>Limit</label>
            <Select value={String(limit)} onValueChange={v => setLimit(Number(v))}>
              <SelectTrigger className='mt-1 w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIMIT_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </AdminBox>

      {/* Table */}
      <AdminDataTable
        columns={columns}
        data={entries}
        loading={ledgerQuery.isLoading}
        emptyState='No ledger entries found'
        enableSorting
      />
    </div>
  );
}
