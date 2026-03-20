import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CheckIcon, ChevronDownIcon, StarIcon, ZapIcon } from 'lucide-react';
import { getBillingPlanCatalog } from '@corates/shared/plans';

import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import FlipNumber from '../components/FlipNumber';
import { config, urls } from '../lib/config';

const FAQ_ITEMS = [
  {
    question: 'Can I switch plans at any time?',
    answer:
      "Yes! You can upgrade or downgrade your plan at any time. When you upgrade, you'll be charged a prorated amount for the remainder of your billing cycle. When you downgrade, your new plan will take effect at the start of your next billing cycle.",
  },
  {
    question: 'What happens when my trial ends?',
    answer:
      "When your 14-day trial ends, you'll need to subscribe to a paid plan to continue using collaborative features. Don't worry - your data will be saved, and you can subscribe at any time to regain access.",
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

const faqSchema = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(item => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
});

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className='border-b border-gray-200 last:border-b-0'>
      <button
        type='button'
        className='flex w-full items-center justify-between py-5 text-left'
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className='text-base font-medium text-gray-900'>{question}</span>
        <ChevronDownIcon
          className={`h-5 w-5 shrink-0 text-gray-500 transition-transform duration-300 ease-out ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className='grid transition-[grid-template-rows] duration-300 ease-out'
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className='overflow-hidden'>
          <p className='pb-5 text-gray-600'>{answer}</p>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/pricing')({
  head: () => ({
    meta: [
      { title: 'Pricing - CoRATES' },
      {
        name: 'description',
        content:
          'Explore our plans for researchers and evidence synthesis teams. Start with a free trial, then choose the plan that fits your needs.',
      },
      { property: 'og:title', content: 'Pricing - CoRATES' },
      {
        property: 'og:description',
        content:
          'Explore our plans for researchers and evidence synthesis teams. Start with a free trial, then choose the plan that fits your needs.',
      },
      { property: 'og:url', content: `${config.appUrl}/pricing` },
      { name: 'twitter:title', content: 'Pricing - CoRATES' },
      {
        name: 'twitter:description',
        content:
          'Explore our plans for researchers and evidence synthesis teams. Start with a free trial, then choose the plan that fits your needs.',
      },
    ],
    links: [{ rel: 'canonical', href: `${config.appUrl}/pricing` }],
  }),
  component: PricingPage,
});

function PricingPage() {
  const catalog = getBillingPlanCatalog();

  const trialPlan = catalog.plans.find(p => p.tier === 'trial');
  const singleProjectPlan = catalog.plans.find(p => p.tier === 'single_project');
  const subscriptionPlans = catalog.plans.filter(p => p.cta === 'subscribe');

  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');

  const formatUsd = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(amount);

  const getAnnualSavings = (plan: (typeof subscriptionPlans)[number]) => {
    if (!plan.price || !plan.price.monthly || !plan.price.yearly) return null;
    const monthlyTotal = plan.price.monthly * 12;
    const savings = monthlyTotal - plan.price.yearly;
    return savings > 0 ? savings : null;
  };

  const getButtonText = (plan: (typeof catalog.plans)[number]) => {
    if (plan.cta === 'start_trial') return 'Start Free Trial';
    if (plan.cta === 'buy_single_project') return 'Buy Now';
    if (plan.cta === 'subscribe') return 'Get Started';
    return 'Learn More';
  };

  const getButtonUrl = (plan: (typeof catalog.plans)[number]) => {
    if (plan.cta === 'subscribe') {
      return urls.signUp(plan.tier, billingInterval);
    }
    return urls.signUp(plan.tier);
  };

  return (
    <div className='min-h-screen bg-linear-to-b from-blue-50 to-white'>
      <Navbar />

      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: faqSchema }} />

      <main className='mx-auto max-w-6xl px-6 py-12'>
        {/* Header */}
        <div className='mx-auto max-w-2xl text-center'>
          <h1 className='text-3xl font-bold text-gray-900 md:text-4xl'>
            Explore our plans for researchers and evidence synthesis teams.
          </h1>
          <p className='mt-4 text-lg text-gray-600'>
            Start with a free trial, then choose the plan that fits your team's needs.
          </p>
        </div>

        {/* Trial CTA Banner */}
        {trialPlan && (
          <div className='mt-10 rounded-2xl border-2 border-blue-200 bg-linear-to-r from-blue-50 to-indigo-50 p-6'>
            <div className='flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left'>
              <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100'>
                <ZapIcon className='h-6 w-6 text-blue-600' />
              </div>
              <div className='flex-1'>
                <h3 className='text-lg font-bold text-gray-900'>Start your 14-day free trial</h3>
                <p className='mt-1 text-sm text-gray-600'>
                  {trialPlan.features[0]}. {trialPlan.features[1]}. No credit card required.
                </p>
              </div>
              <Link
                to={getButtonUrl(trialPlan)}
                className='shrink-0 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-700'
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        )}

        {/* Billing interval toggle */}
        <div className='mt-10 flex flex-col items-center gap-4'>
          <div className='flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-700'>
            <StarIcon className='h-4 w-4' />
            Save 2 months with annual billing
          </div>
          <div className='relative inline-flex rounded-xl bg-gray-100 p-1.5'>
            {/* Sliding background pill */}
            <div
              className='absolute top-1.5 h-[calc(100%-12px)] w-[calc(50%-6px)] rounded-lg bg-white shadow-sm transition-transform duration-200 ease-out'
              style={{
                transform: billingInterval === 'yearly' ? 'translateX(100%)' : 'translateX(0)',
              }}
            />
            <button
              type='button'
              className={`relative z-10 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                billingInterval === 'monthly' ? 'text-gray-900' : (
                  'text-gray-500 hover:text-gray-700'
                )
              }`}
              onClick={() => setBillingInterval('monthly')}
            >
              Monthly
            </button>
            <button
              type='button'
              className={`relative z-10 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                billingInterval === 'yearly' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setBillingInterval('yearly')}
            >
              Annual
            </button>
          </div>
        </div>

        {/* Subscription plans grid */}
        <div className='mt-10 grid grid-cols-1 gap-6 md:grid-cols-3'>
          {subscriptionPlans.map(plan => {
            const isPopular = plan.isPopular;
            const savings = getAnnualSavings(plan);

            return (
              <div
                key={plan.tier}
                className={`relative flex flex-col rounded-2xl border-2 p-6 transition-all duration-300 ${
                  isPopular ?
                    'border-blue-400 bg-white shadow-xl shadow-blue-100/50 hover:shadow-2xl hover:shadow-blue-200/50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg'
                }`}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className='absolute -top-4 left-1/2 -translate-x-1/2'>
                    <span className='inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg'>
                      <ZapIcon className='h-3.5 w-3.5' />
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan header */}
                <div className='mb-4 pt-2'>
                  <h3 className='text-xl font-bold text-gray-900'>{plan.name}</h3>
                  <p className='mt-1 text-sm text-gray-500'>{plan.description}</p>
                </div>

                {/* Price */}
                <div className='mb-6'>
                  {plan.price ?
                    plan.price[billingInterval] !== null ?
                      <>
                        <div className='flex items-baseline gap-1'>
                          <FlipNumber
                            value={
                              billingInterval === 'monthly' ?
                                plan.price.monthly!
                              : plan.price.yearly! / 12
                            }
                            prefix='$'
                            decimals={billingInterval === 'yearly' ? 2 : 0}
                            className='text-4xl font-bold text-gray-900'
                          />
                          <span className='text-gray-500'>/month</span>
                        </div>
                        {/* Annual billing details */}
                        <div
                          className='mt-1 grid transition-[grid-template-rows] duration-300 ease-out'
                          style={{
                            gridTemplateRows: billingInterval === 'yearly' ? '1fr' : '0fr',
                          }}
                        >
                          <div className='overflow-hidden'>
                            {plan.price.yearly && plan.price.yearly > 0 && (
                              <p className='text-sm text-gray-500'>
                                {formatUsd(plan.price.yearly)} billed annually
                              </p>
                            )}
                            {savings && (
                              <p className='text-sm font-medium text-green-600'>
                                Save {formatUsd(savings)} per year
                              </p>
                            )}
                          </div>
                        </div>
                      </>
                    : <div className='text-3xl font-bold text-gray-900'>Custom</div>
                  : <div className='text-3xl font-bold text-gray-900'>Free</div>}
                </div>

                {/* CTA Button */}
                <Link
                  to={getButtonUrl(plan)}
                  className={`mb-6 block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                    isPopular ?
                      'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                    : 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-500'
                  }`}
                >
                  {getButtonText(plan)}
                </Link>

                {/* Features */}
                <div className='flex-1'>
                  <p className='mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase'>
                    What's included
                  </p>
                  <ul className='space-y-3'>
                    {plan.features.map(feature => (
                      <li key={feature} className='flex items-start gap-3'>
                        <div className='mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100'>
                          <CheckIcon className='h-3 w-3 text-green-600' />
                        </div>
                        <span className='text-sm text-gray-600'>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Single Project - One-time alternative */}
        {singleProjectPlan && (
          <div className='mt-12 rounded-2xl border-2 border-gray-200 bg-white p-6'>
            <div className='flex flex-col gap-6 md:flex-row md:items-center md:justify-between'>
              <div className='flex-1'>
                <div className='mb-2 flex items-center gap-2'>
                  <h3 className='text-lg font-bold text-gray-900'>{singleProjectPlan.name}</h3>
                  <span className='rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-600'>
                    One-time purchase
                  </span>
                </div>
                <p className='text-sm text-gray-600'>{singleProjectPlan.description}</p>
                <ul className='mt-3 flex flex-wrap gap-x-4 gap-y-1'>
                  {singleProjectPlan.features.map(feature => (
                    <li key={feature} className='flex items-center gap-1.5 text-sm text-gray-600'>
                      <CheckIcon className='h-3.5 w-3.5 text-green-600' />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div className='flex shrink-0 items-center gap-4'>
                <div className='text-right'>
                  <div className='text-2xl font-bold text-gray-900'>
                    {formatUsd(singleProjectPlan.oneTime!.amount)}
                  </div>
                  <p className='text-xs text-gray-500'>
                    {singleProjectPlan.oneTime!.durationMonths} months access
                  </p>
                </div>
                <Link
                  to={getButtonUrl(singleProjectPlan)}
                  className='rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-gray-800'
                >
                  Buy Now
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* FAQ Section */}
        <div className='mt-16'>
          <div className='mb-8 text-center'>
            <h2 className='text-2xl font-bold text-gray-900'>Frequently asked questions</h2>
            <p className='mt-2 text-gray-500'>
              Everything you need to know about our plans and billing.
            </p>
          </div>
          <div className='mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white px-6'>
            {FAQ_ITEMS.map(faq => (
              <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>

        {/* Contact section */}
        <div className='mt-12 text-center'>
          <p className='text-sm text-gray-500'>
            Need a custom plan for your institution?{' '}
            <Link to='/contact' className='text-blue-600 hover:text-blue-700'>
              Contact us
            </Link>{' '}
            for enterprise pricing.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
