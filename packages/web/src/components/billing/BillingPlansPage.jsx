/**
 * BillingPlansPage Component
 * Premium plan comparison page with FAQ and trust signals
 */

import { For, createSignal } from 'solid-js';
import { FiArrowLeft, FiShield, FiClock, FiHelpCircle, FiChevronDown } from 'solid-icons/fi';
import { A } from '@solidjs/router';
import { useSubscription } from '@/primitives/useSubscription.js';
import PricingTable from './PricingTable.jsx';
import { LANDING_URL } from '@/config/api.js';

/**
 * FAQ Accordion item
 */
function FAQItem(props) {
  const [isOpen, setIsOpen] = createSignal(false);

  return (
    <div class='border-b border-gray-200 last:border-b-0'>
      <button
        type='button'
        class='flex w-full items-center justify-between py-5 text-left'
        onClick={() => setIsOpen(!isOpen())}
      >
        <span class='text-base font-medium text-gray-900'>{props.question}</span>
        <FiChevronDown
          class={`h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200 ${isOpen() ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        class={`overflow-hidden transition-all duration-200 ${isOpen() ? 'max-h-96 pb-5' : 'max-h-0'}`}
      >
        <p class='text-gray-600'>{props.answer}</p>
      </div>
    </div>
  );
}

/**
 * Trust signal badge
 */
function TrustBadge(props) {
  return (
    <div class='flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3'>
      <div class='flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm'>
        {props.icon}
      </div>
      <div>
        <p class='font-medium text-gray-900'>{props.title}</p>
        <p class='text-sm text-gray-500'>{props.subtitle}</p>
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
 * Billing Plans Page component
 * @returns {JSX.Element} - The BillingPlansPage component
 */
export default function BillingPlansPage() {
  const { tier } = useSubscription();

  return (
    <div class='min-h-full bg-gray-50 py-6'>
      <div class='mx-auto max-w-6xl px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div class='mb-8'>
          <A
            href='/settings/billing'
            class='mb-4 inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700'
          >
            <FiArrowLeft class='mr-1 h-4 w-4' />
            Back to Billing
          </A>
          <div class='text-center'>
            <h1 class='text-4xl font-bold text-gray-900'>Choose the right plan for your team</h1>
            <p class='mx-auto mt-4 max-w-2xl text-lg text-gray-500'>
              Start with a free trial, then pick the plan that fits your workflow. All plans include
              our core features.
            </p>
          </div>
        </div>

        {/* Trust signals */}
        <div class='mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3'>
          <TrustBadge
            icon={<FiShield class='h-5 w-5 text-green-600' />}
            title='Secure payments'
            subtitle='Powered by Stripe'
          />
          <TrustBadge
            icon={<FiClock class='h-5 w-5 text-blue-600' />}
            title='14-day free trial'
            subtitle='No credit card required'
          />
          <TrustBadge
            icon={<FiHelpCircle class='h-5 w-5 text-gray-600' />}
            title='Cancel anytime'
            subtitle='No questions asked'
          />
        </div>

        {/* Plan Comparison Table */}
        <PricingTable currentTier={tier()} />

        {/* FAQ Section */}
        <div class='mt-16'>
          <div class='mb-8 text-center'>
            <h2 class='text-2xl font-bold text-gray-900'>Frequently asked questions</h2>
            <p class='mt-2 text-gray-500'>
              Everything you need to know about our plans and billing.
            </p>
          </div>
          <div class='mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white px-6'>
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
  );
}
