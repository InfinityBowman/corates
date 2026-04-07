import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import {
  FileTextIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  HelpCircleIcon,
  BookOpenIcon,
  LayersIcon,
  HistoryIcon,
  ZapIcon,
  QuoteIcon,
  GitBranchIcon,
} from 'lucide-react';
import { config } from '../../lib/config';
import type { ToolContent, ScoreLevel, DomainSummary, FaqEntry } from '../../lib/tool-content';

const COLOR_CONFIG = {
  green: {
    border: 'border-green-200',
    bg: 'bg-green-50',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  yellow: {
    border: 'border-yellow-200',
    bg: 'bg-yellow-50',
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
  },
  orange: {
    border: 'border-orange-200',
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
  },
  red: {
    border: 'border-red-200',
    bg: 'bg-red-50',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
  gray: {
    border: 'border-gray-200',
    bg: 'bg-gray-50',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
  },
};

const SCORE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  green: CheckCircleIcon,
  yellow: AlertCircleIcon,
  orange: AlertTriangleIcon,
  red: AlertCircleIcon,
  gray: HelpCircleIcon,
};

function ScoreLevelCard({ level }: { level: ScoreLevel }) {
  const colors = COLOR_CONFIG[level.color] || COLOR_CONFIG.gray;
  const Icon = SCORE_ICON_MAP[level.color] || AlertCircleIcon;

  return (
    <div className={`rounded-lg border p-6 ${colors.border} ${colors.bg}`}>
      <div className='flex items-start gap-4'>
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${colors.iconBg}`}
        >
          <Icon className={`size-5 ${colors.iconColor}`} />
        </div>
        <div>
          <h3 className='mb-2 text-lg font-semibold text-gray-900'>{level.name}</h3>
          <p className='text-gray-600'>{level.description}</p>
          {level.note && <p className='mt-2 text-sm text-gray-500 italic'>{level.note}</p>}
        </div>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <main className='flex flex-1 items-center justify-center py-16'>
      <div className='text-center'>
        <h1 className='mb-2 text-2xl font-bold text-gray-900'>Tool Not Found</h1>
        <p className='mb-4 text-gray-600'>The requested resource page could not be found.</p>
        <Link to='/resources' className='font-medium text-blue-600 hover:text-blue-700'>
          Back to Resources
        </Link>
      </div>
    </main>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className='rounded-lg bg-gray-50 p-6'>
      <div className='flex items-start gap-4'>
        <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100'>
          <Icon className='size-5 text-blue-600' />
        </div>
        <div className='min-w-0 flex-1'>
          <h2 className='mb-2 text-lg font-semibold text-gray-900'>{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}

function DomainsSection({ domains, intro }: { domains: DomainSummary[]; intro?: string }) {
  return (
    <SectionCard icon={LayersIcon} title='Bias domains assessed'>
      {intro && <p className='mb-4 text-gray-600'>{intro}</p>}
      <ol className='flex flex-col gap-3 text-gray-600'>
        {domains.map((domain, index) => (
          <li key={domain.name} className='rounded border border-gray-200 bg-white p-4'>
            <h3 className='mb-1 font-semibold text-gray-900'>
              <span className='mr-2 text-blue-600'>{index + 1}.</span>
              {domain.name}
            </h3>
            <p className='text-sm text-gray-600'>{domain.shortDescription}</p>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

function FaqSection({ faq }: { faq: FaqEntry[] }) {
  return (
    <SectionCard icon={HelpCircleIcon} title='Frequently asked questions'>
      <dl className='flex flex-col gap-5'>
        {faq.map(entry => (
          <div key={entry.question}>
            <dt className='mb-1 font-semibold text-gray-900'>{entry.question}</dt>
            <dd className='text-gray-600'>{entry.answer}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}

function ToolContentView({ tool }: { tool: ToolContent }) {
  const pageUrl = `${config.appUrl}/resources/${tool.slug}`;

  const breadcrumbSchema = useMemo(
    () =>
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: config.appUrl,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Resources',
            item: `${config.appUrl}/resources`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: tool.name,
            item: pageUrl,
          },
        ],
      }),
    [tool.name, pageUrl],
  );

  // FAQPage JSON-LD enables Google's FAQ rich snippet in search results.
  // Only emitted when the tool has FAQ content; pages without FAQ data
  // (currently AMSTAR 2 and RoB 2) skip this entirely.
  const faqSchema = useMemo(() => {
    if (!tool.faq || tool.faq.length === 0) return null;
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: tool.faq.map(entry => ({
        '@type': 'Question',
        name: entry.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: entry.answer,
        },
      })),
    });
  }, [tool.faq]);

  return (
    <>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
      {faqSchema && (
        <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: faqSchema }} />
      )}

      <main className='flex-1 py-12'>
        <div className='mx-auto max-w-4xl px-6'>
          <h1 className='mb-2 text-4xl font-bold text-gray-900'>{tool.name}</h1>
          <p className='mb-8 text-gray-500'>Appraisal tool guidance</p>

          <div className='flex flex-col gap-8 leading-relaxed text-gray-700'>
            <div>
              <h2 className='mb-4 text-2xl font-semibold text-gray-900'>{tool.name}</h2>
              {tool.fullName && <p className='mb-3 text-sm text-gray-500'>{tool.fullName}</p>}
              <p className='mb-6 text-gray-600'>{tool.description}</p>
              {tool.versionNote && (
                <p className='rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900'>
                  {tool.versionNote}
                </p>
              )}
            </div>

            <SectionCard icon={FileTextIcon} title='Best used for'>
              <p className='text-gray-600'>{tool.bestUsedFor}</p>
              {tool.studyTypes && tool.studyTypes.length > 0 && (
                <ul className='mt-4 list-inside list-disc space-y-1 text-gray-600'>
                  {tool.studyTypes.map(type => (
                    <li key={type}>{type}</li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {tool.domains && tool.domains.length > 0 && (
              <DomainsSection domains={tool.domains} intro={tool.domainsIntro} />
            )}

            {(tool.whenToUse || tool.whenNotToUse) && (
              <SectionCard icon={CheckCircleIcon} title='When to use this tool'>
                {tool.whenToUse && <p className='mb-4 text-gray-600'>{tool.whenToUse}</p>}
                {tool.whenNotToUse && (
                  <>
                    <h3 className='mb-2 font-semibold text-gray-900'>When not to use it</h3>
                    <p className='text-gray-600'>{tool.whenNotToUse}</p>
                  </>
                )}
              </SectionCard>
            )}

            {tool.comparisonWithAlternatives && (
              <SectionCard icon={GitBranchIcon} title='How it compares to related tools'>
                <p className='text-gray-600'>{tool.comparisonWithAlternatives}</p>
              </SectionCard>
            )}

            <SectionCard icon={ExternalLinkIcon} title='Reference Documents'>
              <ul className='flex flex-col gap-3 text-gray-600'>
                {tool.referenceLinks.map(link => (
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

            <div className='border-t border-gray-200 pt-8'>
              <h2 className='mb-4 text-xl font-semibold text-gray-900'>Scoring</h2>
              <p className='mb-6 text-gray-600'>{tool.scoringDescription}</p>

              <div className='grid gap-4'>
                {tool.scoreLevels.map(level => (
                  <ScoreLevelCard key={level.name} level={level} />
                ))}
              </div>
            </div>

            {tool.workflowInCoRATES && (
              <SectionCard icon={ZapIcon} title='How CoRATES supports this tool'>
                <p className='text-gray-600'>{tool.workflowInCoRATES}</p>
              </SectionCard>
            )}

            {tool.versionHistory && (
              <SectionCard icon={HistoryIcon} title='Version history'>
                <p className='text-gray-600'>{tool.versionHistory}</p>
              </SectionCard>
            )}

            {tool.commonPitfalls && tool.commonPitfalls.length > 0 && (
              <SectionCard icon={AlertTriangleIcon} title='Common pitfalls'>
                <ul className='flex flex-col gap-3 text-gray-600'>
                  {tool.commonPitfalls.map(pitfall => (
                    <li key={pitfall} className='flex gap-3'>
                      <AlertCircleIcon className='size-5 shrink-0 text-orange-500' />
                      <span>{pitfall}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {tool.faq && tool.faq.length > 0 && <FaqSection faq={tool.faq} />}

            {tool.developedBy && (
              <SectionCard icon={BookOpenIcon} title='About the tool'>
                <p className='text-gray-600'>{tool.developedBy}</p>
              </SectionCard>
            )}

            {tool.citations && tool.citations.length > 0 && (
              <SectionCard icon={QuoteIcon} title='Further reading'>
                <ul className='flex flex-col gap-3 text-sm text-gray-600'>
                  {tool.citations.map(citation => (
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
            )}

            <div className='rounded-lg border border-gray-200 bg-gray-50 p-6'>
              <p className='text-sm leading-relaxed text-gray-600'>
                CoRATES supports the structured use of this appraisal framework by providing
                workflow, documentation, and collaboration features. CoRATES does not reproduce,
                modify, or replace the instrument.
              </p>
              <p className='mt-2 text-sm leading-relaxed text-gray-600'>
                This framework is the intellectual property of its original authors. Users should
                consult the official publications and guidance linked above when applying the tool.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default function ToolResourcePage({ tool }: { tool: ToolContent | null }) {
  if (!tool) {
    return <NotFoundPage />;
  }

  return <ToolContentView tool={tool} />;
}
