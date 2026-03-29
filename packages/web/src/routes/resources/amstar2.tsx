import { createFileRoute } from '@tanstack/react-router';
import ToolResourcePage from '../../components/resources/ToolResourcePage';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { getToolBySlug } from '../../lib/tool-content';
import { config } from '../../lib/config';

const tool = getToolBySlug('amstar2');
const pageUrl = `${config.appUrl}/resources/amstar2`;
const title = tool ? `${tool.name} Resources - CoRATES` : 'AMSTAR 2 - CoRATES';
const description =
  tool ?
    `Learn about ${tool.name}, including scoring guidance and links to official documentation.`
  : 'AMSTAR 2 appraisal tool resources.';

export const Route = createFileRoute('/resources/amstar2')({
  headers: () => ({
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  }),
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: pageUrl },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
    links: [{ rel: 'canonical', href: pageUrl }],
  }),
  component: Amstar2Page,
});

function Amstar2Page() {
  return (
    <div className='flex min-h-screen flex-col'>
      <Navbar />
      <ToolResourcePage tool={tool} />
      <Footer />
    </div>
  );
}
