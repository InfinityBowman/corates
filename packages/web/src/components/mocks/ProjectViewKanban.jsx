/**
 * ProjectView Mock - Kanban/Board Style
 *
 * Design Direction: Spatial organization with drag-drop potential.
 * Warm, approachable palette with paper-like textures and soft shadows.
 * Inspired by Notion, Linear, and modern project management tools.
 */

import { For, Show, createSignal } from 'solid-js';
import {
  FiArrowLeft,
  FiPlus,
  FiSearch,
  FiSettings,
  FiMoreVertical,
  FiFile,
  FiMessageCircle,
  FiCheckCircle,
  FiAlertTriangle,
  FiClock,
  FiChevronDown,
} from 'solid-icons/fi';

// Mock data
const mockProject = {
  name: 'Mindfulness Interventions Review',
  emoji: null,
  members: ['SC', 'MT', 'EW'],
};

const mockColumns = [
  {
    id: 'pending',
    title: 'Pending',
    color: 'slate',
    icon: FiClock,
    studies: [
      {
        id: '4',
        title: 'Mindfulness for Fibromyalgia: Impact on Pain and Quality of Life',
        journal: 'Pain Medicine',
        year: 2020,
        pdf: true,
        comments: 0,
        priority: 'normal',
      },
      {
        id: '5',
        title: 'Online Mindfulness Training for Chronic Pain',
        journal: 'J Pain Res',
        year: 2021,
        pdf: true,
        comments: 2,
        priority: 'high',
      },
    ],
  },
  {
    id: 'in-review',
    title: 'In Review',
    color: 'blue',
    icon: FiFile,
    studies: [
      {
        id: '3',
        title: 'A Pilot Study of Mindfulness Meditation for Pediatric Chronic Pain',
        journal: 'Children',
        year: 2019,
        pdf: true,
        comments: 5,
        priority: 'normal',
        reviewers: [
          { initials: 'MT', progress: 65 },
          { initials: 'EW', progress: 30 },
        ],
      },
      {
        id: '6',
        title: 'Acceptance and Mindfulness-Based Therapy for Chronic Pain',
        journal: 'Clin J Pain',
        year: 2018,
        pdf: true,
        comments: 1,
        priority: 'normal',
        reviewers: [
          { initials: 'SC', progress: 45 },
          { initials: 'MT', progress: 20 },
        ],
      },
    ],
  },
  {
    id: 'reconcile',
    title: 'Reconciliation',
    color: 'amber',
    icon: FiAlertTriangle,
    studies: [
      {
        id: '2',
        title: 'Effects of MBCT on Body Awareness in Patients with Chronic Pain',
        journal: 'Frontiers in Psychology',
        year: 2016,
        pdf: true,
        comments: 8,
        priority: 'urgent',
        reviewers: [
          { initials: 'EW', progress: 100 },
          { initials: 'SC', progress: 100 },
        ],
        disagreements: 3,
      },
    ],
  },
  {
    id: 'completed',
    title: 'Completed',
    color: 'emerald',
    icon: FiCheckCircle,
    studies: [
      {
        id: '1',
        title: 'MBSR for Chronic Low Back Pain: A Randomized Controlled Trial',
        journal: 'JAMA',
        year: 2016,
        pdf: true,
        comments: 12,
        rating: 'High',
        reviewers: [
          { initials: 'SC', progress: 100 },
          { initials: 'MT', progress: 100 },
        ],
      },
    ],
  },
];

const colorMap = {
  slate: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    header: 'bg-slate-100 text-slate-700',
    dot: 'bg-slate-400',
    accent: 'text-slate-600',
  },
  blue: {
    bg: 'bg-blue-50/50',
    border: 'border-blue-200/50',
    header: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-400',
    accent: 'text-blue-600',
  },
  amber: {
    bg: 'bg-amber-50/50',
    border: 'border-amber-200/50',
    header: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-400',
    accent: 'text-amber-600',
  },
  emerald: {
    bg: 'bg-emerald-50/50',
    border: 'border-emerald-200/50',
    header: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
    accent: 'text-emerald-600',
  },
};

function PriorityDot(props) {
  const colors = {
    urgent: 'bg-rose-500',
    high: 'bg-amber-500',
    normal: 'bg-slate-300',
  };

  return <span class={`inline-block h-2 w-2 rounded-full ${colors[props.priority]}`} />;
}

function RatingBadge(props) {
  const colors = {
    High: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Moderate: 'bg-amber-100 text-amber-700 border-amber-200',
    Low: 'bg-rose-100 text-rose-700 border-rose-200',
    'Critically Low': 'bg-rose-200 text-rose-800 border-rose-300',
  };

  return (
    <span
      class={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${colors[props.rating]}`}
    >
      {props.rating} Confidence
    </span>
  );
}

function ReviewerStack(props) {
  return (
    <div class='flex items-center -space-x-2'>
      <For each={props.reviewers}>
        {reviewer => (
          <div class='relative'>
            <div class='flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-indigo-400 to-purple-500 text-[10px] font-bold text-white shadow-sm'>
              {reviewer.initials}
            </div>
            <Show when={reviewer.progress < 100}>
              <svg class='absolute -right-0.5 -bottom-0.5 h-3 w-3' viewBox='0 0 12 12'>
                <circle cx='6' cy='6' r='5' fill='white' stroke='#e2e8f0' stroke-width='1' />
                <circle
                  cx='6'
                  cy='6'
                  r='3'
                  fill='none'
                  stroke='#818cf8'
                  stroke-width='2'
                  stroke-dasharray={`${(reviewer.progress / 100) * 18.85} 18.85`}
                  stroke-linecap='round'
                  transform='rotate(-90 6 6)'
                />
              </svg>
            </Show>
            <Show when={reviewer.progress === 100}>
              <div class='absolute -right-0.5 -bottom-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500'>
                <FiCheckCircle class='h-2 w-2 text-white' />
              </div>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}

function StudyCard(props) {
  const [expanded, setExpanded] = createSignal(false);

  return (
    <div class='group cursor-grab rounded-lg border border-slate-200/80 bg-white p-3 shadow-sm transition-all hover:border-slate-300 hover:shadow-md active:cursor-grabbing'>
      {/* Header Row */}
      <div class='mb-2 flex items-start justify-between gap-2'>
        <div class='flex items-center gap-2'>
          <PriorityDot priority={props.study.priority || 'normal'} />
          <Show when={props.study.rating}>
            <RatingBadge rating={props.study.rating} />
          </Show>
          <Show when={props.study.disagreements}>
            <span class='inline-flex items-center gap-1 rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700'>
              <FiAlertTriangle class='h-2.5 w-2.5' />
              {props.study.disagreements} conflicts
            </span>
          </Show>
        </div>
        <button class='rounded p-1 opacity-0 transition-all group-hover:opacity-100 hover:bg-slate-100'>
          <FiMoreVertical class='h-3.5 w-3.5 text-slate-400' />
        </button>
      </div>

      {/* Title */}
      <h4 class='mb-2 line-clamp-2 text-sm leading-snug font-medium text-slate-900'>
        {props.study.title}
      </h4>

      {/* Meta */}
      <p class='mb-3 text-xs text-slate-500'>
        {props.study.journal} ({props.study.year})
      </p>

      {/* Footer */}
      <div class='flex items-center justify-between'>
        <div class='flex items-center gap-2'>
          <Show when={props.study.pdf}>
            <span class='inline-flex items-center gap-1 text-xs text-slate-400'>
              <FiFile class='h-3 w-3' />
            </span>
          </Show>
          <Show when={props.study.comments > 0}>
            <span class='inline-flex items-center gap-1 text-xs text-slate-400'>
              <FiMessageCircle class='h-3 w-3' />
              {props.study.comments}
            </span>
          </Show>
        </div>
        <Show when={props.study.reviewers && props.study.reviewers.length > 0}>
          <ReviewerStack reviewers={props.study.reviewers} />
        </Show>
      </div>
    </div>
  );
}

function KanbanColumn(props) {
  const colors = colorMap[props.column.color];
  const Icon = props.column.icon;

  return (
    <div
      class={`flex flex-col rounded-xl ${colors.bg} border ${colors.border} min-h-[calc(100vh-200px)]`}
    >
      {/* Column Header */}
      <div class={`flex items-center justify-between rounded-t-xl px-4 py-3 ${colors.header}`}>
        <div class='flex items-center gap-2'>
          <span
            class={`flex h-5 w-5 items-center justify-center rounded ${colors.dot.replace('bg-', 'bg-opacity-20 bg-')}`}
          >
            <Icon class={`h-3 w-3 ${colors.accent}`} />
          </span>
          <span class='text-sm font-semibold'>{props.column.title}</span>
          <span class='ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/60 px-1.5 text-xs font-medium'>
            {props.column.studies.length}
          </span>
        </div>
        <button class='rounded p-1 transition-colors hover:bg-white/50'>
          <FiPlus class='h-4 w-4' />
        </button>
      </div>

      {/* Cards */}
      <div class='flex-1 space-y-2 overflow-y-auto p-2'>
        <For each={props.column.studies}>{study => <StudyCard study={study} />}</For>

        {/* Add card button */}
        <button class='w-full rounded-lg border-2 border-dashed border-slate-200 py-3 text-sm text-slate-400 transition-all hover:border-slate-300 hover:bg-white/50 hover:text-slate-500'>
          + Add study
        </button>
      </div>
    </div>
  );
}

export default function ProjectViewKanban() {
  const [viewMode, setViewMode] = createSignal('board');

  return (
    <div class='min-h-screen bg-gradient-to-br from-stone-100 via-slate-50 to-stone-100'>
      {/* Subtle Paper Texture Overlay */}
      <div
        class='pointer-events-none fixed inset-0 opacity-30'
        style={{
          'background-image':
            'url(\'data:image/svg+xml,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noise"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%" height="100%" filter="url(%23noise)" opacity="0.04"/%3E%3C/svg%3E\')',
        }}
      />

      <div class='relative'>
        {/* Header */}
        <header class='sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl'>
          <div class='mx-auto max-w-[1600px] px-6 py-4'>
            <div class='flex items-center justify-between'>
              {/* Left: Back + Project Info */}
              <div class='flex items-center gap-4'>
                ""
                <button class='flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900'>
                  <FiArrowLeft class='h-4 w-4' />
                </button>
                <div class='flex items-center gap-3'>
                  <div class='flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg shadow-md'>
                    <span class='font-medium text-white'>M</span>
                  </div>
                  <div>
                    <h1 class='text-lg font-semibold text-slate-900'>{mockProject.name}</h1>
                    <div class='flex items-center gap-2 text-xs text-slate-500'>
                      <span>6 studies</span>
                      <span class='text-slate-300'>|</span>
                      <span>3 team members</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center: View Toggle */}
              <div class='flex items-center gap-1 rounded-lg bg-slate-100 p-1'>
                <button
                  class={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                    viewMode() === 'board' ?
                      'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                  }`}
                  onClick={() => setViewMode('board')}
                >
                  Board
                </button>
                <button
                  class={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                    viewMode() === 'list' ?
                      'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                  }`}
                  onClick={() => setViewMode('list')}
                >
                  List
                </button>
                <button
                  class={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                    viewMode() === 'table' ?
                      'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                  }`}
                  onClick={() => setViewMode('table')}
                >
                  Table
                </button>
              </div>

              {/* Right: Actions */}
              <div class='flex items-center gap-3'>
                <div class='relative'>
                  <FiSearch class='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400' />
                  <input
                    type='text'
                    placeholder='Search...'
                    class='w-48 rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm placeholder-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none'
                  />
                </div>

                {/* Team avatars */}
                <div class='flex -space-x-2'>
                  <For each={mockProject.members}>
                    {initials => (
                      <div class='flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-indigo-400 to-purple-500 text-xs font-bold text-white shadow-sm'>
                        {initials}
                      </div>
                    )}
                  </For>
                  <button class='flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white text-slate-400 transition-all hover:border-indigo-300 hover:text-indigo-500'>
                    <FiPlus class='h-3.5 w-3.5' />
                  </button>
                </div>

                <button class='flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700'>
                  <FiPlus class='h-4 w-4' />
                  Add Study
                </button>

                <button class='flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-700'>
                  <FiSettings class='h-4 w-4' />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Filter Bar */}
        <div class='border-b border-slate-200/80 bg-white/50 backdrop-blur-sm'>
          <div class='mx-auto max-w-[1600px] px-6 py-3'>
            <div class='flex items-center gap-2'>
              <button class='flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm transition-all hover:bg-slate-50'>
                Reviewer
                <FiChevronDown class='h-3.5 w-3.5' />
              </button>
              <button class='flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm transition-all hover:bg-slate-50'>
                Priority
                <FiChevronDown class='h-3.5 w-3.5' />
              </button>
              <button class='flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm transition-all hover:bg-slate-50'>
                Checklist Type
                <FiChevronDown class='h-3.5 w-3.5' />
              </button>
              <div class='h-4 w-px bg-slate-200' />
              <button class='text-sm text-slate-500 transition-colors hover:text-indigo-600'>
                Clear filters
              </button>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <main class='mx-auto max-w-[1600px] p-6'>
          <div class='grid grid-cols-4 gap-4'>
            <For each={mockColumns}>{column => <KanbanColumn column={column} />}</For>
          </div>
        </main>
      </div>

      {/* Floating Action Button (mobile) */}
      <div class='fixed right-6 bottom-6 lg:hidden'>
        <button class='flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-700'>
          <FiPlus class='h-6 w-6' />
        </button>
      </div>

      {/* Embedded Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        body {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
