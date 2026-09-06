/**
 * PlanFAQ - Shared FAQ section for pricing/plans pages
 */

import { useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { getPlan } from '@corates/shared/plans';

interface FAQItemData {
  question: string;
  answer: string;
}

const free = getPlan('free');

const FAQ_ITEMS: FAQItemData[] = [
  {
    question: 'What does the Free plan include?',
    answer: `Appraising a single study in your browser is always free and needs no account. With a free account you also get one shared project with up to ${free.quotas['collaborators.org.max']} collaborators and as many studies as you need. Completed appraisals stay readable and exportable if you never upgrade.`,
  },
  {
    question: 'Do collaborators need their own subscription?',
    answer:
      "No. Only the project owner needs a paid plan. Collaborators you invite can create a free CoRATES account, accept your invitation, and work on the projects you add them to. They don't need to subscribe or pay anything. Team and Lab have no collaborator limit.",
  },
  {
    question: 'Is there a discount for annual billing?',
    answer:
      'Yes. Annual billing is the default and costs about 17% less than paying monthly for a year. Monthly billing is available if you prefer it.',
  },
  {
    question: 'What is the Enterprise plan?',
    answer:
      'Enterprise covers consultancies and institutions, is billed annually, and is quoted per customer. Consultancies get unlimited projects, priority support, and invoice billing. Institutions get site-wide access for every lab and course. Contact us and we will put together a quote.',
  },
  {
    question: 'Do you offer course licenses?',
    answer:
      'Yes. If you teach evidence appraisal, a discounted course license gives your class shared projects for the term. Contact us with your course size and dates and we will set it up.',
  },
  {
    question: 'Can I switch plans at any time?',
    answer:
      "Yes. You can upgrade or downgrade your plan at any time. When you upgrade, you'll be charged a prorated amount for the remainder of your billing cycle. When you downgrade, your new plan will take effect at the start of your next billing cycle.",
  },
  {
    question: 'Can I cancel my subscription?',
    answer:
      "Absolutely. You can cancel your subscription at any time from your billing settings. Your access continues until the end of your current billing period, then your workspace moves to the Free plan. Your projects stay readable and exportable, and you won't be charged again.",
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe. All payments are encrypted and secure.',
  },
];

export function getFaqItemsForSchema() {
  return FAQ_ITEMS;
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

export function PlanFAQ() {
  return (
    <div className='mt-16'>
      <div className='mb-8 text-center'>
        <h2 className='text-foreground text-2xl font-bold'>Frequently asked questions</h2>
        <p className='text-muted-foreground mt-2'>
          Everything you need to know about our plans and billing.
        </p>
      </div>
      <div className='border-border bg-card mx-auto max-w-3xl rounded-2xl border px-6'>
        {FAQ_ITEMS.map(faq => (
          <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
        ))}
      </div>
    </div>
  );
}
