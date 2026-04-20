/**
 * InvoicesList - Invoices with status badges and empty state
 */

import { useQuery } from '@tanstack/react-query';
import { DownloadIcon, FileTextIcon, ExternalLinkIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { API_BASE } from '@/config/api';
import { queryKeys } from '@/lib/queryKeys';
import type { Invoice, InvoicesResponse } from '@/routes/api/billing/invoices';

async function fetchInvoices(): Promise<InvoicesResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/billing/invoices`, { credentials: 'include' });
    if (!res.ok) return { invoices: [] };
    return (await res.json()) as InvoicesResponse;
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
    <Card>
      <CardHeader className='border-b'>
        <CardTitle className='flex items-center gap-2'>
          <FileTextIcon className='text-muted-foreground size-5' />
          Invoices
        </CardTitle>
      </CardHeader>

      <CardContent className='p-0'>
        {isFetching ?
          <div className='divide-border divide-y'>
            {[1, 2, 3].map(i => (
              <div key={i} className='flex items-center justify-between px-6 py-4'>
                <div className='flex items-center gap-4'>
                  <Skeleton className='size-10 rounded-lg' />
                  <div className='flex flex-col gap-2'>
                    <Skeleton className='h-4 w-32' />
                    <Skeleton className='h-3 w-24' />
                  </div>
                </div>
                <div className='flex items-center gap-4'>
                  <Skeleton className='h-4 w-16' />
                  <Skeleton className='h-6 w-14 rounded-full' />
                </div>
              </div>
            ))}
          </div>
        : invoices.length > 0 ?
          <div className='divide-border divide-y'>
            {invoices.map((invoice: Invoice) => (
              <div
                key={invoice.id}
                className='hover:bg-muted/50 flex items-center justify-between px-6 py-4 transition-colors'
              >
                <div className='flex items-center gap-4'>
                  <div className='bg-muted flex size-10 items-center justify-center rounded-lg'>
                    <FileTextIcon className='text-muted-foreground size-5' />
                  </div>
                  <div>
                    <p className='text-foreground font-medium'>
                      {`Invoice #${invoice.number || invoice.id}`}
                    </p>
                    <p className='text-muted-foreground text-sm'>{formatDate(invoice.created)}</p>
                  </div>
                </div>
                <div className='flex items-center gap-4'>
                  <span className='text-foreground text-sm font-semibold'>
                    {formatAmount(invoice.amount)}
                  </span>
                  <Badge variant={STATUS_VARIANTS[invoice.status ?? ''] || 'success'}>
                    {STATUS_LABELS[invoice.status ?? ''] || 'Paid'}
                  </Badge>
                  {invoice.pdfUrl && (
                    <button
                      type='button'
                      className='text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-2 transition-colors'
                      onClick={() => window.open(invoice.pdfUrl!, '_blank')}
                      title='Download invoice'
                    >
                      <DownloadIcon className='size-4' />
                    </button>
                  )}
                  {invoice.hostedUrl && (
                    <a
                      href={invoice.hostedUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-2 transition-colors'
                      title='View invoice'
                    >
                      <ExternalLinkIcon className='size-4' />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        : <div className='px-6 py-12 text-center'>
            <div className='bg-muted mx-auto mb-4 flex size-14 items-center justify-center rounded-full'>
              <FileTextIcon className='text-muted-foreground size-7' />
            </div>
            <h3 className='text-foreground text-sm font-medium'>No invoices yet</h3>
            <p className='text-muted-foreground mt-1 text-sm'>
              Invoices will appear here once you have an active subscription.
            </p>
          </div>
        }
      </CardContent>
    </Card>
  );
}
