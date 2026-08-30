/** The Invoices section of the billing page. */

import { useQuery } from '@tanstack/react-query';
import { DownloadIcon, ExternalLinkIcon, FileTextIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/queryKeys';
import { getInvoices } from '@/server/functions/billing.functions';
import type { Invoice, InvoicesResponse } from '@/server/functions/billing.server';
import { SettingsSection, SettingsRow } from '@/components/settings/primitives';

async function fetchInvoices(): Promise<InvoicesResponse> {
  try {
    return await getInvoices();
  } catch (err) {
    console.warn('Failed to fetch invoices:', (err as Error).message);
    return { invoices: [] };
  }
}

function formatDate(timestamp: string | number | null) {
  if (!timestamp) return null;
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

const STATUS_VARIANTS: Record<string, 'success' | 'info' | 'secondary' | 'destructive'> = {
  paid: 'success',
  open: 'info',
  draft: 'secondary',
  uncollectible: 'destructive',
  void: 'secondary',
};

const STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  open: 'Open',
  draft: 'Draft',
  uncollectible: 'Failed',
  void: 'Void',
};

export function InvoicesList() {
  const { data, isFetching } = useQuery({
    queryKey: queryKeys.billing.invoices,
    queryFn: fetchInvoices,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  const invoices = data?.invoices ?? [];

  return (
    <SettingsSection title='Invoices' icon={FileTextIcon}>
      {isFetching ?
        [1, 2, 3].map(i => (
          <div key={i} className='flex items-center justify-between gap-4 px-4 py-3.5'>
            <div className='flex flex-col gap-2'>
              <Skeleton className='h-3.5 w-36' />
              <Skeleton className='h-3 w-24' />
            </div>
            <Skeleton className='h-5 w-20' />
          </div>
        ))
      : invoices.length > 0 ?
        invoices.map((invoice: Invoice) => (
          <SettingsRow
            key={invoice.id}
            label={`Invoice ${invoice.number || invoice.id}`}
            description={formatDate(invoice.created)}
          >
            <span className='text-foreground text-sm tabular-nums'>
              {formatAmount(invoice.amount)}
            </span>
            <Badge variant={STATUS_VARIANTS[invoice.status ?? ''] || 'success'}>
              {STATUS_LABELS[invoice.status ?? ''] || 'Paid'}
            </Badge>
            {invoice.pdfUrl && (
              <Button
                variant='ghost'
                size='icon-sm'
                className='text-muted-foreground'
                onClick={() => window.open(invoice.pdfUrl!, '_blank')}
                aria-label='Download invoice'
              >
                <DownloadIcon className='size-4' />
              </Button>
            )}
            {invoice.hostedUrl && (
              <a
                href={invoice.hostedUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1.5 transition-colors'
                aria-label='View invoice'
              >
                <ExternalLinkIcon className='size-4' />
              </a>
            )}
          </SettingsRow>
        ))
      : <p className='text-muted-foreground px-4 py-6 text-center text-[13px]'>
          Invoices appear here once you have a paid subscription.
        </p>
      }
    </SettingsSection>
  );
}
