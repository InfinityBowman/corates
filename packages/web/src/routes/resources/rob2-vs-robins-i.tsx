import { createFileRoute } from '@tanstack/react-router';
import ComparisonPage from '../../components/resources/ComparisonPage';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { getComparisonBySlug } from '../../lib/comparison-content';
import { config } from '../../lib/config';

const comparison = getComparisonBySlug('rob2-vs-robins-i')!;
const pageUrl = `${config.appUrl}/resources/rob2-vs-robins-i`;

export const Route = createFileRoute('/resources/rob2-vs-robins-i')({
  headers: () => ({
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  }),
  head: () => ({
    meta: [
      { title: comparison.metaTitle },
      { name: 'description', content: comparison.metaDescription },
      { property: 'og:title', content: comparison.metaTitle },
      { property: 'og:description', content: comparison.metaDescription },
      { property: 'og:url', content: pageUrl },
      { name: 'twitter:title', content: comparison.metaTitle },
      { name: 'twitter:description', content: comparison.metaDescription },
    ],
    links: [{ rel: 'canonical', href: pageUrl }],
  }),
  component: Rob2VsRobinsIPage,
});

function Rob2VsRobinsIPage() {
  return (
    <div className='flex min-h-screen flex-col'>
      <Navbar />
      <ComparisonPage comparison={comparison} />
      <Footer />
    </div>
  );
}
