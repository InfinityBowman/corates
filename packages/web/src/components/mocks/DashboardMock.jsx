/**
 * Dashboard Mock - Clean Modern Style
 *
 * Design Direction: Clean, professional research dashboard.
 * A refined aesthetic with:
 * - Inter font family for clarity and readability
 * - Blue brand accents with warm stone neutrals
 * - Paper-like textures and layered cards
 * - Clear data hierarchy and beautiful progress visualization
 * - Generous whitespace with intentional asymmetry
 *
 * Inspired by: Linear's precision, Notion's warmth
 */

import { For, Show, createSignal, createEffect, onMount } from 'solid-js';
import {
  FiPlus,
  FiFolder,
  FiUsers,
  FiClock,
  FiCheck,
  FiArrowRight,
  FiFileText,
  FiTrendingUp,
  FiChevronRight,
  FiSearch,
  FiBook,
  FiBarChart2,
} from 'solid-icons/fi';
import { BiRegularBookmark } from 'solid-icons/bi';
import { AiOutlineExperiment } from 'solid-icons/ai';
import { VsBeaker } from 'solid-icons/vs';

// Mock Data
const mockUser = {
  name: 'Dr. Sarah Chen',
  institution: 'Stanford School of Medicine',
  avatar: null,
};

const mockProjects = [
  {
    id: '1',
    name: 'Mindfulness Interventions for Chronic Pain',
    description: 'Systematic review of RCTs examining mindfulness-based interventions',
    role: 'owner',
    studies: 24,
    completed: 16,
    members: 4,
    updatedAt: '2 hours ago',
    color: 'blue',
  },
  {
    id: '2',
    name: 'Digital Therapeutics for Anxiety Disorders',
    description: 'Meta-analysis of mobile app interventions for GAD',
    role: 'reviewer',
    studies: 18,
    completed: 8,
    members: 3,
    updatedAt: '1 day ago',
    color: 'amber',
  },
  {
    id: '3',
    name: 'Exercise & Cognitive Function in Aging',
    description: 'Umbrella review of physical activity interventions',
    role: 'reviewer',
    studies: 42,
    completed: 38,
    members: 6,
    updatedAt: '3 days ago',
    color: 'rose',
  },
];

const mockLocalAppraisals = [
  {
    id: 'local-1',
    name: 'MBSR RCT - Johnson 2023',
    type: 'ROBINS-I',
    updatedAt: 'Today',
  },
  {
    id: 'local-2',
    name: 'CBT Meta-analysis Quality Check',
    type: 'AMSTAR 2',
    updatedAt: 'Yesterday',
  },
];

const mockActivity = [
  {
    action: 'completed',
    project: 'Mindfulness Interventions',
    study: 'MBSR for Low Back Pain',
    time: '2h ago',
  },
  {
    action: 'started',
    project: 'Digital Therapeutics',
    study: 'Calm App RCT',
    time: '5h ago',
  },
  {
    action: 'reconciled',
    project: 'Exercise & Cognitive',
    study: 'Walking Intervention Study',
    time: '1d ago',
  },
];

// Accent color map
const accentColors = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    ring: 'ring-blue-500/20',
    fill: 'bg-blue-500',
    gradient: 'from-blue-500 to-blue-600',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    ring: 'ring-amber-500/20',
    fill: 'bg-amber-500',
    gradient: 'from-amber-400 to-orange-500',
  },
  rose: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    ring: 'ring-rose-500/20',
    fill: 'bg-rose-500',
    gradient: 'from-rose-400 to-pink-500',
  },
};

// Progress Arc component
function ProgressArc(props) {
  const percentage = () => Math.round((props.completed / props.total) * 100);
  const circumference = 2 * Math.PI * 36;
  const offset = () => circumference - (percentage() / 100) * circumference;

  return (
    <div class='relative h-24 w-24'>
      <svg class='h-24 w-24 -rotate-90' viewBox='0 0 80 80'>
        <circle
          cx='40'
          cy='40'
          r='36'
          stroke='currentColor'
          stroke-width='4'
          fill='none'
          class='text-stone-100'
        />
        <circle
          cx='40'
          cy='40'
          r='36'
          stroke={`url(#arc-gradient-${props.id})`}
          stroke-width='4'
          fill='none'
          stroke-linecap='round'
          stroke-dasharray={circumference}
          stroke-dashoffset={offset()}
          class='transition-all duration-700 ease-out'
        />
        <defs>
          <linearGradient id={`arc-gradient-${props.id}`} x1='0%' y1='0%' x2='100%' y2='100%'>
            <stop offset='0%' stop-color='#3b82f6' />
            <stop offset='100%' stop-color='#2563eb' />
          </linearGradient>
        </defs>
      </svg>
      <div class='absolute inset-0 flex flex-col items-center justify-center'>
        <span class='text-2xl font-semibold text-stone-800'>{percentage()}%</span>
      </div>
    </div>
  );
}

// Project Card component
function ProjectCard(props) {
  const colors = () => accentColors[props.project.color] || accentColors.blue;
  const percentage = () => Math.round((props.project.completed / props.project.studies) * 100) || 0;

  return (
    <div
      class='group relative overflow-hidden rounded-2xl border border-stone-200/60 bg-white p-6 shadow-sm transition-all duration-300 hover:border-stone-300 hover:shadow-lg hover:shadow-stone-200/50'
      style='animation: card-rise 0.5s ease-out backwards'
    >
      {/* Decorative corner accent */}
      <div
        class={`absolute -top-10 -right-10 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-40 ${colors().fill}`}
      />

      {/* Header */}
      <div class='relative mb-4 flex items-start justify-between'>
        <div class='flex-1 pr-4'>
          <div class='mb-2 flex items-center gap-2'>
            <span
              class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${colors().bg} ${colors().text}`}
            >
              {props.project.role === 'owner' ? 'Lead' : 'Reviewer'}
            </span>
            <span class='text-xs text-stone-400'>{props.project.updatedAt}</span>
          </div>
          <h3 class='line-clamp-2 text-lg leading-snug font-semibold text-stone-800 transition-colors group-hover:text-blue-600'>
            {props.project.name}
          </h3>
        </div>
      </div>

      {/* Description */}
      <p class='mb-5 line-clamp-2 text-sm leading-relaxed text-stone-500'>
        {props.project.description}
      </p>

      {/* Progress bar */}
      <div class='mb-4'>
        <div class='mb-1.5 flex items-center justify-between text-xs'>
          <span class='font-medium text-stone-600'>Progress</span>
          <span class='text-stone-500 tabular-nums'>
            {props.project.completed}/{props.project.studies} studies
          </span>
        </div>
        <div class='h-1.5 overflow-hidden rounded-full bg-stone-100'>
          <div
            class={`h-full rounded-full bg-gradient-to-r ${colors().gradient} transition-all duration-500`}
            style={`width: ${percentage()}%`}
          />
        </div>
      </div>

      {/* Footer */}
      <div class='flex items-center justify-between'>
        <div class='flex items-center gap-1.5 text-xs text-stone-500'>
          <FiUsers class='h-3.5 w-3.5' />
          <span>{props.project.members} members</span>
        </div>
        <button class='flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition-all hover:bg-blue-50 hover:text-blue-700'>
          Open
          <FiChevronRight class='h-4 w-4 transition-transform group-hover:translate-x-0.5' />
        </button>
      </div>
    </div>
  );
}

// Local Appraisal Card
function LocalAppraisalCard(props) {
  return (
    <div class='group flex items-center gap-4 rounded-xl border border-stone-200/60 bg-white p-4 transition-all duration-200 hover:border-stone-300 hover:shadow-md'>
      <div class='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600'>
        <FiFileText class='h-5 w-5' />
      </div>
      <div class='min-w-0 flex-1'>
        <h4 class='truncate text-sm font-medium text-stone-800'>{props.appraisal.name}</h4>
        <div class='flex items-center gap-2 text-xs text-stone-400'>
          <span class='rounded bg-stone-100 px-1.5 py-0.5 font-medium'>{props.appraisal.type}</span>
          <span>{props.appraisal.updatedAt}</span>
        </div>
      </div>
      <button class='shrink-0 rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600'>
        <FiArrowRight class='h-4 w-4' />
      </button>
    </div>
  );
}

// Activity Item
function ActivityItem(props) {
  const actionColors = {
    completed: 'bg-emerald-500',
    started: 'bg-blue-500',
    reconciled: 'bg-amber-500',
  };

  return (
    <div class='flex items-start gap-3 py-2'>
      <div class={`mt-1 h-2 w-2 shrink-0 rounded-full ${actionColors[props.activity.action]}`} />
      <div class='min-w-0 flex-1'>
        <p class='text-sm text-stone-600'>
          <span class='font-medium text-stone-800 capitalize'>{props.activity.action}</span>{' '}
          <span class='text-stone-500'>appraisal in</span>{' '}
          <span class='font-medium text-stone-700'>{props.activity.project}</span>
        </p>
        <p class='mt-0.5 truncate text-xs text-stone-400'>{props.activity.study}</p>
      </div>
      <span class='shrink-0 text-xs text-stone-400'>{props.activity.time}</span>
    </div>
  );
}

// Stat Card
function StatCard(props) {
  return (
    <div
      class='relative overflow-hidden rounded-xl border border-stone-200/60 bg-white p-5 transition-all duration-200 hover:shadow-md'
      style={`animation: stat-rise 0.4s ease-out ${props.delay || 0}ms backwards`}
    >
      <div class='flex items-start justify-between'>
        <div>
          <p class='text-xs font-medium tracking-wide text-stone-400 uppercase'>{props.label}</p>
          <p class='mt-1 text-3xl font-semibold text-stone-800 tabular-nums'>{props.value}</p>
        </div>
        <div
          class={`flex h-10 w-10 items-center justify-center rounded-xl ${props.iconBg || 'bg-stone-100'}`}
        >
          {props.icon}
        </div>
      </div>
      <Show when={props.subtext}>
        <p class='mt-2 text-xs text-stone-500'>{props.subtext}</p>
      </Show>
    </div>
  );
}

// Main Dashboard Component
export default function DashboardMock() {
  const [mounted, setMounted] = createSignal(false);

  onMount(() => {
    requestAnimationFrame(() => setMounted(true));
  });

  const totalStudies = () => mockProjects.reduce((sum, p) => sum + p.studies, 0);
  const completedStudies = () => mockProjects.reduce((sum, p) => sum + p.completed, 0);

  return (
    <div class='min-h-screen bg-stone-50/50'>
      {/* Google Fonts */}
      <link rel='preconnect' href='https://fonts.googleapis.com' />
      <link rel='preconnect' href='https://fonts.gstatic.com' crossorigin='' />
      <link
        href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
        rel='stylesheet'
      />

      <style>{`
        .dashboard-mock {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        
        @keyframes card-rise {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes stat-rise {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes fade-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        .dashboard-mock .pattern-dots {
          background-image: radial-gradient(circle, #d4d4d4 1px, transparent 1px);
          background-size: 24px 24px;
        }
      `}</style>

      <div class='dashboard-mock'>
        {/* Subtle dot pattern background */}
        <div class='pattern-dots pointer-events-none fixed inset-0 opacity-30' />

        {/* Main Content */}
        <div class='relative mx-auto max-w-6xl px-6 py-10'>
          {/* Header */}
          <header class='mb-12' style='animation: fade-up 0.6s ease-out backwards'>
            <div class='flex items-start justify-between'>
              <div>
                <p class='mb-1 text-sm font-medium text-blue-600'>Welcome back,</p>
                <h1 class='text-4xl font-semibold tracking-tight text-stone-900'>
                  {mockUser.name}
                </h1>
                <p class='mt-2 text-stone-500'>{mockUser.institution}</p>
              </div>
              <div class='flex items-center gap-3'>
                <button class='flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 shadow-sm transition-all hover:border-stone-300 hover:shadow'>
                  <FiSearch class='h-4 w-4' />
                  <span>Search</span>
                  <kbd class='ml-2 hidden rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-400 sm:inline'>
                    /
                  </kbd>
                </button>
                <button class='flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/30'>
                  <FiPlus class='h-4 w-4' />
                  New Project
                </button>
              </div>
            </div>
          </header>

          {/* Stats Row */}
          <section
            class='mb-10 grid grid-cols-4 gap-4'
            style='animation: fade-up 0.6s ease-out 100ms backwards'
          >
            <StatCard
              label='Active Projects'
              value={mockProjects.length}
              icon={<FiFolder class='h-5 w-5 text-blue-600' />}
              iconBg='bg-blue-50'
              delay={0}
            />
            <StatCard
              label='Studies Reviewed'
              value={completedStudies()}
              subtext={`of ${totalStudies()} total`}
              icon={<FiCheck class='h-5 w-5 text-emerald-600' />}
              iconBg='bg-emerald-50'
              delay={50}
            />
            <StatCard
              label='Local Appraisals'
              value={mockLocalAppraisals.length}
              icon={<FiFileText class='h-5 w-5 text-amber-600' />}
              iconBg='bg-amber-50'
              delay={100}
            />
            <StatCard
              label='Team Members'
              value='12'
              subtext='Across all projects'
              icon={<FiUsers class='h-5 w-5 text-violet-600' />}
              iconBg='bg-violet-50'
              delay={150}
            />
          </section>

          {/* Main Grid */}
          <div class='grid grid-cols-12 gap-8'>
            {/* Left Column - Projects */}
            <div class='col-span-8'>
              {/* Projects Section */}
              <section style='animation: fade-up 0.6s ease-out 200ms backwards'>
                <div class='mb-6 flex items-center justify-between'>
                  <div>
                    <h2 class='text-2xl font-semibold text-stone-800'>Your Projects</h2>
                    <p class='mt-1 text-sm text-stone-500'>Systematic reviews and meta-analyses</p>
                  </div>
                  <button class='text-sm font-medium text-blue-600 transition-colors hover:text-blue-700'>
                    View all
                  </button>
                </div>

                <div class='grid gap-5'>
                  <For each={mockProjects}>
                    {(project, index) => (
                      <div
                        style={`animation: card-rise 0.5s ease-out ${200 + index() * 80}ms backwards`}
                      >
                        <ProjectCard project={project} />
                      </div>
                    )}
                  </For>
                </div>
              </section>

              {/* Local Appraisals Section */}
              <section class='mt-10' style='animation: fade-up 0.6s ease-out 500ms backwards'>
                <div class='mb-5 flex items-center justify-between'>
                  <div>
                    <h2 class='text-xl font-semibold text-stone-800'>Local Appraisals</h2>
                    <p class='mt-0.5 text-sm text-stone-500'>Saved on this device</p>
                  </div>
                  <button class='flex items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700'>
                    <FiPlus class='h-4 w-4' />
                    New Appraisal
                  </button>
                </div>

                <div class='space-y-3'>
                  <For each={mockLocalAppraisals}>
                    {appraisal => <LocalAppraisalCard appraisal={appraisal} />}
                  </For>
                </div>
              </section>
            </div>

            {/* Right Column - Activity & Quick Actions */}
            <div class='col-span-4 space-y-6'>
              {/* Overall Progress Card */}
              <div
                class='rounded-2xl border border-stone-200/60 bg-white p-6'
                style='animation: fade-up 0.6s ease-out 300ms backwards'
              >
                <h3 class='mb-4 text-sm font-medium tracking-wide text-stone-400 uppercase'>
                  Overall Progress
                </h3>
                <div class='flex items-center justify-center'>
                  <ProgressArc id='overall' completed={completedStudies()} total={totalStudies()} />
                </div>
                <div class='mt-4 text-center'>
                  <p class='text-sm text-stone-600'>
                    <span class='font-semibold text-stone-800'>{completedStudies()}</span>
                    <span class='text-stone-400'> / {totalStudies()}</span> studies completed
                  </p>
                </div>
              </div>

              {/* Recent Activity */}
              <div
                class='rounded-2xl border border-stone-200/60 bg-white p-6'
                style='animation: fade-up 0.6s ease-out 400ms backwards'
              >
                <h3 class='mb-4 text-sm font-medium tracking-wide text-stone-400 uppercase'>
                  Recent Activity
                </h3>
                <div class='divide-y divide-stone-100'>
                  <For each={mockActivity}>{activity => <ActivityItem activity={activity} />}</For>
                </div>
              </div>

              {/* Quick Actions */}
              <div
                class='rounded-2xl border border-stone-200/60 bg-white p-6'
                style='animation: fade-up 0.6s ease-out 500ms backwards'
              >
                <h3 class='mb-4 text-sm font-medium tracking-wide text-stone-400 uppercase'>
                  Quick Start
                </h3>
                <div class='space-y-2'>
                  <button class='flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-stone-50'>
                    <div class='flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600'>
                      <VsBeaker class='h-4 w-4' />
                    </div>
                    <div>
                      <p class='text-sm font-medium text-stone-800'>ROBINS-I Appraisal</p>
                      <p class='text-xs text-stone-500'>Risk of bias for non-randomized studies</p>
                    </div>
                  </button>
                  <button class='flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-stone-50'>
                    <div class='flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600'>
                      <FiBarChart2 class='h-4 w-4' />
                    </div>
                    <div>
                      <p class='text-sm font-medium text-stone-800'>AMSTAR 2 Appraisal</p>
                      <p class='text-xs text-stone-500'>
                        Quality assessment for systematic reviews
                      </p>
                    </div>
                  </button>
                  <button class='flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-stone-50'>
                    <div class='flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600'>
                      <FiBook class='h-4 w-4' />
                    </div>
                    <div>
                      <p class='text-sm font-medium text-stone-800'>Learn More</p>
                      <p class='text-xs text-stone-500'>Documentation and tutorials</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Collaboration Prompt */}
              <div
                class='overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-6 text-white'
                style='animation: fade-up 0.6s ease-out 600ms backwards'
              >
                <div class='mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20'>
                  <FiUsers class='h-5 w-5' />
                </div>
                <h3 class='mb-2 text-lg font-semibold'>Invite Collaborators</h3>
                <p class='mb-4 text-sm text-blue-100'>
                  Add team members to accelerate your systematic review process.
                </p>
                <button class='rounded-lg bg-white px-4 py-2 text-sm font-medium text-blue-600 transition-all hover:bg-blue-50'>
                  Invite Team
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
