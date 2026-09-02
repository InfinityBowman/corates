/** Banner shown while a subscription payment needs attention. */

import { TriangleAlertIcon, CreditCardIcon } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

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
    isPastDue ? 'Payment failed'
    : isIncomplete ? 'Payment required'
    : 'Subscription unpaid';

  const message =
    isPastDue ?
      'Your most recent payment did not go through. Update your payment method to keep your plan active.'
    : isIncomplete ?
      'Your subscription setup was not finished. Complete the payment to activate your plan.'
    : 'Your subscription is unpaid. Update your payment method to restore your plan.';

  return (
    <Alert variant='destructive'>
      <TriangleAlertIcon />
      <div className='flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
          {isPastDue && (
            <AlertDescription className='mt-2 text-xs'>
              Your plan stays active until the end of the current billing period. Nothing is deleted
              if it lapses, but creating and editing projects pauses until payment goes through.
            </AlertDescription>
          )}
        </div>
        <Button
          variant='destructive'
          className='shrink-0'
          onClick={onUpdatePayment}
          disabled={loading}
        >
          {loading ?
            <Spinner size='sm' variant='white' data-icon='inline-start' />
          : <CreditCardIcon data-icon='inline-start' />}
          {loading ? 'Opening...' : 'Update payment method'}
        </Button>
      </div>
    </Alert>
  );
}
