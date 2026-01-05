/**
 * BillingPlansPage Component
 * Plan comparison page with table layout and monthly/annual toggle
 */

import { FiArrowLeft } from 'solid-icons/fi';
import { A } from '@solidjs/router';
import { useSubscription } from '@/primitives/useSubscription.js';
import PricingTable from './PricingTable.jsx';

/**
 * Billing Plans Page component
 * Shows all plans and their details
 * @returns {JSX.Element} - The BillingPlansPage component
 */
export default function BillingPlansPage() {
  const { tier } = useSubscription();

  return (
    <div class='mx-auto max-w-6xl p-6'>
      {/* Header */}
      <div class='mb-8'>
        <A
          href='/settings/billing'
          class='mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700'
        >
          <FiArrowLeft class='mr-1 h-4 w-4' />
          Back to Billing
        </A>
        <h1 class='text-3xl font-bold text-gray-900'>Plans</h1>
        <p class='mt-2 text-sm text-gray-600'>Choose the plan that's right for you</p>
      </div>

      {/* Plan Comparison Table */}
      <PricingTable currentTier={tier()} />
    </div>
  );
}
