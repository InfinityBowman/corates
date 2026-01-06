/**
 * PaymentIssueBanner Component
 * Prominent banner for payment issues (past_due, incomplete, unpaid)
 */

import { Show } from 'solid-js';
import { FiAlertTriangle, FiCreditCard } from 'solid-icons/fi';

/**
 * Payment issue banner for subscription problems
 * @param {Object} props
 * @param {string} props.status - Subscription status
 * @param {Function} props.onUpdatePayment - Handler to open Stripe portal
 * @param {boolean} props.loading - Loading state for the button
 */
export default function PaymentIssueBanner(props) {
  const isPastDue = () => props.status === 'past_due';
  const isIncomplete = () => props.status === 'incomplete';
  const isUnpaid = () => props.status === 'unpaid';

  const hasPaymentIssue = () => isPastDue() || isIncomplete() || isUnpaid();

  const getTitle = () => {
    if (isPastDue()) return 'Payment Failed';
    if (isIncomplete()) return 'Payment Required';
    if (isUnpaid()) return 'Subscription Unpaid';
    return 'Payment Issue';
  };

  const getMessage = () => {
    if (isPastDue()) {
      return 'Your recent payment failed. Please update your payment method to avoid service interruption.';
    }
    if (isIncomplete()) {
      return 'Your subscription setup is incomplete. Please complete payment to activate your plan.';
    }
    if (isUnpaid()) {
      return 'Your subscription is unpaid. Please update your payment method to restore access.';
    }
    return 'There is an issue with your payment.';
  };

  return (
    <Show when={hasPaymentIssue()}>
      <div class='mb-6 overflow-hidden rounded-xl border-2 border-red-300 bg-red-50 shadow-sm'>
        <div class='flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between'>
          <div class='flex items-start gap-4'>
            <div class='flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100'>
              <FiAlertTriangle class='h-6 w-6 text-red-600' />
            </div>
            <div>
              <h3 class='text-lg font-semibold text-red-800'>{getTitle()}</h3>
              <p class='mt-1 text-sm text-red-700'>{getMessage()}</p>
              <Show when={isPastDue()}>
                <p class='mt-2 text-xs text-red-600'>
                  Your access will continue until the end of your billing period, but you may lose
                  access to premium features if payment is not updated.
                </p>
              </Show>
            </div>
          </div>
          <button
            type='button'
            class='inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
            onClick={() => props.onUpdatePayment?.()}
            disabled={props.loading}
          >
            <Show
              when={!props.loading}
              fallback={
                <>
                  <svg class='h-4 w-4 animate-spin' fill='none' viewBox='0 0 24 24'>
                    <circle
                      class='opacity-25'
                      cx='12'
                      cy='12'
                      r='10'
                      stroke='currentColor'
                      stroke-width='4'
                    />
                    <path
                      class='opacity-75'
                      fill='currentColor'
                      d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                    />
                  </svg>
                  Loading...
                </>
              }
            >
              <FiCreditCard class='h-4 w-4' />
              Update Payment Method
            </Show>
          </button>
        </div>
      </div>
    </Show>
  );
}
