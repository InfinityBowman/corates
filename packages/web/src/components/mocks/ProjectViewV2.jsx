/**
 * ProjectView V2 Mock
 *
 * Design Direction: Clean, modern dashboard with blue palette
 * - Consistent with Project Wizard design language
 * - URL-persisted tab state
 * - Improved table styling (no harsh dividers)
 * - Refined assignment UI
 */

import { For, Show, createSignal, createMemo } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import {
  FiArrowLeft,
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
  FiX,
  FiChevronRight,
  FiAlertCircle,
  FiEdit3,
  FiDownload,
  FiExternalLink,
  FiSliders,
  FiCopy,
  FiCheck,
  FiInfo,
} from 'solid-icons/fi';

// ============================================================================
// DESIGN TOKENS (matching wizard)
// ============================================================================

const tokens = {
  // Primary blue palette
  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue200: '#bfdbfe',
  blue300: '#93c5fd',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  blue900: '#1e3a8a',

  // Neutral slate
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',

  // Semantic colors
  success: '#059669',
  successLight: '#d1fae5',
  warning: '#d97706',
  warningLight: '#fef3c7',
  danger: '#dc2626',
  dangerLight: '#fee2e2',
};

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = {
  name: 'Mindfulness Interventions for Chronic Pain',
  description:
    'Systematic review examining RCTs of mindfulness-based interventions for chronic pain management',
  checklistTypes: ['AMSTAR2'],
};

const mockMembers = [
  { id: '1', name: 'Dr. Sarah Chen', email: 'sarah.chen@university.edu', role: 'Owner' },
  { id: '2', name: 'Dr. Michael Torres', email: 'm.torres@research.org', role: 'Member' },
  { id: '3', name: 'Dr. Emily Watson', email: 'e.watson@institute.edu', role: 'Member' },
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
  const getInitials = name =>
    name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2) || '?';

  const getColor = name => {
    const colors = [
      { bg: '#dbeafe', text: '#1d4ed8' },
      { bg: '#d1fae5', text: '#047857' },
      { bg: '#fef3c7', text: '#b45309' },
      { bg: '#fce7f3', text: '#be185d' },
      { bg: '#e0e7ff', text: '#4338ca' },
    ];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  const color = () => getColor(props.name);
  const size = () => props.size || '32px';
  const fontSize = () => props.fontSize || '11px';

  return (
    <div
      class='flex shrink-0 items-center justify-center rounded-full font-semibold'
      style={{
        width: size(),
        height: size(),
        'font-size': fontSize(),
        background: color().bg,
        color: color().text,
      }}
    >
      {getInitials(props.name)}
    </div>
  );
}

function Badge(props) {
  const variants = {
    success: { bg: tokens.successLight, text: tokens.success, border: '#a7f3d0' },
    warning: { bg: tokens.warningLight, text: tokens.warning, border: '#fcd34d' },
    danger: { bg: tokens.dangerLight, text: tokens.danger, border: '#fca5a5' },
    info: { bg: tokens.blue50, text: tokens.blue700, border: tokens.blue200 },
    neutral: { bg: tokens.slate100, text: tokens.slate600, border: tokens.slate200 },
  };

  const style = () => variants[props.variant || 'neutral'];

  return (
    <span
      class='inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium'
      style={{
        background: style().bg,
        color: style().text,
        'border-color': style().border,
      }}
    >
      {props.children}
    </span>
  );
}

function ProgressBar(props) {
  return (
    <div class='h-1.5 w-full overflow-hidden rounded-full' style={{ background: tokens.slate200 }}>
      <div
        class='h-full rounded-full transition-all duration-300'
        style={{
          width: `${props.value}%`,
          background: `linear-gradient(90deg, ${tokens.blue500}, ${tokens.blue600})`,
        }}
      />
    </div>
  );
}

function EmptyState(props) {
  return (
    <div class='flex flex-col items-center justify-center py-12 text-center'>
      <div
        class='mb-4 flex h-12 w-12 items-center justify-center rounded-xl'
        style={{ background: tokens.slate100, color: tokens.slate400 }}
      >
        {props.icon}
      </div>
      <h3 class='mb-1 text-sm font-medium' style={{ color: tokens.slate900 }}>
        {props.title}
      </h3>
      <p class='mb-4 max-w-sm text-sm' style={{ color: tokens.slate500 }}>
        {props.description}
      </p>
      <Show when={props.action}>
        <button
          class='flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors'
          style={{ background: tokens.blue600 }}
        >
          {props.actionIcon}
          {props.action}
        </button>
      </Show>
    </div>
  );
}

function Card(props) {
  return (
    <div
      class='rounded-xl border'
      style={{
        background: 'white',
        'border-color': props.borderColor || tokens.slate200,
      }}
    >
      <Show when={props.header}>
        <div
          class='flex items-center justify-between border-b px-5 py-4'
          style={{ 'border-color': tokens.slate100 }}
        >
          {props.header}
        </div>
      </Show>
      <div class={props.noPadding ? '' : 'p-5'}>{props.children}</div>
    </div>
  );
}

// ============================================================================
// TAB CONTENT COMPONENTS
// ============================================================================

function OverviewTab() {
  const stats = createMemo(() => ({
    total: mockStudies.length,
    completed: mockStudies.filter(s => s.status === 'completed').length,
    inReview: mockStudies.filter(s => s.status === 'in-review').length,
    needsReconcile: mockStudies.filter(s => s.status === 'reconcile').length,
    unassigned: mockStudies.filter(s => s.status === 'unassigned').length,
  }));

  const progress = () => Math.round((stats().completed / stats().total) * 100) || 0;

  return (
    <div class='space-y-6'>
      {/* Progress Overview */}
      <Card>
        <div class='mb-6'>
          <div class='mb-2 flex items-center justify-between'>
            <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
              Project Progress
            </h3>
            <span class='text-2xl font-bold' style={{ color: tokens.blue600 }}>
              {progress()}%
            </span>
          </div>
          <div class='h-3 overflow-hidden rounded-full' style={{ background: tokens.slate100 }}>
            <div
              class='h-full rounded-full transition-all duration-500'
              style={{
                width: `${progress()}%`,
                background: `linear-gradient(90deg, ${tokens.blue500}, ${tokens.blue600})`,
              }}
            />
          </div>
        </div>

        <div class='grid grid-cols-4 gap-4'>
          {[
            { label: 'Total Studies', value: stats().total, color: tokens.slate600 },
            { label: 'Completed', value: stats().completed, color: tokens.success },
            { label: 'In Review', value: stats().inReview, color: tokens.blue600 },
            {
              label: 'Needs Action',
              value: stats().needsReconcile + stats().unassigned,
              color: tokens.warning,
            },
          ].map(stat => (
            <div class='text-center'>
              <p class='text-2xl font-bold' style={{ color: stat.color }}>
                {stat.value}
              </p>
              <p class='text-sm' style={{ color: tokens.slate500 }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick Actions */}
      <div class='grid grid-cols-2 gap-4'>
        <Show when={mockTodoItems.length > 0}>
          <Card>
            <div class='flex items-start gap-4'>
              <div
                class='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg'
                style={{ background: tokens.blue50, color: tokens.blue600 }}
              >
                <FiClipboard class='h-5 w-5' />
              </div>
              <div class='min-w-0 flex-1'>
                <h4 class='font-medium' style={{ color: tokens.slate900 }}>
                  Continue Your Review
                </h4>
                <p class='mt-1 truncate text-sm' style={{ color: tokens.slate500 }}>
                  {mockTodoItems[0].studyTitle}
                </p>
                <div class='mt-3 flex items-center gap-3'>
                  <ProgressBar value={mockTodoItems[0].progress} />
                  <span class='text-sm font-medium' style={{ color: tokens.slate600 }}>
                    {mockTodoItems[0].progress}%
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </Show>

        <Show when={mockReconcileItems.length > 0}>
          <Card borderColor='#fcd34d'>
            <div class='flex items-start gap-4'>
              <div
                class='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg'
                style={{ background: tokens.warningLight, color: tokens.warning }}
              >
                <FiGitMerge class='h-5 w-5' />
              </div>
              <div class='min-w-0 flex-1'>
                <h4 class='font-medium' style={{ color: tokens.slate900 }}>
                  Reconciliation Needed
                </h4>
                <p class='mt-1 truncate text-sm' style={{ color: tokens.slate500 }}>
                  {mockReconcileItems[0].studyTitle}
                </p>
                <div class='mt-3'>
                  <Badge variant='warning'>
                    {mockReconcileItems[0].disagreements - mockReconcileItems[0].resolved}{' '}
                    disagreements
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </Show>
      </div>

      {/* Recent Activity */}
      <Card
        header={
          <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
            Recent Activity
          </h3>
        }
      >
        <div class='space-y-4'>
          {[
            {
              action: 'Completed review',
              study: 'MBSR for Chronic Low Back Pain',
              user: 'Dr. Sarah Chen',
              time: '2 hours ago',
            },
            {
              action: 'Started review',
              study: 'Mindfulness Meditation for Pediatric Chronic Pain',
              user: 'Dr. Michael Torres',
              time: '5 hours ago',
            },
            {
              action: 'Added study',
              study: 'Online Mindfulness Training for Chronic Pain',
              user: 'Dr. Emily Watson',
              time: '1 day ago',
            },
          ].map((item, index) => (
            <div
              class='flex items-center gap-4 rounded-lg p-3'
              style={{ background: index % 2 === 0 ? tokens.slate50 : 'transparent' }}
            >
              <Avatar name={item.user} size='28px' fontSize='10px' />
              <div class='min-w-0 flex-1'>
                <p class='text-sm' style={{ color: tokens.slate700 }}>
                  <span class='font-medium'>{item.user}</span>{' '}
                  <span style={{ color: tokens.slate500 }}>{item.action}</span>
                </p>
                <p class='truncate text-sm' style={{ color: tokens.slate500 }}>
                  {item.study}
                </p>
              </div>
              <span class='shrink-0 text-xs' style={{ color: tokens.slate400 }}>
                {item.time}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function TeamTab() {
  const [showInvite, setShowInvite] = createSignal(false);

  return (
    <div class='space-y-6'>
      <Card
        header={
          <>
            <div>
              <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
                Team Members
              </h3>
              <p class='text-sm' style={{ color: tokens.slate500 }}>
                {mockMembers.length} members
              </p>
            </div>
            <button
              class='flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors'
              style={{ background: tokens.blue600 }}
              onClick={() => setShowInvite(true)}
            >
              <FiUserPlus class='h-4 w-4' />
              Invite
            </button>
          </>
        }
      >
        <Show when={showInvite()}>
          <div
            class='mb-4 rounded-lg border p-4'
            style={{ background: tokens.blue50, 'border-color': tokens.blue200 }}
          >
            <div class='flex items-center gap-3'>
              <input
                type='email'
                placeholder='colleague@university.edu'
                class='flex-1 rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none'
                style={{ 'border-color': tokens.slate200 }}
              />
              <select
                class='rounded-lg border bg-white px-3 py-2 text-sm'
                style={{ 'border-color': tokens.slate200 }}
              >
                <option>Member</option>
                <option>Owner</option>
              </select>
              <button
                class='rounded-lg px-4 py-2 text-sm font-medium text-white'
                style={{ background: tokens.blue600 }}
              >
                Send
              </button>
              <button
                class='rounded-lg p-2 transition-colors'
                style={{ color: tokens.slate400 }}
                onClick={() => setShowInvite(false)}
              >
                <FiX class='h-4 w-4' />
              </button>
            </div>
          </div>
        </Show>

        <div class='space-y-2'>
          <For each={mockMembers}>
            {(member, index) => (
              <div
                class='flex items-center justify-between rounded-lg p-3 transition-colors'
                style={{ background: index() % 2 === 0 ? tokens.slate50 : 'transparent' }}
              >
                <div class='flex items-center gap-3'>
                  <Avatar name={member.name} />
                  <div>
                    <p class='font-medium' style={{ color: tokens.slate900 }}>
                      {member.name}
                    </p>
                    <p class='text-sm' style={{ color: tokens.slate500 }}>
                      {member.email}
                    </p>
                  </div>
                </div>
                <div class='flex items-center gap-3'>
                  <Badge variant={member.role === 'Owner' ? 'info' : 'neutral'}>
                    {member.role}
                  </Badge>
                  <button
                    class='rounded p-1.5 transition-colors'
                    style={{ color: tokens.slate400 }}
                  >
                    <FiMoreHorizontal class='h-4 w-4' />
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Card>
    </div>
  );
}

function StudiesTab() {
  const unassignedStudies = createMemo(() => mockStudies.filter(s => s.assignedTo.length === 0));

  return (
    <div class='space-y-6'>
      {/* Add Studies */}
      <Card
        header={
          <div>
            <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
              Add Studies
            </h3>
            <p class='text-sm' style={{ color: tokens.slate500 }}>
              Import from various sources
            </p>
          </div>
        }
      >
        <div class='grid grid-cols-4 gap-3'>
          {[
            { icon: FiUpload, label: 'Upload PDFs', desc: 'Drag & drop' },
            { icon: FiLink, label: 'DOI/PMID', desc: 'Lookup metadata' },
            { icon: FiFile, label: 'Reference File', desc: 'RIS, BibTeX' },
            { icon: FiExternalLink, label: 'Google Drive', desc: 'Connect' },
          ].map(source => (
            <button
              class='flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-4 transition-all'
              style={{ 'border-color': tokens.slate200, color: tokens.slate500 }}
            >
              <source.icon class='h-5 w-5' />
              <span class='text-sm font-medium'>{source.label}</span>
              <span class='text-xs' style={{ color: tokens.slate400 }}>
                {source.desc}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Unassigned Warning */}
      <Show when={unassignedStudies().length > 0}>
        <Card borderColor='#fcd34d'>
          <div class='mb-4 flex items-center gap-3'>
            <FiAlertCircle class='h-5 w-5' style={{ color: tokens.warning }} />
            <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
              Needs Assignment ({unassignedStudies().length})
            </h3>
          </div>
          <div class='space-y-2'>
            <For each={unassignedStudies()}>
              {(study, index) => (
                <div
                  class='flex items-center justify-between rounded-lg p-3'
                  style={{ background: index() % 2 === 0 ? tokens.warningLight : 'transparent' }}
                >
                  <div class='flex min-w-0 items-center gap-3'>
                    <div
                      class='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg'
                      style={{
                        background: tokens.slate100,
                        color: study.hasPdf ? tokens.blue600 : tokens.slate400,
                      }}
                    >
                      <FiFile class='h-4 w-4' />
                    </div>
                    <div class='min-w-0'>
                      <p class='truncate font-medium' style={{ color: tokens.slate900 }}>
                        {study.title}
                      </p>
                      <p class='text-sm' style={{ color: tokens.slate500 }}>
                        {study.journal} ({study.year})
                      </p>
                    </div>
                  </div>
                  <button
                    class='flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors'
                    style={{
                      'border-color': tokens.blue200,
                      background: tokens.blue50,
                      color: tokens.blue700,
                    }}
                  >
                    <FiUsers class='h-4 w-4' />
                    Assign
                  </button>
                </div>
              )}
            </For>
          </div>
        </Card>
      </Show>

      {/* All Studies */}
      <Card
        header={
          <>
            <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
              All Studies ({mockStudies.length})
            </h3>
            <div class='relative'>
              <FiSearch
                class='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2'
                style={{ color: tokens.slate400 }}
              />
              <input
                type='text'
                placeholder='Search studies...'
                class='w-64 rounded-lg border py-2 pr-3 pl-9 text-sm focus:outline-none'
                style={{ 'border-color': tokens.slate200, background: tokens.slate50 }}
              />
            </div>
          </>
        }
        noPadding
      >
        <div class='divide-y' style={{ 'border-color': tokens.slate100 }}>
          <For each={mockStudies}>
            {(study, index) => (
              <div
                class='flex cursor-pointer items-center gap-4 px-5 py-3 transition-colors'
                style={{ background: index() % 2 === 0 ? tokens.slate50 : 'white' }}
              >
                <div
                  class='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg'
                  style={{
                    background: tokens.slate100,
                    color: study.hasPdf ? tokens.blue600 : tokens.slate400,
                  }}
                >
                  <FiFile class='h-4 w-4' />
                </div>
                <div class='min-w-0 flex-1'>
                  <p class='truncate font-medium' style={{ color: tokens.slate900 }}>
                    {study.title}
                  </p>
                  <p class='text-sm' style={{ color: tokens.slate500 }}>
                    {study.authors}
                  </p>
                </div>
                <div class='flex shrink-0 items-center gap-3'>
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

                  <Show when={study.assignedTo.length > 0}>
                    <div class='flex -space-x-2'>
                      <For each={study.assignedTo.slice(0, 3)}>
                        {memberId => {
                          const member = mockMembers.find(m => m.id === memberId);
                          return member ?
                              <Avatar name={member.name} size='26px' fontSize='9px' />
                            : null;
                        }}
                      </For>
                    </div>
                  </Show>

                  <FiChevronRight class='h-4 w-4' style={{ color: tokens.slate300 }} />
                </div>
              </div>
            )}
          </For>
        </div>
      </Card>
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
            description='Studies assigned to you for review will appear here.'
          />
        }
      >
        <Card
          header={
            <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
              Your Assigned Reviews
            </h3>
          }
        >
          <div class='space-y-4'>
            <For each={mockTodoItems}>
              {item => (
                <div
                  class='rounded-lg border p-4 transition-all'
                  style={{ 'border-color': tokens.slate200 }}
                >
                  <div class='mb-3 flex items-start justify-between'>
                    <div>
                      <p class='font-medium' style={{ color: tokens.slate900 }}>
                        {item.studyTitle}
                      </p>
                      <div class='mt-1 flex items-center gap-2'>
                        <Badge variant='info'>{item.checklistType}</Badge>
                        <span class='text-xs' style={{ color: tokens.slate400 }}>
                          Last edited {item.lastEdited}
                        </span>
                      </div>
                    </div>
                    <button
                      class='flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white'
                      style={{ background: tokens.blue600 }}
                    >
                      <FiEdit3 class='h-4 w-4' />
                      Continue
                    </button>
                  </div>
                  <div class='flex items-center gap-3'>
                    <ProgressBar value={item.progress} />
                    <span class='text-sm font-medium' style={{ color: tokens.slate600 }}>
                      {item.progress}%
                    </span>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Card>
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
            description="When reviewers complete assessments with disagreements, they'll appear here."
          />
        }
      >
        <Card
          header={
            <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
              Pending Reconciliation
            </h3>
          }
        >
          <div class='space-y-4'>
            <For each={mockReconcileItems}>
              {item => (
                <div
                  class='rounded-lg border p-4'
                  style={{ 'border-color': '#fcd34d', background: tokens.warningLight }}
                >
                  <div class='mb-3 flex items-start justify-between'>
                    <div>
                      <p class='font-medium' style={{ color: tokens.slate900 }}>
                        {item.studyTitle}
                      </p>
                      <div class='mt-2 flex items-center gap-3'>
                        <div class='flex -space-x-2'>
                          <For each={item.reviewers}>
                            {name => <Avatar name={name} size='24px' fontSize='9px' />}
                          </For>
                        </div>
                        <span class='text-sm' style={{ color: tokens.slate500 }}>
                          {item.reviewers.join(' vs ')}
                        </span>
                      </div>
                    </div>
                    <button
                      class='flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white'
                      style={{ background: tokens.warning }}
                    >
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
        </Card>
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
            description='Studies that have been fully reviewed will appear here.'
          />
        }
      >
        <Card
          header={
            <>
              <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
                Completed Reviews
              </h3>
              <button
                class='flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium'
                style={{ 'border-color': tokens.slate200, color: tokens.slate600 }}
              >
                <FiDownload class='h-4 w-4' />
                Export All
              </button>
            </>
          }
        >
          <div class='space-y-2'>
            <For each={mockCompletedItems}>
              {(item, index) => (
                <div
                  class='flex items-center justify-between rounded-lg p-3'
                  style={{ background: index() % 2 === 0 ? tokens.successLight : 'transparent' }}
                >
                  <div class='flex items-center gap-3'>
                    <div
                      class='flex h-10 w-10 items-center justify-center rounded-full'
                      style={{ background: tokens.successLight, color: tokens.success }}
                    >
                      <FiCheckCircle class='h-5 w-5' />
                    </div>
                    <div>
                      <p class='font-medium' style={{ color: tokens.slate900 }}>
                        {item.studyTitle}
                      </p>
                      <div class='mt-1 flex items-center gap-3'>
                        <Badge variant='success'>{item.rating} Confidence</Badge>
                        <span class='text-xs' style={{ color: tokens.slate400 }}>
                          Completed {item.completedAt}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button class='rounded-lg p-2' style={{ color: tokens.slate400 }}>
                    <FiExternalLink class='h-4 w-4' />
                  </button>
                </div>
              )}
            </For>
          </div>
        </Card>
      </Show>
    </div>
  );
}

function ChartsTab() {
  return (
    <div class='space-y-6'>
      {/* Summary Stats */}
      <div class='grid grid-cols-4 gap-4'>
        {[
          { label: 'Total Studies', value: '24', sub: '+3 this week' },
          { label: 'High Confidence', value: '8', sub: '33%' },
          { label: 'Moderate', value: '10', sub: '42%' },
          { label: 'Low/Critically Low', value: '6', sub: '25%' },
        ].map(stat => (
          <Card>
            <p class='text-sm' style={{ color: tokens.slate500 }}>
              {stat.label}
            </p>
            <div class='mt-1 flex items-end justify-between'>
              <span class='text-2xl font-bold' style={{ color: tokens.slate900 }}>
                {stat.value}
              </span>
              <span class='text-xs' style={{ color: tokens.slate400 }}>
                {stat.sub}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div class='grid grid-cols-2 gap-6'>
        <Card
          header={
            <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
              AMSTAR2 Confidence Ratings
            </h3>
          }
        >
          <div class='space-y-3'>
            {[
              { label: 'High', value: 8, max: 24, color: tokens.success },
              { label: 'Moderate', value: 10, max: 24, color: tokens.warning },
              { label: 'Low', value: 4, max: 24, color: '#f97316' },
              { label: 'Critically Low', value: 2, max: 24, color: tokens.danger },
            ].map(item => (
              <div class='flex items-center gap-4'>
                <span class='w-28 text-sm' style={{ color: tokens.slate600 }}>
                  {item.label}
                </span>
                <div
                  class='h-8 flex-1 overflow-hidden rounded-lg'
                  style={{ background: tokens.slate100 }}
                >
                  <div
                    class='flex h-full items-center justify-end pr-2 text-xs font-medium text-white'
                    style={{
                      width: `${(item.value / item.max) * 100}%`,
                      background: item.color,
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          header={
            <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
              Critical Domains Summary
            </h3>
          }
        >
          <div class='grid grid-cols-4 gap-3'>
            {[2, 4, 7, 9, 11, 13, 15].map(domain => (
              <div
                class='flex flex-col items-center rounded-lg border p-3'
                style={{ 'border-color': tokens.slate100 }}
              >
                <span class='mb-1 text-xs' style={{ color: tokens.slate500 }}>
                  Domain {domain}
                </span>
                <div class='flex items-center gap-1'>
                  <span class='h-2 w-2 rounded-full' style={{ background: tokens.success }} />
                  <span class='h-2 w-2 rounded-full' style={{ background: tokens.success }} />
                  <span class='h-2 w-2 rounded-full' style={{ background: tokens.warning }} />
                  <span class='h-2 w-2 rounded-full' style={{ background: tokens.danger }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Export */}
      <Card
        header={
          <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
            Export & Share
          </h3>
        }
      >
        <div class='grid grid-cols-3 gap-4'>
          {[
            {
              icon: FiDownload,
              label: 'Download CSV',
              desc: 'Full data export',
              color: tokens.success,
            },
            {
              icon: FiBarChart2,
              label: 'Export Charts',
              desc: 'PNG or SVG',
              color: tokens.blue600,
            },
            {
              icon: FiExternalLink,
              label: 'Share Report',
              desc: 'Generate link',
              color: tokens.blue600,
            },
          ].map(item => (
            <button
              class='flex items-center gap-3 rounded-lg border p-4 text-left transition-all'
              style={{ 'border-color': tokens.slate200 }}
            >
              <div
                class='flex h-10 w-10 items-center justify-center rounded-lg'
                style={{ background: tokens.blue50, color: item.color }}
              >
                <item.icon class='h-5 w-5' />
              </div>
              <div>
                <p class='font-medium' style={{ color: tokens.slate900 }}>
                  {item.label}
                </p>
                <p class='text-xs' style={{ color: tokens.slate500 }}>
                  {item.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProjectViewV2() {
  const [searchParams, setSearchParams] = useSearchParams();

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FiBarChart2 },
    { id: 'team', label: 'Team', icon: FiUsers, count: mockMembers.length },
    { id: 'studies', label: 'Studies', icon: FiBook, count: mockStudies.length },
    { id: 'todo', label: 'To Do', icon: FiClipboard, count: mockTodoItems.length },
    { id: 'reconcile', label: 'Reconcile', icon: FiGitMerge, count: mockReconcileItems.length },
    { id: 'completed', label: 'Completed', icon: FiCheckCircle, count: mockCompletedItems.length },
    { id: 'charts', label: 'Charts', icon: FiBarChart2 },
  ];

  const getInitialTab = () => {
    const tabParam = searchParams.tab;
    return tabs.some(t => t.id === tabParam) ? tabParam : 'overview';
  };

  const [activeTab, setActiveTab] = createSignal(getInitialTab());

  const updateTab = tab => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  return (
    <div
      class='min-h-screen'
      style={{
        background: tokens.slate50,
        'font-family': "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Header */}
      <header
        class='sticky top-0 z-20 border-b'
        style={{ background: 'white', 'border-color': tokens.slate200 }}
      >
        <div class='mx-auto max-w-7xl px-6 py-4'>
          <div class='flex items-center justify-between'>
            <div class='flex items-center gap-4'>
              <button
                class='flex h-9 w-9 items-center justify-center rounded-lg border transition-colors'
                style={{ 'border-color': tokens.slate200, color: tokens.slate500 }}
              >
                <FiArrowLeft class='h-4 w-4' />
              </button>
              <div>
                <h1 class='text-lg font-semibold' style={{ color: tokens.slate900 }}>
                  {mockProject.name}
                </h1>
                <p class='text-sm' style={{ color: tokens.slate500 }}>
                  {mockProject.description}
                </p>
              </div>
            </div>
            <div class='flex items-center gap-3'>
              <div class='flex -space-x-2'>
                <For each={mockMembers.slice(0, 3)}>
                  {member => <Avatar name={member.name} size='32px' fontSize='11px' />}
                </For>
              </div>
              <button
                class='flex h-9 w-9 items-center justify-center rounded-lg border transition-colors'
                style={{ 'border-color': tokens.slate200, color: tokens.slate500 }}
              >
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
                const isActive = () => activeTab() === tab.id;
                return (
                  <button
                    class='flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors'
                    style={{
                      'border-color': isActive() ? tokens.blue600 : 'transparent',
                      color: isActive() ? tokens.blue700 : tokens.slate500,
                    }}
                    onClick={() => updateTab(tab.id)}
                  >
                    <Icon class='h-4 w-4' />
                    {tab.label}
                    <Show when={tab.count !== undefined && tab.count > 0}>
                      <span
                        class='rounded-full px-2 py-0.5 text-xs'
                        style={{
                          background: isActive() ? tokens.blue100 : tokens.slate100,
                          color: isActive() ? tokens.blue700 : tokens.slate500,
                        }}
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
        <Show when={activeTab() === 'overview'}>
          <OverviewTab />
        </Show>
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
        <Show when={activeTab() === 'charts'}>
          <ChartsTab />
        </Show>
      </main>

      {/* Load Inter font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      `}</style>
    </div>
  );
}
