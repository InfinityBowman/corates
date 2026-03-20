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
    <div className='border-destructive/30 bg-destructive/10 mb-6 overflow-hidden rounded-xl border-2 shadow-sm'>
      <div className='flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-start gap-4'>
          <div className='bg-destructive/10 flex size-12 shrink-0 items-center justify-center rounded-full'>
            <TriangleAlertIcon className='text-destructive size-6' />
          </div>
          <div>
            <h3 className='text-destructive text-lg font-semibold'>{title}</h3>
            <p className='text-destructive mt-1 text-sm'>{message}</p>
            {isPastDue && (
              <p className='text-destructive mt-2 text-xs'>
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
