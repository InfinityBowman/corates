import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoicesList } from '../InvoicesList';

const { getInvoices } = vi.hoisted(() => ({ getInvoices: vi.fn() }));
vi.mock('@/server/functions/billing.functions', () => ({ getInvoices }));

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InvoicesList />
    </QueryClientProvider>,
  );
}

describe('InvoicesList', () => {
  it('renders Stripe unix-second timestamps as the invoice date', async () => {
    getInvoices.mockResolvedValue({
      invoices: [
        {
          id: 'in_1',
          number: 'ABC-0001',
          amount: 8,
          currency: 'usd',
          status: 'paid',
          created: 1781438400, // 2026-06-14T12:00:00Z
          periodStart: 1781438400,
          periodEnd: 1784030400,
          pdfUrl: null,
          hostedUrl: null,
        },
      ],
    });

    renderList();

    expect(await screen.findByText('Invoice ABC-0001')).toBeInTheDocument();
    expect(screen.getByText('Jun 14, 2026')).toBeInTheDocument();
    expect(screen.queryByText(/1970/)).not.toBeInTheDocument();
  });
});
