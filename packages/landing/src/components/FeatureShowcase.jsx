import { For } from 'solid-js';
import { AiOutlineCheckCircle } from 'solid-icons/ai';
import { HiOutlineDocumentText, HiOutlineShieldCheck } from 'solid-icons/hi';
import { BsGraphUp } from 'solid-icons/bs';
import { FiLock, FiKey, FiShield } from 'solid-icons/fi';

// Real-time Collaboration Illustration
function CollaborationIllustration() {
  return (
    <div class='bg-linear-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 overflow-hidden p-8'>
      <div class='relative aspect-4/3 flex items-center justify-center'>
        {/* Central document */}
        <div class='absolute inset-0 flex items-center justify-center'>
          <div class='bg-white rounded-lg shadow-lg p-6 w-48 border-2 border-blue-300'>
            <div class='space-y-2'>
              <div class='h-2 bg-gray-200 rounded w-full' />
              <div class='h-2 bg-gray-200 rounded w-5/6' />
              <div class='h-2 bg-blue-400 rounded w-4/6 animate-pulse' />
              <div class='h-2 bg-gray-100 rounded w-full' />
            </div>
          </div>
        </div>

        {/* User avatars with activity indicators */}
        <div class='absolute -top-2 -left-2'>
          <div class='relative'>
            <div class='w-12 h-12 rounded-full bg-linear-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg'>
              A
            </div>
            <div class='absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white' />
          </div>
        </div>

        <div class='absolute -top-2 -right-2'>
          <div class='relative'>
            <div class='w-12 h-12 rounded-full bg-linear-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-bold shadow-lg'>
              B
            </div>
            <div class='absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse' />
          </div>
        </div>

        <div class='absolute -bottom-2 -left-2'>
          <div class='relative'>
            <div class='w-12 h-12 rounded-full bg-linear-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg'>
              C
            </div>
            <div class='absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full border-2 border-white' />
          </div>
        </div>

        {/* Activity indicators */}
        <div class='absolute -right-4 top-1/4'>
          <div class='bg-white rounded-lg shadow-md px-3 py-2 text-xs flex items-center gap-1.5 border border-green-200'>
            <div class='w-2 h-2 bg-green-500 rounded-full animate-pulse' />
            <span class='text-gray-700 font-medium'>Live</span>
          </div>
        </div>

        <div class='absolute -left-4 bottom-1/4'>
          <div class='bg-white rounded-lg shadow-md px-3 py-2 text-xs flex items-center gap-1.5'>
            <AiOutlineCheckCircle class='w-3 h-3 text-blue-600' />
            <span class='text-gray-700'>Updated</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Security Illustration
function SecurityIllustration() {
  return (
    <div class='bg-linear-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 overflow-hidden p-8'>
      <div class='relative aspect-4/3 flex items-center justify-center'>
        {/* Central shield */}
        <div class='absolute inset-0 flex items-center justify-center'>
          <div class='relative'>
            <div class='w-32 h-36 bg-linear-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-xl'>
              <HiOutlineShieldCheck class='w-16 h-16 text-white' />
            </div>
            <div class='absolute -inset-4 border-2 border-emerald-300 rounded-lg animate-pulse opacity-50' />
          </div>
        </div>

        {/* Auth method badges */}
        <div class='absolute top-4 left-4'>
          <div class='bg-white rounded-lg shadow-md px-3 py-2 flex items-center gap-2 border border-emerald-200'>
            <FiKey class='w-4 h-4 text-emerald-600' />
            <span class='text-xs font-medium text-gray-700'>OAuth</span>
          </div>
        </div>

        <div class='absolute top-4 right-4'>
          <div class='bg-white rounded-lg shadow-md px-3 py-2 flex items-center gap-2 border border-blue-200'>
            <FiLock class='w-4 h-4 text-blue-600' />
            <span class='text-xs font-medium text-gray-700'>2FA</span>
          </div>
        </div>

        <div class='absolute bottom-6 left-6'>
          <div class='bg-white rounded-lg shadow-md px-3 py-2 flex items-center gap-2 border border-purple-200'>
            <svg class='w-4 h-4 text-purple-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
              />
            </svg>
            <span class='text-xs font-medium text-gray-700'>Passwordless</span>
          </div>
        </div>

        <div class='absolute bottom-6 right-6'>
          <div class='bg-white rounded-lg shadow-md px-3 py-2 flex items-center gap-2 border border-indigo-200'>
            <FiShield class='w-4 h-4 text-indigo-600' />
            <span class='text-xs font-medium text-gray-700'>SSO</span>
          </div>
        </div>

        {/* Security checkmarks */}
        <div class='absolute -right-2 top-1/3'>
          <div class='w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-md'>
            <svg class='w-4 h-4 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M5 13l4 4L19 7' />
            </svg>
          </div>
        </div>

        <div class='absolute -left-2 top-1/2'>
          <div class='w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-md'>
            <svg class='w-4 h-4 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M5 13l4 4L19 7' />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// Automatic Scoring Illustration
function ScoringIllustration() {
  return (
    <div class='bg-linear-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 overflow-hidden p-8'>
      <div class='relative aspect-4/3 flex items-center justify-center'>
        {/* Checklist card */}
        <div class='bg-white rounded-lg shadow-lg p-4 w-56 border border-amber-200'>
          {/* Header */}
          <div class='flex items-center justify-between mb-3 pb-2 border-b border-gray-100'>
            <span class='text-xs font-semibold text-gray-700'>AMSTAR-2</span>
            <div class='bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded'>High</div>
          </div>

          {/* Checklist items */}
          <div class='space-y-2'>
            <div class='flex items-center gap-2'>
              <div class='w-4 h-4 rounded bg-green-500 flex items-center justify-center'>
                <svg class='w-3 h-3 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M5 13l4 4L19 7' />
                </svg>
              </div>
              <div class='h-2 bg-gray-200 rounded flex-1' />
            </div>
            <div class='flex items-center gap-2'>
              <div class='w-4 h-4 rounded bg-green-500 flex items-center justify-center'>
                <svg class='w-3 h-3 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M5 13l4 4L19 7' />
                </svg>
              </div>
              <div class='h-2 bg-gray-200 rounded flex-1' />
            </div>
            <div class='flex items-center gap-2'>
              <div class='w-4 h-4 rounded bg-yellow-500 flex items-center justify-center'>
                <span class='text-white text-xs font-bold'>!</span>
              </div>
              <div class='h-2 bg-gray-200 rounded flex-1' />
            </div>
            <div class='flex items-center gap-2'>
              <div class='w-4 h-4 rounded bg-green-500 flex items-center justify-center'>
                <svg class='w-3 h-3 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M5 13l4 4L19 7' />
                </svg>
              </div>
              <div class='h-2 bg-gray-200 rounded flex-1' />
            </div>
          </div>

          {/* Progress bar */}
          <div class='mt-3 pt-2 border-t border-gray-100'>
            <div class='flex justify-between text-xs text-gray-500 mb-1'>
              <span>Progress</span>
              <span class='font-medium'>75%</span>
            </div>
            <div class='h-2 bg-gray-100 rounded-full overflow-hidden'>
              <div class='h-full w-3/4 bg-linear-to-r from-amber-400 to-orange-500 rounded-full' />
            </div>
          </div>
        </div>

        {/* Floating score badge */}
        <div class='absolute -top-2 -right-2'>
          <div class='bg-linear-to-br from-amber-500 to-orange-500 rounded-lg px-3 py-2 shadow-lg'>
            <div class='text-white text-xs font-medium'>Score</div>
            <div class='text-white text-xl font-bold'>14/16</div>
          </div>
        </div>

        {/* Auto-calculate indicator */}
        <div class='absolute -bottom-2 left-4'>
          <div class='bg-white rounded-lg shadow-md px-3 py-2 flex items-center gap-2 border border-green-200'>
            <div class='w-2 h-2 bg-green-500 rounded-full animate-pulse' />
            <span class='text-xs font-medium text-gray-700'>Auto-calculated</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// PDF Annotation Illustration
function PDFAnnotationIllustration() {
  return (
    <div class='bg-linear-to-br from-rose-50 to-pink-50 rounded-xl border border-rose-200 overflow-hidden p-8'>
      <div class='relative aspect-4/3 flex items-center justify-center'>
        {/* PDF document */}
        <div class='bg-white rounded-lg shadow-lg w-52 border border-gray-200 overflow-hidden'>
          {/* PDF header bar */}
          <div class='bg-gray-100 px-3 py-1.5 border-b border-gray-200 flex items-center gap-2'>
            <HiOutlineDocumentText class='w-4 h-4 text-rose-500' />
            <span class='text-xs text-gray-600 truncate'>study_2024.pdf</span>
          </div>

          {/* PDF content */}
          <div class='p-3 space-y-2'>
            <div class='h-2 bg-gray-200 rounded w-full' />
            <div class='h-2 bg-gray-200 rounded w-5/6' />

            {/* Highlighted text */}
            <div class='relative'>
              <div class='h-2 bg-yellow-300 rounded w-4/5' />
              <div class='absolute -right-1 -top-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center shadow-sm'>
                <span class='text-white text-xs font-bold'>1</span>
              </div>
            </div>

            <div class='h-2 bg-gray-200 rounded w-full' />
            <div class='h-2 bg-gray-200 rounded w-3/4' />

            {/* Another highlight */}
            <div class='relative'>
              <div class='h-2 bg-blue-300 rounded w-2/3' />
              <div class='absolute -right-1 -top-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shadow-sm'>
                <span class='text-white text-xs font-bold'>2</span>
              </div>
            </div>

            <div class='h-2 bg-gray-200 rounded w-full' />
            <div class='h-2 bg-gray-200 rounded w-4/6' />
          </div>
        </div>

        {/* Annotation comment bubble */}
        <div class='absolute -top-2 -right-4'>
          <div class='bg-white rounded-lg shadow-lg p-3 w-32 border border-rose-200'>
            <div class='flex items-center gap-1.5 mb-1.5'>
              <div class='w-5 h-5 rounded-full bg-linear-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white text-xs font-bold'>
                R
              </div>
              <span class='text-xs font-medium text-gray-700'>Note</span>
            </div>
            <p class='text-xs text-gray-500 leading-tight'>Key finding for Q7...</p>
          </div>
        </div>

        {/* Link indicator */}
        <div class='absolute -bottom-2 -left-2'>
          <div class='bg-white rounded-lg shadow-md px-3 py-2 flex items-center gap-2 border border-rose-200'>
            <svg class='w-4 h-4 text-rose-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1'
              />
            </svg>
            <span class='text-xs font-medium text-gray-700'>Linked</span>
          </div>
        </div>

        {/* Toolbar floating */}
        <div class='absolute top-1/2 -left-4 transform -translate-y-1/2'>
          <div class='bg-white rounded-lg shadow-md p-1.5 flex flex-col gap-1 border border-gray-200'>
            <div class='w-6 h-6 bg-yellow-100 rounded flex items-center justify-center'>
              <div class='w-3 h-3 bg-yellow-400 rounded-sm' />
            </div>
            <div class='w-6 h-6 bg-blue-100 rounded flex items-center justify-center'>
              <div class='w-3 h-3 bg-blue-400 rounded-sm' />
            </div>
            <div class='w-6 h-6 bg-rose-100 rounded flex items-center justify-center'>
              <svg class='w-3 h-3 text-rose-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z'
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Data Visualizations Illustration
function DataVisualizationIllustration() {
  return (
    <div class='bg-linear-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-200 overflow-hidden p-8'>
      <div class='relative aspect-4/3 flex items-center justify-center'>
        {/* Chart card */}
        <div class='bg-white rounded-lg shadow-lg p-4 w-56 border border-violet-200'>
          {/* Chart header */}
          <div class='flex items-center justify-between mb-3'>
            <span class='text-xs font-semibold text-gray-700'>Risk of Bias</span>
            <BsGraphUp class='w-4 h-4 text-violet-500' />
          </div>

          {/* Stacked horizontal bar chart */}
          <div class='space-y-2'>
            <div class='flex items-center gap-2'>
              <span class='text-xs text-gray-500 w-8'>D1</span>
              <div class='flex-1 h-4 flex rounded overflow-hidden'>
                <div class='bg-green-400' style={{ width: '60%' }} />
                <div class='bg-yellow-400' style={{ width: '20%' }} />
                <div class='bg-red-400' style={{ width: '20%' }} />
              </div>
            </div>
            <div class='flex items-center gap-2'>
              <span class='text-xs text-gray-500 w-8'>D2</span>
              <div class='flex-1 h-4 flex rounded overflow-hidden'>
                <div class='bg-green-400' style={{ width: '80%' }} />
                <div class='bg-yellow-400' style={{ width: '20%' }} />
              </div>
            </div>
            <div class='flex items-center gap-2'>
              <span class='text-xs text-gray-500 w-8'>D3</span>
              <div class='flex-1 h-4 flex rounded overflow-hidden'>
                <div class='bg-green-400' style={{ width: '40%' }} />
                <div class='bg-yellow-400' style={{ width: '40%' }} />
                <div class='bg-red-400' style={{ width: '20%' }} />
              </div>
            </div>
            <div class='flex items-center gap-2'>
              <span class='text-xs text-gray-500 w-8'>D4</span>
              <div class='flex-1 h-4 flex rounded overflow-hidden'>
                <div class='bg-green-400' style={{ width: '70%' }} />
                <div class='bg-yellow-400' style={{ width: '30%' }} />
              </div>
            </div>
            <div class='flex items-center gap-2'>
              <span class='text-xs text-gray-500 w-8'>D5</span>
              <div class='flex-1 h-4 flex rounded overflow-hidden'>
                <div class='bg-green-400' style={{ width: '50%' }} />
                <div class='bg-yellow-400' style={{ width: '25%' }} />
                <div class='bg-red-400' style={{ width: '25%' }} />
              </div>
            </div>
          </div>

          {/* Legend */}
          <div class='flex items-center justify-center gap-3 mt-3 pt-2 border-t border-gray-100'>
            <div class='flex items-center gap-1'>
              <div class='w-2 h-2 bg-green-400 rounded-sm' />
              <span class='text-xs text-gray-500'>Low</span>
            </div>
            <div class='flex items-center gap-1'>
              <div class='w-2 h-2 bg-yellow-400 rounded-sm' />
              <span class='text-xs text-gray-500'>Some</span>
            </div>
            <div class='flex items-center gap-1'>
              <div class='w-2 h-2 bg-red-400 rounded-sm' />
              <span class='text-xs text-gray-500'>High</span>
            </div>
          </div>
        </div>

        {/* Export options floating */}
        <div class='absolute -top-2 -right-2'>
          <div class='bg-white rounded-lg shadow-md p-2 flex gap-1 border border-violet-200'>
            <div class='w-7 h-7 bg-violet-100 rounded flex items-center justify-center'>
              <span class='text-xs font-bold text-violet-600'>PNG</span>
            </div>
            <div class='w-7 h-7 bg-purple-100 rounded flex items-center justify-center'>
              <span class='text-xs font-bold text-purple-600'>SVG</span>
            </div>
          </div>
        </div>

        {/* Publication ready badge */}
        <div class='absolute -bottom-2 left-4'>
          <div class='bg-linear-to-r from-violet-500 to-purple-500 rounded-lg px-3 py-1.5 shadow-lg'>
            <span class='text-xs font-medium text-white'>Publication Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureSection(props) {
  return (
    <div
      class={`grid md:grid-cols-2 gap-8 md:gap-12 items-center ${props.reversed ? 'md:flex-row-reverse' : ''}`}
    >
      <div class={props.reversed ? 'md:order-2' : ''}>{props.feature.illustration}</div>
      <div class={props.reversed ? 'md:order-1' : ''}>
        <h3 class='text-2xl md:text-3xl font-bold text-gray-900 mb-4'>{props.feature.title}</h3>
        <p class='text-gray-600 text-lg mb-6 leading-relaxed'>{props.feature.description}</p>
        <ul class='space-y-3'>
          <For each={props.feature.bullets}>
            {bullet => (
              <li class='flex items-start gap-3'>
                <svg
                  class='w-5 h-5 text-blue-700 mt-0.5 shrink-0'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    stroke-linecap='round'
                    stroke-linejoin='round'
                    stroke-width='2'
                    d='M5 13l4 4L19 7'
                  />
                </svg>
                <span class='text-gray-700'>{bullet}</span>
              </li>
            )}
          </For>
        </ul>
      </div>
    </div>
  );
}

export default function FeatureShowcase() {
  const features = [
    {
      title: 'Real-time Collaboration',
      description:
        'Work together with your team seamlessly. See updates instantly as reviewers complete their assessments.',
      illustration: <CollaborationIllustration />,
      bullets: [
        'Independent ratings with blinded mode',
        'Automatic inter-rater reliability calculation',
        'Built-in conflict resolution workflow',
      ],
    },
    {
      title: 'Enterprise-Grade Security',
      description:
        'Your research data is protected with multiple authentication options and industry-standard security practices.',
      illustration: <SecurityIllustration />,
      bullets: [
        'OAuth, passwordless login, and SSO support',
        'Two-factor authentication (2FA) for enhanced security',
        'Role-based access control and audit logging',
      ],
    },
    {
      title: 'Automatic Scoring',
      description:
        'Eliminate manual calculation errors. Scores are computed instantly as you complete each checklist item.',
      illustration: <ScoringIllustration />,
      bullets: ['AMSTAR-2 scoring built in', 'Visual summary charts', 'Export-ready reports'],
    },
    {
      title: 'PDF Annotation',
      description:
        'Annotate study PDFs directly alongside your checklist. Keep all evidence linked and organized.',
      illustration: <PDFAnnotationIllustration />,
      bullets: [
        'Highlight and comment on PDFs',
        'Link annotations to checklist items',
        'Centralized document storage',
      ],
    },
    {
      title: 'Data Visualizations',
      description:
        'Generate publication-ready charts and graphs from your appraisal data with a single click.',
      illustration: <DataVisualizationIllustration />,
      bullets: [
        'Interactive risk of bias summary plots',
        'Customizable chart styles and formats',
        'Export to PNG, SVG, in color or black & white',
      ],
    },
  ];

  return (
    <section class='max-w-6xl mx-auto px-6 py-16 md:py-24'>
      <div class='text-center mb-16'>
        <h2 class='text-3xl md:text-4xl font-bold text-gray-900 mb-4'>
          Everything you need for rigorous study appraisal
        </h2>
        <p class='text-lg text-gray-600 max-w-2xl mx-auto'>
          Built specifically for researchers conducting systematic reviews and evidence synthesis.
        </p>
      </div>

      <div class='space-y-16 md:space-y-24'>
        <For each={features}>
          {(feature, index) => <FeatureSection feature={feature} reversed={index() % 2 === 1} />}
        </For>
      </div>
    </section>
  );
}
