/**
 * Admin Billing Stuck States Page
 * Displays orgs with stuck billing states for monitoring and alerting
 */

import { createSignal, Show, For } from 'solid-js';
import { A } from '@solidjs/router';
import { FiLoader, FiAlertCircle, FiAlertTriangle, FiCheckCircle } from 'solid-icons/fi';
import { useAdminBillingStuckStates } from '@primitives/useAdminQueries.js';

export default function AdminBillingStuckStatesPage() {
  const [incompleteThreshold, setIncompleteThreshold] = createSignal(30);
  const limit = () => 50;

  const stuckStatesQuery = useAdminBillingStuckStates(() => ({
    incompleteThreshold: incompleteThreshold(),
    limit: limit(),
  }));

  const stuckOrgs = () => stuckStatesQuery.data?.stuckOrgs || [];
  const checkedAt = () => stuckStatesQuery.data?.checkedAt;

  const formatDate = timestamp => {
    if (!timestamp) return '-';
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStuckStateTypeLabel = type => {
    switch (type) {
      case 'incomplete_subscription':
        return 'Incomplete Subscription';
      case 'checkout_no_subscription':
        return 'Checkout Without Subscription';
      case 'repeated_failures':
        return 'Repeated Failures';
      case 'past_due_expired':
        return 'Past Due Expired';
      default:
        return type;
    }
  };

  const getStuckStateSeverityIcon = type => {
    if (type === 'checkout_no_subscription') {
      return FiAlertTriangle;
    }
    return FiAlertCircle;
  };

  const getInvestigationSteps = type => {
    switch (type) {
      case 'checkout_no_subscription':
        return [
          'Verify Better Auth Stripe plugin configuration',
          'Check authorizeReference function for this org',
          'Verify referenceId/orgId mapping matches',
          'Check Stripe dashboard for subscription creation',
        ];
      case 'incomplete_subscription':
        return [
          'Check Stripe dashboard for payment failures',
          'Verify customer payment method is valid',
          'Check webhook delivery logs for errors',
        ];
      case 'repeated_failures':
        return [
          'Review recent webhook error messages in ledger',
          'Check for API changes or configuration issues',
          'Verify webhook endpoint is accessible',
        ];
      default:
        return ['Review billing state and recent events'];
    }
  };

  const groupedByType = () => {
    const groups = {};
    for (const org of stuckOrgs()) {
      const type = org.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(org);
    }
    return groups;
  };

  return (
    <div>
      {/* Header */}
      <div class='mb-6 flex items-center justify-between'>
        <div class='flex items-center space-x-3'>
          <div class='flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100'>
            <FiAlertTriangle class='h-6 w-6 text-orange-600' />
          </div>
          <div>
            <h1 class='text-2xl font-bold text-gray-900'>Stuck Billing States</h1>
            <p class='text-sm text-gray-500'>
              Organizations with billing issues requiring attention
            </p>
          </div>
        </div>
        <div class='flex items-center gap-2'>
          <div class='flex items-center space-x-2'>
            <label class='text-sm text-gray-600'>Threshold (min):</label>
            <input
              type='number'
              value={incompleteThreshold()}
              onInput={e => setIncompleteThreshold(parseInt(e.target.value, 10))}
              min='1'
              class='w-20 rounded-md border-gray-300 text-sm'
            />
          </div>
          <button
            onClick={() => stuckStatesQuery.refetch()}
            class='rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
            disabled={stuckStatesQuery.isFetching}
          >
            {stuckStatesQuery.isFetching ?
              <FiLoader class='h-4 w-4 animate-spin' />
            : 'Refresh'}
          </button>
        </div>
      </div>
      {checkedAt() && (
        <p class='mb-6 text-sm text-gray-500'>Last checked: {formatDate(checkedAt())}</p>
      )}

      {/* Summary */}
      <div class='mb-6 rounded-lg border border-gray-200 bg-white p-4'>
        <div class='flex items-center justify-between'>
          <div>
            <p class='text-lg font-semibold text-gray-900'>
              {stuckOrgs().length} Organization{stuckOrgs().length !== 1 ? 's' : ''} with Stuck
              States
            </p>
            <p class='text-sm text-gray-500'>
              Click on an org to view details and run reconciliation
            </p>
          </div>
        </div>
      </div>

      {/* Stuck Orgs by Type */}
      <Show
        when={!stuckStatesQuery.isLoading}
        fallback={
          <div class='flex items-center justify-center py-12'>
            <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
          </div>
        }
      >
        <Show
          when={stuckOrgs().length > 0}
          fallback={
            <div class='rounded-lg border border-gray-200 bg-white p-12 text-center'>
              <FiCheckCircle class='mx-auto mb-4 h-12 w-12 text-green-500' />
              <p class='text-lg font-medium text-gray-900'>No stuck states found</p>
              <p class='text-sm text-gray-500'>All organizations have healthy billing states</p>
            </div>
          }
        >
          <div class='space-y-6'>
            <For each={Object.entries(groupedByType())}>
              {([type, orgs]) => {
                const Icon = getStuckStateSeverityIcon(type);
                const steps = getInvestigationSteps(type);
                return (
                  <div class='rounded-lg border border-gray-200 bg-white'>
                    <div class='border-b border-gray-200 px-6 py-4'>
                      <div class='flex items-center space-x-3'>
                        <Icon class='h-5 w-5 text-orange-600' />
                        <h2 class='text-lg font-semibold text-gray-900'>
                          {getStuckStateTypeLabel(type)}
                        </h2>
                        <span class='rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800'>
                          {orgs.length}
                        </span>
                      </div>
                    </div>
                    <div class='p-6'>
                      <div class='space-y-4'>
                        <For each={orgs}>
                          {org => (
                            <div class='rounded-lg border border-gray-200 p-4'>
                              <div class='flex items-start justify-between'>
                                <div class='flex-1'>
                                  <div class='flex items-center space-x-2'>
                                    <A
                                      href={`/admin/orgs/${org.orgId}`}
                                      class='font-medium text-blue-600 hover:text-blue-800'
                                    >
                                      Org: {org.orgId.slice(0, 8)}...
                                    </A>
                                    {org.ageMinutes && (
                                      <span class='text-sm text-gray-500'>
                                        ({org.ageMinutes} minutes)
                                      </span>
                                    )}
                                  </div>
                                  {org.description && (
                                    <p class='mt-2 text-sm text-gray-600'>{org.description}</p>
                                  )}
                                  {org.subscriptionId && (
                                    <p class='mt-1 text-xs text-gray-500'>
                                      Subscription: {org.subscriptionId}
                                    </p>
                                  )}
                                  {org.stripeSubscriptionId && (
                                    <p class='mt-1 text-xs text-gray-500'>
                                      Stripe: {org.stripeSubscriptionId}
                                    </p>
                                  )}
                                  {org.stripeEventId && (
                                    <p class='mt-1 text-xs text-gray-500'>
                                      Event: {org.stripeEventId}
                                    </p>
                                  )}
                                  {org.failedCount && (
                                    <p class='mt-1 text-xs text-red-600'>
                                      {org.failedCount} webhook failures
                                    </p>
                                  )}
                                </div>
                                <A
                                  href={`/admin/orgs/${org.orgId}`}
                                  class='ml-4 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
                                >
                                  View Details
                                </A>
                              </div>
                              <div class='mt-4 rounded bg-gray-50 p-3'>
                                <p class='mb-2 text-xs font-medium text-gray-700'>
                                  Investigation Steps:
                                </p>
                                <ul class='list-inside list-disc space-y-1 text-xs text-gray-600'>
                                  <For each={steps}>{step => <li>{step}</li>}</For>
                                </ul>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
