import { Title, Meta, Link } from '@solidjs/meta';
import { For, Show, createMemo } from 'solid-js';
import { HiOutlineDocumentText } from 'solid-icons/hi';
import { AiOutlineCheckCircle } from 'solid-icons/ai';
import { FiExternalLink, FiAlertCircle, FiAlertTriangle, FiHelpCircle } from 'solid-icons/fi';
import Navbar from '~/components/Navbar';
import Footer from '~/components/Footer';
import { config } from '~/lib/config';

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

function getScoreLevelIcon(color) {
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

function ScoreLevelCard(props) {
  const colors = () => COLOR_CONFIG[props.level.color] || COLOR_CONFIG.gray;
  const Icon = createMemo(() => getScoreLevelIcon(props.level.color));

  return (
    <div class={`rounded-lg border p-6 ${colors().border} ${colors().bg}`}>
      <div class='flex items-start gap-4'>
        <div
          class={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colors().iconBg}`}
        >
          {(() => {
            const IconComponent = Icon();
            return <IconComponent class={`h-5 w-5 ${colors().iconColor}`} />;
          })()}
        </div>
        <div>
          <h3 class='mb-2 text-lg font-semibold text-gray-900'>{props.level.name}</h3>
          <p class='text-gray-600'>{props.level.description}</p>
          <Show when={props.level.note}>
            <p class='mt-2 text-sm text-gray-500 italic'>{props.level.note}</p>
          </Show>
        </div>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div class='flex min-h-screen flex-col'>
      <Navbar />
      <main class='flex flex-1 items-center justify-center py-16'>
        <div class='text-center'>
          <h1 class='mb-2 text-2xl font-bold text-gray-900'>Tool Not Found</h1>
          <p class='mb-4 text-gray-600'>The requested resource page could not be found.</p>
          <a href='/resources' class='font-medium text-blue-600 hover:text-blue-700'>
            Back to Resources
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ToolContent(props) {
  const pageUrl = () => `${config.appUrl}/resources/${props.tool.slug}`;
  const title = () => `${props.tool.name} Resources - CoRATES`;
  const description = () =>
    `Learn about ${props.tool.name}, including scoring guidance and links to official documentation.`;

  return (
    <>
      <Title>{title()}</Title>
      <Meta name='description' content={description()} />
      <Link rel='canonical' href={pageUrl()} />
      <Meta property='og:title' content={title()} />
      <Meta property='og:description' content={description()} />
      <Meta property='og:url' content={pageUrl()} />
      <Meta name='twitter:title' content={title()} />
      <Meta name='twitter:description' content={description()} />

      <div class='flex min-h-screen flex-col'>
        <Navbar />

        <main class='flex-1 py-12'>
          <div class='mx-auto max-w-4xl px-6'>
            <h1 class='mb-2 text-4xl font-bold text-gray-900'>{props.tool.name}</h1>
            <p class='mb-8 text-gray-500'>Appraisal tool guidance</p>

            <div class='space-y-8 leading-relaxed text-gray-700'>
              <div>
                <h2 class='mb-4 text-2xl font-semibold text-gray-900'>{props.tool.name}</h2>
                <p class='mb-6 text-gray-600'>{props.tool.description}</p>
              </div>

              <div class='rounded-lg bg-gray-50 p-6'>
                <div class='flex items-start gap-4'>
                  <div class='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100'>
                    <HiOutlineDocumentText class='h-5 w-5 text-blue-600' />
                  </div>
                  <div>
                    <h2 class='mb-2 text-lg font-semibold text-gray-900'>Best used for</h2>
                    <p class='text-gray-600'>{props.tool.bestUsedFor}</p>
                  </div>
                </div>
              </div>

              <div class='rounded-lg bg-gray-50 p-6'>
                <div class='flex items-start gap-4'>
                  <div class='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100'>
                    <FiExternalLink class='h-5 w-5 text-blue-600' />
                  </div>
                  <div class='flex-1'>
                    <h2 class='mb-4 text-lg font-semibold text-gray-900'>Reference Documents</h2>
                    <ul class='space-y-3 text-gray-600'>
                      <For each={props.tool.referenceLinks}>
                        {link => (
                          <li>
                            <a
                              href={link.href}
                              target='_blank'
                              rel='external noopener noreferrer'
                              class='inline-flex items-center gap-2 font-medium text-blue-600 hover:text-blue-700'
                            >
                              {link.text}
                              <FiExternalLink class='h-4 w-4' />
                            </a>
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                </div>
              </div>

              <div class='border-t border-gray-200 pt-8'>
                <h2 class='mb-4 text-xl font-semibold text-gray-900'>Scoring</h2>
                <p class='mb-6 text-gray-600'>{props.tool.scoringDescription}</p>

                <div class='grid gap-4'>
                  <For each={props.tool.scoreLevels}>
                    {level => <ScoreLevelCard level={level} />}
                  </For>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default function ToolResourcePage(props) {
  return (
    <Show when={props.tool} fallback={<NotFoundPage />}>
      <ToolContent tool={props.tool} />
    </Show>
  );
}
