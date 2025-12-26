import { Title, Meta, Link } from '@solidjs/meta';
import { For, Show, createSignal, onMount } from 'solid-js';
import { FiCheck } from 'solid-icons/fi';

import Navbar from '~/components/Navbar';
import Footer from '~/components/Footer';
import { config, urls } from '~/lib/config';

const ANNUAL_DISCOUNT = 0.1;

const BASE_PLANS = [
  {
    tier: 'free',
    name: 'Free',
    description: 'For learners and one-off appraisals',
    monthlyAmount: 0,
    features: [
      'Single-study appraisal',
      'Automatic scoring',
      'Any checklist in the platform',
      'PDF viewing + annotation',
      'Save/export single-study scoring',
    ],
    cta: { label: 'Start Free', href: () => urls.signUp(), relExternal: true },
  },
  {
    tier: 'pro',
    name: 'Project',
    description: 'For multi-study review workspaces',
    monthlyAmount: 20,
    badge: 'Most Popular',
    features: [
      'Unlimited projects',
      'Unlimited studies per project',
      'Visualizations + IRR',
      'Consensus workflows',
      'Audit trails + exports',
      'Up to 3 collaborators included',
    ],
    cta: { label: 'Get Project', href: () => urls.signUp(), relExternal: true },
  },
  {
    tier: 'team',
    name: 'Team',
    description: 'For labs and collaborative research groups',
    monthlyAmount: 39,
    features: [
      'Everything in Project',
      'Unlimited collaborators',
      'Priority support',
      'Early access to beta tools',
      'Team admin tools (coming soon)',
    ],
    cta: { label: 'Get Team', href: () => urls.signUp(), relExternal: true },
  },
  {
    tier: 'enterprise',
    name: 'Institutional',
    description: 'For universities and organizations',
    monthlyAmount: null,
    features: [
      'Unlimited users',
      'Centralized administration',
      'Usage analytics',
      'SSO options',
      'Onboarding + training',
    ],
    cta: {
      label: 'Contact Us',
      href: () => 'mailto:support@corates.org',
      relExternal: false,
    },
  },
];

function getPrice(plan, billing) {
  if (plan.monthlyAmount === null) return { amount: null, unit: '' };

  if (billing === 'yearly') {
    const monthlyEquivalent = Math.round(plan.monthlyAmount * (1 - ANNUAL_DISCOUNT));
    return { amount: monthlyEquivalent, unit: '/month' };
  }

  return { amount: plan.monthlyAmount, unit: '/month' };
}

export default function Pricing() {
  const pageUrl = `${config.appUrl}/pricing`;
  const title = 'Pricing - CoRATES';
  const description = 'Simple plans for evidence synthesis teams. Start free, upgrade anytime.';

  const [billing, setBilling] = createSignal('monthly');
  const [showIntroAnimation, setShowIntroAnimation] = createSignal(true);

  onMount(() => {
    const timer = setTimeout(() => setShowIntroAnimation(false), 1200);
    return () => clearTimeout(timer);
  });

  const plans = () => BASE_PLANS.map(plan => ({ ...plan, price: getPrice(plan, billing()) }));

  return (
    <>
      <Title>{title}</Title>
      <Meta name='description' content={description} />
      <Link rel='canonical' href={pageUrl} />
      <Meta property='og:title' content={title} />
      <Meta property='og:description' content={description} />
      <Meta property='og:url' content={pageUrl} />
      <Meta name='twitter:title' content={title} />
      <Meta name='twitter:description' content={description} />

      <div class='min-h-screen bg-linear-to-b from-blue-50 to-white'>
        <Navbar />
        <main class='mx-auto max-w-6xl px-6 py-12'>
          <div class='mx-auto max-w-2xl text-center'>
            <h1 class='text-3xl font-bold text-gray-900 md:text-4xl'>Pricing</h1>
            <p class='mt-4 text-lg text-gray-600'>
              CoRATES is currently in active development and testing. We’re working closely with
              early users to refine features, workflows, and team-based collaboration. Pricing will
              be announced closer to launch and will reflect the needs of individual researchers,
              teams, and institutions. Interested in getting involved?{' '}
              <a href='/contact' class='text-blue-600 hover:text-blue-700'>
                Contact us
              </a>{' '}
              to learn more.
            </p>
          </div>

          <div class='mt-10 hidden justify-center'>
            <div class='inline-flex rounded-lg bg-gray-100 p-1'>
              <button
                type='button'
                class={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  billing() === 'monthly' ?
                    'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setBilling('monthly')}
              >
                Monthly
              </button>
              <button
                type='button'
                class={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  billing() === 'yearly' ?
                    'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setBilling('yearly')}
              >
                Annual
                <span class='ml-1 text-xs font-semibold text-green-600'>Save 10%</span>
              </button>
            </div>
          </div>

          <div class='mt-10 hidden grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
            <For each={plans()}>
              {(plan, index) => (
                <div
                  class={`relative flex flex-col rounded-xl border-2 p-6 transition-colors duration-300 ${
                    showIntroAnimation() ? 'animate-fade-in-up' : ''
                  } ${
                    plan.tier === 'pro' ?
                      'border-blue-200 bg-white shadow-md'
                    : 'border-gray-200 bg-white'
                  }`}
                  style={
                    showIntroAnimation() ? { 'animation-delay': `${index() * 0.1}s` } : undefined
                  }
                >
                  <Show when={plan.badge}>
                    <div class='absolute -top-3 left-1/2 -translate-x-1/2'>
                      <span class='rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white'>
                        {plan.badge}
                      </span>
                    </div>
                  </Show>

                  <div class='mb-4'>
                    <h2 class='text-lg font-semibold text-gray-900'>{plan.name}</h2>
                    <p class='mt-1 text-sm text-gray-500'>{plan.description}</p>
                  </div>

                  <div class='mb-6'>
                    <Show
                      when={plan.price.amount !== null}
                      fallback={<div class='text-2xl font-bold text-gray-900'>Custom</div>}
                    >
                      <div class='flex items-baseline transition-all duration-300'>
                        <span class='text-3xl font-bold text-gray-900 transition-all duration-300'>
                          ${plan.price.amount}
                        </span>
                        <span class='ml-1 text-gray-500'>{plan.price.unit}</span>
                      </div>
                      <p class='mt-1 text-sm text-gray-500'>
                        {plan.price.amount === 0 ?
                          'Free'
                        : billing() === 'yearly' ?
                          'Billed yearly'
                        : 'Billed monthly'}
                      </p>
                    </Show>
                  </div>

                  <ul class='mb-6 flex-1 space-y-3'>
                    <For each={plan.features}>
                      {feature => (
                        <li class='flex items-start'>
                          <FiCheck class='mt-0.5 mr-2 h-5 w-5 shrink-0 text-green-500' />
                          <span class='text-sm text-gray-600'>{feature}</span>
                        </li>
                      )}
                    </For>
                  </ul>

                  <a
                    href={plan.cta.href()}
                    rel={plan.cta.relExternal ? 'external' : undefined}
                    class={`w-full rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95 ${
                      plan.tier === 'pro' ?
                        'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
                      : plan.tier === 'enterprise' ?
                        'bg-gray-900 text-white hover:bg-gray-800 hover:shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {plan.cta.label}
                  </a>
                </div>
              )}
            </For>
          </div>

          <p class='mt-8 hidden text-center text-sm text-gray-500'>
            For institutional purchasing, contact{' '}
            <a href='mailto:support@corates.org' class='text-blue-600 hover:text-blue-700'>
              support@corates.org
            </a>
            .
          </p>
        </main>
        <Footer />
      </div>
    </>
  );
}
