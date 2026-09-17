import { Link } from '@tanstack/react-router';
import {
  ArrowRightIcon,
  ExternalLinkIcon,
  HelpCircleIcon,
  QuoteIcon,
  LinkIcon,
} from 'lucide-react';
import { config } from '@/lib/config';
import { clientLogger } from '@/lib/clientLogger';
import { SectionCard } from '@/components/resources/SectionCard';
import { DecisionTree } from '@/components/resources/DecisionTree';
import { DomainMappingFigure } from '@/components/resources/DomainMappingFigure';
import { getToolBySlug } from '@/lib/tool-content';
import type { ComparisonContent, ComparisonTable, QuickAnswer } from '@/lib/comparison-content';

function QuickAnswerCard({ item }: { item: QuickAnswer }) {
  return (
    <div className='flex flex-col rounded-lg border border-blue-100 bg-blue-50 p-5'>
      <p className='text-sm font-medium text-blue-900'>{item.situation}</p>
      <p className='mt-1 text-xl font-semibold text-gray-900'>{item.answer}</p>
      <p className='mt-2 text-sm text-gray-600'>{item.detail}</p>
    </div>
  );
}

/**
 * Renders as a table from the sm breakpoint. Below that each row collapses
 * into a stacked block with the column name repeated above every cell, so the
 * three-column comparisons stay readable on a phone without sideways scroll.
 */
function ComparisonTableView({ table }: { table: ComparisonTable }) {
  const [rowHeader, ...valueColumns] = table.columns;
  return (
    <div className='overflow-hidden rounded-lg border border-gray-200 bg-white'>
      <table className='block w-full text-sm sm:table'>
        <thead className='hidden bg-gray-50 sm:table-header-group'>
          <tr>
            <th scope='col' className='px-4 py-3 text-left font-semibold text-gray-700'>
              {rowHeader}
            </th>
            {valueColumns.map(column => (
              <th
                key={column}
                scope='col'
                className='px-4 py-3 text-left font-semibold text-gray-700'
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className='block sm:table-row-group'>
          {table.rows.map(([label, ...cells]) => (
            <tr
              key={label}
              className='block border-t border-gray-200 p-4 sm:table-row sm:p-0 sm:align-top'
            >
              <th
                scope='row'
                className='block pb-2 text-left font-semibold text-gray-900 sm:table-cell sm:w-1/5 sm:px-4 sm:py-3'
              >
                {label}
              </th>
              {cells.map((cell, index) => (
                <td
                  key={valueColumns[index]}
                  data-label={valueColumns[index]}
                  className='block pb-2 text-gray-600 before:block before:text-xs before:font-semibold before:tracking-wide before:text-gray-500 before:uppercase before:content-[attr(data-label)] last:pb-0 sm:table-cell sm:px-4 sm:py-3 sm:before:hidden'
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonCta({ comparison }: { comparison: ComparisonContent }) {
  const tools = comparison.ctaTools.map(slug => getToolBySlug(slug)).filter(tool => tool !== null);
  if (tools.length === 0) return null;

  const names = tools.map(tool => tool.name).join(' and ');

  return (
    <div className='rounded-lg border border-blue-200 bg-blue-50 p-6'>
      <h2 className='text-lg font-semibold text-gray-900'>Appraise with {names} in CoRATES</h2>
      <p className='mt-2 text-gray-600'>
        Open an appraisal in your browser and work through it item by item. Nothing to install and
        no account needed.
        {comparison.ctaNote && <> {comparison.ctaNote}</>}
      </p>
      <div className='mt-5 flex flex-col gap-3 sm:flex-row'>
        {tools.map(tool => (
          <Link
            key={tool.slug}
            to='/checklist'
            search={{ type: tool.checklistType }}
            onClick={() =>
              clientLogger.info('client.resource.cta_clicked', {
                tool: tool.slug,
                placement: 'comparison',
                page: comparison.slug,
                target: 'checklist',
              })
            }
            className='group inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none'
          >
            Start a {tool.name} appraisal
            <ArrowRightIcon className='size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function ComparisonPage({ comparison }: { comparison: ComparisonContent }) {
  const pageUrl = `${config.appUrl}/resources/${comparison.slug}`;

  const breadcrumbSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: config.appUrl },
      { '@type': 'ListItem', position: 2, name: 'Resources', item: `${config.appUrl}/resources` },
      { '@type': 'ListItem', position: 3, name: comparison.title, item: pageUrl },
    ],
  });

  const faqSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: comparison.faq.map(entry => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  });

  return (
    <>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: faqSchema }} />

      <main className='flex-1 py-12'>
        <div className='mx-auto max-w-4xl px-6'>
          <h1 className='mb-2 text-4xl font-bold text-gray-900'>{comparison.title}</h1>
          <p className='mb-8 text-gray-500'>Choosing an appraisal tool</p>

          <div className='flex flex-col gap-8 leading-relaxed text-gray-700'>
            <div className='flex flex-col gap-4'>
              {comparison.intro.map(paragraph => (
                <p key={paragraph} className='text-gray-600'>
                  {paragraph}
                </p>
              ))}
            </div>

            <section>
              <h2 className='mb-4 text-2xl font-semibold text-gray-900'>The short answer</h2>
              <div className='grid gap-4 sm:grid-cols-3'>
                {comparison.quickAnswers.map(item => (
                  <QuickAnswerCard key={item.situation} item={item} />
                ))}
              </div>
            </section>

            {comparison.sections.map(section => (
              <section key={section.heading}>
                <h2 className='mb-3 text-2xl font-semibold text-gray-900'>{section.heading}</h2>
                {section.paragraphs.map(paragraph => (
                  <p key={paragraph} className='mb-4 text-gray-600'>
                    {paragraph}
                  </p>
                ))}
                {section.decisionTree && <DecisionTree root={section.decisionTree} />}
                {section.domainMapping && <DomainMappingFigure mapping={section.domainMapping} />}
                {section.table && <ComparisonTableView table={section.table} />}
              </section>
            ))}

            <ComparisonCta comparison={comparison} />

            <SectionCard icon={HelpCircleIcon} title='Frequently asked questions'>
              <dl className='flex flex-col gap-5'>
                {comparison.faq.map(entry => (
                  <div key={entry.question}>
                    <dt className='mb-1 font-semibold text-gray-900'>{entry.question}</dt>
                    <dd className='text-gray-600'>{entry.answer}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>

            <SectionCard icon={ExternalLinkIcon} title='Reference Documents'>
              <ul className='flex flex-col gap-3 text-gray-600'>
                {comparison.referenceLinks.map(link => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target='_blank'
                      rel='external noopener noreferrer'
                      className='inline-flex items-center gap-2 font-medium text-blue-600 hover:text-blue-700'
                    >
                      {link.text}
                      <ExternalLinkIcon className='size-4' />
                    </a>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard icon={QuoteIcon} title='Further reading'>
              <ul className='flex flex-col gap-3 text-sm text-gray-600'>
                {comparison.citations.map(citation => (
                  <li key={citation.title}>
                    {citation.authors} ({citation.year}). {citation.title}.{' '}
                    <em>{citation.source}</em>
                    {citation.url && (
                      <>
                        .{' '}
                        <a
                          href={citation.url}
                          target='_blank'
                          rel='external noopener noreferrer'
                          className='font-medium text-blue-600 hover:text-blue-700'
                        >
                          View
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard icon={LinkIcon} title='Related guides'>
              <ul className='flex flex-col gap-2'>
                {comparison.related.map(link => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className='inline-flex items-center gap-2 font-medium text-blue-600 hover:text-blue-700'
                    >
                      {link.label}
                      <ArrowRightIcon className='size-4' />
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <div className='rounded-lg border border-gray-200 bg-gray-50 p-6'>
              <p className='text-sm leading-relaxed text-gray-600'>
                This page describes the tools and cites their official sources. It does not
                reproduce signalling questions, items or scoring tables, which are the intellectual
                property of their original authors. Consult the official publications and guidance
                linked above when applying any tool.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
