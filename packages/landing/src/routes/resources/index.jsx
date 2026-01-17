import { Title, Meta, Link } from '@solidjs/meta';
import { For } from 'solid-js';
import { FiArrowRight } from 'solid-icons/fi';
import { HiOutlineDocumentText } from 'solid-icons/hi';
import Navbar from '~/components/Navbar';
import Footer from '~/components/Footer';
import { config } from '~/lib/config';
import { getAllTools } from '~/lib/tool-content';

function ToolCard(props) {
  return (
    <a
      href={`/resources/${props.tool.slug}`}
      rel='external'
      class='group flex flex-col rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-blue-300 hover:shadow-lg'
    >
      <div class='mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100'>
        <HiOutlineDocumentText class='h-6 w-6 text-blue-600' />
      </div>
      <h3 class='mb-2 text-xl font-semibold text-gray-900'>{props.tool.name}</h3>
      <p class='mb-4 flex-1 text-sm text-gray-600'>{props.tool.bestUsedFor}</p>
      <div class='flex items-center gap-2 text-sm font-medium text-blue-600 group-hover:text-blue-700'>
        Learn more
        <FiArrowRight class='h-4 w-4 transition-transform group-hover:translate-x-1' />
      </div>
    </a>
  );
}

export default function Resources() {
  const pageUrl = `${config.appUrl}/resources`;
  const title = 'Resources - CoRATES';
  const description =
    'Learn about AMSTAR 2, ROBINS-I, RoB 2, and other appraisal tools supported by CoRATES, including scoring guidance and links to official documentation.';

  const tools = getAllTools();

  return (
    <>
      <Title>{title}</Title>
      <Meta name='description' content={description} />
      <Link rel='canonical' href={pageUrl} />
      <Meta property='og:title' content={title} />
      <Meta property='og:description' content={description} />
      <Meta property='og:url' content={pageUrl} />
      <Meta name='twitter:title' content={title} />
      <Meta name='twitter:description' content={description} />

      <div class='flex min-h-screen flex-col'>
        <Navbar />

        <main class='flex-1 py-12'>
          <div class='mx-auto max-w-4xl px-6'>
            <h1 class='mb-2 text-4xl font-bold text-gray-900'>Resources</h1>
            <p class='mb-10 text-lg text-gray-500'>
              Appraisal tools and guidance for systematic evidence synthesis
            </p>

            <div class='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
              <For each={tools}>{tool => <ToolCard tool={tool} />}</For>
            </div>

            <div class='mt-12 rounded-lg bg-gray-50 p-6'>
              <h2 class='mb-3 text-lg font-semibold text-gray-900'>About these tools</h2>
              <p class='text-gray-600'>
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
    </>
  );
}
