import { For } from 'solid-js';
import { AiOutlineCheckCircle, AiOutlineCheck, AiOutlineMail, AiOutlineLink } from 'solid-icons/ai';
import { HiOutlineDocumentText, HiOutlineShieldCheck } from 'solid-icons/hi';
import { BsGraphUp, BsLightningChargeFill } from 'solid-icons/bs';
import { FiLock, FiKey, FiShield } from 'solid-icons/fi';
import { BiRegularComment } from 'solid-icons/bi';
import { RiDeviceWifiOffLine } from 'solid-icons/ri';
import { IoTimerOutline } from 'solid-icons/io';

// Reusable illustration components
function IllustrationWrapper(props) {
  return (
    <div
      class={`bg-linear-to-br ${props.gradient} rounded-xl border ${props.border} overflow-hidden p-8`}
    >
      <div class='relative flex aspect-4/3 items-center justify-center'>{props.children}</div>
    </div>
  );
}

function UserAvatar(props) {
  return (
    <div class={`absolute ${props.position}`}>
      <div class='relative'>
        <div
          class={`h-12 w-12 rounded-full bg-linear-to-br ${props.gradient} flex items-center justify-center font-bold text-white shadow-lg`}
        >
          {props.letter}
        </div>
        <div
          class={`absolute -right-1 -bottom-1 h-4 w-4 ${props.statusColor} rounded-full border-2 border-white ${props.pulse ? 'animate-pulse' : ''}`}
        />
      </div>
    </div>
  );
}

function FloatingBadge(props) {
  return (
    <div class={`absolute ${props.position}`}>
      <div
        class={`flex items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-md ${props.border}`}
      >
        {props.children}
      </div>
    </div>
  );
}

function ChecklistItem(props) {
  return (
    <div class='flex items-center gap-2'>
      <div
        class={`h-4 w-4 rounded ${props.variant === 'warning' ? 'bg-yellow-500' : 'bg-green-500'} flex items-center justify-center`}
      >
        {props.variant === 'warning' ?
          <span class='text-xs font-bold text-white'>!</span>
        : <AiOutlineCheck class='h-3 w-3 text-white' />}
      </div>
      <div class='h-2 flex-1 rounded bg-gray-200' />
    </div>
  );
}

// Real-time Collaboration Illustration
function CollaborationIllustration() {
  return (
    <IllustrationWrapper gradient='from-blue-50 to-indigo-50' border='border-blue-200'>
      {/* Central document */}
      <div class='absolute inset-0 flex items-center justify-center'>
        <div class='w-48 rounded-lg border-2 border-blue-300 bg-white p-6 shadow-lg'>
          <div class='space-y-2'>
            <div class='h-2 w-full rounded bg-gray-200' />
            <div class='h-2 w-5/6 rounded bg-gray-200' />
            <div class='h-2 w-4/6 animate-pulse rounded bg-blue-400' />
            <div class='h-2 w-full rounded bg-gray-100' />
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
        <div class='h-2 w-2 animate-pulse rounded-full bg-green-500' />
        <span class='text-xs font-medium text-gray-700'>Live</span>
      </FloatingBadge>

      <div class='absolute bottom-1/4 -left-4'>
        <div class='flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs shadow-md'>
          <AiOutlineCheckCircle class='h-3 w-3 text-blue-600' />
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
          <div class='flex h-36 w-32 items-center justify-center rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 shadow-xl'>
            <HiOutlineShieldCheck class='h-16 w-16 text-white' />
          </div>
          <div class='absolute -inset-4 animate-pulse rounded-lg border-2 border-emerald-300 opacity-50' />
        </div>
      </div>

      {/* Auth method badges */}
      <FloatingBadge position='top-4 left-4' border='border-emerald-200'>
        <FiKey class='h-4 w-4 text-emerald-600' />
        <span class='text-xs font-medium text-gray-700'>OAuth</span>
      </FloatingBadge>

      <FloatingBadge position='top-4 right-4' border='border-blue-200'>
        <FiLock class='h-4 w-4 text-blue-600' />
        <span class='text-xs font-medium text-gray-700'>2FA</span>
      </FloatingBadge>

      <FloatingBadge position='bottom-6 left-6' border='border-purple-200'>
        <AiOutlineMail class='h-4 w-4 text-purple-600' />
        <span class='text-xs font-medium text-gray-700'>Passwordless</span>
      </FloatingBadge>

      <FloatingBadge position='bottom-6 right-6' border='border-indigo-200'>
        <FiShield class='h-4 w-4 text-indigo-600' />
        <span class='text-xs font-medium text-gray-700'>SSO</span>
      </FloatingBadge>
    </IllustrationWrapper>
  );
}

// Automatic Scoring Illustration
function ScoringIllustration() {
  return (
    <IllustrationWrapper gradient='from-sky-50 to-blue-100' border='border-blue-200'>
      {/* Checklist card */}
      <div class='w-56 rounded-lg border border-blue-200 bg-white p-4 shadow-lg'>
        {/* Header */}
        <div class='mb-3 flex items-center justify-between border-b border-gray-100 pb-2'>
          <span class='text-xs font-semibold text-gray-700'>AMSTAR-2</span>
          <div class='rounded bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700'>High</div>
        </div>

        {/* Checklist items */}
        <div class='space-y-2'>
          <ChecklistItem />
          <ChecklistItem />
          <ChecklistItem variant='warning' />
          <ChecklistItem />
        </div>

        {/* Progress bar */}
        <div class='mt-3 border-t border-gray-100 pt-2'>
          <div class='mb-1 flex justify-between text-xs text-gray-500'>
            <span>Progress</span>
            <span class='font-medium'>75%</span>
          </div>
          <div class='h-2 overflow-hidden rounded-full bg-gray-100'>
            <div class='h-full w-3/4 rounded-full bg-linear-to-r from-green-300 to-green-500' />
          </div>
        </div>
      </div>

      {/* Floating score badge */}
      <div class='absolute -top-2 -right-2'>
        <div class='rounded-lg bg-linear-to-br from-blue-500 to-sky-500 px-3 py-2 shadow-lg'>
          <div class='text-xs font-medium text-white'>Scoring</div>
          <div class='text-xl font-bold text-white'>12/16</div>
        </div>
      </div>

      {/* Auto-calculate indicator */}
      <FloatingBadge position='-bottom-2 left-4' border='border-green-200'>
        <div class='h-2 w-2 animate-pulse rounded-full bg-green-500' />
        <span class='text-xs font-medium text-gray-700'>Automatic Scoring</span>
      </FloatingBadge>
    </IllustrationWrapper>
  );
}

// PDF Annotation Illustration
function PDFAnnotationIllustration() {
  return (
    <IllustrationWrapper gradient='from-rose-50 to-pink-50' border='border-rose-200'>
      {/* PDF document */}
      <div class='w-52 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg'>
        {/* PDF header bar */}
        <div class='flex items-center gap-2 border-b border-gray-200 bg-gray-100 px-3 py-1.5'>
          <HiOutlineDocumentText class='h-4 w-4 text-rose-500' />
          <span class='truncate text-xs text-gray-600'>study_2025.pdf</span>
        </div>

        {/* PDF content */}
        <div class='space-y-2 p-3'>
          <div class='h-2 w-full rounded bg-gray-200' />
          <div class='h-2 w-5/6 rounded bg-gray-200' />

          {/* Highlighted text */}
          <div class='relative'>
            <div class='h-2 w-4/5 rounded bg-yellow-300' />
            <div class='absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 shadow-sm'>
              <span class='text-xs font-bold text-white'>1</span>
            </div>
          </div>

          <div class='h-2 w-full rounded bg-gray-200' />
          <div class='h-2 w-3/4 rounded bg-gray-200' />

          {/* Another highlight */}
          <div class='relative'>
            <div class='h-2 w-2/3 rounded bg-blue-300' />
            <div class='absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 shadow-sm'>
              <span class='text-xs font-bold text-white'>2</span>
            </div>
          </div>

          <div class='h-2 w-full rounded bg-gray-200' />
          <div class='h-2 w-4/6 rounded bg-gray-200' />
        </div>
      </div>

      {/* Annotation comment bubble */}
      <div class='absolute -top-2 -right-4'>
        <div class='w-32 rounded-lg border border-rose-200 bg-white p-3 shadow-lg'>
          <div class='mb-1.5 flex items-center gap-1.5'>
            <div class='flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-br from-rose-400 to-pink-500 text-xs font-bold text-white'>
              R
            </div>
            <span class='text-xs font-medium text-gray-700'>Note</span>
          </div>
          <p class='text-xs leading-tight text-gray-500'>Key finding for Q7...</p>
        </div>
      </div>

      {/* Link indicator */}
      <FloatingBadge position='-bottom-2 -left-2' border='border-rose-200'>
        <AiOutlineLink class='h-4 w-4 text-rose-500' />
        <span class='text-xs font-medium text-gray-700'>Linked</span>
      </FloatingBadge>

      {/* Toolbar floating */}
      <div class='absolute top-1/2 -left-4 -translate-y-1/2 transform'>
        <div class='flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-1.5 shadow-md'>
          <div class='flex h-6 w-6 items-center justify-center rounded bg-yellow-100'>
            <div class='h-3 w-3 rounded-sm bg-yellow-400' />
          </div>
          <div class='flex h-6 w-6 items-center justify-center rounded bg-blue-100'>
            <div class='h-3 w-3 rounded-sm bg-blue-400' />
          </div>
          <div class='flex h-6 w-6 items-center justify-center rounded bg-rose-100'>
            <BiRegularComment class='h-3 w-3 text-rose-500' />
          </div>
        </div>
      </div>
    </IllustrationWrapper>
  );
}

// Speed & Productivity Illustration
function SpeedIllustration() {
  return (
    <IllustrationWrapper gradient='from-amber-50 to-orange-50' border='border-amber-200'>
      {/* Central speedometer */}
      <div class='absolute inset-0 flex items-center justify-center'>
        <div class='relative'>
          <div class='flex h-36 w-36 items-center justify-center rounded-full border-4 border-amber-200 bg-white shadow-lg'>
            <div class='text-center'>
              <BsLightningChargeFill class='mx-auto h-12 w-12 text-amber-500' />
              <div class='mt-1 text-xs font-semibold text-gray-500'>Streamlined</div>
            </div>
          </div>
          <div class='absolute -inset-2 animate-pulse rounded-full border-2 border-amber-300 opacity-40' />
        </div>
      </div>

      {/* Time saved badges */}
      <FloatingBadge position='-top-2 -left-2' border='border-green-200'>
        <IoTimerOutline class='h-4 w-4 text-green-600' />
        <span class='text-xs font-medium text-gray-700'>Save hours</span>
      </FloatingBadge>

      <FloatingBadge position='-top-2 -right-2' border='border-amber-200'>
        <AiOutlineCheck class='h-4 w-4 text-amber-600' />
        <span class='text-xs font-medium text-gray-700'>Automated</span>
      </FloatingBadge>

      <FloatingBadge position='top-[40%] -right-2' border='border-blue-200'>
        <RiDeviceWifiOffLine class='h-4 w-4 text-blue-600' />
        <span class='text-xs font-medium text-gray-700'>Works offline</span>
      </FloatingBadge>

      {/* Productivity metrics */}
      <div class='absolute -bottom-2 left-1/2 -translate-x-1/2'>
        <div class='flex items-center gap-3 rounded-lg border border-amber-200 bg-white px-4 py-2 shadow-md'>
          <div class='text-center'>
            <div class='text-lg font-bold text-amber-600'>Fewer</div>
            <div class='text-xs text-gray-500'>Emails</div>
          </div>
          <div class='h-8 w-px bg-gray-200' />
          <div class='text-center'>
            <div class='text-lg font-bold text-green-600'>0</div>
            <div class='text-xs text-gray-500'>Spreadsheets</div>
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
      <div class='w-56 rounded-lg border border-violet-200 bg-white p-4 shadow-lg'>
        {/* Chart header */}
        <div class='mb-3 flex items-center justify-between'>
          <span class='text-xs font-semibold text-gray-700'>Risk of Bias</span>
          <BsGraphUp class='h-4 w-4 text-violet-500' />
        </div>

        {/* Stacked horizontal bar chart */}
        <div class='space-y-2'>
          <For each={chartData}>
            {row => (
              <div class='flex items-center gap-2'>
                <span class='w-8 text-xs text-gray-500'>{row.label}</span>
                <div class='flex h-4 flex-1 overflow-hidden rounded'>
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
        <div class='mt-3 flex items-center justify-center gap-3 border-t border-gray-100 pt-2'>
          <div class='flex items-center gap-1'>
            <div class='h-2 w-2 rounded-sm bg-green-400' />
            <span class='text-xs text-gray-500'>Low</span>
          </div>
          <div class='flex items-center gap-1'>
            <div class='h-2 w-2 rounded-sm bg-yellow-400' />
            <span class='text-xs text-gray-500'>Some</span>
          </div>
          <div class='flex items-center gap-1'>
            <div class='h-2 w-2 rounded-sm bg-red-400' />
            <span class='text-xs text-gray-500'>High</span>
          </div>
        </div>
      </div>

      {/* Export options floating */}
      <div class='absolute -top-2 -right-2'>
        <div class='flex gap-1 rounded-lg border border-violet-200 bg-white p-2 shadow-md'>
          <div class='flex h-7 w-8 items-center justify-center rounded bg-violet-100'>
            <span class='text-xs font-bold text-violet-600'>PNG</span>
          </div>
          <div class='flex h-7 w-8 items-center justify-center rounded bg-purple-100'>
            <span class='text-xs font-bold text-purple-600'>SVG</span>
          </div>
        </div>
      </div>

      {/* Publication ready badge */}
      <div class='absolute -bottom-2 left-4'>
        <div class='rounded-lg bg-linear-to-r from-sky-500 to-blue-500 px-3 py-1.5 shadow-lg'>
          <span class='text-xs font-medium text-white'>Publication Ready</span>
        </div>
      </div>
    </IllustrationWrapper>
  );
}

function FeatureSection(props) {
  return (
    <div
      class={`grid items-center gap-8 md:grid-cols-2 md:gap-12 ${props.reversed ? 'md:flex-row-reverse' : ''}`}
    >
      <div class={props.reversed ? 'md:order-2' : ''}>{props.feature.illustration}</div>
      <div class={props.reversed ? 'md:order-1' : ''}>
        <h3 class='mb-4 text-2xl font-bold text-gray-900 md:text-3xl'>{props.feature.title}</h3>
        <p class='mb-6 text-lg leading-relaxed text-gray-600'>{props.feature.description}</p>
        <ul class='space-y-3'>
          <For each={props.feature.bullets}>
            {bullet => (
              <li class='flex items-start gap-3'>
                <AiOutlineCheck class='mt-0.5 h-5 w-5 shrink-0 text-blue-700' />
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
      title: 'Speed & Productivity',
      description:
        'Stop wrestling with spreadsheets and manual processes. CoRATES streamlines your workflow so you can focus on what matters.',
      illustration: <SpeedIllustration />,
      bullets: [
        'Complete appraisals faster with guided workflows',
        'All-in-one platform replaces scattered tools',
        'Intuitive and blazing-fast interface',
        'Continue working even without internet access (coming soon)',
      ],
    },
    {
      title: 'Real-time Collaboration',
      description:
        'Work together with your team seamlessly. See updates instantly as reviewers complete their assessments.',
      illustration: <CollaborationIllustration />,
      bullets: [
        'Independent ratings with blinded mode',
        'Automatic inter-rater reliability calculation (coming soon)',
        'Live, real-time collaboration with instant updates',
      ],
    },
    {
      title: 'Automatic Scoring',
      description:
        'Eliminate manual calculation errors. Complex scores are computed instantly as you complete appraisals.',
      illustration: <ScoringIllustration />,
      bullets: [
        'Built-in appraisal scoring',
        'Complex scoring rubrics applied automatically',
        'Real-time updates as appraisals are completed',
      ],
    },
    {
      title: 'Data Visualizations',
      description:
        'Publication-ready visual summaries generated automatically from appraisal data.',
      illustration: <DataVisualizationIllustration />,
      bullets: [
        'Study-level and across-study figures generated in real time',
        'Customizable labels, axes, and formatting',
        'Export to PNG, SVG, in color or grayscale',
      ],
    },
    {
      title: 'PDF Annotation (coming soon)',
      description:
        'Annotate study PDFs directly alongside your appraisals. Keep all evidence linked and organized.',
      illustration: <PDFAnnotationIllustration />,
      bullets: [
        'Highlight and comment on PDFs',
        'Link annotations to appraisal items',
        'Import from reference managers, Google Drive, a DOI, upload files directly, or let CoRATES find them for you',
      ],
    },
    {
      title: 'Enterprise-Grade Security',
      description:
        'Your research data is protected with multiple authentication options and industry-standard security practices.',
      illustration: <SecurityIllustration />,
      bullets: [
        'OAuth, passwordless login',
        'Two-factor authentication (2FA) for enhanced security',
        'Role-based access control and audit logging (coming soon)',
        'Single Sign-On (SSO) support (coming soon)',
      ],
    },
  ];

  return (
    <section class='mx-auto max-w-6xl px-6 py-16 md:py-24'>
      <div class='mb-16 text-center'>
        <h2 class='mb-4 text-3xl font-bold text-gray-900 md:text-4xl'>
          Everything you need for rigorous study appraisal
        </h2>
        <p class='mx-auto max-w-2xl text-lg text-gray-600'>
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
