import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { HiOutlineDocumentText } from 'react-icons/hi2';
import { AiOutlineCheckCircle } from 'react-icons/ai';
import { FiExternalLink, FiAlertCircle, FiAlertTriangle, FiHelpCircle } from 'react-icons/fi';
import { config } from '../../lib/config';
import type { ToolContent, ScoreLevel } from '../../lib/tool-content';

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

function getScoreLevelIcon(color: string) {
  switch (color) {
    case 'green':
      return AiOutlineCheckCircle;
    case 'yellow':
      return FiAlertCircle;
    case 'orange':
      return FiAlertTriangle;
    case 'red':
      return FiAlertCircle;
    case 'gray':
      return FiHelpCircle;
    default:
      return FiAlertCircle;
  }
}

function ScoreLevelCard({ level }: { level: ScoreLevel }) {
  const colors = COLOR_CONFIG[level.color] || COLOR_CONFIG.gray;
  const Icon = getScoreLevelIcon(level.color);

  return (
    <div className={`rounded-lg border p-6 ${colors.border} ${colors.bg}`}>
      <div className='flex items-start gap-4'>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colors.iconBg}`}
        >
          <Icon className={`h-5 w-5 ${colors.iconColor}`} />
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

function ToolContentView({ tool }: { tool: ToolContent }) {
  const pageUrl = `${config.appUrl}/resources/${tool.slug}`;
  const title = `${tool.name} Resources - CoRATES`;
  const description = `Learn about ${tool.name}, including scoring guidance and links to official documentation.`;

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
    [tool.name, tool.slug, pageUrl],
  );

  return (
    <>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />

      <main className='flex-1 py-12'>
        <div className='mx-auto max-w-4xl px-6'>
          <h1 className='mb-2 text-4xl font-bold text-gray-900'>{tool.name}</h1>
          <p className='mb-8 text-gray-500'>Appraisal tool guidance</p>

          <div className='space-y-8 leading-relaxed text-gray-700'>
            <div>
              <h2 className='mb-4 text-2xl font-semibold text-gray-900'>{tool.name}</h2>
              <p className='mb-6 text-gray-600'>{tool.description}</p>
            </div>

            <div className='rounded-lg bg-gray-50 p-6'>
              <div className='flex items-start gap-4'>
                <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100'>
                  <HiOutlineDocumentText className='h-5 w-5 text-blue-600' />
                </div>
                <div>
                  <h2 className='mb-2 text-lg font-semibold text-gray-900'>Best used for</h2>
                  <p className='text-gray-600'>{tool.bestUsedFor}</p>
                </div>
              </div>
            </div>

            <div className='rounded-lg bg-gray-50 p-6'>
              <div className='flex items-start gap-4'>
                <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100'>
                  <FiExternalLink className='h-5 w-5 text-blue-600' />
                </div>
                <div className='flex-1'>
                  <h2 className='mb-4 text-lg font-semibold text-gray-900'>Reference Documents</h2>
                  <ul className='space-y-3 text-gray-600'>
                    {tool.referenceLinks.map(link => (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          target='_blank'
                          rel='external noopener noreferrer'
                          className='inline-flex items-center gap-2 font-medium text-blue-600 hover:text-blue-700'
                        >
                          {link.text}
                          <FiExternalLink className='h-4 w-4' />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

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

            <div className='border-t border-gray-200 pt-8'>
              <h2 className='mb-4 text-xl font-semibold text-gray-900'>Scoring</h2>
              <p className='mb-6 text-gray-600'>{tool.scoringDescription}</p>

              <div className='grid gap-4'>
                {tool.scoreLevels.map(level => (
                  <ScoreLevelCard key={level.name} level={level} />
                ))}
              </div>
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
