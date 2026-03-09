import { ReactNode } from 'react';
import { AiOutlineCheck, AiOutlineMail, AiOutlineLink } from 'react-icons/ai';
import { HiOutlineDocumentText, HiOutlineShieldCheck } from 'react-icons/hi2';
import { BsLightningChargeFill } from 'react-icons/bs';
import { FiLock, FiKey, FiShield } from 'react-icons/fi';
import { BiComment } from 'react-icons/bi';
import { RiWifiOffLine } from 'react-icons/ri';
import { IoTimerOutline } from 'react-icons/io5';

interface IllustrationWrapperProps {
  gradient: string;
  border: string;
  children: ReactNode;
}

function IllustrationWrapper({ gradient, border, children }: IllustrationWrapperProps) {
  return (
    <div className={`bg-linear-to-br ${gradient} rounded-xl border ${border} overflow-hidden p-8`}>
      <div className='relative flex aspect-4/3 items-center justify-center'>{children}</div>
    </div>
  );
}

interface UserAvatarProps {
  position: string;
  gradient: string;
  letter: string;
  statusColor: string;
  pulse?: boolean;
}

function UserAvatar({ position, gradient, letter, statusColor, pulse }: UserAvatarProps) {
  return (
    <div className={`absolute ${position}`}>
      <div className='relative'>
        <div
          className={`h-8 w-8 rounded-full bg-linear-to-br ${gradient} flex items-center justify-center font-bold text-white shadow-lg`}
        >
          {letter}
        </div>
        <div
          className={`absolute right-0 bottom-0 h-2 w-2 ${statusColor} rounded-full border border-white ${pulse ? 'animate-pulse' : ''}`}
        />
      </div>
    </div>
  );
}

interface FloatingBadgeProps {
  position: string;
  border: string;
  children: ReactNode;
}

function FloatingBadge({ position, border, children }: FloatingBadgeProps) {
  return (
    <div className={`absolute ${position}`}>
      <div
        className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-md ${border}`}
      >
        {children}
      </div>
    </div>
  );
}

interface AnimatedCursorProps {
  path: string;
  duration?: string;
  delay?: string;
  className?: string;
  stroke: string;
}

function AnimatedCursor({ path, duration, delay, className, stroke }: AnimatedCursorProps) {
  return (
    <div
      className={`absolute ${className || ''} drop-shadow-md`}
      style={{
        animation: `cursorMove${path} ${duration || '8s'} ease-in-out infinite`,
        animationDelay: delay || '0s',
      }}
    >
      <svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24'>
        <path
          fill='#FFF'
          stroke={stroke}
          strokeWidth='2'
          d='M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.35Z'
        />
      </svg>
    </div>
  );
}

function CollaborationIllustration() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes cursorMove1 {
            0%, 100% { transform: translate(20%, 30%); }
            25% { transform: translate(60%, 20%); }
            50% { transform: translate(70%, 60%); }
            75% { transform: translate(40%, 70%); }
          }
          @keyframes cursorMove2 {
            0%, 100% { transform: translate(70%, 40%); }
            25% { transform: translate(30%, 50%); }
            50% { transform: translate(25%, 20%); }
            75% { transform: translate(60%, 65%); }
          }
        `,
        }}
      />
      <IllustrationWrapper gradient='from-blue-50 to-indigo-50' border='border-blue-200'>
        {/* Reconcile image */}
        <div className='absolute inset-0 flex items-center justify-center'>
          <div className='relative rounded-lg border border-blue-200 bg-white p-1 shadow-lg'>
            <picture>
              <source srcSet='/assets/corates_reconcile_progress.webp' type='image/webp' />
              <img
                src='/assets/corates_reconcile_progress.png'
                alt='Real-time collaboration and reconciliation progress'
                className='h-auto w-full max-w-md rounded'
                width={2970}
                height={1844}
                loading='lazy'
                decoding='async'
              />
            </picture>
            {/* Animated cursors */}
            <AnimatedCursor
              path='1'
              duration='10s'
              delay='0s'
              className='top-[60%] left-[50%] -translate-x-1/2 -translate-y-1/2'
              stroke='#f6339a'
            />
            <AnimatedCursor
              path='2'
              duration='12s'
              delay='2s'
              className='top-[50%] left-[20%] -translate-x-1/2 -translate-y-1/2'
              stroke='#2b7fff'
            />
          </div>
        </div>

        {/* User avatars with activity indicators */}
        <UserAvatar
          position='-top-2 -right-2'
          gradient='from-pink-400 to-pink-600'
          letter='B'
          statusColor='bg-green-500'
        />
        <UserAvatar
          position='-top-2 right-4'
          gradient='from-blue-400 to-blue-600'
          letter='J'
          statusColor='bg-green-500'
        />

        {/* Activity indicators */}
        <FloatingBadge position='-left-4 -bottom-2' border='border-green-200'>
          <div className='h-2 w-2 animate-pulse rounded-full bg-green-500' />
          <span className='text-xs font-medium text-gray-700'>Live</span>
        </FloatingBadge>
      </IllustrationWrapper>
    </>
  );
}

function SecurityIllustration() {
  return (
    <IllustrationWrapper gradient='from-emerald-50 to-teal-50' border='border-emerald-200'>
      {/* Central shield */}
      <div className='absolute inset-0 flex items-center justify-center'>
        <div className='relative'>
          <div className='flex h-36 w-32 items-center justify-center rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 shadow-xl'>
            <HiOutlineShieldCheck className='h-16 w-16 text-white' />
          </div>
          <div className='absolute -inset-4 animate-pulse rounded-lg border-2 border-emerald-300 opacity-50' />
        </div>
      </div>

      {/* Auth method badges */}
      <FloatingBadge position='top-4 left-4' border='border-emerald-200'>
        <FiKey className='h-4 w-4 text-emerald-600' />
        <span className='text-xs font-medium text-gray-700'>OAuth</span>
      </FloatingBadge>

      <FloatingBadge position='top-4 right-4' border='border-blue-200'>
        <FiLock className='h-4 w-4 text-blue-600' />
        <span className='text-xs font-medium text-gray-700'>2FA</span>
      </FloatingBadge>

      <FloatingBadge position='bottom-6 left-6' border='border-purple-200'>
        <AiOutlineMail className='h-4 w-4 text-purple-600' />
        <span className='text-xs font-medium text-gray-700'>Passwordless</span>
      </FloatingBadge>

      <FloatingBadge position='bottom-6 right-6' border='border-indigo-200'>
        <FiShield className='h-4 w-4 text-indigo-600' />
        <span className='text-xs font-medium text-gray-700'>SSO</span>
      </FloatingBadge>
    </IllustrationWrapper>
  );
}

function ScoringIllustration() {
  return (
    <IllustrationWrapper gradient='from-sky-50 to-blue-100' border='border-blue-200'>
      {/* Scoring image */}
      <div className='flex items-center justify-center'>
        <div className='relative rounded-lg border border-blue-200 bg-white p-1 shadow-lg'>
          <picture>
            <source srcSet='/assets/corates_scoring.webp' type='image/webp' />
            <img
              src='/assets/corates_scoring.png'
              alt='Automatic scoring visualization'
              className='h-auto w-full max-w-md rounded'
              width={1732}
              height={1846}
              loading='lazy'
              decoding='async'
            />
          </picture>
        </div>
      </div>
    </IllustrationWrapper>
  );
}

function PDFAnnotationIllustration() {
  return (
    <IllustrationWrapper gradient='from-rose-50 to-pink-50' border='border-rose-200'>
      {/* PDF document */}
      <div className='w-52 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg'>
        {/* PDF header bar */}
        <div className='flex items-center gap-2 border-b border-gray-200 bg-gray-100 px-3 py-1.5'>
          <HiOutlineDocumentText className='h-4 w-4 text-rose-500' />
          <span className='truncate text-xs text-gray-600'>study_2025.pdf</span>
        </div>

        {/* PDF content */}
        <div className='space-y-2 p-3'>
          <div className='h-2 w-full rounded bg-gray-200' />
          <div className='h-2 w-5/6 rounded bg-gray-200' />

          {/* Highlighted text */}
          <div className='relative'>
            <div className='h-2 w-4/5 rounded bg-yellow-300' />
            <div className='absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 shadow-sm'>
              <span className='text-xs font-bold text-white'>1</span>
            </div>
          </div>

          <div className='h-2 w-full rounded bg-gray-200' />
          <div className='h-2 w-3/4 rounded bg-gray-200' />

          {/* Another highlight */}
          <div className='relative'>
            <div className='h-2 w-2/3 rounded bg-blue-300' />
            <div className='absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 shadow-sm'>
              <span className='text-xs font-bold text-white'>2</span>
            </div>
          </div>

          <div className='h-2 w-full rounded bg-gray-200' />
          <div className='h-2 w-4/6 rounded bg-gray-200' />
        </div>
      </div>

      {/* Annotation comment bubble */}
      <div className='absolute -top-2 -right-4'>
        <div className='w-32 rounded-lg border border-rose-200 bg-white p-3 shadow-lg'>
          <div className='mb-1.5 flex items-center gap-1.5'>
            <div className='flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-br from-rose-400 to-pink-500 text-xs font-bold text-white'>
              R
            </div>
            <span className='text-xs font-medium text-gray-700'>Note</span>
          </div>
          <p className='text-xs leading-tight text-gray-500'>Key finding for Q7...</p>
        </div>
      </div>

      {/* Link indicator */}
      <FloatingBadge position='-bottom-2 -left-2' border='border-rose-200'>
        <AiOutlineLink className='h-4 w-4 text-rose-500' />
        <span className='text-xs font-medium text-gray-700'>Linked</span>
      </FloatingBadge>

      {/* Toolbar floating */}
      <div className='absolute top-1/2 -left-4 -translate-y-1/2 transform'>
        <div className='flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-1.5 shadow-md'>
          <div className='flex h-6 w-6 items-center justify-center rounded bg-yellow-100'>
            <div className='h-3 w-3 rounded-sm bg-yellow-400' />
          </div>
          <div className='flex h-6 w-6 items-center justify-center rounded bg-blue-100'>
            <div className='h-3 w-3 rounded-sm bg-blue-400' />
          </div>
          <div className='flex h-6 w-6 items-center justify-center rounded bg-rose-100'>
            <BiComment className='h-3 w-3 text-rose-500' />
          </div>
        </div>
      </div>
    </IllustrationWrapper>
  );
}

function SpeedIllustration() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes spinSlow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes spinReverse {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
          }
          @keyframes pingRing {
            0% { transform: scale(0.4); opacity: 0.5; }
            60% { opacity: 0.3; }
            100% { transform: scale(1.8); opacity: 0; }
          }
          @keyframes boltGlow {
            0%, 100% { filter: drop-shadow(0 0 2px rgba(245, 158, 11, 0.3)); }
            50% { filter: drop-shadow(0 0 12px rgba(245, 158, 11, 0.6)); }
          }
        `,
        }}
      />
      <IllustrationWrapper gradient='from-amber-50 to-orange-50' border='border-amber-200'>
        {/* Animation layer - behind everything */}
        <div className='pointer-events-none absolute inset-0 z-0 flex items-center justify-center'>
          <div className='relative h-36 w-36'>
            {/* Expanding ping rings */}
            <div
              className='absolute -inset-4 rounded-full border border-amber-300'
              style={{ animation: 'pingRing 3.5s ease-out infinite' }}
            />
            <div
              className='absolute -inset-4 rounded-full border border-amber-300'
              style={{ animation: 'pingRing 3.5s ease-out infinite 1.75s' }}
            />

            {/* Spinning dashed outer ring */}
            <div
              className='absolute -inset-5 rounded-full border-2 border-dashed border-amber-300/50'
              style={{ animation: 'spinSlow 20s linear infinite' }}
            />

            {/* Counter-spinning arc */}
            <svg
              className='absolute -inset-3'
              viewBox='0 0 100 100'
              style={{ animation: 'spinReverse 8s linear infinite' }}
            >
              <circle
                cx='50'
                cy='50'
                r='46'
                fill='none'
                stroke='url(#speedGradient)'
                strokeWidth='2.5'
                strokeDasharray='72 217'
                strokeLinecap='round'
              />
              <defs>
                <linearGradient id='speedGradient' x1='0%' y1='0%' x2='100%' y2='100%'>
                  <stop offset='0%' stopColor='#f59e0b' />
                  <stop offset='100%' stopColor='#f59e0b' stopOpacity='0' />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Content layer - above animations */}
        <div className='absolute inset-0 z-10 flex items-center justify-center'>
          <div className='flex h-36 w-36 items-center justify-center rounded-full border-4 border-amber-200 bg-white shadow-lg'>
            <div className='text-center'>
              <div style={{ animation: 'boltGlow 2.5s ease-in-out infinite' }}>
                <BsLightningChargeFill className='mx-auto h-12 w-12 text-amber-500' />
              </div>
              <div className='mt-1 text-xs font-semibold text-gray-500'>Streamlined</div>
            </div>
          </div>
        </div>

        {/* Time saved badges */}
        <FloatingBadge position='-top-2 -left-2 z-10' border='border-green-200'>
          <IoTimerOutline className='h-4 w-4 text-green-600' />
          <span className='text-xs font-medium text-gray-700'>Save hours</span>
        </FloatingBadge>

        <FloatingBadge position='-top-2 -right-2 z-10' border='border-amber-200'>
          <AiOutlineCheck className='h-4 w-4 text-amber-600' />
          <span className='text-xs font-medium text-gray-700'>Automated</span>
        </FloatingBadge>

        <FloatingBadge position='top-[40%] -right-2 z-10' border='border-blue-200'>
          <RiWifiOffLine className='h-4 w-4 text-blue-600' />
          <span className='text-xs font-medium text-gray-700'>Works offline</span>
        </FloatingBadge>

        {/* Productivity metrics */}
        <div className='absolute -bottom-2 left-1/2 z-10 -translate-x-1/2'>
          <div className='flex items-center gap-3 rounded-lg border border-amber-200 bg-white px-4 py-2 shadow-md'>
            <div className='text-center'>
              <div className='text-lg font-bold text-amber-600'>Fewer</div>
              <div className='text-xs text-gray-500'>Emails</div>
            </div>
            <div className='h-8 w-px bg-gray-200' />
            <div className='text-center'>
              <div className='text-lg font-bold text-green-600'>0</div>
              <div className='text-xs text-gray-500'>Spreadsheets</div>
            </div>
          </div>
        </div>
      </IllustrationWrapper>
    </>
  );
}

function DataVisualizationIllustration() {
  return (
    <IllustrationWrapper gradient='from-emerald-50 to-teal-50' border='border-emerald-200'>
      {/* Data visualization images */}
      <div className='flex flex-col items-center justify-center gap-4'>
        {/* ROBVIS visualization */}
        <div className='relative rounded-lg border border-emerald-200 bg-white p-3 shadow-lg'>
          <picture>
            <source srcSet='/assets/corates_robvis.webp' type='image/webp' />
            <img
              src='/assets/corates_robvis.png'
              alt='ROBVIS risk of bias visualization'
              className='h-auto w-full max-w-md rounded'
              width={1482}
              height={444}
              loading='lazy'
              decoding='async'
            />
          </picture>
        </div>

        {/* Distribution plot */}
        <div className='relative rounded-lg border border-emerald-200 bg-white p-3 shadow-lg'>
          <picture>
            <source srcSet='/assets/corates_dist.webp' type='image/webp' />
            <img
              src='/assets/corates_dist.png'
              alt='Distribution plot visualization'
              className='h-auto w-full max-w-md rounded'
              width={1606}
              height={1122}
              loading='lazy'
              decoding='async'
            />
          </picture>
        </div>
      </div>

      {/* Export options floating */}
      <div className='absolute -top-2 -right-2'>
        <div className='flex gap-1 rounded-lg border border-sky-200 bg-white p-2 shadow-md'>
          <div className='flex items-center justify-center rounded bg-sky-100 px-2 py-1'>
            <span className='text-xs font-bold text-blue-600'>PNG</span>
          </div>
          <div className='flex items-center justify-center rounded bg-sky-100 px-2 py-1'>
            <span className='text-xs font-bold text-blue-600'>SVG</span>
          </div>
        </div>
      </div>

      {/* Publication ready badge */}
      <FloatingBadge position='-bottom-2 -left-2' border='border-sky-200'>
        <span className='text-xs font-medium text-gray-700'>Publication Ready!</span>
      </FloatingBadge>
    </IllustrationWrapper>
  );
}

interface Feature {
  title: string;
  description: string;
  illustration: ReactNode;
  bullets: string[];
}

interface FeatureSectionProps {
  feature: Feature;
  reversed: boolean;
}

function FeatureSection({ feature, reversed }: FeatureSectionProps) {
  return (
    <div
      className={`grid items-center gap-8 md:grid-cols-2 md:gap-12 ${reversed ? 'md:flex-row-reverse' : ''}`}
    >
      <div className={reversed ? 'md:order-2' : ''}>{feature.illustration}</div>
      <div className={reversed ? 'md:order-1' : ''}>
        <h3 className='mb-4 text-2xl font-bold text-gray-900 md:text-3xl'>{feature.title}</h3>
        <p className='mb-6 text-lg leading-relaxed text-gray-600'>{feature.description}</p>
        <ul className='space-y-3'>
          {feature.bullets.map((bullet, index) => (
            <li key={index} className='flex items-start gap-3'>
              <AiOutlineCheck className='mt-0.5 h-5 w-5 shrink-0 text-blue-700' />
              <span className='text-gray-700'>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function FeatureShowcase() {
  const features: Feature[] = [
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
        'Automatic inter-rater reliability calculation',
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
      title: 'PDF Annotation',
      description:
        'Annotate study PDFs directly alongside your appraisals. Collaboratively create highlights, text notes, and drawings in real time.',
      illustration: <PDFAnnotationIllustration />,
      bullets: [
        'Highlight, underline, draw, and add text notes directly on PDFs',
        'Annotations sync in real time and persist across sessions',
        'Import PDFs from reference managers, Google Drive, DOI, upload directly, or let CoRATES find them for you',
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
    <section className='mx-auto max-w-6xl px-6 py-16 md:py-24'>
      <div className='mb-16 text-center'>
        <h2 className='mb-4 text-3xl font-bold text-gray-900 md:text-4xl'>
          Everything you need for rigorous study appraisal
        </h2>
        <p className='mx-auto max-w-2xl text-lg text-gray-600'>
          Built specifically for researchers conducting systematic reviews and evidence synthesis.
        </p>
      </div>

      <div className='space-y-16 md:space-y-24'>
        {features.map((feature, index) => (
          <FeatureSection key={index} feature={feature} reversed={index % 2 === 1} />
        ))}
      </div>
    </section>
  );
}
