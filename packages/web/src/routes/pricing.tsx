import { createFileRoute, Link } from '@tanstack/react-router';
import { PricingTable } from '@/components/billing/PricingTable';
import { PlanFAQ, getFaqItemsForSchema } from '@/components/billing/PlanFAQ';
import { getBillingPlanCatalog } from '@corates/shared/plans';
import { config, urls } from '@/lib/config';

import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const catalog = getBillingPlanCatalog();

// The catalog lists subscriptions cheapest-first, so the first one is the entry price.
const entryPlan = catalog.plans.find(p => p.cta === 'subscribe');
const singleProjectPlan = catalog.plans.find(p => p.tier === 'single_project');

// Prices are stated in the description as text so that the crawlers and assistants people
// use to shortlist tools can quote them without rendering the page.
const pageDescription = [
  'Appraise a single study with AMSTAR 2, RoB 2, or ROBINS-I free in your browser, with no account.',
  entryPlan?.price?.monthly != null ?
    `Team plans start at $${entryPlan.price.monthly} per month.`
  : '',
  singleProjectPlan?.oneTime ?
    `A single review project is $${singleProjectPlan.oneTime.amount} once for ${singleProjectPlan.oneTime.durationMonths} months.`
  : '',
  'The co-reviewers you invite never pay.',
]
  .filter(Boolean)
  .join(' ');

const pageTitle = 'Pricing - CoRATES';

const faqSchema = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: getFaqItemsForSchema().map(item => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
});

export const Route = createFileRoute('/pricing')({
  headers: () => ({
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
  }),
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: 'description', content: pageDescription },
      { property: 'og:title', content: pageTitle },
      { property: 'og:description', content: pageDescription },
      { property: 'og:url', content: `${config.appUrl}/pricing` },
      { name: 'twitter:title', content: pageTitle },
      { name: 'twitter:description', content: pageDescription },
    ],
    links: [{ rel: 'canonical', href: `${config.appUrl}/pricing` }],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className='min-h-screen bg-linear-to-b from-blue-50/30 to-white'>
      <Navbar />

      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: faqSchema }} />

      <main className='mx-auto max-w-6xl px-6 py-12'>
        {/* Header */}
        <div className='mx-auto max-w-2xl text-center'>
          <h1 className='text-foreground text-3xl font-bold md:text-4xl'>
            Appraisal is free. Collaboration is what you pay for.
          </h1>
          <p className='text-muted-foreground mt-4 text-lg'>
            Individual appraisals with PDF annotation and export are always free.
            <br />
            Choose a plan when you&apos;re ready to collaborate with your team.
          </p>
        </div>

        <div className='mt-10'>
          <PricingTable mode='marketing' getSignUpUrl={urls.signUp} />
        </div>

        <PlanFAQ context='marketing' />

        {/* Contact section */}
        <div className='mt-12 text-center'>
          <p className='text-muted-foreground mx-auto max-w-2xl text-sm'>
            Buying through a department or grant? Payments are card-only today - no purchase orders
            or institutional invoicing yet.{' '}
            <Link to='/contact' className='text-primary hover:text-primary/80'>
              Contact us
            </Link>{' '}
            and tell us what your purchasing office needs.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
