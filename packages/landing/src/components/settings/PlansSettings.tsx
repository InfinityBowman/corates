/**
 * PlansSettings - Plan comparison page with FAQ
 */

import { useState, useEffect, useCallback } from 'react';
import { ChevronDownIcon, LoaderIcon, AlertCircleIcon, RefreshCwIcon } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useSubscription } from '@/hooks/useSubscription';
import { PricingTable } from '@/components/billing/PricingTable';
import {
  hasPendingPlan,
  clearPendingPlan,
  handlePendingPlanRedirect,
  BILLING_MESSAGES,
} from '@/lib/plan-redirect-utils.js';

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-border last:border-b-0 border-b">
      <button
        type="button"
        className="flex w-full items-center justify-between py-5 text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-foreground text-base font-medium">{question}</span>
        <ChevronDownIcon
          className={`text-muted-foreground h-5 w-5 shrink-0 transition-transform duration-300 ease-out ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <p className="text-muted-foreground pb-5">{answer}</p>
        </div>
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

export function PlansSettings() {
  const { subscription, refetch } = useSubscription();
  const tier = subscription?.tier;
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<'checking' | 'redirecting' | 'error' | 'ready'>(
    () => (hasPendingPlan() ? 'checking' : 'ready'),
  );

  const processPendingPlan = useCallback(async () => {
    setPageState('redirecting');
    const { handled, error } = await handlePendingPlanRedirect({ navigate, refetch });
    if (!handled) {
      setPageState('ready');
      return;
    }
    if (error) setPageState('error');
  }, [navigate, refetch]);

  useEffect(() => {
    if (hasPendingPlan()) processPendingPlan(); // eslint-disable-line react-hooks/set-state-in-effect
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (pageState === 'error') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <AlertCircleIcon className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="text-foreground mt-4 text-xl font-semibold">
          {BILLING_MESSAGES.CHECKOUT_ERROR.title}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-md text-center">
          {BILLING_MESSAGES.CHECKOUT_ERROR.message}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={processPendingPlan}
            className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition"
          >
            <RefreshCwIcon className="h-4 w-4" />
            Try Again
          </button>
          <button
            type="button"
            onClick={() => {
              clearPendingPlan();
              setPageState('ready');
            }}
            className="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-4 py-2.5 text-sm font-semibold transition"
          >
            Choose a Plan
          </button>
        </div>
      </div>
    );
  }

  if (pageState !== 'ready') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <LoaderIcon className="text-primary h-8 w-8 animate-spin" />
        <p className="text-foreground mt-4 text-lg font-medium">Redirecting to checkout...</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Please wait while we prepare your order.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-muted/50 py-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-foreground text-4xl font-bold">
            Choose the right plan for your team
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
            Start with a free trial, then pick the plan that fits your workflow. All plans include
            our core features.
          </p>
        </div>

        <PricingTable currentTier={tier} />

        {/* FAQ */}
        <div className="mt-16">
          <div className="mb-8 text-center">
            <h2 className="text-foreground text-2xl font-bold">Frequently asked questions</h2>
            <p className="text-muted-foreground mt-2">
              Everything you need to know about our plans and billing.
            </p>
          </div>
          <div className="border-border bg-card mx-auto max-w-3xl rounded-2xl border px-6">
            {FAQ_ITEMS.map((faq, i) => (
              <FAQItem key={i} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="from-primary to-primary/90 mt-16 rounded-2xl bg-gradient-to-r px-8 py-12 text-center">
          <h2 className="text-2xl font-bold text-white">Still have questions?</h2>
          <p className="mx-auto mt-2 max-w-xl text-blue-100">
            Our team is here to help. Reach out and we&apos;ll get back to you within 24 hours.
          </p>
          <a
            href="/contact"
            className="bg-card text-primary mt-6 inline-flex items-center rounded-xl px-6 py-3 font-semibold shadow-lg transition-all hover:shadow-xl"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
