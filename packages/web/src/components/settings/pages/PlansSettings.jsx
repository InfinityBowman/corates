/**
 * PlansSettings Component
 * Premium plan comparison page with FAQ and trust signals
 * Adapted from BillingPlansPage for the settings sidebar layout
 */

import { For, Show, createSignal, onMount } from 'solid-js';
import { FiChevronDown, FiLoader, FiAlertCircle, FiRefreshCw } from 'solid-icons/fi';
import { useNavigate } from '@solidjs/router';
import { useSubscription } from '@/primitives/useSubscription.js';
import PricingTable from '@/components/billing/PricingTable.jsx';
import { LANDING_URL } from '@/config/api.js';
import {
  hasPendingPlan,
  clearPendingPlan,
  handlePendingPlanRedirect,
  BILLING_MESSAGES,
} from '@/lib/plan-redirect-utils.js';

/**
 * FAQ Accordion item
 */
function FAQItem(props) {
  const [isOpen, setIsOpen] = createSignal(false);

  return (
    <div class='border-b border-slate-200 last:border-b-0'>
      <button
        type='button'
        class='flex w-full items-center justify-between py-5 text-left'
        onClick={() => setIsOpen(!isOpen())}
      >
        <span class='text-base font-medium text-slate-900'>{props.question}</span>
        <FiChevronDown
          class={`h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 ${isOpen() ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        class={`overflow-hidden transition-all duration-200 ${isOpen() ? 'max-h-96 pb-5' : 'max-h-0'}`}
      >
        <p class='text-slate-600'>{props.answer}</p>
      </div>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    question: 'Can I switch plans at any time?',
    answer:
      "Yes! You can upgrade or downgrade your plan at any time. When you upgrade, you'll be charged a prorated amount for the remainder of your billing cycle. When you downgrade, your new plan will take effect at the start of your next billing cycle.",
  },
  {
    question: 'What happens when my trial ends?',
    answer:
      "When your 14-day trial ends, you'll be automatically moved to the Free plan unless you've subscribed to a paid plan. Don't worry - your data will be saved, but you'll lose access to collaborative features until you upgrade.",
  },
  {
    question: 'Can I cancel my subscription?',
    answer:
      "Absolutely. You can cancel your subscription at any time from your billing settings. Your access will continue until the end of your current billing period, and you won't be charged again.",
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe. All payments are encrypted and secure.',
  },
  {
    question: 'Is there a discount for annual billing?',
    answer:
      "Yes! When you choose annual billing, you get 2 months free compared to monthly billing. That's a savings of up to 17% depending on your plan.",
  },
  {
    question: "What's the Single Project option?",
    answer:
      "The Single Project option is perfect if you have a one-time systematic review. It's a one-time payment that gives you 6 months of access for a single project with up to 3 collaborators. No recurring charges.",
  },
];

/**
 * Plans Settings component
 */
export default function PlansSettings() {
  const { tier, refetch } = useSubscription();
  const navigate = useNavigate();

  // State: 'checking' (initial), 'redirecting' (processing plan), 'error' (failed), 'ready' (show pricing)
  const [pageState, setPageState] = createSignal(hasPendingPlan() ? 'checking' : 'ready');

  // Process pending plan redirect
  async function processPendingPlan() {
    setPageState('redirecting');

    const { handled, error } = await handlePendingPlanRedirect({ navigate, refetch });

    if (!handled) {
      // No pending plan - show pricing
      setPageState('ready');
      return;
    }

    if (error) {
      // Redirect failed - show error state with retry option
      setPageState('error');
    }
    // If handled without error, the page will navigate/unload
  }

  // Handle pending plan params from landing page (for logged-in users)
  onMount(() => {
    if (hasPendingPlan()) {
      processPendingPlan();
    }
  });

  // Retry handler for error state
  function handleRetry() {
    processPendingPlan();
  }

  // Dismiss error and show pricing table
  function handleDismissError() {
    clearPendingPlan();
    setPageState('ready');
  }

  return (
    <Show
      when={pageState() === 'ready'}
      fallback={
        <Show
          when={pageState() === 'error'}
          fallback={
            <div class='flex min-h-[60vh] flex-col items-center justify-center'>
              <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
              <p class='mt-4 text-lg font-medium text-slate-700'>Redirecting to checkout...</p>
              <p class='mt-1 text-sm text-slate-500'>Please wait while we prepare your order.</p>
            </div>
          }
        >
          {/* Error state with retry */}
          <div class='flex min-h-[60vh] flex-col items-center justify-center px-4'>
            <div class='flex h-16 w-16 items-center justify-center rounded-full bg-red-100'>
              <FiAlertCircle class='h-8 w-8 text-red-600' />
            </div>
            <h2 class='mt-4 text-xl font-semibold text-slate-900'>
              {BILLING_MESSAGES.CHECKOUT_ERROR.title}
            </h2>
            <p class='mt-2 max-w-md text-center text-slate-600'>
              {BILLING_MESSAGES.CHECKOUT_ERROR.message}
            </p>
            <div class='mt-6 flex gap-3'>
              <button
                type='button'
                onClick={handleRetry}
                class='inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700'
              >
                <FiRefreshCw class='h-4 w-4' />
                Try Again
              </button>
              <button
                type='button'
                onClick={handleDismissError}
                class='rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50'
              >
                Choose a Plan
              </button>
            </div>
          </div>
        </Show>
      }
    >
      <div class='min-h-full bg-slate-50 py-6'>
        <div class='mx-auto max-w-6xl px-4 sm:px-6 lg:px-8'>
          {/* Header */}
          <div class='mb-8'>
            <div class='text-center'>
              <h1 class='text-4xl font-bold text-slate-900'>Choose the right plan for your team</h1>
              <p class='mx-auto mt-4 max-w-2xl text-lg text-slate-500'>
                Start with a free trial, then pick the plan that fits your workflow. All plans
                include our core features.
              </p>
            </div>
          </div>

          {/* Plan Comparison Table */}
          <PricingTable currentTier={tier()} />

          {/* FAQ Section */}
          <div class='mt-16'>
            <div class='mb-8 text-center'>
              <h2 class='text-2xl font-bold text-slate-900'>Frequently asked questions</h2>
              <p class='mt-2 text-slate-500'>
                Everything you need to know about our plans and billing.
              </p>
            </div>
            <div class='mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white px-6'>
              <For each={FAQ_ITEMS}>
                {faq => <FAQItem question={faq.question} answer={faq.answer} />}
              </For>
            </div>
          </div>

          {/* Bottom CTA */}
          <div class='mt-16 rounded-2xl bg-linear-to-r from-blue-600 to-blue-500 px-8 py-12 text-center'>
            <h2 class='text-2xl font-bold text-white'>Still have questions?</h2>
            <p class='mx-auto mt-2 max-w-xl text-blue-100'>
              Our team is here to help. Reach out and we'll get back to you within 24 hours.
            </p>
            <a
              href={`${LANDING_URL}/contact`}
              target='_blank'
              rel='noopener noreferrer'
              class='mt-6 inline-flex items-center rounded-xl bg-white px-6 py-3 font-semibold text-blue-600 shadow-lg transition-all hover:bg-blue-50 hover:shadow-xl'
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </Show>
  );
}
