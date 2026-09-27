import { createFileRoute } from '@tanstack/react-router';
import ComparisonPage from '../../components/resources/ComparisonPage';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { loadComparison } from '../../lib/resource-loaders';
import { RESOURCE_CACHE_HEADERS, comparisonPageHead } from '../../lib/resource-head';

export const Route = createFileRoute('/resources/amstar2-vs-robis')({
  headers: () => RESOURCE_CACHE_HEADERS,
  loader: () => loadComparison('amstar2-vs-robis'),
  head: ({ loaderData }) => (loaderData ? comparisonPageHead(loaderData) : {}),
  component: Amstar2VsRobisPage,
});

function Amstar2VsRobisPage() {
  const comparison = Route.useLoaderData();
  return (
    <div className='flex min-h-screen flex-col'>
      <Navbar />
      <ComparisonPage comparison={comparison} />
      <Footer />
    </div>
  );
}
