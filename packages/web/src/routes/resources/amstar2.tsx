import { createFileRoute } from '@tanstack/react-router';
import ToolResourcePage from '../../components/resources/ToolResourcePage';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { loadTool } from '../../lib/resource-loaders';
import { RESOURCE_CACHE_HEADERS, toolPageHead } from '../../lib/resource-head';

export const Route = createFileRoute('/resources/amstar2')({
  headers: () => RESOURCE_CACHE_HEADERS,
  loader: () => loadTool('amstar2'),
  head: ({ loaderData }) => (loaderData ? toolPageHead(loaderData) : {}),
  component: Amstar2Page,
});

function Amstar2Page() {
  const tool = Route.useLoaderData();
  return (
    <div className='flex min-h-screen flex-col'>
      <Navbar />
      <ToolResourcePage tool={tool} />
      <Footer />
    </div>
  );
}
