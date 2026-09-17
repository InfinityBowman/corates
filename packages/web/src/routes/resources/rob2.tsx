import { createFileRoute } from '@tanstack/react-router';
import ToolResourcePage from '../../components/resources/ToolResourcePage';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { getToolBySlug } from '../../lib/tool-content';
import { RESOURCE_CACHE_HEADERS, toolPageHead } from '../../lib/resource-head';

const tool = getToolBySlug('rob2')!;

export const Route = createFileRoute('/resources/rob2')({
  headers: () => RESOURCE_CACHE_HEADERS,
  head: () => toolPageHead(tool),
  component: Rob2Page,
});

function Rob2Page() {
  return (
    <div className='flex min-h-screen flex-col'>
      <Navbar />
      <ToolResourcePage tool={tool} />
      <Footer />
    </div>
  );
}
