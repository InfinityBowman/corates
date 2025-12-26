/**
 * CheckoutForm Component
 * Stripe Elements payment form for subscription checkout
 */

import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { FiLock, FiAlertCircle } from 'solid-icons/fi';
import { getStripe } from '@/lib/stripe.js';
import { createPaymentIntent } from '@/api/billing.js';
import { handleError } from '@/lib/error-utils.js';

export default function CheckoutForm(props) {
  const navigate = useNavigate();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal(null);
  const [stripe, setStripe] = createSignal(null);
  const [elements, setElements] = createSignal(null);
  const [paymentElement, setPaymentElement] = createSignal(null);
  const [clientSecret, setClientSecret] = createSignal(null);

  const tier = () => props.tier;
  const interval = () => props.interval ?? 'monthly';

  // Initialize Stripe and Elements
  onMount(async () => {
    try {
      const stripeInstance = await getStripe();
      if (!stripeInstance) {
        setError('Stripe failed to initialize. Please refresh the page.');
        return;
      }

      setStripe(stripeInstance);

      // Create payment intent
      setLoading(true);
      const { clientSecret: secret } = await createPaymentIntent(tier(), interval());
      setClientSecret(secret);

      // Create Elements instance
      const elementsInstance = stripeInstance.elements({
        clientSecret: secret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#2563eb',
            colorBackground: '#ffffff',
            colorText: '#1f2937',
            colorDanger: '#ef4444',
            fontFamily: 'system-ui, sans-serif',
            spacingUnit: '4px',
            borderRadius: '8px',
          },
        },
      });

      setElements(elementsInstance);

      // Create and mount PaymentElement
      const payment = elementsInstance.create('payment');
      setPaymentElement(payment);
      payment.mount('#payment-element');
    } catch (err) {
      await handleError(err, {
        toastTitle: 'Checkout Error',
      });
      setError(err.message || 'Failed to initialize checkout');
    } finally {
      setLoading(false);
    }
  });

  onCleanup(() => {
    const payment = paymentElement();
    if (payment) {
      payment.unmount();
    }
  });

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const stripeInstance = stripe();
    if (!stripeInstance || !clientSecret()) {
      setError('Payment form not ready. Please refresh the page.');
      setLoading(false);
      return;
    }

    try {
      const { error: submitError } = await stripeInstance.confirmPayment({
        elements: elements(),
        confirmParams: {
          return_url: `${window.location.origin}/billing?success=true`,
        },
        redirect: 'if_required',
      });

      if (submitError) {
        setError(submitError.message || 'Payment failed');
        setLoading(false);
      } else {
        // Payment succeeded, redirect to success page
        navigate('/billing?success=true');
      }
    } catch (err) {
      await handleError(err, {
        toastTitle: 'Payment Error',
      });
      setError(err.message || 'Payment failed');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} class='space-y-6'>
      {/* Payment Element Container */}
      <div class='rounded-lg border border-gray-200 bg-white p-6'>
        <div id='payment-element' class='min-h-[200px]' />
      </div>

      {/* Error Display */}
      <Show when={error()}>
        <div class='flex items-center rounded-lg border border-red-200 bg-red-50 p-4'>
          <FiAlertCircle class='mr-3 h-5 w-5 shrink-0 text-red-500' />
          <p class='text-sm text-red-700'>{error()}</p>
        </div>
      </Show>

      {/* Submit Button */}
      <button
        type='submit'
        disabled={loading() || !stripe() || !clientSecret()}
        class='w-full rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
      >
        <Show
          when={loading()}
          fallback={
            <span class='flex items-center justify-center'>
              <FiLock class='mr-2 h-5 w-5' />
              Subscribe Now
            </span>
          }
        >
          <span class='flex items-center justify-center'>
            <svg class='mr-2 h-5 w-5 animate-spin' fill='none' viewBox='0 0 24 24'>
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
            Processing...
          </span>
        </Show>
      </button>

      {/* Security Notice */}
      <p class='text-center text-xs text-gray-500'>
        <FiLock class='mr-1 inline h-3 w-3' />
        Your payment information is secure and encrypted
      </p>
    </form>
  );
}
