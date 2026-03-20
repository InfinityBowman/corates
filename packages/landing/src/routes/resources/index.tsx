import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRightIcon, FileTextIcon } from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { config } from '../../lib/config';
import { getAllTools } from '../../lib/tool-content';
import type { ToolContent } from '../../lib/tool-content';

const pageUrl = `${config.appUrl}/resources`;
const title = 'Resources - CoRATES';
const description =
  'Learn about AMSTAR 2, ROBINS-I, RoB 2, and other appraisal tools supported by CoRATES, including scoring guidance and links to official documentation.';

export const Route = createFileRoute('/resources/')({
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
  component: ResourcesPage,
});

function ToolCard({ tool }: { tool: ToolContent }) {
  return (
    <Link
      to={`/resources/${tool.slug}` as string}
      className='group flex flex-col rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-blue-300 hover:shadow-lg'
    >
      <div className='mb-4 flex size-12 items-center justify-center rounded-lg bg-blue-100'>
        <FileTextIcon className='size-6 text-blue-600' />
      </div>
      <h3 className='mb-2 text-xl font-semibold text-gray-900'>{tool.name}</h3>
      <p className='mb-4 flex-1 text-sm text-gray-600'>{tool.bestUsedFor}</p>
      <div className='flex items-center gap-2 text-sm font-medium text-blue-600 group-hover:text-blue-700'>
        Learn more
        <ArrowRightIcon className='size-4 transition-transform group-hover:translate-x-1' />
      </div>
    </Link>
  );
}

function ResourcesPage() {
  const tools = getAllTools();

  return (
    <div className='flex min-h-screen flex-col'>
      <Navbar />

      <main className='flex-1 py-12'>
        <div className='mx-auto max-w-4xl px-6'>
          <h1 className='mb-2 text-4xl font-bold text-gray-900'>Resources</h1>
          <p className='mb-10 text-lg text-gray-500'>
            Appraisal tools and guidance for systematic evidence synthesis
          </p>

          <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
            {tools.map(tool => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>

          <div className='mt-12 rounded-lg bg-gray-50 p-6'>
            <h2 className='mb-3 text-lg font-semibold text-gray-900'>About these tools</h2>
            <p className='text-gray-600'>
              CoRATES supports multiple evidence appraisal tools used in systematic reviews and
              research synthesis. Each tool is designed for specific study types and provides
              structured guidance for assessing methodological quality or risk of bias. Select a
              tool above to learn more about its purpose, scoring methodology, and access official
              documentation.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
