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
const title = 'CoRATES - Collaborative Research Appraisal Tool for Evidence Synthesis';
const description =
  'CoRATES streamlines quality and risk-of-bias appraisal with intuitive workflows, real-time collaboration, automatic scoring, and clear visual summaries for evidence synthesis.';

export const Route = createFileRoute('/')({
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
    <div className='min-h-screen bg-linear-to-b from-blue-50 to-white'>
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
