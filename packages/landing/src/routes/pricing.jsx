import { Title, Meta, Link } from '@solidjs/meta';
import { For, Show, createSignal } from 'solid-js';
import { FiCheck, FiStar, FiZap } from 'solid-icons/fi';
import { getBillingPlanCatalog } from '@corates/shared/plans';

import Navbar from '~/components/Navbar';
import Footer from '~/components/Footer';
import FlipNumber from '~/components/FlipNumber';
import { config, urls } from '~/lib/config';

export default function Pricing() {
  const pageUrl = `${config.appUrl}/pricing`;
  const title = 'Pricing - CoRATES';
  const description =
    'Explore our plans for researchers and evidence synthesis teams. Start with a free trial, then choose the plan that fits your needs.';

  const catalog = getBillingPlanCatalog();

  // Separate plans by type
  const trialPlan = () => catalog.plans.find(p => p.tier === 'trial');
  const singleProjectPlan = () => catalog.plans.find(p => p.tier === 'single_project');
  const subscriptionPlans = () => catalog.plans.filter(p => p.cta === 'subscribe');

  const [billingInterval, setBillingInterval] = createSignal('monthly');

  const formatUsd = amount =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(amount);

  // Calculate annual savings
  const getAnnualSavings = plan => {
    if (!plan.price || !plan.price.monthly || !plan.price.yearly) return null;
    const monthlyTotal = plan.price.monthly * 12;
    const savings = monthlyTotal - plan.price.yearly;
    return savings > 0 ? savings : null;
  };

  // Get button text based on plan CTA type
  const getButtonText = plan => {
    if (plan.cta === 'start_trial') return 'Start Free Trial';
    if (plan.cta === 'buy_single_project') return 'Buy Now';
    if (plan.cta === 'subscribe') return 'Get Started';
    return 'Learn More';
  };

  // Get button URL with appropriate plan parameter
  const getButtonUrl = plan => {
    return urls.signUp(plan.tier);
  };

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
          {/* Header */}
          <div class='mx-auto max-w-2xl text-center'>
            <h1 class='text-3xl font-bold text-gray-900 md:text-4xl'>
              Explore our plans for researchers and evidence synthesis teams.
            </h1>
            <p class='mt-4 text-lg text-gray-600'>
              Start with a free trial, then choose the plan that fits your team's needs.
            </p>
          </div>

          {/* Trial CTA Banner */}
          <Show when={trialPlan()}>
            <div class='mt-10 rounded-2xl border-2 border-blue-200 bg-linear-to-r from-blue-50 to-indigo-50 p-6'>
              <div class='flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left'>
                <div class='flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100'>
                  <FiZap class='h-6 w-6 text-blue-600' />
                </div>
                <div class='flex-1'>
                  <h3 class='text-lg font-bold text-gray-900'>Start your 14-day free trial</h3>
                  <p class='mt-1 text-sm text-gray-600'>
                    {trialPlan().features[0]}. {trialPlan().features[1]}. No credit card required.
                  </p>
                </div>
                <a
                  href={getButtonUrl(trialPlan())}
                  class='shrink-0 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-700'
                >
                  Start Free Trial
                </a>
              </div>
            </div>
          </Show>

          {/* Billing interval toggle */}
          <div class='mt-10 flex flex-col items-center gap-4'>
            <div class='flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-700'>
              <FiStar class='h-4 w-4' />
              Save 2 months with annual billing
            </div>
            <div class='relative inline-flex rounded-xl bg-gray-100 p-1.5'>
              {/* Sliding background pill */}
              <div
                class='absolute top-1.5 h-[calc(100%-12px)] w-[calc(50%-6px)] rounded-lg bg-white shadow-sm transition-transform duration-200 ease-out'
                style={{
                  transform: billingInterval() === 'yearly' ? 'translateX(100%)' : 'translateX(0)',
                }}
              />
              <button
                type='button'
                class={`relative z-10 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                  billingInterval() === 'monthly' ? 'text-gray-900' : (
                    'text-gray-500 hover:text-gray-700'
                  )
                }`}
                onClick={() => setBillingInterval('monthly')}
              >
                Monthly
              </button>
              <button
                type='button'
                class={`relative z-10 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                  billingInterval() === 'yearly' ? 'text-gray-900' : (
                    'text-gray-500 hover:text-gray-700'
                  )
                }`}
                onClick={() => setBillingInterval('yearly')}
              >
                Annual
              </button>
            </div>
          </div>

          {/* Subscription plans grid */}
          <div class='mt-10 grid grid-cols-1 gap-6 md:grid-cols-3'>
            <For each={subscriptionPlans()}>
              {plan => {
                const isPopular = () => plan.isPopular;
                const savings = () => getAnnualSavings(plan);

                return (
                  <div
                    class={`relative flex flex-col rounded-2xl border-2 p-6 transition-all duration-300 ${
                      isPopular() ?
                        'border-blue-400 bg-white shadow-xl shadow-blue-100/50 hover:shadow-2xl hover:shadow-blue-200/50'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg'
                    }`}
                  >
                    {/* Popular badge */}
                    <Show when={isPopular()}>
                      <div class='absolute -top-4 left-1/2 -translate-x-1/2'>
                        <span class='inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg'>
                          <FiZap class='h-3.5 w-3.5' />
                          Most Popular
                        </span>
                      </div>
                    </Show>

                    {/* Plan header */}
                    <div class='mb-4 pt-2'>
                      <h3 class='text-xl font-bold text-gray-900'>{plan.name}</h3>
                      <p class='mt-1 text-sm text-gray-500'>{plan.description}</p>
                    </div>

                    {/* Price */}
                    <div class='mb-6'>
                      <Show
                        when={plan.price}
                        fallback={<div class='text-3xl font-bold text-gray-900'>Free</div>}
                      >
                        <Show
                          when={plan.price[billingInterval()] !== null}
                          fallback={<div class='text-3xl font-bold text-gray-900'>Custom</div>}
                        >
                          <div class='flex items-baseline gap-1'>
                            <FlipNumber
                              value={
                                billingInterval() === 'monthly' ?
                                  plan.price.monthly
                                : plan.price.yearly / 12
                              }
                              prefix='$'
                              decimals={billingInterval() === 'yearly' ? 2 : 0}
                              class='text-4xl font-bold text-gray-900'
                            />
                            <span class='text-gray-500'>/month</span>
                          </div>
                          {/* Annual billing details - grid row animation for smooth height */}
                          <div
                            class='mt-1 grid transition-[grid-template-rows] duration-300 ease-out'
                            style={{
                              'grid-template-rows': billingInterval() === 'yearly' ? '1fr' : '0fr',
                            }}
                          >
                            <div class='overflow-hidden'>
                              <Show when={plan.price.yearly > 0}>
                                <p class='text-sm text-gray-500'>
                                  {formatUsd(plan.price.yearly)} billed annually
                                </p>
                              </Show>
                              <Show when={savings()}>
                                <p class='text-sm font-medium text-green-600'>
                                  Save {formatUsd(savings())} per year
                                </p>
                              </Show>
                            </div>
                          </div>
                        </Show>
                      </Show>
                    </div>

                    {/* CTA Button */}
                    <a
                      href={getButtonUrl(plan)}
                      class={`mb-6 block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                        isPopular() ?
                          'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                        : 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-500'
                      }`}
                    >
                      {getButtonText(plan)}
                    </a>

                    {/* Features */}
                    <div class='flex-1'>
                      <p class='mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase'>
                        What's included
                      </p>
                      <ul class='space-y-3'>
                        <For each={plan.features}>
                          {feature => (
                            <li class='flex items-start gap-3'>
                              <div class='mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100'>
                                <FiCheck class='h-3 w-3 text-green-600' />
                              </div>
                              <span class='text-sm text-gray-600'>{feature}</span>
                            </li>
                          )}
                        </For>
                      </ul>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>

          {/* Single Project - One-time alternative */}
          <Show when={singleProjectPlan()}>
            <div class='mt-12 rounded-2xl border-2 border-gray-200 bg-white p-6'>
              <div class='flex flex-col gap-6 md:flex-row md:items-center md:justify-between'>
                <div class='flex-1'>
                  <div class='mb-2 flex items-center gap-2'>
                    <h3 class='text-lg font-bold text-gray-900'>{singleProjectPlan().name}</h3>
                    <span class='rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-600'>
                      One-time purchase
                    </span>
                  </div>
                  <p class='text-sm text-gray-600'>{singleProjectPlan().description}</p>
                  <ul class='mt-3 flex flex-wrap gap-x-4 gap-y-1'>
                    <For each={singleProjectPlan().features}>
                      {feature => (
                        <li class='flex items-center gap-1.5 text-sm text-gray-600'>
                          <FiCheck class='h-3.5 w-3.5 text-green-600' />
                          {feature}
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
                <div class='flex shrink-0 items-center gap-4'>
                  <div class='text-right'>
                    <div class='text-2xl font-bold text-gray-900'>
                      {formatUsd(singleProjectPlan().oneTime.amount)}
                    </div>
                    <p class='text-xs text-gray-500'>
                      {singleProjectPlan().oneTime.durationMonths} months access
                    </p>
                  </div>
                  <a
                    href={getButtonUrl(singleProjectPlan())}
                    class='rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-gray-800'
                  >
                    Buy Now
                  </a>
                </div>
              </div>
            </div>
          </Show>

          {/* Contact section */}
          <div class='mt-12 text-center'>
            <p class='text-sm text-gray-500'>
              Need a custom plan for your institution?{' '}
              <a href='/contact' class='text-blue-600 hover:text-blue-700'>
                Contact us
              </a>{' '}
              for enterprise pricing.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
