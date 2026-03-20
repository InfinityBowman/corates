import { createFileRoute } from '@tanstack/react-router';
import ToolResourcePage from '../../components/resources/ToolResourcePage';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { getToolBySlug } from '../../lib/tool-content';
import { config } from '../../lib/config';

const tool = getToolBySlug('robins-i');
const pageUrl = `${config.appUrl}/resources/robins-i`;
const title = tool ? `${tool.name} Resources - CoRATES` : 'ROBINS-I - CoRATES';
const description =
  tool ?
    `Learn about ${tool.name}, including scoring guidance and links to official documentation.`
  : 'ROBINS-I appraisal tool resources.';

export const Route = createFileRoute('/resources/robins-i')({
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
