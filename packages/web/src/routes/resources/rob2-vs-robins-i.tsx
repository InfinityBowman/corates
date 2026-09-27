import { createFileRoute } from '@tanstack/react-router';
import ComparisonPage from '../../components/resources/ComparisonPage';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { loadComparison } from '../../lib/resource-loaders';
import { RESOURCE_CACHE_HEADERS, comparisonPageHead } from '../../lib/resource-head';

export const Route = createFileRoute('/resources/rob2-vs-robins-i')({
  headers: () => RESOURCE_CACHE_HEADERS,
  loader: () => loadComparison('rob2-vs-robins-i'),
  head: ({ loaderData }) => (loaderData ? comparisonPageHead(loaderData) : {}),
  component: Rob2VsRobinsIPage,
});

function Rob2VsRobinsIPage() {
  const comparison = Route.useLoaderData();
  return (
    <div className='flex min-h-screen flex-col'>
      <Navbar />
      <ComparisonPage comparison={comparison} />
      <Footer />
    </div>
  );
}
