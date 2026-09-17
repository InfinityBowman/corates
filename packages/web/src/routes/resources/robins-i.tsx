import { createFileRoute } from '@tanstack/react-router';
import ToolResourcePage from '../../components/resources/ToolResourcePage';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { getToolBySlug } from '../../lib/tool-content';
import { RESOURCE_CACHE_HEADERS, toolPageHead } from '../../lib/resource-head';

const tool = getToolBySlug('robins-i')!;

export const Route = createFileRoute('/resources/robins-i')({
  headers: () => RESOURCE_CACHE_HEADERS,
  head: () => toolPageHead(tool),
  component: RobinsIPage,
});

function RobinsIPage() {
  return (
    <div className='flex min-h-screen flex-col'>
      <Navbar />
      <ToolResourcePage tool={tool} />
      <Footer />
    </div>
  );
}
