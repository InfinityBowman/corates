import { createFileRoute } from '@tanstack/react-router';
import ComparisonPage from '../../components/resources/ComparisonPage';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { loadComparison } from '../../lib/resource-loaders';
import { RESOURCE_CACHE_HEADERS, comparisonPageHead } from '../../lib/resource-head';

export const Route = createFileRoute('/resources/robins-i-v1-vs-v2')({
  headers: () => RESOURCE_CACHE_HEADERS,
  loader: () => loadComparison('robins-i-v1-vs-v2'),
  head: ({ loaderData }) => (loaderData ? comparisonPageHead(loaderData) : {}),
  component: RobinsIV1VsV2Page,
});

function RobinsIV1VsV2Page() {
  const comparison = Route.useLoaderData();
  return (
    <div className='flex min-h-screen flex-col'>
      <Navbar />
      <ComparisonPage comparison={comparison} />
      <Footer />
    </div>
  );
}
