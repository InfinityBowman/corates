import { createFileRoute } from '@tanstack/react-router';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import FeatureShowcase from '../components/FeatureShowcase';
import HowItWorks from '../components/HowItWorks';
import Audience from '../components/Audience';
import SupportedTools from '../components/SupportedTools';
import CTA from '../components/CTA';
import Footer from '../components/Footer';
import { config } from '../lib/config';

const pageUrl = `${config.appUrl}/`;
const title = 'Risk of Bias and Quality Appraisal Software | CoRATES';
const description =
  'Collaborative risk-of-bias appraisal for systematic reviews. Run RoB 2, ROBINS-I, and AMSTAR 2 appraisals with double coding, automatic scoring, and visual summaries.';

export const Route = createFileRoute('/')({
  headers: () => ({
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  }),
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: pageUrl },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
    links: [{ rel: 'canonical', href: pageUrl }],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className='min-h-screen bg-linear-to-b from-blue-50/30 to-white'>
      <Navbar />
      <main>
        <Hero />
        <FeatureShowcase />
        <HowItWorks />
        <Audience />
        <SupportedTools />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
