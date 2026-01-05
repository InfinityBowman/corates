/**
 * BillingPage Component
 * Dashboard-style billing settings page with subscription, usage, and invoices
 */

import { Show, createSignal } from 'solid-js';
import { useSearchParams, A } from '@solidjs/router';
import { FiArrowLeft, FiCheckCircle, FiArrowRight, FiHelpCircle } from 'solid-icons/fi';
import { useSubscription } from '@/primitives/useSubscription.js';
import { useMembers } from '@/primitives/useMembers.js';
import { redirectToPortal } from '@/api/billing.js';
import SubscriptionCard from './SubscriptionCard.jsx';
import UsageCard from './UsageCard.jsx';
import InvoicesList from './InvoicesList.jsx';
import { LANDING_URL } from '@/config/api.js';

/**
 * Quick action link card
 */
function QuickAction(props) {
  return (
    <A
      href={props.href}
      target={props.target ?? '_self'}
      rel={props.rel ?? 'noopener noreferrer'}
      class='group flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-sm'
    >
      <div class='flex items-center gap-3'>
        <div class='flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-gray-600 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600'>
          {props.icon}
        </div>
        <div>
          <p class='font-medium text-gray-900'>{props.title}</p>
          <p class='text-sm text-gray-500'>{props.description}</p>
        </div>
      </div>
      <FiArrowRight class='h-5 w-5 text-gray-400 transition-colors group-hover:text-blue-600' />
    </A>
  );
}

/**
 * Loading skeleton for subscription card
 */
function SubscriptionSkeleton() {
  return (
    <div class='animate-pulse overflow-hidden rounded-xl border border-gray-200 bg-white'>
      <div class='h-28 bg-linear-to-r from-gray-200 to-gray-300' />
      <div class='p-6'>
        <div class='mb-4 space-y-3'>
          <div class='h-4 w-1/2 rounded bg-gray-200' />
          <div class='h-4 w-1/3 rounded bg-gray-200' />
        </div>
        <div class='flex gap-3'>
          <div class='h-10 flex-1 rounded-lg bg-gray-200' />
          <div class='h-10 w-28 rounded-lg bg-gray-200' />
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for usage card
 */
function UsageSkeleton() {
  return (
    <div class='animate-pulse rounded-xl border border-gray-200 bg-white p-6'>
      <div class='mb-5 h-6 w-20 rounded bg-gray-200' />
      <div class='space-y-5'>
        <div class='space-y-2'>
          <div class='flex justify-between'>
            <div class='h-4 w-24 rounded bg-gray-200' />
            <div class='h-4 w-12 rounded bg-gray-200' />
          </div>
          <div class='h-2 w-full rounded-full bg-gray-200' />
        </div>
        <div class='space-y-2'>
          <div class='flex justify-between'>
            <div class='h-4 w-28 rounded bg-gray-200' />
            <div class='h-4 w-12 rounded bg-gray-200' />
          </div>
          <div class='h-2 w-full rounded-full bg-gray-200' />
        </div>
      </div>
    </div>
  );
}

/**
 * Billing Page component - Dashboard layout
 * @returns {JSX.Element} - The BillingPage component
 */
export default function BillingPage() {
  const [searchParams] = useSearchParams();
  const { subscription, loading, refetch, quotas } = useSubscription();
  const { memberCount } = useMembers();
  const [portalLoading, setPortalLoading] = createSignal(false);

  // Check for success/canceled query params from Stripe redirect
  const checkoutSuccess = () => searchParams.success === 'true';

  // Refetch subscription on successful checkout
  if (checkoutSuccess()) {
    refetch();
  }

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      await redirectToPortal();
    } catch (error) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(error, {
        toastTitle: 'Portal Error',
      });
      setPortalLoading(false);
    }
  };

  // Mock usage data - in production this would come from the subscription or a separate API
  const usage = () => ({
    projects: subscription()?.projectCount ?? 0,
    collaborators: memberCount(),
  });

  return (
    <div class='min-h-full bg-blue-50 py-6'>
      <div class='mx-auto max-w-6xl px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div class='mb-8'>
          <A
            href='/settings'
            class='mb-4 inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700'
          >
            <FiArrowLeft class='mr-1 h-4 w-4' />
            Back to Settings
          </A>
          <div class='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h1 class='text-3xl font-bold text-gray-900'>Billing</h1>
              <p class='mt-1 text-gray-500'>
                Manage your subscription, view usage, and download invoices.
              </p>
            </div>
            <A
              href='/settings/billing/plans'
              class='inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow'
            >
              View All Plans
              <FiArrowRight class='h-4 w-4' />
            </A>
          </div>
        </div>

        {/* Success alert */}
        <Show when={checkoutSuccess()}>
          <div class='mb-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4'>
            <div class='flex h-10 w-10 items-center justify-center rounded-full bg-green-100'>
              <FiCheckCircle class='h-5 w-5 text-green-600' />
            </div>
            <div>
              <p class='font-semibold text-green-800'>Payment successful!</p>
              <p class='text-sm text-green-600'>
                Your subscription has been activated. Welcome aboard!
              </p>
            </div>
          </div>
        </Show>

        {/* Main content - two column layout */}
        <div class='grid gap-6 lg:grid-cols-3'>
          {/* Left column - Subscription & Usage */}
          <div class='space-y-6 lg:col-span-2'>
            {/* Subscription Card */}
            <Show when={!loading()} fallback={<SubscriptionSkeleton />}>
              <SubscriptionCard
                subscription={subscription()}
                onManage={handleManageSubscription}
                manageLoading={portalLoading()}
              />
            </Show>

            {/* Invoices */}
            <InvoicesList />
          </div>

          {/* Right column - Usage & Quick Actions */}
          <div class='space-y-6'>
            {/* Usage Card */}
            <Show when={!loading()} fallback={<UsageSkeleton />}>
              <UsageCard quotas={quotas()} usage={usage()} />
            </Show>

            {/* Quick Actions */}
            <div class='space-y-3'>
              <h3 class='text-sm font-semibold text-gray-900'>Quick Actions</h3>
              <QuickAction
                href='/settings/billing/plans'
                icon={<FiArrowRight class='h-5 w-5' />}
                title='Compare Plans'
                description='See all available plans'
              />
              <QuickAction
                href={`${LANDING_URL}/contact`}
                target='_blank'
                rel='noopener noreferrer'
                icon={<FiHelpCircle class='h-5 w-5' />}
                title='Get Help'
                description='Contact support'
              />
            </div>

            {/* Help text */}
            <div class='rounded-lg border border-gray-200 bg-white p-4'>
              <p class='text-sm text-gray-600'>
                Need help with billing?{' '}
                <a
                  href={`${LANDING_URL}/contact`}
                  target='_blank'
                  rel='noopener noreferrer'
                  class='font-medium text-blue-600 hover:text-blue-700'
                >
                  Contact support
                </a>{' '}
                and we'll get back to you within 24 hours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
