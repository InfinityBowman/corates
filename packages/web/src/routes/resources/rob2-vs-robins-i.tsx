import { createFileRoute } from '@tanstack/react-router';
import ComparisonPage from '../../components/resources/ComparisonPage';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { getComparisonBySlug } from '../../lib/comparison-content';
import { RESOURCE_CACHE_HEADERS, comparisonPageHead } from '../../lib/resource-head';

const comparison = getComparisonBySlug('rob2-vs-robins-i')!;

export const Route = createFileRoute('/resources/rob2-vs-robins-i')({
  headers: () => RESOURCE_CACHE_HEADERS,
  head: () => comparisonPageHead(comparison),
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
