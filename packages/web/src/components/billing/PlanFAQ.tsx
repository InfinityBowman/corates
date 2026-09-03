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
    question: 'What can I do without paying anything?',
    answer:
      'Appraise one study at a time, without an account. You can run AMSTAR 2, RoB 2, or ROBINS-I on a study, upload and mark up its PDF, and export the finished appraisal to CSV or PDF. That work is stored in your own browser rather than on our servers. What a plan or trial adds is the shared side of a review: projects holding many studies, invited co-reviewers, independent dual appraisal, and a view for reconciling disagreements.',
  },
  {
    question: 'Do collaborators need their own subscription?',
    answer:
      'No. Only you pay. Co-reviewers create a free CoRATES account, accept your invitation, and can then appraise, reconcile, and export like anyone else on the project. Your plan sets how many collaborators you can invite; you do not count toward that number.',
  },
  {
    question: 'What happens to my projects if my plan ends or my funding runs out?',
    answer:
      'Nothing is deleted. Projects, appraisals, and uploaded PDFs stay where they are, and you keep read access to all of it: you can open a project, read every appraisal, download the PDFs, and export to CSV or PDF whenever you want. Creating new projects requires an active plan, and after a trial or a Single Project purchase runs out, editing pauses until you start a plan again. Nothing is charged automatically to reinstate it.',
  },
  {
    question: 'Can I get my data out?',
    answer:
      'Yes, at any time, as CSV or PDF. Exports are generated in your browser from the data already on screen, so they are available to every member of a project rather than only the owner, and they keep working after a plan has ended. The CSV carries the per-domain judgments and the notes behind them for AMSTAR 2, RoB 2, and ROBINS-I, so you can take the results into R, Stata, or a spreadsheet.',
  },
  {
    question: 'Who owns the data I put into CoRATES?',
    answer:
      'You do. Our Terms of Service state that you keep all right, title, and interest in what you upload and create; we receive only the limited license needed to run the service for you. A project owner can delete a project at any time, which removes its records and the PDFs stored for it, and you can delete your account from your settings.',
  },
  {
    question: 'What happens when my trial ends?',
    answer: '', // filled per-context below
  },
  {
    question: 'What is the Single Project option?',
    answer:
      'A one-time payment that covers one project for six months. There is no subscription and nothing renews or charges again. It suits a single review, a thesis chapter, or a course project, and it is usually the simplest thing to put through a grant line or a departmental card. If you buy it again later the six months are added on rather than starting over.',
  },
  {
    question: 'Is there a discount for annual billing?',
    answer:
      'Yes. Annual billing charges ten months instead of twelve, so two months are free, which works out to roughly 17 percent. Switch the toggle to Annual and each plan card shows the exact saving for that plan.',
  },
  {
    question: 'Can I switch plans at any time?',
    answer:
      'Yes. Upgrading takes effect immediately and Stripe prorates the remainder of the period you have already paid for. Downgrading takes effect at the start of your next billing period, and we check first that your existing projects and collaborators fit within the smaller plan, so nothing is removed without you deciding to remove it.',
  },
  {
    question: 'Can I cancel my subscription?',
    answer:
      'Yes. Cancel from Manage billing in billing settings, which opens the Stripe customer portal. Access continues to the end of the period you have already paid for and you are not charged again. Your projects are not deleted, and your exports keep working.',
  },
  {
    question: 'How do payments and receipts work?',
    answer:
      'Payments run through Stripe, and we accept major credit and debit cards. While a subscription is active, your billing settings list your Stripe invoices with a downloadable PDF for each one, which is normally what a grant office or a reimbursement claim needs. We do not currently support purchase orders or payment by institutional invoice, so if that is what your purchasing office requires, contact us and tell us what they need.',
  },
];

const TRIAL_ANSWER_MARKETING =
  'After 14 days the trial project stops accepting edits, and that is all that happens. Nothing is deleted: you can still open the project, read every appraisal, download the PDFs you uploaded, and export to CSV or PDF. Choose a plan whenever you are ready and editing resumes exactly where you left off. The trial does not ask for a card and does not turn into a paid subscription on its own.';

const TRIAL_ANSWER_SETTINGS =
  'When the 14 days are up, your project stops accepting edits. Nothing is deleted: you can still open it, read every appraisal, download your PDFs, and export to CSV or PDF. Choose a plan and editing resumes exactly where you left off. You are never charged automatically at the end of a trial.';

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
