import { createFileRoute } from '@tanstack/react-router';
import ComparisonPage from '../../components/resources/ComparisonPage';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { getComparisonBySlug } from '../../lib/comparison-content';
import { RESOURCE_CACHE_HEADERS, comparisonPageHead } from '../../lib/resource-head';

const comparison = getComparisonBySlug('amstar2-vs-robis')!;

export const Route = createFileRoute('/resources/amstar2-vs-robis')({
  headers: () => RESOURCE_CACHE_HEADERS,
  head: () => comparisonPageHead(comparison),
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
