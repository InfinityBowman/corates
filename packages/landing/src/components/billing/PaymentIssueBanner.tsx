/**
 * PaymentIssueBanner - Prominent banner for payment issues
 */

import { TriangleAlertIcon, CreditCardIcon, LoaderIcon } from 'lucide-react';

interface PaymentIssueBannerProps {
  status: string;
  onUpdatePayment: () => void;
  loading: boolean;
}

export function PaymentIssueBanner({ status, onUpdatePayment, loading }: PaymentIssueBannerProps) {
  const isPastDue = status === 'past_due';
  const isIncomplete = status === 'incomplete';
  const isUnpaid = status === 'unpaid';
  const hasIssue = isPastDue || isIncomplete || isUnpaid;

  if (!hasIssue) return null;

  const title =
    isPastDue ? 'Payment Failed'
    : isIncomplete ? 'Payment Required'
    : 'Subscription Unpaid';

  const message =
    isPastDue ?
      'Your recent payment failed. Please update your payment method to avoid service interruption.'
    : isIncomplete ?
      'Your subscription setup is incomplete. Please complete payment to activate your plan.'
    : 'Your subscription is unpaid. Please update your payment method to restore access.';

  return (
    <div className='mb-6 overflow-hidden rounded-xl border-2 border-destructive/30 bg-destructive/10 shadow-sm'>
      <div className='flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-start gap-4'>
          <div className='flex size-12 shrink-0 items-center justify-center rounded-full bg-destructive/10'>
            <TriangleAlertIcon className='size-6 text-destructive' />
          </div>
          <div>
            <h3 className='text-lg font-semibold text-destructive'>{title}</h3>
            <p className='mt-1 text-sm text-destructive'>{message}</p>
            {isPastDue && (
              <p className='mt-2 text-xs text-destructive'>
                Your access will continue until the end of your billing period, but you may lose
                access to premium features if payment is not updated.
              </p>
            )}
          </div>
        </div>
        <button
          type='button'
          className='inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
          onClick={onUpdatePayment}
          disabled={loading}
        >
          {loading ?
            <>
              <LoaderIcon className='size-4 animate-spin' />
              Loading...
            </>
          : <>
              <CreditCardIcon className='size-4' />
              Update Payment Method
            </>
          }
        </button>
      </div>
    </div>
  );
}
