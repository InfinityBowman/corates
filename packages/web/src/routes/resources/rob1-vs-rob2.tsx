import { createFileRoute } from '@tanstack/react-router';
import ComparisonPage from '../../components/resources/ComparisonPage';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { getComparisonBySlug } from '../../lib/comparison-content';
import { config } from '../../lib/config';

const comparison = getComparisonBySlug('rob1-vs-rob2')!;
const pageUrl = `${config.appUrl}/resources/rob1-vs-rob2`;

export const Route = createFileRoute('/resources/rob1-vs-rob2')({
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
  component: Rob1VsRob2Page,
});

function Rob1VsRob2Page() {
  return (
    <div className='flex min-h-screen flex-col'>
      <Navbar />
      <ComparisonPage comparison={comparison} />
      <Footer />
    </div>
  );
}
