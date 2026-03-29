import { createFileRoute, Link } from '@tanstack/react-router';
import { PricingTable } from '@/components/billing/PricingTable';
import { PlanFAQ, getFaqItemsForSchema } from '@/components/billing/PlanFAQ';
import { config, urls } from '@/lib/config';

import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

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
  return (
    <div className='min-h-screen bg-linear-to-b from-blue-50 to-white'>
      <Navbar />

      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: faqSchema }} />

      <main className='mx-auto max-w-6xl px-6 py-12'>
        {/* Header */}
        <div className='mx-auto max-w-2xl text-center'>
          <h1 className='text-foreground text-3xl font-bold md:text-4xl'>
            Explore our plans for researchers and evidence synthesis teams.
          </h1>
          <p className='text-muted-foreground mt-4 text-lg'>
            Start with a free trial, then choose the plan that fits your team's needs.
          </p>
        </div>

        <div className='mt-10'>
          <PricingTable mode='marketing' getSignUpUrl={urls.signUp} />
        </div>

        <PlanFAQ context='marketing' />

        {/* Contact section */}
        <div className='mt-12 text-center'>
          <p className='text-muted-foreground text-sm'>
            Need a custom plan for your institution?{' '}
            <Link to='/contact' className='text-primary hover:text-primary/80'>
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
