/**
 * PlanFAQ - Shared FAQ section for pricing/plans pages
 */

import { useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';

interface FAQItemData {
  question: string;
  answer: string;
}

const FAQ_ITEMS_BASE: FAQItemData[] = [
  {
    question: 'Can I switch plans at any time?',
    answer:
      "Yes! You can upgrade or downgrade your plan at any time. When you upgrade, you'll be charged a prorated amount for the remainder of your billing cycle. When you downgrade, your new plan will take effect at the start of your next billing cycle.",
  },
  {
    question: 'What happens when my trial ends?',
    answer: '', // filled per-context below
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

const TRIAL_ANSWER_MARKETING =
  "When your 14-day trial ends, you'll need to subscribe to a paid plan to continue using collaborative features. Don't worry - your data will be saved, and you can subscribe at any time to regain access.";

const TRIAL_ANSWER_SETTINGS =
  "When your 14-day trial ends, you'll be automatically moved to the Free plan unless you've subscribed to a paid plan. Don't worry - your data will be saved, but you'll lose access to collaborative features until you upgrade.";

function getFaqItems(context: 'marketing' | 'settings'): FAQItemData[] {
  return FAQ_ITEMS_BASE.map(item => {
    if (item.question === 'What happens when my trial ends?') {
      return {
        ...item,
        answer: context === 'marketing' ? TRIAL_ANSWER_MARKETING : TRIAL_ANSWER_SETTINGS,
      };
    }
    return item;
  });
}

export function getFaqItemsForSchema() {
  return getFaqItems('marketing');
}

function FAQItem({ question, answer }: FAQItemData) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className='border-border border-b last:border-b-0'>
      <button
        type='button'
        className='flex w-full items-center justify-between py-5 text-left'
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className='text-foreground text-base font-medium'>{question}</span>
        <ChevronDownIcon
          className={`text-muted-foreground size-5 shrink-0 transition-transform duration-300 ease-out ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className='grid transition-[grid-template-rows] duration-300 ease-out'
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className='overflow-hidden'>
          <p className='text-muted-foreground pb-5'>{answer}</p>
        </div>
      </div>
    </div>
  );
}

interface PlanFAQProps {
  context?: 'marketing' | 'settings';
}

export function PlanFAQ({ context = 'settings' }: PlanFAQProps) {
  const items = getFaqItems(context);

  return (
    <div className='mt-16'>
      <div className='mb-8 text-center'>
        <h2 className='text-foreground text-2xl font-bold'>Frequently asked questions</h2>
        <p className='text-muted-foreground mt-2'>
          Everything you need to know about our plans and billing.
        </p>
      </div>
      <div className='border-border bg-card mx-auto max-w-3xl rounded-2xl border px-6'>
        {items.map(faq => (
          <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
        ))}
      </div>
    </div>
  );
}
