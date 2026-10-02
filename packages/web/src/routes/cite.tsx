import { useState, useSyncExternalStore } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { CheckIcon, CopyIcon, DownloadIcon } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '@/components/ui/button';
import { config } from '../lib/config';
import { coratesCitationMeta, getCoratesCitations } from '@/lib/coratesCitation';

const pageUrl = `${config.appUrl}/cite`;
const title = 'How to Cite CoRATES - APA, AMA, Vancouver, and BibTeX';
const description =
  'Cite CoRATES in the methods section of your systematic review or evidence synthesis. Copy an APA, AMA, Vancouver, or BibTeX citation, or download RIS for your reference manager.';

function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const subscribeNever = () => () => {};

export const Route = createFileRoute('/cite')({
  headers: () => ({
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  }),
  loader: () => ({ renderedOn: localDateKey() }),
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: pageUrl },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      ...coratesCitationMeta(),
    ],
    links: [{ rel: 'canonical', href: pageUrl }],
  }),
  component: CitePage,
});

function CitePage() {
  const { renderedOn } = Route.useLoaderData();
  // Hydrate with the date the server rendered, then switch to the reader's own
  // day: a cached page or a UTC server can be a day off the reader's calendar.
  const today = useSyncExternalStore(subscribeNever, localDateKey, () => renderedOn);
  const citations = getCoratesCitations({ now: dateFromKey(today) });
  const risHref = `data:application/x-research-info-systems;charset=utf-8,${encodeURIComponent(citations.ris)}`;

  return (
    <div className='flex min-h-screen flex-col'>
      <Navbar />

      <main className='flex-1 py-12'>
        <div className='mx-auto max-w-3xl px-6'>
          <h1 className='mb-2 text-4xl font-bold text-gray-900'>How to cite CoRATES</h1>
          <p className='mb-8 text-gray-500'>Citations for your methods section</p>

          <div className='flex flex-col gap-6 leading-relaxed text-gray-700'>
            <p>
              If you used CoRATES to appraise studies in your review, cite it in your methods
              section alongside the appraisal tools you used, such as RoB 2, ROBINS-I, or AMSTAR 2.
            </p>

            <CitationCard label='APA' text={citations.apa} />
            <CitationCard label='AMA' text={citations.ama} />
            <CitationCard label='Vancouver' text={citations.vancouver} />
            <CitationCard label='BibTeX' text={citations.bibtex} code />

            <div className='flex flex-col items-start gap-2 rounded-lg bg-gray-50 p-6'>
              <h2 className='text-lg font-semibold text-gray-900'>Reference managers</h2>
              <p className='text-gray-600'>
                Import the RIS file into EndNote, Zotero, or Mendeley. The Zotero browser connector
                also saves CoRATES directly from this page.
              </p>
              <Button variant='outline' asChild>
                <a href={risHref} download='corates.ris'>
                  <DownloadIcon data-icon='inline-start' />
                  Download RIS
                </a>
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function CitationCard({
  label,
  text,
  code = false,
}: {
  label: string;
  text: string;
  code?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className='rounded-lg bg-gray-50 p-6'>
      <div className='mb-2 flex items-center justify-between'>
        <h2 className='text-lg font-semibold text-gray-900'>{label}</h2>
        <Button variant='ghost' size='sm' onClick={copy} aria-label={`Copy ${label} citation`}>
          {copied ?
            <CheckIcon data-icon='inline-start' className='text-success' />
          : <CopyIcon data-icon='inline-start' />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {code ?
        <pre className='text-sm break-words whitespace-pre-wrap text-gray-700'>{text}</pre>
      : <p className='text-gray-700'>{text}</p>}
    </div>
  );
}
