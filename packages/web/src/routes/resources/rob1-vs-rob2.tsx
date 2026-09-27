import { createFileRoute } from '@tanstack/react-router';
import ComparisonPage from '../../components/resources/ComparisonPage';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { loadComparison } from '../../lib/resource-loaders';
import { RESOURCE_CACHE_HEADERS, comparisonPageHead } from '../../lib/resource-head';

export const Route = createFileRoute('/resources/rob1-vs-rob2')({
  headers: () => RESOURCE_CACHE_HEADERS,
  loader: () => loadComparison('rob1-vs-rob2'),
  head: ({ loaderData }) => (loaderData ? comparisonPageHead(loaderData) : {}),
  component: Rob1VsRob2Page,
});

function Rob1VsRob2Page() {
  const comparison = Route.useLoaderData();
  return (
    <div className='flex min-h-screen flex-col'>
      <Navbar />
      <ComparisonPage comparison={comparison} />
      <Footer />
    </div>
  );
}
