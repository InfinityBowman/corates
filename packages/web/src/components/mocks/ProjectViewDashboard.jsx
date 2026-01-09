/**
 * ProjectView Mock - Dashboard/Analytical Style
 *
 * Design Direction: Data-focused with visual progress indicators and metrics.
 * Dark theme with vibrant accent colors, glassmorphism, and animated elements.
 * Inspired by Linear, Raycast, and modern SaaS analytics dashboards.
 */

import { For, Show, createSignal } from 'solid-js';
import {
  FiArrowLeft,
  FiPlus,
  FiSearch,
  FiFilter,
  FiGrid,
  FiList,
  FiMoreHorizontal,
  FiExternalLink,
  FiUser,
  FiClock,
} from 'solid-icons/fi';

// Mock data
const mockProject = {
  name: 'Mindfulness Interventions for Chronic Pain',
  description: 'Systematic review of RCTs examining mindfulness-based interventions',
  progress: 67,
};

const mockStats = [
  {
    label: 'Total Studies',
    value: 24,
    change: '+3 this week',
    color: 'from-violet-500 to-fuchsia-500',
  },
  { label: 'Completed', value: 16, percentage: 67, color: 'from-emerald-400 to-cyan-400' },
  { label: 'In Review', value: 5, percentage: 21, color: 'from-amber-400 to-orange-500' },
  { label: 'Pending', value: 3, percentage: 12, color: 'from-slate-400 to-slate-500' },
];

const mockStudies = [
  {
    id: '1',
    title: 'MBSR for Chronic Low Back Pain: A Randomized Controlled Trial',
    journal: 'JAMA',
    year: 2016,
    status: 'completed',
    confidence: 'high',
    reviewers: [
      { name: 'Sarah Chen', progress: 100 },
      { name: 'Michael Torres', progress: 100 },
    ],
    consensusReached: true,
    daysAgo: 2,
  },
  {
    id: '2',
    title: 'MBCT on Body Awareness in Chronic Pain Patients',
    journal: 'Front Psychol',
    year: 2016,
    status: 'reconcile',
    confidence: null,
    reviewers: [
      { name: 'Emily Watson', progress: 100 },
      { name: 'Sarah Chen', progress: 100 },
    ],
    consensusReached: false,
    daysAgo: 1,
  },
  {
    id: '3',
    title: 'Mindfulness Meditation for Pediatric Chronic Pain',
    journal: 'Children',
    year: 2019,
    status: 'in-progress',
    confidence: null,
    reviewers: [
      { name: 'Michael Torres', progress: 65 },
      { name: 'Emily Watson', progress: 30 },
    ],
    consensusReached: false,
    daysAgo: 0,
  },
  {
    id: '4',
    title: 'Mindfulness for Fibromyalgia: Impact on Pain and QoL',
    journal: 'Pain Med',
    year: 2020,
    status: 'pending',
    confidence: null,
    reviewers: [],
    consensusReached: false,
    daysAgo: 5,
  },
];

const mockActivity = [
  {
    user: 'Sarah Chen',
    action: 'completed review',
    study: 'MBSR for Chronic Low Back Pain',
    time: '2 hours ago',
  },
  {
    user: 'Michael Torres',
    action: 'started review',
    study: 'Mindfulness Meditation for Pediatric',
    time: '5 hours ago',
  },
  {
    user: 'Emily Watson',
    action: 'requested reconciliation',
    study: 'MBCT on Body Awareness',
    time: '1 day ago',
  },
];

function ProgressRing(props) {
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (props.value / 100) * circumference;

  return (
    <div class='relative h-12 w-12'>
      <svg class='h-12 w-12 -rotate-90'>
        <circle
          cx='24'
          cy='24'
          r='18'
          stroke='currentColor'
          stroke-width='3'
          fill='none'
          class='text-slate-700'
        />
        <circle
          cx='24'
          cy='24'
          r='18'
          stroke='url(#gradient)'
          stroke-width='3'
          fill='none'
          stroke-linecap='round'
          stroke-dasharray={circumference}
          stroke-dashoffset={offset}
          class='transition-all duration-500'
        />
        <defs>
          <linearGradient id='gradient' x1='0%' y1='0%' x2='100%' y2='0%'>
            <stop offset='0%' stop-color='#a78bfa' />
            <stop offset='100%' stop-color='#f472b6' />
          </linearGradient>
        </defs>
      </svg>
      <span class='absolute inset-0 flex items-center justify-center text-xs font-semibold text-white'>
        {props.value}%
      </span>
    </div>
  );
}

function StatusPill(props) {
  const styles = {
    completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    reconcile: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'in-progress': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    pending: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  const labels = {
    completed: 'Completed',
    reconcile: 'Reconciling',
    'in-progress': 'In Progress',
    pending: 'Pending',
  };

  return (
    <span
      class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles[props.status]}`}
    >
      <span
        class={`h-1.5 w-1.5 rounded-full ${
          props.status === 'completed' ? 'bg-emerald-400'
          : props.status === 'reconcile' ? 'bg-amber-400'
          : props.status === 'in-progress' ? 'animate-pulse bg-blue-400'
          : 'bg-slate-400'
        }`}
      />
      {labels[props.status]}
    </span>
  );
}

function ConfidenceBadge(props) {
  const styles = {
    high: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white',
    moderate: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
    low: 'bg-gradient-to-r from-rose-500 to-pink-500 text-white',
    'critically-low': 'bg-gradient-to-r from-red-600 to-rose-600 text-white',
  };

  return (
    <span
      class={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${styles[props.level]}`}
    >
      {props.level.replace('-', ' ')}
    </span>
  );
}

function ReviewerProgress(props) {
  return (
    <div class='flex items-center gap-2'>
      <div class='flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[10px] font-bold text-white'>
        {props.name
          .split(' ')
          .map(n => n[0])
          .join('')}
      </div>
      <div class='flex-1'>
        <div class='mb-1 flex items-center justify-between'>
          <span class='text-xs text-slate-300'>{props.name.split(' ')[0]}</span>
          <span class='text-[10px] text-slate-500'>{props.progress}%</span>
        </div>
        <div class='h-1 w-full overflow-hidden rounded-full bg-slate-700'>
          <div
            class='h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300'
            style={`width: ${props.progress}%`}
          />
        </div>
      </div>
    </div>
  );
}

export default function ProjectViewDashboard() {
  const [viewMode, setViewMode] = createSignal('cards');
  const [filterOpen, setFilterOpen] = createSignal(false);

  return (
    <div class='min-h-screen bg-slate-950 text-white'>
      {/* Gradient Background Effects */}
      <div class='pointer-events-none fixed inset-0 overflow-hidden'>
        <div class='absolute -top-40 -right-40 h-80 w-80 rounded-full bg-violet-500/20 blur-[100px]' />
        <div class='absolute top-1/2 -left-40 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-[100px]' />
        <div class='absolute right-1/4 bottom-0 h-60 w-60 rounded-full bg-cyan-500/10 blur-[80px]' />
      </div>

      <div class='relative'>
        {/* Header */}
        <header class='border-b border-slate-800/50 backdrop-blur-xl'>
          <div class='mx-auto max-w-7xl px-6 py-4'>
            <div class='flex items-center justify-between'>
              <div class='flex items-center gap-4'>
                <button class='flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/50 text-slate-400 transition-all hover:bg-slate-800 hover:text-white'>
                  <FiArrowLeft class='h-4 w-4' />
                </button>
                <div>
                  <h1 class='text-lg font-semibold text-white'>{mockProject.name}</h1>
                  <p class='text-sm text-slate-400'>{mockProject.description}</p>
                </div>
              </div>
              <div class='flex items-center gap-3'>
                <button class='flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40'>
                  <FiPlus class='h-4 w-4' />
                  Add Studies
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Stats Cards */}
        <div class='mx-auto max-w-7xl px-6 py-6'>
          <div class='grid grid-cols-4 gap-4'>
            <For each={mockStats}>
              {stat => (
                <div class='group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5 backdrop-blur-sm transition-all hover:border-slate-700/50'>
                  <div
                    class={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 transition-opacity group-hover:opacity-5`}
                  />
                  <div class='relative'>
                    <p class='text-sm text-slate-400'>{stat.label}</p>
                    <div class='mt-2 flex items-end justify-between'>
                      <span class='text-3xl font-bold tracking-tight'>{stat.value}</span>
                      <Show when={stat.percentage}>
                        <span
                          class={`bg-gradient-to-r text-sm font-medium ${stat.color} bg-clip-text text-transparent`}
                        >
                          {stat.percentage}%
                        </span>
                      </Show>
                      <Show when={stat.change}>
                        <span class='text-xs text-slate-500'>{stat.change}</span>
                      </Show>
                    </div>
                    <Show when={stat.percentage}>
                      <div class='mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-800'>
                        <div
                          class={`h-full rounded-full bg-gradient-to-r ${stat.color}`}
                          style={`width: ${stat.percentage}%`}
                        />
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Main Content Area */}
        <div class='mx-auto max-w-7xl px-6 pb-8'>
          <div class='grid grid-cols-12 gap-6'>
            {/* Studies List */}
            <div class='col-span-8'>
              {/* Toolbar */}
              <div class='mb-4 flex items-center justify-between'>
                <div class='flex items-center gap-3'>
                  <div class='relative'>
                    <FiSearch class='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500' />
                    <input
                      type='text'
                      placeholder='Search studies...'
                      class='w-64 rounded-lg border border-slate-800 bg-slate-900/50 py-2 pr-4 pl-10 text-sm text-white placeholder-slate-500 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 focus:outline-none'
                    />
                  </div>
                  <button
                    class={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                      filterOpen() ?
                        'border-violet-500/50 bg-violet-500/10 text-violet-400'
                      : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                    }`}
                    onClick={() => setFilterOpen(!filterOpen())}
                  >
                    <FiFilter class='h-4 w-4' />
                    Filter
                  </button>
                </div>
                <div class='flex items-center gap-1 rounded-lg border border-slate-800 p-1'>
                  <button
                    class={`rounded-md p-1.5 transition-all ${viewMode() === 'cards' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                    onClick={() => setViewMode('cards')}
                  >
                    <FiGrid class='h-4 w-4' />
                  </button>
                  <button
                    class={`rounded-md p-1.5 transition-all ${viewMode() === 'list' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                    onClick={() => setViewMode('list')}
                  >
                    <FiList class='h-4 w-4' />
                  </button>
                </div>
              </div>

              {/* Study Cards */}
              <div class='space-y-3'>
                <For each={mockStudies}>
                  {study => (
                    <div class='group relative cursor-pointer overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/30 p-4 backdrop-blur-sm transition-all hover:border-slate-700/50 hover:bg-slate-900/50'>
                      <div class='flex items-start gap-4'>
                        {/* Progress Ring */}
                        <Show when={study.status !== 'pending'}>
                          <ProgressRing
                            value={
                              study.status === 'completed' ?
                                100
                              : Math.round(
                                  study.reviewers.reduce((a, r) => a + r.progress, 0) /
                                    Math.max(study.reviewers.length, 1),
                                )
                            }
                          />
                        </Show>
                        <Show when={study.status === 'pending'}>
                          <div class='flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-slate-700 text-slate-600'>
                            <FiClock class='h-5 w-5' />
                          </div>
                        </Show>

                        {/* Content */}
                        <div class='min-w-0 flex-1'>
                          <div class='mb-2 flex items-center gap-2'>
                            <StatusPill status={study.status} />
                            <Show when={study.confidence}>
                              <ConfidenceBadge level={study.confidence} />
                            </Show>
                          </div>

                          <h3 class='truncate font-medium text-white transition-colors group-hover:text-violet-300'>
                            {study.title}
                          </h3>

                          <p class='mt-1 text-sm text-slate-500'>
                            {study.journal} ({study.year})
                          </p>

                          {/* Reviewers */}
                          <Show when={study.reviewers.length > 0}>
                            <div class='mt-3 grid grid-cols-2 gap-3'>
                              <For each={study.reviewers}>
                                {reviewer => (
                                  <ReviewerProgress
                                    name={reviewer.name}
                                    progress={reviewer.progress}
                                  />
                                )}
                              </For>
                            </div>
                          </Show>

                          <Show when={study.reviewers.length === 0}>
                            <button class='mt-3 flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-violet-400'>
                              <FiUser class='h-4 w-4' />
                              Assign reviewers
                            </button>
                          </Show>
                        </div>

                        {/* Actions */}
                        <button class='flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-slate-800 hover:text-white'>
                          <FiMoreHorizontal class='h-4 w-4' />
                        </button>
                      </div>

                      {/* Consensus indicator */}
                      <Show when={study.status === 'reconcile'}>
                        <div class='absolute right-0 bottom-0 left-0 h-1 animate-pulse bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500' />
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* Activity Sidebar */}
            <div class='col-span-4'>
              <div class='rounded-2xl border border-slate-800/50 bg-slate-900/30 p-5 backdrop-blur-sm'>
                <h3 class='mb-4 text-sm font-semibold text-white'>Recent Activity</h3>
                <div class='space-y-4'>
                  <For each={mockActivity}>
                    {activity => (
                      <div class='flex gap-3'>
                        <div class='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[10px] font-bold text-white'>
                          {activity.user
                            .split(' ')
                            .map(n => n[0])
                            .join('')}
                        </div>
                        <div class='min-w-0'>
                          <p class='text-sm text-slate-300'>
                            <span class='font-medium text-white'>
                              {activity.user.split(' ')[0]}
                            </span>{' '}
                            {activity.action}
                          </p>
                          <p class='truncate text-xs text-slate-500'>{activity.study}</p>
                          <p class='mt-0.5 text-xs text-slate-600'>{activity.time}</p>
                        </div>
                      </div>
                    )}
                  </For>
                </div>

                <button class='mt-4 w-full rounded-lg border border-slate-800 py-2 text-sm text-slate-400 transition-all hover:border-slate-700 hover:text-white'>
                  View all activity
                </button>
              </div>

              {/* Quick Actions */}
              <div class='mt-4 rounded-2xl border border-slate-800/50 bg-slate-900/30 p-5 backdrop-blur-sm'>
                <h3 class='mb-4 text-sm font-semibold text-white'>Quick Actions</h3>
                <div class='space-y-2'>
                  <button class='flex w-full items-center gap-3 rounded-lg border border-slate-800 p-3 text-left text-sm text-slate-300 transition-all hover:border-violet-500/30 hover:bg-violet-500/5'>
                    <span class='flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400'>
                      <FiExternalLink class='h-4 w-4' />
                    </span>
                    Export Results
                  </button>
                  <button class='flex w-full items-center gap-3 rounded-lg border border-slate-800 p-3 text-left text-sm text-slate-300 transition-all hover:border-fuchsia-500/30 hover:bg-fuchsia-500/5'>
                    <span class='flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-500/20 text-fuchsia-400'>
                      <FiUser class='h-4 w-4' />
                    </span>
                    Invite Collaborator
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
      `}</style>
    </div>
  );
}
