import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoicesList } from '../InvoicesList';

const { getInvoices } = vi.hoisted(() => ({ getInvoices: vi.fn() }));
vi.mock('@/server/functions/billing.functions', () => ({ getInvoices }));
vi.mock('@/hooks/useWorkspaces', () => ({
  useOwnedWorkspace: () => ({
    workspace: { id: 'org-1', name: 'Lab', role: 'owner' },
    isLoading: false,
  }),
}));

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InvoicesList />
    </QueryClientProvider>,
  );
}

// Local noon on 2026-06-14, so the displayed local date is the same in every timezone
const JUNE_14_2026 = new Date(2026, 5, 14, 12).getTime() / 1000;

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
          created: JUNE_14_2026,
          periodStart: JUNE_14_2026,
          periodEnd: JUNE_14_2026 + 30 * 86400,
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
