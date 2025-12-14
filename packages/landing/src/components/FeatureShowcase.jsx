import { For } from 'solid-js';
import { AiOutlineCheckCircle, AiOutlineCheck, AiOutlineMail, AiOutlineLink } from 'solid-icons/ai';
import { HiOutlineDocumentText, HiOutlineShieldCheck } from 'solid-icons/hi';
import { BsGraphUp } from 'solid-icons/bs';
import { FiLock, FiKey, FiShield } from 'solid-icons/fi';
import { BiRegularComment } from 'solid-icons/bi';

// Reusable illustration components
function IllustrationWrapper(props) {
  return (
    <div
      class={`bg-linear-to-br ${props.gradient} rounded-xl border ${props.border} overflow-hidden p-8`}
    >
      <div class='relative aspect-4/3 flex items-center justify-center'>{props.children}</div>
    </div>
  );
}

function UserAvatar(props) {
  return (
    <div class={`absolute ${props.position}`}>
      <div class='relative'>
        <div
          class={`w-12 h-12 rounded-full bg-linear-to-br ${props.gradient} flex items-center justify-center text-white font-bold shadow-lg`}
        >
          {props.letter}
        </div>
        <div
          class={`absolute -bottom-1 -right-1 w-4 h-4 ${props.statusColor} rounded-full border-2 border-white ${props.pulse ? 'animate-pulse' : ''}`}
        />
      </div>
    </div>
  );
}

function FloatingBadge(props) {
  return (
    <div class={`absolute ${props.position}`}>
      <div
        class={`bg-white rounded-lg shadow-md px-3 py-2 flex items-center gap-2 border ${props.border}`}
      >
        {props.children}
      </div>
    </div>
  );
}

function CheckBadge(props) {
  return (
    <div class={`absolute ${props.position}`}>
      <div class='w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-md'>
        <AiOutlineCheck class='w-4 h-4 text-white' />
      </div>
    </div>
  );
}

function ChecklistItem(props) {
  return (
    <div class='flex items-center gap-2'>
      <div
        class={`w-4 h-4 rounded ${props.variant === 'warning' ? 'bg-yellow-500' : 'bg-green-500'} flex items-center justify-center`}
      >
        {props.variant === 'warning' ?
          <span class='text-white text-xs font-bold'>!</span>
        : <AiOutlineCheck class='w-3 h-3 text-white' />}
      </div>
      <div class='h-2 bg-gray-200 rounded flex-1' />
    </div>
  );
}

// Real-time Collaboration Illustration
function CollaborationIllustration() {
  return (
    <IllustrationWrapper gradient='from-blue-50 to-indigo-50' border='border-blue-200'>
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
      <UserAvatar
        position='-top-2 -left-2'
        gradient='from-purple-400 to-purple-600'
        letter='A'
        statusColor='bg-green-500'
      />
      <UserAvatar
        position='-top-2 -right-2'
        gradient='from-pink-400 to-pink-600'
        letter='B'
        statusColor='bg-green-500'
        pulse
      />
      <UserAvatar
        position='-bottom-2 -left-2'
        gradient='from-blue-400 to-blue-600'
        letter='C'
        statusColor='bg-yellow-500'
      />

      {/* Activity indicators */}
      <FloatingBadge position='-right-4 top-1/4' border='border-green-200'>
        <div class='w-2 h-2 bg-green-500 rounded-full animate-pulse' />
        <span class='text-xs text-gray-700 font-medium'>Live</span>
      </FloatingBadge>

      <div class='absolute -left-4 bottom-1/4'>
        <div class='bg-white rounded-lg shadow-md px-3 py-2 text-xs flex items-center gap-1.5'>
          <AiOutlineCheckCircle class='w-3 h-3 text-blue-600' />
          <span class='text-gray-700'>Updated</span>
        </div>
      </div>
    </IllustrationWrapper>
  );
}

// Security Illustration
function SecurityIllustration() {
  return (
    <IllustrationWrapper gradient='from-emerald-50 to-teal-50' border='border-emerald-200'>
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
      <FloatingBadge position='top-4 left-4' border='border-emerald-200'>
        <FiKey class='w-4 h-4 text-emerald-600' />
        <span class='text-xs font-medium text-gray-700'>OAuth</span>
      </FloatingBadge>

      <FloatingBadge position='top-4 right-4' border='border-blue-200'>
        <FiLock class='w-4 h-4 text-blue-600' />
        <span class='text-xs font-medium text-gray-700'>2FA</span>
      </FloatingBadge>

      <FloatingBadge position='bottom-6 left-6' border='border-purple-200'>
        <AiOutlineMail class='w-4 h-4 text-purple-600' />
        <span class='text-xs font-medium text-gray-700'>Passwordless</span>
      </FloatingBadge>

      <FloatingBadge position='bottom-6 right-6' border='border-indigo-200'>
        <FiShield class='w-4 h-4 text-indigo-600' />
        <span class='text-xs font-medium text-gray-700'>SSO</span>
      </FloatingBadge>

      {/* Security checkmarks */}
      <CheckBadge position='-right-2 top-1/3' />
      <CheckBadge position='-left-2 top-1/2' />
    </IllustrationWrapper>
  );
}

// Automatic Scoring Illustration
function ScoringIllustration() {
  return (
    <IllustrationWrapper gradient='from-sky-50 to-blue-100' border='border-blue-200'>
      {/* Checklist card */}
      <div class='bg-white rounded-lg shadow-lg p-4 w-56 border border-blue-200'>
        {/* Header */}
        <div class='flex items-center justify-between mb-3 pb-2 border-b border-gray-100'>
          <span class='text-xs font-semibold text-gray-700'>AMSTAR-2</span>
          <div class='bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded'>High</div>
        </div>

        {/* Checklist items */}
        <div class='space-y-2'>
          <ChecklistItem />
          <ChecklistItem />
          <ChecklistItem variant='warning' />
          <ChecklistItem />
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
        <div class='bg-linear-to-br from-blue-500 to-sky-500 rounded-lg px-3 py-2 shadow-lg'>
          <div class='text-white text-xs font-medium'>Score</div>
          <div class='text-white text-xl font-bold'>14/16</div>
        </div>
      </div>

      {/* Auto-calculate indicator */}
      <FloatingBadge position='-bottom-2 left-4' border='border-green-200'>
        <div class='w-2 h-2 bg-green-500 rounded-full animate-pulse' />
        <span class='text-xs font-medium text-gray-700'>Auto-calculated</span>
      </FloatingBadge>
    </IllustrationWrapper>
  );
}

// PDF Annotation Illustration
function PDFAnnotationIllustration() {
  return (
    <IllustrationWrapper gradient='from-rose-50 to-pink-50' border='border-rose-200'>
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
      <FloatingBadge position='-bottom-2 -left-2' border='border-rose-200'>
        <AiOutlineLink class='w-4 h-4 text-rose-500' />
        <span class='text-xs font-medium text-gray-700'>Linked</span>
      </FloatingBadge>

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
            <BiRegularComment class='w-3 h-3 text-rose-500' />
          </div>
        </div>
      </div>
    </IllustrationWrapper>
  );
}

// Data Visualizations Illustration
const chartData = [
  { label: 'D1', green: 60, yellow: 20, red: 20 },
  { label: 'D2', green: 80, yellow: 20, red: 0 },
  { label: 'D3', green: 40, yellow: 40, red: 20 },
  { label: 'D4', green: 70, yellow: 30, red: 0 },
  { label: 'D5', green: 50, yellow: 25, red: 25 },
];

function DataVisualizationIllustration() {
  return (
    <IllustrationWrapper gradient='from-violet-50 to-purple-50' border='border-violet-200'>
      {/* Chart card */}
      <div class='bg-white rounded-lg shadow-lg p-4 w-56 border border-violet-200'>
        {/* Chart header */}
        <div class='flex items-center justify-between mb-3'>
          <span class='text-xs font-semibold text-gray-700'>Risk of Bias</span>
          <BsGraphUp class='w-4 h-4 text-violet-500' />
        </div>

        {/* Stacked horizontal bar chart */}
        <div class='space-y-2'>
          <For each={chartData}>
            {row => (
              <div class='flex items-center gap-2'>
                <span class='text-xs text-gray-500 w-8'>{row.label}</span>
                <div class='flex-1 h-4 flex rounded overflow-hidden'>
                  {row.green > 0 && <div class='bg-green-400' style={{ width: `${row.green}%` }} />}
                  {row.yellow > 0 && (
                    <div class='bg-yellow-400' style={{ width: `${row.yellow}%` }} />
                  )}
                  {row.red > 0 && <div class='bg-red-400' style={{ width: `${row.red}%` }} />}
                </div>
              </div>
            )}
          </For>
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
          <div class='w-8 h-7 bg-violet-100 rounded flex items-center justify-center'>
            <span class='text-xs font-bold text-violet-600'>PNG</span>
          </div>
          <div class='w-8 h-7 bg-purple-100 rounded flex items-center justify-center'>
            <span class='text-xs font-bold text-purple-600'>SVG</span>
          </div>
        </div>
      </div>

      {/* Publication ready badge */}
      <div class='absolute -bottom-2 left-4'>
        <div class='bg-linear-to-r from-sky-500 to-blue-500 rounded-lg px-3 py-1.5 shadow-lg'>
          <span class='text-xs font-medium text-white'>Publication Ready</span>
        </div>
      </div>
    </IllustrationWrapper>
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
                <AiOutlineCheck class='w-5 h-5 text-blue-700 mt-0.5 shrink-0' />
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
