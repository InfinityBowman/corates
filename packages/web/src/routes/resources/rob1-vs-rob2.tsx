import { createFileRoute } from '@tanstack/react-router';
import ComparisonPage from '../../components/resources/ComparisonPage';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { getComparisonBySlug } from '../../lib/comparison-content';
import { RESOURCE_CACHE_HEADERS, comparisonPageHead } from '../../lib/resource-head';

const comparison = getComparisonBySlug('rob1-vs-rob2')!;

export const Route = createFileRoute('/resources/rob1-vs-rob2')({
  headers: () => RESOURCE_CACHE_HEADERS,
  head: () => comparisonPageHead(comparison),
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
