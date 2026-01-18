/**
 * ProjectView Mock - Complete Workflow
 *
 * Design Direction: Light-mode dashboard with clear workflow stages.
 * Shows the full journey: Team -> Studies -> Assignment -> Review -> Reconcile -> Complete -> Charts
 */

import { For, Show, createSignal, createMemo } from 'solid-js';
import {
  FiArrowLeft,
  FiPlus,
  FiSearch,
  FiSettings,
  FiMoreHorizontal,
  FiUsers,
  FiBook,
  FiClipboard,
  FiGitMerge,
  FiCheckCircle,
  FiBarChart2,
  FiUpload,
  FiLink,
  FiFile,
  FiUserPlus,
  FiMail,
  FiX,
  FiChevronRight,
  FiAlertCircle,
  FiClock,
  FiEdit3,
  FiDownload,
  FiExternalLink,
} from 'solid-icons/fi';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = {
  name: 'Mindfulness Interventions for Chronic Pain',
  description:
    'Systematic review examining RCTs of mindfulness-based interventions for chronic pain management',
};

const mockMembers = [
  {
    id: '1',
    name: 'Dr. Sarah Chen',
    email: 'sarah.chen@university.edu',
    role: 'Lead',
    avatar: 'SC',
  },
  {
    id: '2',
    name: 'Dr. Michael Torres',
    email: 'm.torres@research.org',
    role: 'Reviewer',
    avatar: 'MT',
  },
  {
    id: '3',
    name: 'Dr. Emily Watson',
    email: 'e.watson@institute.edu',
    role: 'Reviewer',
    avatar: 'EW',
  },
];

const mockStudies = [
  {
    id: '1',
    title:
      'Mindfulness-Based Stress Reduction for Chronic Low Back Pain: A Randomized Controlled Trial',
    authors: 'Cherkin DC, Sherman KJ, Balderson BH, et al.',
    journal: 'JAMA',
    year: 2016,
    hasPdf: true,
    assignedTo: ['1', '2'],
    status: 'completed',
    rating: 'High',
  },
  {
    id: '2',
    title:
      'Effects of Mindfulness-Based Cognitive Therapy on Body Awareness in Patients with Chronic Pain',
    authors: 'de Jong M, Lazar SW, Hug K, et al.',
    journal: 'Frontiers in Psychology',
    year: 2016,
    hasPdf: true,
    assignedTo: ['3', '1'],
    status: 'reconcile',
    disagreements: 3,
  },
  {
    id: '3',
    title: 'A Pilot Study of Mindfulness Meditation for Pediatric Chronic Pain',
    authors: 'Jastrowski Mano KE, Salamon KS, Hainsworth KR, et al.',
    journal: 'Children',
    year: 2019,
    hasPdf: true,
    assignedTo: ['2'],
    status: 'in-review',
    progress: { 2: 65 },
  },
  {
    id: '4',
    title: 'Mindfulness-Based Intervention for Fibromyalgia: Impact on Pain and Quality of Life',
    authors: 'Schmidt S, Grossman P, Schwarzer B, et al.',
    journal: 'Pain Medicine',
    year: 2020,
    hasPdf: true,
    assignedTo: [],
    status: 'unassigned',
  },
  {
    id: '5',
    title: 'Online Mindfulness Training for Chronic Pain Management',
    authors: 'Gardner-Nix J, Backman S, Barbati J, et al.',
    journal: 'Journal of Pain Research',
    year: 2021,
    hasPdf: false,
    assignedTo: [],
    status: 'unassigned',
  },
];

const mockTodoItems = [
  {
    id: '1',
    studyId: '3',
    studyTitle: 'A Pilot Study of Mindfulness Meditation for Pediatric Chronic Pain',
    checklistType: 'AMSTAR2',
    progress: 65,
    lastEdited: '2 hours ago',
  },
];

const mockReconcileItems = [
  {
    id: '1',
    studyId: '2',
    studyTitle: 'Effects of MBCT on Body Awareness in Chronic Pain Patients',
    reviewers: ['Dr. Emily Watson', 'Dr. Sarah Chen'],
    disagreements: 3,
    resolved: 1,
  },
];

const mockCompletedItems = [
  {
    id: '1',
    studyId: '1',
    studyTitle: 'MBSR for Chronic Low Back Pain: A Randomized Controlled Trial',
    rating: 'High',
    checklistType: 'AMSTAR2',
    completedAt: 'Dec 15, 2024',
    reviewers: ['Dr. Sarah Chen', 'Dr. Michael Torres'],
  },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function Avatar(props) {
  const colors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
  ];
  const colorIndex = props.name ? props.name.charCodeAt(0) % colors.length : 0;

  return (
    <div
      class={`flex items-center justify-center rounded-full bg-gradient-to-br ${colors[colorIndex]} font-semibold text-white ${props.class || 'h-8 w-8 text-xs'}`}
    >
      {props.initials ||
        props.name
          ?.split(' ')
          .map(n => n[0])
          .join('') ||
        '?'}
    </div>
  );
}

function Badge(props) {
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    neutral: 'bg-slate-50 text-slate-600 border-slate-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  return (
    <span
      class={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${styles[props.variant || 'neutral']}`}
    >
      {props.children}
    </span>
  );
}

function ProgressBar(props) {
  return (
    <div class='h-1.5 w-full overflow-hidden rounded-full bg-slate-100'>
      <div
        class='h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300'
        style={`width: ${props.value}%`}
      />
    </div>
  );
}

function EmptyState(props) {
  return (
    <div class='flex flex-col items-center justify-center py-12 text-center'>
      <div class='mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400'>
        {props.icon}
      </div>
      <h3 class='mb-1 text-sm font-medium text-slate-900'>{props.title}</h3>
      <p class='mb-4 max-w-sm text-sm text-slate-500'>{props.description}</p>
      <Show when={props.action}>
        <button class='flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700'>
          {props.actionIcon}
          {props.action}
        </button>
      </Show>
    </div>
  );
}

// ============================================================================
// TAB CONTENT COMPONENTS
// ============================================================================

function TeamTab() {
  const [showInvite, setShowInvite] = createSignal(false);

  return (
    <div class='space-y-6'>
      {/* Invite Section */}
      <div class='rounded-xl border border-slate-200 bg-white p-6'>
        <div class='mb-4 flex items-center justify-between'>
          <div>
            <h3 class='text-base font-semibold text-slate-900'>Team Members</h3>
            <p class='text-sm text-slate-500'>Invite collaborators to review studies</p>
          </div>
          <button
            class='flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700'
            onClick={() => setShowInvite(true)}
          >
            <FiUserPlus class='h-4 w-4' />
            Invite Member
          </button>
        </div>

        {/* Invite Form */}
        <Show when={showInvite()}>
          <div class='mb-6 rounded-lg border border-violet-200 bg-violet-50/50 p-4'>
            <div class='flex items-center gap-3'>
              <div class='flex-1'>
                <input
                  type='email'
                  placeholder='colleague@university.edu'
                  class='w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100 focus:outline-none'
                />
              </div>
              <select class='rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-violet-300 focus:ring-2 focus:ring-violet-100 focus:outline-none'>
                <option>Reviewer</option>
                <option>Lead</option>
              </select>
              <button class='rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700'>
                Send Invite
              </button>
              <button
                class='rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600'
                onClick={() => setShowInvite(false)}
              >
                <FiX class='h-4 w-4' />
              </button>
            </div>
          </div>
        </Show>

        {/* Member List */}
        <div class='space-y-3'>
          <For each={mockMembers}>
            {member => (
              <div class='flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-4 transition-colors hover:bg-slate-50'>
                <div class='flex items-center gap-3'>
                  <Avatar name={member.name} initials={member.avatar} class='h-10 w-10 text-sm' />
                  <div>
                    <p class='font-medium text-slate-900'>{member.name}</p>
                    <p class='text-sm text-slate-500'>{member.email}</p>
                  </div>
                </div>
                <div class='flex items-center gap-3'>
                  <Badge variant={member.role === 'Lead' ? 'info' : 'neutral'}>{member.role}</Badge>
                  <button class='rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600'>
                    <FiMoreHorizontal class='h-4 w-4' />
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

function StudiesTab() {
  const [showUpload, setShowUpload] = createSignal(false);

  const unassignedStudies = createMemo(() => mockStudies.filter(s => s.assignedTo.length === 0));
  const assignedStudies = createMemo(() => mockStudies.filter(s => s.assignedTo.length > 0));

  return (
    <div class='space-y-6'>
      {/* Add Studies Section */}
      <div class='rounded-xl border border-slate-200 bg-white p-6'>
        <div class='mb-4 flex items-center justify-between'>
          <div>
            <h3 class='text-base font-semibold text-slate-900'>Add Studies</h3>
            <p class='text-sm text-slate-500'>Import PDFs, references, or from Google Drive</p>
          </div>
        </div>

        <div class='grid grid-cols-3 gap-4'>
          <button class='flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6 text-slate-500 transition-all hover:border-violet-300 hover:bg-violet-50/30 hover:text-violet-600'>
            <FiUpload class='h-6 w-6' />
            <span class='text-sm font-medium'>Upload PDFs</span>
          </button>
          <button class='flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6 text-slate-500 transition-all hover:border-violet-300 hover:bg-violet-50/30 hover:text-violet-600'>
            <FiLink class='h-6 w-6' />
            <span class='text-sm font-medium'>Import References</span>
            <span class='text-xs text-slate-400'>RIS, BibTeX, EndNote</span>
          </button>
          <button class='flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6 text-slate-500 transition-all hover:border-violet-300 hover:bg-violet-50/30 hover:text-violet-600'>
            <svg class='h-6 w-6' viewBox='0 0 24 24' fill='currentColor'>
              <path
                d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'
                stroke='currentColor'
                stroke-width='2'
                fill='none'
              />
            </svg>
            <span class='text-sm font-medium'>Google Drive</span>
          </button>
        </div>
      </div>

      {/* Unassigned Studies */}
      <Show when={unassignedStudies().length > 0}>
        <div class='rounded-xl border border-amber-200 bg-amber-50/30 p-6'>
          <div class='mb-4 flex items-center gap-2'>
            <FiAlertCircle class='h-5 w-5 text-amber-600' />
            <h3 class='text-base font-semibold text-slate-900'>
              Needs Assignment ({unassignedStudies().length})
            </h3>
          </div>
          <div class='space-y-3'>
            <For each={unassignedStudies()}>
              {study => (
                <div class='flex items-center justify-between rounded-lg border border-amber-200 bg-white p-4'>
                  <div class='flex min-w-0 items-center gap-3'>
                    <div class='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400'>
                      <Show when={study.hasPdf} fallback={<FiFile class='h-5 w-5' />}>
                        <FiFile class='h-5 w-5 text-violet-500' />
                      </Show>
                    </div>
                    <div class='min-w-0'>
                      <p class='truncate font-medium text-slate-900'>{study.title}</p>
                      <p class='text-sm text-slate-500'>
                        {study.journal} ({study.year})
                      </p>
                    </div>
                  </div>
                  <button class='flex shrink-0 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100'>
                    <FiUsers class='h-4 w-4' />
                    Assign Reviewers
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* All Studies */}
      <div class='rounded-xl border border-slate-200 bg-white p-6'>
        <div class='mb-4 flex items-center justify-between'>
          <h3 class='text-base font-semibold text-slate-900'>All Studies ({mockStudies.length})</h3>
          <div class='flex items-center gap-2'>
            <div class='relative'>
              <FiSearch class='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400' />
              <input
                type='text'
                placeholder='Search studies...'
                class='w-64 rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm placeholder-slate-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 focus:outline-none'
              />
            </div>
          </div>
        </div>

        <div class='space-y-2'>
          <For each={mockStudies}>
            {study => (
              <div class='group flex cursor-pointer items-center gap-4 rounded-lg border border-slate-100 p-4 transition-colors hover:border-slate-200 hover:bg-slate-50/50'>
                <div class='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400'>
                  <Show when={study.hasPdf} fallback={<FiFile class='h-5 w-5' />}>
                    <FiFile class='h-5 w-5 text-violet-500' />
                  </Show>
                </div>
                <div class='min-w-0 flex-1'>
                  <p class='truncate font-medium text-slate-900 transition-colors group-hover:text-violet-700'>
                    {study.title}
                  </p>
                  <p class='text-sm text-slate-500'>{study.authors}</p>
                  <p class='text-xs text-slate-400'>
                    {study.journal} ({study.year})
                  </p>
                </div>
                <div class='flex shrink-0 items-center gap-3'>
                  {/* Status */}
                  <Show when={study.status === 'completed'}>
                    <Badge variant='success'>
                      <FiCheckCircle class='h-3 w-3' />
                      {study.rating}
                    </Badge>
                  </Show>
                  <Show when={study.status === 'reconcile'}>
                    <Badge variant='warning'>
                      <FiGitMerge class='h-3 w-3' />
                      Reconcile
                    </Badge>
                  </Show>
                  <Show when={study.status === 'in-review'}>
                    <Badge variant='info'>
                      <FiClipboard class='h-3 w-3' />
                      In Review
                    </Badge>
                  </Show>
                  <Show when={study.status === 'unassigned'}>
                    <Badge variant='neutral'>Unassigned</Badge>
                  </Show>

                  {/* Reviewers */}
                  <Show when={study.assignedTo.length > 0}>
                    <div class='flex -space-x-2'>
                      <For each={study.assignedTo.slice(0, 3)}>
                        {memberId => {
                          const member = mockMembers.find(m => m.id === memberId);
                          return member ?
                              <Avatar
                                name={member.name}
                                initials={member.avatar}
                                class='h-7 w-7 border-2 border-white text-[10px]'
                              />
                            : null;
                        }}
                      </For>
                    </div>
                  </Show>

                  <FiChevronRight class='h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500' />
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

function TodoTab() {
  return (
    <div class='space-y-6'>
      <Show
        when={mockTodoItems.length > 0}
        fallback={
          <EmptyState
            icon={<FiClipboard class='h-6 w-6' />}
            title='No tasks assigned to you'
            description='Studies assigned to you for review will appear here. Ask your team lead to assign studies.'
          />
        }
      >
        <div class='rounded-xl border border-slate-200 bg-white p-6'>
          <h3 class='mb-4 text-base font-semibold text-slate-900'>Your Assigned Reviews</h3>
          <div class='space-y-4'>
            <For each={mockTodoItems}>
              {item => (
                <div class='cursor-pointer rounded-lg border border-slate-200 p-4 transition-all hover:border-violet-200 hover:shadow-sm'>
                  <div class='mb-3 flex items-start justify-between'>
                    <div>
                      <p class='font-medium text-slate-900'>{item.studyTitle}</p>
                      <div class='mt-1 flex items-center gap-2'>
                        <Badge variant='info'>{item.checklistType}</Badge>
                        <span class='text-xs text-slate-400'>Last edited {item.lastEdited}</span>
                      </div>
                    </div>
                    <button class='flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700'>
                      <FiEdit3 class='h-4 w-4' />
                      Continue
                    </button>
                  </div>
                  <div class='flex items-center gap-3'>
                    <ProgressBar value={item.progress} />
                    <span class='text-sm font-medium text-slate-600'>{item.progress}%</span>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

function ReconcileTab() {
  return (
    <div class='space-y-6'>
      <Show
        when={mockReconcileItems.length > 0}
        fallback={
          <EmptyState
            icon={<FiGitMerge class='h-6 w-6' />}
            title='No studies to reconcile'
            description="When reviewers complete their assessments with disagreements, they'll appear here for reconciliation."
          />
        }
      >
        <div class='rounded-xl border border-slate-200 bg-white p-6'>
          <h3 class='mb-4 text-base font-semibold text-slate-900'>Pending Reconciliation</h3>
          <div class='space-y-4'>
            <For each={mockReconcileItems}>
              {item => (
                <div class='rounded-lg border border-amber-200 bg-amber-50/30 p-4'>
                  <div class='mb-3 flex items-start justify-between'>
                    <div>
                      <p class='font-medium text-slate-900'>{item.studyTitle}</p>
                      <div class='mt-2 flex items-center gap-3'>
                        <div class='flex -space-x-2'>
                          <For each={item.reviewers}>
                            {name => (
                              <Avatar
                                name={name}
                                class='h-6 w-6 border-2 border-white text-[9px]'
                              />
                            )}
                          </For>
                        </div>
                        <span class='text-sm text-slate-500'>{item.reviewers.join(' vs ')}</span>
                      </div>
                    </div>
                    <button class='flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700'>
                      <FiGitMerge class='h-4 w-4' />
                      Reconcile
                    </button>
                  </div>
                  <div class='flex items-center gap-4'>
                    <Badge variant='danger'>
                      <FiAlertCircle class='h-3 w-3' />
                      {item.disagreements - item.resolved} unresolved
                    </Badge>
                    <Badge variant='success'>
                      <FiCheckCircle class='h-3 w-3' />
                      {item.resolved} resolved
                    </Badge>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

function CompletedTab() {
  return (
    <div class='space-y-6'>
      <Show
        when={mockCompletedItems.length > 0}
        fallback={
          <EmptyState
            icon={<FiCheckCircle class='h-6 w-6' />}
            title='No completed reviews'
            description='Studies that have been fully reviewed and reconciled will appear here.'
          />
        }
      >
        <div class='rounded-xl border border-slate-200 bg-white p-6'>
          <div class='mb-4 flex items-center justify-between'>
            <h3 class='text-base font-semibold text-slate-900'>Completed Reviews</h3>
            <button class='flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50'>
              <FiDownload class='h-4 w-4' />
              Export All
            </button>
          </div>
          <div class='space-y-3'>
            <For each={mockCompletedItems}>
              {item => (
                <div class='flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/30 p-4'>
                  <div class='flex items-center gap-3'>
                    <div class='flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600'>
                      <FiCheckCircle class='h-5 w-5' />
                    </div>
                    <div>
                      <p class='font-medium text-slate-900'>{item.studyTitle}</p>
                      <div class='mt-1 flex items-center gap-3'>
                        <Badge variant='success'>{item.rating} Confidence</Badge>
                        <span class='text-xs text-slate-400'>Completed {item.completedAt}</span>
                      </div>
                    </div>
                  </div>
                  <div class='flex items-center gap-2'>
                    <button class='rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600'>
                      <FiExternalLink class='h-4 w-4' />
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

function FiguresTab() {
  return (
    <div class='space-y-6'>
      {/* Summary Stats */}
      <div class='grid grid-cols-4 gap-4'>
        {[
          { label: 'Total Studies', value: '24', change: '+3 this week' },
          { label: 'High Confidence', value: '8', pct: '33%' },
          { label: 'Moderate', value: '10', pct: '42%' },
          { label: 'Low/Critically Low', value: '6', pct: '25%' },
        ].map(stat => (
          <div class='rounded-xl border border-slate-200 bg-white p-5'>
            <p class='text-sm text-slate-500'>{stat.label}</p>
            <div class='mt-1 flex items-end justify-between'>
              <span class='text-2xl font-bold text-slate-900'>{stat.value}</span>
              <span class='text-xs text-slate-400'>{stat.change || stat.pct}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div class='grid grid-cols-2 gap-6'>
        {/* AMSTAR2 Results Chart */}
        <div class='rounded-xl border border-slate-200 bg-white p-6'>
          <div class='mb-6 flex items-center justify-between'>
            <h3 class='text-base font-semibold text-slate-900'>AMSTAR2 Confidence Ratings</h3>
            <button class='text-sm text-violet-600 hover:text-violet-700'>Customize</button>
          </div>
          <div class='space-y-3'>
            {[
              { label: 'High', value: 8, max: 24, color: 'bg-emerald-500' },
              { label: 'Moderate', value: 10, max: 24, color: 'bg-amber-500' },
              { label: 'Low', value: 4, max: 24, color: 'bg-orange-500' },
              { label: 'Critically Low', value: 2, max: 24, color: 'bg-rose-500' },
            ].map(item => (
              <div class='flex items-center gap-4'>
                <span class='w-28 text-sm text-slate-600'>{item.label}</span>
                <div class='h-8 flex-1 overflow-hidden rounded-lg bg-slate-100'>
                  <div
                    class={`h-full ${item.color} flex items-center justify-end pr-2 text-xs font-medium text-white`}
                    style={`width: ${(item.value / item.max) * 100}%`}
                  >
                    {item.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Domain Results */}
        <div class='rounded-xl border border-slate-200 bg-white p-6'>
          <div class='mb-6 flex items-center justify-between'>
            <h3 class='text-base font-semibold text-slate-900'>Critical Domains Summary</h3>
            <button class='text-sm text-violet-600 hover:text-violet-700'>View Details</button>
          </div>
          <div class='grid grid-cols-4 gap-3'>
            {[2, 4, 7, 9, 11, 13, 15].map(domain => (
              <div class='flex flex-col items-center rounded-lg border border-slate-100 p-3'>
                <span class='mb-1 text-xs text-slate-500'>Domain {domain}</span>
                <div class='flex items-center gap-1'>
                  <span class='h-2 w-2 rounded-full bg-emerald-500' />
                  <span class='h-2 w-2 rounded-full bg-emerald-500' />
                  <span class='h-2 w-2 rounded-full bg-amber-500' />
                  <span class='h-2 w-2 rounded-full bg-rose-500' />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div class='rounded-xl border border-slate-200 bg-white p-6'>
        <h3 class='mb-4 text-base font-semibold text-slate-900'>Export & Share</h3>
        <div class='grid grid-cols-3 gap-4'>
          <button class='flex items-center gap-3 rounded-lg border border-slate-200 p-4 text-left transition-all hover:border-violet-300 hover:bg-violet-50/30'>
            <div class='flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600'>
              <FiDownload class='h-5 w-5' />
            </div>
            <div>
              <p class='font-medium text-slate-900'>Download CSV</p>
              <p class='text-xs text-slate-500'>Full data export</p>
            </div>
          </button>
          <button class='flex items-center gap-3 rounded-lg border border-slate-200 p-4 text-left transition-all hover:border-violet-300 hover:bg-violet-50/30'>
            <div class='flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600'>
              <FiBarChart2 class='h-5 w-5' />
            </div>
            <div>
              <p class='font-medium text-slate-900'>Export Charts</p>
              <p class='text-xs text-slate-500'>PNG or SVG format</p>
            </div>
          </button>
          <button class='flex items-center gap-3 rounded-lg border border-slate-200 p-4 text-left transition-all hover:border-violet-300 hover:bg-violet-50/30'>
            <div class='flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600'>
              <FiExternalLink class='h-5 w-5' />
            </div>
            <div>
              <p class='font-medium text-slate-900'>Share Report</p>
              <p class='text-xs text-slate-500'>Generate public link</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProjectViewComplete() {
  const [activeTab, setActiveTab] = createSignal('studies');

  const tabs = [
    { id: 'team', label: 'Team', icon: FiUsers, count: mockMembers.length },
    { id: 'studies', label: 'Studies', icon: FiBook, count: mockStudies.length },
    { id: 'todo', label: 'To Do', icon: FiClipboard, count: mockTodoItems.length },
    { id: 'reconcile', label: 'Reconcile', icon: FiGitMerge, count: mockReconcileItems.length },
    { id: 'completed', label: 'Completed', icon: FiCheckCircle, count: mockCompletedItems.length },
    { id: 'figures', label: 'Figures', icon: FiBarChart2, count: null },
  ];

  return (
    <div class='min-h-screen bg-slate-50'>
      {/* Header */}
      <header class='sticky top-0 z-20 border-b border-slate-200 bg-white'>
        <div class='mx-auto max-w-7xl px-6 py-4'>
          <div class='flex items-center justify-between'>
            <div class='flex items-center gap-4'>
              <button class='flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700'>
                <FiArrowLeft class='h-4 w-4' />
              </button>
              <div>
                <h1 class='text-lg font-semibold text-slate-900'>{mockProject.name}</h1>
                <p class='text-sm text-slate-500'>{mockProject.description}</p>
              </div>
            </div>
            <div class='flex items-center gap-3'>
              {/* Online team members - powered by Yjs awareness, only shows users currently viewing this project */}
              <div class='flex -space-x-2'>
                {/* In production, this would filter by awareness state from useProject() */}
              </div>
              <button class='flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700'>
                <FiSettings class='h-4 w-4' />
              </button>
            </div>
          </div>
        </div>


        {/* Tabs */}
        <div class='mx-auto max-w-7xl px-6'>
          <nav class='-mb-px flex gap-1'>
            <For each={tabs}>
              {tab => {
                const Icon = tab.icon;
                const isActive = activeTab() === tab.id;
                return (
                  <button
                    class={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                      isActive ?
                        'border-violet-600 text-violet-700'
                      : 'border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700'
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon class='h-4 w-4' />
                    {tab.label}
                    <Show when={tab.count !== null && tab.count > 0}>
                      <span
                        class={`rounded-full px-2 py-0.5 text-xs ${
                          isActive ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </Show>
                  </button>
                );
              }}
            </For>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main class='mx-auto max-w-7xl px-6 py-6'>
        <Show when={activeTab() === 'team'}>
          <TeamTab />
        </Show>
        <Show when={activeTab() === 'studies'}>
          <StudiesTab />
        </Show>
        <Show when={activeTab() === 'todo'}>
          <TodoTab />
        </Show>
        <Show when={activeTab() === 'reconcile'}>
          <ReconcileTab />
        </Show>
        <Show when={activeTab() === 'completed'}>
          <CompletedTab />
        </Show>
        <Show when={activeTab() === 'figures'}>
          <FiguresTab />
        </Show>
      </main>

      {/* Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
      `}</style>
    </div>
  );
}
