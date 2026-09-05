/** Banner shown on every app page while a subscription payment needs attention. */

import { useState } from 'react';
import { TriangleAlertIcon, CreditCardIcon } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useSubscription } from '@/hooks/useSubscription';
import { redirectToPortal } from '@/api/billing';

export function PaymentIssueBanner() {
  const { status } = useSubscription();
  const [loading, setLoading] = useState(false);

  const isPastDue = status === 'past_due';
  const isIncomplete = status === 'incomplete';
  const isUnpaid = status === 'unpaid';
  const hasIssue = isPastDue || isIncomplete || isUnpaid;

  if (!hasIssue) return null;

  async function handleUpdatePayment() {
    setLoading(true);
    try {
      await redirectToPortal();
    } catch (error) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(error, { toastTitle: 'Portal Error' });
      setLoading(false);
    }
  }

  const title =
    isPastDue ? 'Payment failed'
    : isIncomplete ? 'Payment required'
    : 'Subscription unpaid';

  const message =
    isPastDue ?
      'Your recent payment failed. Please update your payment method to avoid service interruption.'
    : isIncomplete ?
      'Your subscription setup is incomplete. Please complete payment to activate your plan.'
    : 'Your subscription is unpaid. Please update your payment method to restore access.';

  return (
    <div className='px-4 pt-4 sm:px-6'>
      <Alert variant='destructive'>
        <TriangleAlertIcon />
        <div className='flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
            {isPastDue && (
              <AlertDescription className='mt-2 text-xs'>
                Your access will continue until the end of your billing period, but you may lose
                access to premium features if payment is not updated.
              </AlertDescription>
            )}
          </div>
          <Button
            variant='destructive'
            className='shrink-0'
            onClick={handleUpdatePayment}
            disabled={loading}
          >
            {loading ?
              <Spinner size='sm' variant='white' data-icon='inline-start' />
            : <CreditCardIcon data-icon='inline-start' />}
            {loading ? 'Opening...' : 'Update payment method'}
          </Button>
        </div>
      </Alert>
    </div>
  );
}
