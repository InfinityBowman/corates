import { createFileRoute } from '@tanstack/react-router';
import ComparisonPage from '../../components/resources/ComparisonPage';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { getComparisonBySlug } from '../../lib/comparison-content';
import { config } from '../../lib/config';

const comparison = getComparisonBySlug('amstar2-vs-robis')!;
const pageUrl = `${config.appUrl}/resources/amstar2-vs-robis`;

export const Route = createFileRoute('/resources/amstar2-vs-robis')({
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
  component: Amstar2VsRobisPage,
});

function Amstar2VsRobisPage() {
  return (
    <div className='flex min-h-screen flex-col'>
      <Navbar />
      <ComparisonPage comparison={comparison} />
      <Footer />
    </div>
  );
}
