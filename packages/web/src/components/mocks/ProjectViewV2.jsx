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
  FiFileText,
  FiFolder,
  FiUserPlus,
  FiX,
  FiChevronRight,
  FiChevronDown,
  FiChevronUp,
  FiAlertCircle,
  FiEdit3,
  FiDownload,
  FiExternalLink,
  FiSliders,
  FiCopy,
  FiCheck,
  FiInfo,
  FiPlus,
  FiShuffle,
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
    title: 'Mindfulness-Based Stress Reduction for Chronic Low Back Pain: A Randomized Controlled Trial',
    authors: 'Cherkin DC, Sherman KJ, Balderson BH, et al.',
    firstAuthor: 'Cherkin DC',
    journal: 'JAMA',
    year: 2016,
    assignedTo: ['1', '2'],
    status: 'completed',
    rating: 'High',
    checklistType: 'AMSTAR2',
    pdfs: [
      { id: 'pdf1', name: 'Cherkin_2016_JAMA.pdf', tag: 'primary', size: '1.2 MB' },
      { id: 'pdf2', name: 'Cherkin_2016_Protocol.pdf', tag: 'protocol', size: '450 KB' },
    ],
  },
  {
    id: '2',
    title: 'Effects of Mindfulness-Based Cognitive Therapy on Body Awareness in Patients with Chronic Pain',
    authors: 'de Jong M, Lazar SW, Hug K, et al.',
    firstAuthor: 'de Jong M',
    journal: 'Frontiers in Psychology',
    year: 2016,
    assignedTo: ['3', '1'],
    status: 'reconcile',
    disagreements: 3,
    resolved: 1,
    checklistType: 'AMSTAR2',
    pdfs: [
      { id: 'pdf3', name: 'deJong_2016_FrontPsych.pdf', tag: 'primary', size: '890 KB' },
    ],
  },
  {
    id: '3',
    title: 'A Pilot Study of Mindfulness Meditation for Pediatric Chronic Pain',
    authors: 'Jastrowski Mano KE, Salamon KS, Hainsworth KR, et al.',
    firstAuthor: 'Jastrowski Mano KE',
    journal: 'Children',
    year: 2019,
    assignedTo: ['2'],
    status: 'in-review',
    progress: 65,
    checklistType: 'AMSTAR2',
    pdfs: [
      { id: 'pdf4', name: 'Jastrowski_2019_Children.pdf', tag: 'primary', size: '1.1 MB' },
      { id: 'pdf5', name: 'Supplementary_Materials.pdf', tag: 'secondary', size: '2.3 MB' },
    ],
  },
  {
    id: '4',
    title: 'Mindfulness-Based Intervention for Fibromyalgia: Impact on Pain and Quality of Life',
    authors: 'Schmidt S, Grossman P, Schwarzer B, et al.',
    firstAuthor: 'Schmidt S',
    journal: 'Pain Medicine',
    year: 2020,
    assignedTo: [],
    status: 'unassigned',
    pdfs: [
      { id: 'pdf6', name: 'Schmidt_2020_PainMed.pdf', tag: 'primary', size: '750 KB' },
    ],
  },
  {
    id: '5',
    title: 'Online Mindfulness Training for Chronic Pain Management',
    authors: 'Gardner-Nix J, Backman S, Barbati J, et al.',
    firstAuthor: 'Gardner-Nix J',
    journal: 'Journal of Pain Research',
    year: 2021,
    assignedTo: [],
    status: 'unassigned',
    pdfs: [],
  },
];

// Helper to get studies by status
const getStudiesByStatus = status => mockStudies.filter(s => s.status === status);

// Get member name by ID
const getMemberName = id => mockMembers.find(m => m.id === id)?.name || 'Unknown';

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

/**
 * PdfListItem - Individual PDF row in expanded section
 */
function PdfListItem(props) {
  const tagColors = {
    primary: { bg: tokens.blue50, text: tokens.blue700 },
    protocol: { bg: '#f0fdf4', text: '#15803d' },
    secondary: { bg: tokens.slate100, text: tokens.slate600 },
  };
  const tagStyle = () => tagColors[props.pdf.tag] || tagColors.secondary;

  return (
    <div
      class='flex items-center gap-3 rounded-lg px-3 py-2 transition-colors'
      style={{ background: tokens.slate50 }}
    >
      <FiFile class='h-4 w-4 shrink-0' style={{ color: tokens.slate400 }} />
      <div class='min-w-0 flex-1'>
        <p class='truncate text-sm font-medium' style={{ color: tokens.slate700 }}>
          {props.pdf.name}
        </p>
        <div class='mt-0.5 flex items-center gap-2'>
          <span
            class='rounded px-1.5 py-0.5 text-xs font-medium capitalize'
            style={{ background: tagStyle().bg, color: tagStyle().text }}
          >
            {props.pdf.tag}
          </span>
          <Show when={props.pdf.size}>
            <span class='text-xs' style={{ color: tokens.slate400 }}>
              {props.pdf.size}
            </span>
          </Show>
        </div>
      </div>
      <div class='flex items-center gap-1'>
        <button
          class='rounded-lg p-1.5 transition-colors hover:bg-white'
          style={{ color: tokens.slate400 }}
          title='View PDF'
        >
          <FiExternalLink class='h-4 w-4' />
        </button>
        <button
          class='rounded-lg p-1.5 transition-colors hover:bg-white'
          style={{ color: tokens.slate400 }}
          title='Download PDF'
        >
          <FiDownload class='h-4 w-4' />
        </button>
      </div>
    </div>
  );
}

/**
 * StudyRow - Collapsible study card matching real implementation pattern
 * Used across Todo, Reconcile, and Completed tabs
 */
function StudyRow(props) {
  // props.study: Study object with pdfs array
  // props.expanded: boolean (controlled)
  // props.onToggle: () => void
  // props.badges: JSX for badges section
  // props.actions: JSX for action buttons
  // props.children: Additional content below header (e.g., reconciliation info)

  const study = () => props.study;
  const hasPdfs = () => (study().pdfs || []).length > 0;

  // Citation line: author (year)
  const citationLine = () => {
    const author = study().firstAuthor;
    const year = study().year;
    if (!author && !year) return null;
    return `${author || 'Unknown'}${year ? ` (${year})` : ''}`;
  };

  // Handle header click - toggle unless clicking interactive elements
  const handleHeaderClick = e => {
    if (!hasPdfs()) return;
    const target = e.target;
    const interactive = target.closest('button, [role="button"], [data-selectable], input');
    if (interactive) return;
    props.onToggle?.();
  };

  return (
    <div
      class='overflow-hidden rounded-lg border transition-colors'
      style={{
        background: 'white',
        'border-color': tokens.slate200,
      }}
    >
      {/* Header row */}
      <div
        class={`flex items-center gap-3 px-4 py-3 ${hasPdfs() ? 'cursor-pointer' : ''}`}
        style={{ userSelect: 'none' }}
        onClick={handleHeaderClick}
      >
        {/* Chevron (only if has PDFs) */}
        <Show when={hasPdfs()}>
          <div class='-ml-1 shrink-0 p-1'>
            <FiChevronRight
              class='h-5 w-5 transition-transform duration-200'
              style={{
                color: tokens.slate400,
                transform: props.expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            />
          </div>
        </Show>

        {/* Study info */}
        <div class='min-w-0 flex-1'>
          <p class='truncate font-medium' style={{ color: tokens.slate900 }}>
            {study().title}
          </p>
          <Show when={citationLine()}>
            <p
              class='mt-0.5 w-fit truncate text-xs'
              style={{ color: tokens.slate500, cursor: 'text', userSelect: 'text' }}
              data-selectable
            >
              {citationLine()}
              <Show when={hasPdfs()}>
                <span style={{ color: tokens.slate400 }}> - {study().pdfs.length} PDFs</span>
              </Show>
            </p>
          </Show>
        </div>

        {/* Badges section */}
        <Show when={props.badges}>
          <div class='flex shrink-0 items-center gap-2'>{props.badges}</div>
        </Show>

        {/* Actions section */}
        <Show when={props.actions}>
          <div class='flex shrink-0 items-center gap-2'>{props.actions}</div>
        </Show>
      </div>

      {/* Additional content (e.g., reviewer info for reconcile) */}
      <Show when={props.children}>{props.children}</Show>

      {/* Expanded PDF section */}
      <Show when={props.expanded && hasPdfs()}>
        <div
          class='space-y-2 border-t px-4 py-3'
          style={{ 'border-color': tokens.slate100 }}
        >
          <For each={study().pdfs}>
            {pdf => <PdfListItem pdf={pdf} />}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// ADD STUDIES COMPONENTS (from wizard)
// ============================================================================

/**
 * Tab button for import sources
 */
function ImportTab(props) {
  return (
    <button
      type='button'
      onClick={props.onClick}
      class='flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-all duration-200'
      style={{
        'border-color': props.active ? tokens.blue600 : 'transparent',
        color: props.active ? tokens.blue700 : tokens.slate500,
        background: props.active ? tokens.blue50 : 'transparent',
      }}
    >
      {props.icon}
      {props.label}
    </button>
  );
}

/**
 * PDF Upload Tab Content
 */
function PdfUploadContent(props) {
  const [isDragging, setIsDragging] = createSignal(false);

  return (
    <div class='space-y-4'>
      <div
        class='relative rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200'
        style={{
          'border-color': isDragging() ? tokens.blue500 : tokens.slate200,
          background: isDragging() ? tokens.blue50 : tokens.slate50,
        }}
        onDragOver={e => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          props.onUpload?.();
        }}
      >
        <div
          class='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full'
          style={{ background: tokens.blue100, color: tokens.blue600 }}
        >
          <FiUpload class='h-6 w-6' />
        </div>
        <p class='text-sm font-medium' style={{ color: tokens.slate700 }}>
          Drag and drop PDF files here
        </p>
        <p class='mt-1 text-xs' style={{ color: tokens.slate500 }}>
          or click to browse
        </p>
        <input
          type='file'
          accept='.pdf'
          multiple
          class='absolute inset-0 cursor-pointer opacity-0'
          onChange={() => props.onUpload?.()}
        />
      </div>
      <p class='text-center text-xs' style={{ color: tokens.slate400 }}>
        Metadata will be automatically extracted from uploaded PDFs
      </p>
    </div>
  );
}

/**
 * DOI/PMID Lookup Tab Content
 */
function DoiLookupContent(props) {
  const [input, setInput] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);

  const handleLookup = () => {
    if (!input()) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      props.onLookup?.(input());
      setInput('');
    }, 800);
  };

  return (
    <div class='space-y-4'>
      <div>
        <label class='mb-1.5 block text-sm font-medium' style={{ color: tokens.slate700 }}>
          Enter DOIs or PMIDs
        </label>
        <textarea
          value={input()}
          onInput={e => setInput(e.target.value)}
          placeholder='10.1001/jama.2016.0086&#10;10.3389/fpsyg.2016.00578&#10;PMID: 27002445'
          rows={4}
          class='w-full resize-none rounded-lg border px-3 py-2.5 text-sm transition-all duration-200 outline-none'
          style={{
            'border-color': tokens.slate200,
            background: 'white',
            color: tokens.slate900,
          }}
        />
        <p class='mt-1.5 text-xs' style={{ color: tokens.slate500 }}>
          One identifier per line. Supports DOI (10.xxxx/...) and PMID formats.
        </p>
      </div>

      <button
        onClick={handleLookup}
        disabled={!input() || isLoading()}
        class='flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200'
        style={{
          background: input() && !isLoading() ? tokens.blue600 : tokens.slate100,
          color: input() && !isLoading() ? 'white' : tokens.slate400,
          cursor: input() && !isLoading() ? 'pointer' : 'not-allowed',
        }}
      >
        <Show when={isLoading()} fallback={<FiSearch class='h-4 w-4' />}>
          <div
            class='h-4 w-4 animate-spin rounded-full border-2'
            style={{ 'border-color': `${tokens.slate300} transparent transparent transparent` }}
          />
        </Show>
        {isLoading() ? 'Looking up...' : 'Look up metadata'}
      </button>
    </div>
  );
}

/**
 * Reference File Import Tab Content
 */
function ReferenceFileContent(props) {
  return (
    <div class='space-y-4'>
      <div
        class='relative rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200'
        style={{
          'border-color': tokens.slate200,
          background: tokens.slate50,
        }}
      >
        <div
          class='mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full'
          style={{ background: tokens.slate200, color: tokens.slate500 }}
        >
          <FiFileText class='h-5 w-5' />
        </div>
        <p class='text-sm font-medium' style={{ color: tokens.slate700 }}>
          Upload reference file
        </p>
        <p class='mt-1 text-xs' style={{ color: tokens.slate500 }}>
          RIS, BibTeX, EndNote XML, or CSV
        </p>
        <input
          type='file'
          accept='.ris,.bib,.xml,.csv'
          class='absolute inset-0 cursor-pointer opacity-0'
          onChange={() => props.onUpload?.()}
        />
      </div>

      <div class='flex items-center gap-3'>
        <div class='h-px flex-1' style={{ background: tokens.slate200 }} />
        <span class='text-xs' style={{ color: tokens.slate400 }}>
          Supported formats
        </span>
        <div class='h-px flex-1' style={{ background: tokens.slate200 }} />
      </div>

      <div class='grid grid-cols-4 gap-2'>
        {[
          { name: 'RIS', desc: 'Research Info Systems' },
          { name: 'BibTeX', desc: 'LaTeX bibliography' },
          { name: 'EndNote', desc: 'XML export' },
          { name: 'CSV', desc: 'Spreadsheet' },
        ].map(format => (
          <div
            class='rounded-lg border p-3 text-center'
            style={{ 'border-color': tokens.slate200, background: 'white' }}
          >
            <p class='text-sm font-medium' style={{ color: tokens.slate700 }}>
              {format.name}
            </p>
            <p class='mt-0.5 text-xs' style={{ color: tokens.slate400 }}>
              {format.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Google Drive Tab Content
 */
function GoogleDriveContent(props) {
  const [isConnected, setIsConnected] = createSignal(false);

  return (
    <div class='space-y-4'>
      <Show
        when={isConnected()}
        fallback={
          <div class='rounded-xl border p-6 text-center' style={{ 'border-color': tokens.slate200 }}>
            <div
              class='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full'
              style={{ background: '#fef3c7', color: '#b45309' }}
            >
              <FiFolder class='h-6 w-6' />
            </div>
            <p class='text-sm font-medium' style={{ color: tokens.slate700 }}>
              Connect Google Drive
            </p>
            <p class='mx-auto mt-1 max-w-xs text-xs' style={{ color: tokens.slate500 }}>
              Import PDFs directly from your Google Drive folders
            </p>
            <button
              onClick={() => setIsConnected(true)}
              class='mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200'
              style={{ background: tokens.blue600, color: 'white' }}
            >
              <FiExternalLink class='h-4 w-4' />
              Connect Drive
            </button>
          </div>
        }
      >
        <div class='rounded-xl border' style={{ 'border-color': tokens.slate200 }}>
          <div
            class='flex items-center justify-between border-b px-4 py-3'
            style={{ 'border-color': tokens.slate200, background: tokens.slate50 }}
          >
            <div class='flex items-center gap-2'>
              <FiFolder class='h-4 w-4' style={{ color: tokens.slate500 }} />
              <span class='text-sm font-medium' style={{ color: tokens.slate700 }}>
                My Drive / Research Papers
              </span>
            </div>
            <button
              class='text-xs'
              style={{ color: tokens.blue600 }}
              onClick={() => setIsConnected(false)}
            >
              Disconnect
            </button>
          </div>
          <div class='divide-y' style={{ 'border-color': tokens.slate100 }}>
            {[
              { name: 'Cherkin_2016_JAMA.pdf', selected: true },
              { name: 'deJong_2016_FrontPsych.pdf', selected: true },
              { name: 'Schmidt_2020_PainMed.pdf', selected: false },
              { name: 'Gardner_2021_JPainRes.pdf', selected: false },
            ].map(file => (
              <div
                class='flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors'
                style={{ background: file.selected ? tokens.blue50 : 'white' }}
              >
                <input
                  type='checkbox'
                  checked={file.selected}
                  class='h-4 w-4 rounded'
                  style={{ accentColor: tokens.blue600 }}
                />
                <FiFile class='h-4 w-4' style={{ color: tokens.slate400 }} />
                <span class='text-sm' style={{ color: tokens.slate700 }}>
                  {file.name}
                </span>
              </div>
            ))}
          </div>
          <div
            class='flex items-center justify-between border-t px-4 py-3'
            style={{ 'border-color': tokens.slate200, background: tokens.slate50 }}
          >
            <span class='text-xs' style={{ color: tokens.slate500 }}>
              2 files selected
            </span>
            <button
              class='rounded-lg px-3 py-1.5 text-sm font-medium'
              style={{ background: tokens.blue600, color: 'white' }}
              onClick={() => props.onImport?.()}
            >
              Import Selected
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}

/**
 * Staged Study Card
 */
function StagedStudyCard(props) {
  return (
    <div
      class='group flex items-start gap-3 rounded-lg border p-4 transition-all duration-150'
      style={{
        background: 'white',
        'border-color': props.duplicate ? '#fcd34d' : tokens.slate200,
      }}
    >
      <div
        class='mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg'
        style={{
          background: props.study.hasPdf ? tokens.blue50 : tokens.slate100,
          color: props.study.hasPdf ? tokens.blue600 : tokens.slate400,
        }}
      >
        <Show when={props.study.hasPdf} fallback={<FiFileText class='h-5 w-5' />}>
          <FiFile class='h-5 w-5' />
        </Show>
      </div>

      <div class='min-w-0 flex-1'>
        <p class='text-sm font-medium leading-snug' style={{ color: tokens.slate900 }}>
          {props.study.title}
        </p>
        <p class='mt-1 truncate text-xs' style={{ color: tokens.slate500 }}>
          {props.study.authors}
        </p>
        <div class='mt-2 flex flex-wrap items-center gap-2'>
          <Show when={props.study.journal}>
            <span class='text-xs' style={{ color: tokens.slate400 }}>
              {props.study.journal}
            </span>
          </Show>
          <Show when={props.study.year}>
            <span class='text-xs' style={{ color: tokens.slate400 }}>
              ({props.study.year})
            </span>
          </Show>
          <Show when={props.study.hasPdf}>
            <span
              class='inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs'
              style={{ background: tokens.blue50, color: tokens.blue700 }}
            >
              <FiFile class='h-3 w-3' />
              PDF
            </span>
          </Show>
          <Show when={props.duplicate}>
            <span
              class='inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs'
              style={{ background: '#fef3c7', color: '#b45309' }}
            >
              <FiAlertCircle class='h-3 w-3' />
              Possible duplicate
            </span>
          </Show>
        </div>
      </div>

      <button
        class='shrink-0 rounded-lg p-1.5 opacity-0 transition-all duration-150 group-hover:opacity-100'
        style={{ color: tokens.slate400 }}
        onClick={() => props.onRemove?.()}
      >
        <FiX class='h-4 w-4' />
      </button>
    </div>
  );
}

// ============================================================================
// ASSIGNMENT COMPONENTS (from wizard)
// ============================================================================

const PERCENT_PRESETS = [0, 25, 33, 50, 75, 100];

function PresetButton(props) {
  return (
    <button
      type='button'
      onClick={props.onClick}
      class='rounded-md px-2 py-1 text-xs font-medium transition-all'
      style={{
        background: props.active ? tokens.blue600 : tokens.slate100,
        color: props.active ? 'white' : tokens.slate600,
      }}
    >
      {props.value}%
    </button>
  );
}

function MemberPercentRow(props) {
  return (
    <div
      class='flex items-center gap-3 rounded-lg border p-3'
      style={{ background: 'white', 'border-color': tokens.slate200 }}
    >
      <Avatar name={props.member.name} size='32px' fontSize='11px' />
      <div class='min-w-0 flex-1'>
        <p class='truncate text-sm font-medium' style={{ color: tokens.slate700 }}>
          {props.member.name}
        </p>
      </div>
      <div class='flex items-center gap-1'>
        <For each={PERCENT_PRESETS}>
          {preset => (
            <PresetButton
              value={preset}
              active={props.percent === preset}
              onClick={() => props.onChange(preset)}
            />
          )}
        </For>
      </div>
    </div>
  );
}

function AssignmentPreviewRow(props) {
  const hasConflict = () => props.assignment.reviewer1?.id === props.assignment.reviewer2?.id;
  const isEven = () => props.index % 2 === 0;

  const rowBg = () => {
    if (hasConflict()) return '#fef2f2';
    if (isEven()) return tokens.slate50;
    return 'white';
  };

  return (
    <tr style={{ background: rowBg() }}>
      <td class='max-w-xs truncate py-2.5 pr-4 pl-4 text-sm' style={{ color: tokens.slate700 }}>
        {props.assignment.title}
      </td>
      <td class='py-2.5 pr-4'>
        <Show when={props.assignment.reviewer1}>
          <div class='flex items-center gap-2'>
            <Avatar
              name={props.assignment.reviewer1.name}
              size='22px'
              fontSize='8px'
            />
            <span class='text-sm' style={{ color: tokens.slate600 }}>
              {props.assignment.reviewer1.name}
            </span>
          </div>
        </Show>
      </td>
      <td class='py-2.5 pr-4'>
        <Show when={props.assignment.reviewer2}>
          <div class='flex items-center gap-2'>
            <Avatar
              name={props.assignment.reviewer2.name}
              size='22px'
              fontSize='8px'
            />
            <span
              class='text-sm'
              style={{ color: hasConflict() ? '#dc2626' : tokens.slate600 }}
            >
              {props.assignment.reviewer2.name}
              {hasConflict() && ' (conflict)'}
            </span>
          </div>
        </Show>
      </td>
    </tr>
  );
}

// ============================================================================
// TAB CONTENT COMPONENTS
// ============================================================================

function OverviewTab() {
  const todoStudies = () => getStudiesByStatus('in-review');
  const reconcileStudies = () => getStudiesByStatus('reconcile');
  const completedStudies = () => getStudiesByStatus('completed');

  const stats = createMemo(() => ({
    total: mockStudies.length,
    completed: completedStudies().length,
    inReview: todoStudies().length,
    needsReconcile: reconcileStudies().length,
    unassigned: mockStudies.filter(s => s.status === 'unassigned').length,
  }));

  const progress = () => Math.round((stats().completed / stats().total) * 100) || 0;

  // Mock inter-rater reliability data
  const reliability = {
    cohensKappa: 0.72,
    percentAgreement: 84,
    interpretation: 'Substantial Agreement',
  };

  return (
    <div class='space-y-6'>
      {/* Progress Overview - simplified */}
      <Card>
        <div class='flex items-center justify-between'>
          <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
            Project Progress
          </h3>
          <span class='text-2xl font-bold' style={{ color: tokens.blue600 }}>
            {progress()}%
          </span>
        </div>
        <div class='mt-3 h-3 overflow-hidden rounded-full' style={{ background: tokens.slate100 }}>
          <div
            class='h-full rounded-full transition-all duration-500'
            style={{
              width: `${progress()}%`,
              background: `linear-gradient(90deg, ${tokens.blue500}, ${tokens.blue600})`,
            }}
          />
        </div>
      </Card>

      {/* Inter-rater Reliability */}
      <Card
        header={
          <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
            Inter-rater Reliability
          </h3>
        }
      >
        <div class='grid grid-cols-3 gap-6'>
          <div class='text-center'>
            <p class='text-3xl font-bold' style={{ color: tokens.blue600 }}>
              {reliability.cohensKappa.toFixed(2)}
            </p>
            <p class='mt-1 text-sm' style={{ color: tokens.slate500 }}>
              Cohen's Kappa
            </p>
          </div>
          <div class='text-center'>
            <p class='text-3xl font-bold' style={{ color: tokens.success }}>
              {reliability.percentAgreement}%
            </p>
            <p class='mt-1 text-sm' style={{ color: tokens.slate500 }}>
              Percent Agreement
            </p>
          </div>
          <div class='text-center'>
            <span
              class='inline-block rounded-full px-3 py-1 text-sm font-medium'
              style={{ background: tokens.successLight, color: tokens.success }}
            >
              {reliability.interpretation}
            </span>
            <p class='mt-2 text-sm' style={{ color: tokens.slate500 }}>
              Interpretation
            </p>
          </div>
        </div>
        <p class='mt-4 text-center text-xs' style={{ color: tokens.slate400 }}>
          Based on {stats().completed} completed studies with dual-reviewer assessment
        </p>
      </Card>

      {/* Team Members */}
      <Card
        header={
          <>
            <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
              Team Members ({mockMembers.length})
            </h3>
            <button
              class='flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors'
              style={{ background: tokens.blue600 }}
            >
              <FiUserPlus class='h-4 w-4' />
              Invite
            </button>
          </>
        }
      >
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
                <Badge variant={member.role === 'Owner' ? 'info' : 'neutral'}>
                  {member.role}
                </Badge>
              </div>
            )}
          </For>
        </div>
      </Card>

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
            { action: 'Completed review', study: 'MBSR for Chronic Low Back Pain', user: 'Dr. Sarah Chen', time: '2 hours ago' },
            { action: 'Started review', study: 'Mindfulness Meditation for Pediatric Chronic Pain', user: 'Dr. Michael Torres', time: '5 hours ago' },
            { action: 'Added study', study: 'Online Mindfulness Training for Chronic Pain', user: 'Dr. Emily Watson', time: '1 day ago' },
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

  // Add Studies panel state
  const [addStudiesExpanded, setAddStudiesExpanded] = createSignal(false);
  const [activeImportTab, setActiveImportTab] = createSignal('pdf');
  const [stagedStudies, setStagedStudies] = createSignal([]);

  // Assignment panel state
  const [showAssignmentPanel, setShowAssignmentPanel] = createSignal(false);
  const [showCustomize, setShowCustomize] = createSignal(false);
  const [pool1Percents, setPool1Percents] = createSignal(null);
  const [pool2Percents, setPool2Percents] = createSignal(null);
  const [previewAssignments, setPreviewAssignments] = createSignal([]);

  // All Studies expand state
  const [allStudiesExpanded, setAllStudiesExpanded] = createSignal(new Set());
  const toggleAllStudiesExpanded = studyId => {
    setAllStudiesExpanded(prev => {
      const next = new Set(prev);
      if (next.has(studyId)) {
        next.delete(studyId);
      } else {
        next.add(studyId);
      }
      return next;
    });
  };

  // Mock add studies
  const addMockStudies = () => {
    const newStudies = [
      {
        id: Date.now().toString(),
        title: 'Mindfulness-Based Stress Reduction for Chronic Low Back Pain',
        authors: 'Cherkin DC, Sherman KJ, Balderson BH, et al.',
        journal: 'JAMA',
        year: 2016,
        hasPdf: true,
      },
      {
        id: (Date.now() + 1).toString(),
        title: 'Effects of Mindfulness-Based Cognitive Therapy on Body Awareness',
        authors: 'de Jong M, Lazar SW, Hug K, et al.',
        journal: 'Frontiers in Psychology',
        year: 2016,
        hasPdf: true,
      },
    ];
    setStagedStudies([...stagedStudies(), ...newStudies]);
  };

  const addDoiStudy = () => {
    const newStudy = {
      id: Date.now().toString(),
      title: 'A Pilot Study of Mindfulness Meditation for Pediatric Chronic Pain',
      authors: 'Jastrowski Mano KE, Salamon KS, Hainsworth KR, et al.',
      journal: 'Children',
      year: 2019,
      hasPdf: false,
    };
    setStagedStudies([...stagedStudies(), newStudy]);
  };

  const removeStudy = id => {
    setStagedStudies(stagedStudies().filter(s => s.id !== id));
  };

  // Quick action button handler - expands and switches to tab
  const handleQuickAction = tabId => {
    setAddStudiesExpanded(true);
    setActiveImportTab(tabId);
  };

  // Assignment helpers
  const getEvenPercents = () => {
    const each = Math.floor(100 / mockMembers.length);
    const remainder = 100 - each * mockMembers.length;
    const result = {};
    mockMembers.forEach((m, i) => {
      result[m.id] = each + (i < remainder ? 1 : 0);
    });
    return result;
  };

  const getPool1Percents = () => pool1Percents() || getEvenPercents();
  const getPool2Percents = () => pool2Percents() || getEvenPercents();

  const updatePool1Percent = (id, value) => {
    const current = pool1Percents() || getEvenPercents();
    setPool1Percents({ ...current, [id]: value });
  };

  const updatePool2Percent = (id, value) => {
    const current = pool2Percents() || getEvenPercents();
    setPool2Percents({ ...current, [id]: value });
  };

  const pool1Total = () => Object.values(getPool1Percents()).reduce((a, b) => a + b, 0);
  const pool2Total = () => Object.values(getPool2Percents()).reduce((a, b) => a + b, 0);
  const isPoolValid = total => total >= 99 && total <= 100;
  const isCustomValid = () => isPoolValid(pool1Total()) && isPoolValid(pool2Total());

  const shuffleArray = arr => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const generateAssignments = () => {
    const studiesToAssign = unassignedStudies();
    const totalStudies = studiesToAssign.length;
    const p1Percents = getPool1Percents();
    const p2Percents = getPool2Percents();

    const pool1Assignments = [];
    const pool2Assignments = [];

    const p1Members = mockMembers.filter(m => (p1Percents[m.id] || 0) > 0);
    const p2Members = mockMembers.filter(m => (p2Percents[m.id] || 0) > 0);

    let remaining1 = totalStudies;
    p1Members.forEach((m, i) => {
      const percent = p1Percents[m.id] || 0;
      const count = i === p1Members.length - 1 ? remaining1 : Math.round((percent / 100) * totalStudies);
      remaining1 -= count;
      for (let j = 0; j < count; j++) pool1Assignments.push(m);
    });

    let remaining2 = totalStudies;
    p2Members.forEach((m, i) => {
      const percent = p2Percents[m.id] || 0;
      const count = i === p2Members.length - 1 ? remaining2 : Math.round((percent / 100) * totalStudies);
      remaining2 -= count;
      for (let j = 0; j < count; j++) pool2Assignments.push(m);
    });

    const shuffled1 = shuffleArray(pool1Assignments);
    const shuffled2 = shuffleArray(pool2Assignments);
    const shuffledStudies = shuffleArray(studiesToAssign);

    const assignments = shuffledStudies.map((study, i) => ({
      ...study,
      reviewer1: shuffled1[i],
      reviewer2: shuffled2[i],
    }));

    // Resolve conflicts
    for (let i = 0; i < assignments.length; i++) {
      if (assignments[i].reviewer1?.id === assignments[i].reviewer2?.id) {
        for (let j = 0; j < assignments.length; j++) {
          if (i !== j && assignments[j].reviewer1?.id !== assignments[j].reviewer2?.id) {
            const canSwap =
              assignments[j].reviewer2?.id !== assignments[i].reviewer1?.id &&
              assignments[i].reviewer2?.id !== assignments[j].reviewer1?.id;
            if (canSwap) {
              const temp = assignments[i].reviewer2;
              assignments[i].reviewer2 = assignments[j].reviewer2;
              assignments[j].reviewer2 = temp;
              break;
            }
          }
        }
      }
    }

    setPreviewAssignments(assignments);
  };

  const hasAssignments = () => previewAssignments().length > 0;
  const hasConflicts = createMemo(() =>
    previewAssignments().some(a => a.reviewer1?.id === a.reviewer2?.id)
  );
  const conflictCount = createMemo(() =>
    previewAssignments().filter(a => a.reviewer1?.id === a.reviewer2?.id).length
  );

  const pool1MembersWithPercent = createMemo(() =>
    mockMembers.map(m => ({ ...m, percent: getPool1Percents()[m.id] || 0 }))
  );
  const pool2MembersWithPercent = createMemo(() =>
    mockMembers.map(m => ({ ...m, percent: getPool2Percents()[m.id] || 0 }))
  );

  return (
    <div class='space-y-6'>
      {/* Add Studies - Inline Expandable */}
      <Card
        header={
          <>
            <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
              Add Studies
            </h3>
            <Show when={addStudiesExpanded()}>
              <button
                onClick={() => setAddStudiesExpanded(false)}
                class='flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors'
                style={{ color: tokens.slate500 }}
              >
                <FiX class='h-4 w-4' />
                Close
              </button>
            </Show>
          </>
        }
      >
        {/* Collapsed: Compact button row */}
        <Show when={!addStudiesExpanded()}>
          <div class='flex items-center gap-2'>
            {[
              { id: 'pdf', icon: FiUpload, label: 'Upload PDFs' },
              { id: 'doi', icon: FiLink, label: 'DOI/PMID' },
              { id: 'reference', icon: FiFileText, label: 'Reference File' },
              { id: 'drive', icon: FiFolder, label: 'Google Drive' },
            ].map(source => (
              <button
                onClick={() => handleQuickAction(source.id)}
                class='flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all'
                style={{
                  'border-color': tokens.slate200,
                  color: tokens.slate600,
                }}
              >
                <source.icon class='h-4 w-4' />
                {source.label}
              </button>
            ))}
          </div>
        </Show>

        {/* Expanded: Full import interface */}
        <Show when={addStudiesExpanded()}>
          <div
            class='rounded-lg border'
            style={{ background: tokens.slate50, 'border-color': tokens.slate200 }}
          >
            {/* Tabs */}
            <div class='flex border-b' style={{ 'border-color': tokens.slate200, background: 'white' }}>
              <ImportTab
                label='PDF Upload'
                icon={<FiUpload class='h-4 w-4' />}
                active={activeImportTab() === 'pdf'}
                onClick={() => setActiveImportTab('pdf')}
              />
              <ImportTab
                label='DOI / PMID'
                icon={<FiSearch class='h-4 w-4' />}
                active={activeImportTab() === 'doi'}
                onClick={() => setActiveImportTab('doi')}
              />
              <ImportTab
                label='Reference File'
                icon={<FiFileText class='h-4 w-4' />}
                active={activeImportTab() === 'reference'}
                onClick={() => setActiveImportTab('reference')}
              />
              <ImportTab
                label='Google Drive'
                icon={<FiFolder class='h-4 w-4' />}
                active={activeImportTab() === 'drive'}
                onClick={() => setActiveImportTab('drive')}
              />
            </div>

            {/* Tab content */}
            <div class='p-6'>
              <Show when={activeImportTab() === 'pdf'}>
                <PdfUploadContent onUpload={addMockStudies} />
              </Show>
              <Show when={activeImportTab() === 'doi'}>
                <DoiLookupContent onLookup={addDoiStudy} />
              </Show>
              <Show when={activeImportTab() === 'reference'}>
                <ReferenceFileContent onUpload={addMockStudies} />
              </Show>
              <Show when={activeImportTab() === 'drive'}>
                <GoogleDriveContent onImport={addMockStudies} />
              </Show>
            </div>
          </div>

          {/* Staged studies */}
          <Show when={stagedStudies().length > 0}>
            <div class='mt-4 border-t pt-4' style={{ 'border-color': tokens.slate200 }}>
              <div class='mb-3 flex items-center justify-between'>
                <h4 class='text-sm font-medium' style={{ color: tokens.slate700 }}>
                  Staged Studies ({stagedStudies().length})
                </h4>
                <button
                  class='flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium'
                  style={{ background: tokens.blue600, color: 'white' }}
                >
                  <FiPlus class='h-4 w-4' />
                  Add to Project
                </button>
              </div>
              <div class='space-y-2'>
                <For each={stagedStudies()}>
                  {study => (
                    <StagedStudyCard
                      study={study}
                      onRemove={() => removeStudy(study.id)}
                    />
                  )}
                </For>
              </div>
            </div>
          </Show>
        </Show>
      </Card>

      {/* Reviewer Assignment Panel */}
      <Show when={unassignedStudies().length > 0}>
        <Card borderColor={tokens.blue200}>
          {/* Header */}
          <div class='flex items-center justify-between'>
            <div class='flex items-center gap-3'>
              <div
                class='flex h-10 w-10 items-center justify-center rounded-lg'
                style={{ background: tokens.blue100, color: tokens.blue600 }}
              >
                <FiUsers class='h-5 w-5' />
              </div>
              <div>
                <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
                  Assign Reviewers
                </h3>
                <p class='text-sm' style={{ color: tokens.slate500 }}>
                  {unassignedStudies().length} studies need assignment
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAssignmentPanel(!showAssignmentPanel())}
              class='flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors'
              style={{
                background: showAssignmentPanel() ? tokens.blue600 : tokens.blue50,
                color: showAssignmentPanel() ? 'white' : tokens.blue700,
              }}
            >
              <Show when={showAssignmentPanel()} fallback={<FiChevronDown class='h-4 w-4' />}>
                <FiChevronUp class='h-4 w-4' />
              </Show>
              {showAssignmentPanel() ? 'Hide' : 'Show Assignment Tool'}
            </button>
          </div>

          <Show when={showAssignmentPanel()}>
            <div class='mt-6 border-t pt-6' style={{ 'border-color': tokens.slate200 }}>
              {/* Summary stats */}
              <div
                class='flex items-center justify-between rounded-lg px-4 py-3'
                style={{ background: tokens.slate100 }}
              >
                <p class='text-sm' style={{ color: tokens.slate600 }}>
                  <span class='font-semibold' style={{ color: tokens.slate900 }}>
                    {unassignedStudies().length}
                  </span>{' '}
                  unassigned studies
                </p>
                <p class='text-sm' style={{ color: tokens.slate600 }}>
                  <span class='font-semibold' style={{ color: tokens.slate900 }}>
                    {mockMembers.length}
                  </span>{' '}
                  reviewers
                </p>
                <p class='text-sm' style={{ color: tokens.slate600 }}>
                  <span class='font-semibold' style={{ color: tokens.slate900 }}>
                    {Math.round(100 / mockMembers.length)}%
                  </span>{' '}
                  each (even split)
                </p>
              </div>

              {/* Customize toggle */}
              <button
                onClick={() => setShowCustomize(!showCustomize())}
                class='mt-4 flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition-all'
                style={{
                  'border-color': showCustomize() ? tokens.blue300 : tokens.slate200,
                  background: showCustomize() ? tokens.blue50 : 'white',
                  color: showCustomize() ? tokens.blue700 : tokens.slate700,
                }}
              >
                <div class='flex items-center gap-2'>
                  <FiSliders class='h-4 w-4' />
                  <span>Customize distribution</span>
                </div>
                <div class='flex items-center gap-2'>
                  <span class='text-xs' style={{ color: tokens.slate400 }}>
                    {showCustomize() ? 'Hide' : 'Adjust percentages per reviewer'}
                  </span>
                  <FiChevronRight
                    class='h-4 w-4 transition-transform'
                    style={{ transform: showCustomize() ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  />
                </div>
              </button>

              {/* Customization panels */}
              <Show when={showCustomize()}>
                <div class='mt-4 space-y-4'>
                  {/* Pool 1 */}
                  <div
                    class='rounded-xl border p-4'
                    style={{ 'border-color': tokens.slate200, background: tokens.slate50 }}
                  >
                    <div class='mb-3 flex items-center justify-between'>
                      <h4 class='text-sm font-semibold' style={{ color: tokens.slate700 }}>
                        1st Reviewer Pool
                      </h4>
                      <span
                        class='text-xs font-medium'
                        style={{ color: isPoolValid(pool1Total()) ? tokens.success : '#b45309' }}
                      >
                        Total: {pool1Total()}%{pool1Total() === 99 && ' (OK)'}
                      </span>
                    </div>
                    <div class='space-y-2'>
                      <For each={pool1MembersWithPercent()}>
                        {member => (
                          <MemberPercentRow
                            member={member}
                            percent={member.percent}
                            onChange={val => updatePool1Percent(member.id, val)}
                          />
                        )}
                      </For>
                    </div>
                  </div>

                  {/* Pool 2 */}
                  <div
                    class='rounded-xl border p-4'
                    style={{ 'border-color': tokens.slate200, background: tokens.slate50 }}
                  >
                    <div class='mb-3 flex items-center justify-between'>
                      <h4 class='text-sm font-semibold' style={{ color: tokens.slate700 }}>
                        2nd Reviewer Pool
                      </h4>
                      <span
                        class='text-xs font-medium'
                        style={{ color: isPoolValid(pool2Total()) ? tokens.success : '#b45309' }}
                      >
                        Total: {pool2Total()}%{pool2Total() === 99 && ' (OK)'}
                      </span>
                    </div>
                    <div class='space-y-2'>
                      <For each={pool2MembersWithPercent()}>
                        {member => (
                          <MemberPercentRow
                            member={member}
                            percent={member.percent}
                            onChange={val => updatePool2Percent(member.id, val)}
                          />
                        )}
                      </For>
                    </div>
                  </div>

                  <Show when={!isCustomValid()}>
                    <p class='text-center text-xs' style={{ color: '#b45309' }}>
                      Each pool must total 99-100% to generate assignments
                    </p>
                  </Show>
                </div>
              </Show>

              {/* Action button */}
              <div class='mt-4'>
                <button
                  onClick={generateAssignments}
                  disabled={showCustomize() && !isCustomValid()}
                  class='flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-200'
                  style={{
                    background: showCustomize() && !isCustomValid() ? tokens.slate200 : tokens.blue600,
                    color: showCustomize() && !isCustomValid() ? tokens.slate400 : 'white',
                    cursor: showCustomize() && !isCustomValid() ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Show when={hasAssignments()} fallback={<FiShuffle class='h-4 w-4' />}>
                    <FiShuffle class='h-4 w-4' />
                  </Show>
                  {hasAssignments() ? 'Reshuffle' : 'Assign Randomly (Even Split)'}
                </button>
              </div>

              {/* Preview section */}
              <Show when={hasAssignments()}>
                <div class='mt-4'>
                  <div
                    class='overflow-hidden rounded-xl border'
                    style={{ 'border-color': hasConflicts() ? '#fca5a5' : tokens.blue200 }}
                  >
                    <div
                      class='flex items-center justify-between border-b px-4 py-3'
                      style={{
                        'border-color': hasConflicts() ? '#fca5a5' : tokens.blue200,
                        background: hasConflicts() ? '#fef2f2' : tokens.blue50,
                      }}
                    >
                      <div>
                        <h4
                          class='text-sm font-semibold'
                          style={{ color: hasConflicts() ? '#991b1b' : tokens.blue900 }}
                        >
                          Assignment Preview
                        </h4>
                        <Show when={hasConflicts()}>
                          <p class='text-xs' style={{ color: '#dc2626' }}>
                            {conflictCount()} conflict{conflictCount() !== 1 && 's'} - click Reshuffle
                          </p>
                        </Show>
                      </div>
                      <span class='text-xs' style={{ color: tokens.slate500 }}>
                        {unassignedStudies().length} studies assigned
                      </span>
                    </div>

                    <div class='max-h-64 overflow-y-auto'>
                      <table class='w-full text-left'>
                        <thead class='sticky top-0' style={{ background: tokens.slate50 }}>
                          <tr>
                            <th class='py-2 pl-4 pr-4 text-xs font-medium' style={{ color: tokens.slate500 }}>
                              Study
                            </th>
                            <th class='py-2 pr-4 text-xs font-medium' style={{ color: tokens.slate500 }}>
                              1st Reviewer
                            </th>
                            <th class='py-2 pr-4 text-xs font-medium' style={{ color: tokens.slate500 }}>
                              2nd Reviewer
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={previewAssignments()}>
                            {(assignment, index) => (
                              <AssignmentPreviewRow assignment={assignment} index={index()} />
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>

                    {/* Apply button */}
                    <div
                      class='flex items-center justify-end border-t px-4 py-3'
                      style={{ 'border-color': tokens.slate200, background: tokens.slate50 }}
                    >
                      <button
                        disabled={hasConflicts()}
                        class='flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium'
                        style={{
                          background: hasConflicts() ? tokens.slate200 : tokens.success,
                          color: hasConflicts() ? tokens.slate400 : 'white',
                          cursor: hasConflicts() ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <FiCheck class='h-4 w-4' />
                        Apply Assignments
                      </button>
                    </div>
                  </div>
                </div>
              </Show>
            </div>
          </Show>
        </Card>
      </Show>

      {/* All Studies - using collapsible card pattern */}
      <div>
        <div class='mb-3 flex items-center justify-between'>
          <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
            All Studies ({mockStudies.length})
          </h3>
          <div class='relative'>
            <FiSearch
              class='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2'
              style={{ color: tokens.slate400 }}
            />
            <input
              type='text'
              placeholder='Search studies...'
              class='w-64 rounded-lg border py-2 pl-9 pr-3 text-sm focus:outline-none'
              style={{ 'border-color': tokens.slate200, background: tokens.slate50 }}
            />
          </div>
        </div>
        <div class='space-y-2'>
          <For each={mockStudies}>
            {study => (
              <AllStudiesStudyRow
                study={study}
                expanded={allStudiesExpanded().has(study.id)}
                onToggle={() => toggleAllStudiesExpanded(study.id)}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

/**
 * AllStudiesStudyRow - Study card for All Studies tab with actions menu
 */
function AllStudiesStudyRow(props) {
  const study = () => props.study;
  const hasPdfs = () => (study().pdfs || []).length > 0;
  const [showMenu, setShowMenu] = createSignal(false);

  const citationLine = () => {
    const author = study().firstAuthor;
    const year = study().year;
    if (!author && !year) return null;
    return `${author || 'Unknown'}${year ? ` (${year})` : ''}`;
  };

  const handleHeaderClick = e => {
    if (!hasPdfs()) return;
    const target = e.target;
    const interactive = target.closest('button, [role="button"], [data-selectable], input, [data-menu]');
    if (interactive) return;
    props.onToggle?.();
  };

  // Status badge helper
  const getStatusBadge = () => {
    const status = study().status;
    switch (status) {
      case 'completed':
        return { variant: 'success', icon: FiCheckCircle, label: study().rating };
      case 'reconcile':
        return { variant: 'warning', icon: FiGitMerge, label: 'Reconcile' };
      case 'in-review':
        return { variant: 'info', icon: FiClipboard, label: 'In Review' };
      case 'unassigned':
        return { variant: 'neutral', icon: null, label: 'Unassigned' };
      default:
        return { variant: 'neutral', icon: null, label: status };
    }
  };

  return (
    <div
      class='overflow-hidden rounded-lg border transition-colors hover:border-gray-300'
      style={{
        background: 'white',
        'border-color': tokens.slate200,
      }}
    >
      {/* Header row */}
      <div
        class={`flex items-center gap-3 px-4 py-3 ${hasPdfs() ? 'cursor-pointer' : ''}`}
        style={{ userSelect: 'none' }}
        onClick={handleHeaderClick}
      >
        {/* Chevron (only if has PDFs) */}
        <Show when={hasPdfs()}>
          <div class='-ml-1 shrink-0 p-1'>
            <FiChevronRight
              class='h-5 w-5 transition-transform duration-200'
              style={{
                color: tokens.slate400,
                transform: props.expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            />
          </div>
        </Show>

        {/* Study info */}
        <div class='min-w-0 flex-1'>
          <p class='truncate font-medium' style={{ color: tokens.slate900 }}>
            {study().title}
          </p>
          <Show when={citationLine()}>
            <p
              class='mt-0.5 w-fit truncate text-xs'
              style={{ color: tokens.slate500, cursor: 'text', userSelect: 'text' }}
              data-selectable
            >
              {citationLine()}
              <Show when={study().journal}>
                <span style={{ color: tokens.slate400 }}> - {study().journal}</span>
              </Show>
            </p>
          </Show>
        </div>

        {/* Status badge */}
        <Badge variant={getStatusBadge().variant}>
          {(() => {
            const IconComponent = getStatusBadge().icon;
            return IconComponent ? <IconComponent class='h-3 w-3' /> : null;
          })()}
          {getStatusBadge().label}
        </Badge>

        {/* Reviewer avatars */}
        <Show when={study().assignedTo?.length > 0}>
          <div class='flex -space-x-2'>
            <For each={study().assignedTo.slice(0, 2)}>
              {memberId => {
                const member = mockMembers.find(m => m.id === memberId);
                return member ? <Avatar name={member.name} size='26px' fontSize='9px' /> : null;
              }}
            </For>
          </div>
        </Show>
        <Show when={!study().assignedTo?.length}>
          <span class='text-xs italic' style={{ color: tokens.slate400 }}>
            No reviewers
          </span>
        </Show>

        {/* Actions menu */}
        <div class='relative' data-menu>
          <button
            onClick={e => {
              e.stopPropagation();
              setShowMenu(!showMenu());
            }}
            class='rounded-lg p-1.5 transition-colors hover:bg-gray-100'
            style={{ color: tokens.slate400 }}
          >
            <FiMoreHorizontal class='h-4 w-4' />
          </button>
          <Show when={showMenu()}>
            <div
              class='absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border bg-white py-1 shadow-lg'
              style={{ 'border-color': tokens.slate200 }}
            >
              <button
                class='flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-gray-50'
                style={{ color: tokens.slate700 }}
                onClick={() => setShowMenu(false)}
              >
                <FiUsers class='h-4 w-4' />
                Assign Reviewers
              </button>
              <button
                class='flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-gray-50'
                style={{ color: tokens.slate700 }}
                onClick={() => setShowMenu(false)}
              >
                <FiEdit3 class='h-4 w-4' />
                Edit Study
              </button>
              <button
                class='flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-gray-50'
                style={{ color: tokens.slate700 }}
                onClick={() => setShowMenu(false)}
              >
                <FiUpload class='h-4 w-4' />
                Add PDF
              </button>
              <div class='my-1 border-t' style={{ 'border-color': tokens.slate100 }} />
              <button
                class='flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-red-50'
                style={{ color: tokens.danger }}
                onClick={() => setShowMenu(false)}
              >
                <FiX class='h-4 w-4' />
                Delete Study
              </button>
            </div>
          </Show>
        </div>
      </div>

      {/* Expanded PDF section */}
      <Show when={props.expanded && hasPdfs()}>
        <div
          class='space-y-2 border-t px-4 py-3'
          style={{ 'border-color': tokens.slate100 }}
        >
          <For each={study().pdfs}>{pdf => <PdfListItem pdf={pdf} />}</For>
        </div>
      </Show>
    </div>
  );
}

function TodoTab() {
  const todoStudies = () => getStudiesByStatus('in-review');
  const [expandedStudies, setExpandedStudies] = createSignal(new Set());

  const toggleExpanded = studyId => {
    setExpandedStudies(prev => {
      const next = new Set(prev);
      if (next.has(studyId)) {
        next.delete(studyId);
      } else {
        next.add(studyId);
      }
      return next;
    });
  };

  // Status badge styling
  const getStatusStyle = status => {
    switch (status) {
      case 'in-progress':
        return { bg: tokens.blue50, text: tokens.blue700 };
      case 'not-started':
        return { bg: tokens.slate100, text: tokens.slate600 };
      default:
        return { bg: tokens.blue50, text: tokens.blue700 };
    }
  };

  return (
    <div class='space-y-2'>
      <Show
        when={todoStudies().length > 0}
        fallback={
          <EmptyState
            icon={<FiClipboard class='h-6 w-6' />}
            title='No tasks assigned to you'
            description='Studies assigned to you for review will appear here.'
          />
        }
      >
        <For each={todoStudies()}>
          {study => (
            <StudyRow
              study={study}
              expanded={expandedStudies().has(study.id)}
              onToggle={() => toggleExpanded(study.id)}
              badges={
                <>
                  {/* Checklist type badge */}
                  <span
                    class='rounded-full px-2 py-1 text-xs font-medium'
                    style={{ background: tokens.slate100, color: tokens.slate700 }}
                  >
                    {study.checklistType}
                  </span>
                  {/* Status badge */}
                  <span
                    class='rounded-full px-2.5 py-1 text-xs font-medium'
                    style={{ background: getStatusStyle('in-progress').bg, color: getStatusStyle('in-progress').text }}
                  >
                    In Progress
                  </span>
                </>
              }
              actions={
                <button
                  class='rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors'
                  style={{ background: tokens.blue600 }}
                >
                  Open
                </button>
              }
            />
          )}
        </For>
      </Show>
    </div>
  );
}

function ReconcileTab() {
  const reconcileStudies = () => getStudiesByStatus('reconcile');
  const [expandedStudies, setExpandedStudies] = createSignal(new Set());

  const toggleExpanded = studyId => {
    setExpandedStudies(prev => {
      const next = new Set(prev);
      if (next.has(studyId)) {
        next.delete(studyId);
      } else {
        next.add(studyId);
      }
      return next;
    });
  };

  // Get reviewer names for a study
  const getReviewerNames = study => {
    return study.assignedTo.map(id => getMemberName(id));
  };

  // Check if ready for reconciliation (both reviewers completed)
  const isReady = study => study.assignedTo.length >= 2;

  return (
    <div class='space-y-2'>
      <Show
        when={reconcileStudies().length > 0}
        fallback={
          <EmptyState
            icon={<FiGitMerge class='h-6 w-6' />}
            title='No studies to reconcile'
            description="When reviewers complete assessments with disagreements, they'll appear here."
          />
        }
      >
        <For each={reconcileStudies()}>
          {study => (
            <StudyRow
              study={study}
              expanded={expandedStudies().has(study.id)}
              onToggle={() => toggleExpanded(study.id)}
              badges={
                <>
                  {/* Reconciliation status badge */}
                  <Show
                    when={isReady(study)}
                    fallback={
                      <span
                        class='rounded-full px-2.5 py-1 text-xs font-medium'
                        style={{ background: tokens.warningLight, color: tokens.warning }}
                      >
                        Waiting for reviewers
                      </span>
                    }
                  >
                    <span
                      class='rounded-full px-2.5 py-1 text-xs font-medium'
                      style={{ background: tokens.successLight, color: tokens.success }}
                    >
                      Ready
                    </span>
                  </Show>
                  {/* Reviewer names */}
                  <Show when={isReady(study)}>
                    <div class='flex items-center gap-2 text-sm' style={{ color: tokens.slate600 }}>
                      <span>{getReviewerNames(study)[0]}</span>
                      <span style={{ color: tokens.slate400 }}>vs</span>
                      <span>{getReviewerNames(study)[1]}</span>
                    </div>
                  </Show>
                </>
              }
              actions={
                <button
                  disabled={!isReady(study)}
                  class='flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors'
                  style={{
                    background: isReady(study) ? tokens.blue600 : tokens.slate200,
                    color: isReady(study) ? 'white' : tokens.slate500,
                    cursor: isReady(study) ? 'pointer' : 'not-allowed',
                  }}
                >
                  <FiGitMerge class='h-4 w-4' />
                  Reconcile
                </button>
              }
            />
          )}
        </For>
      </Show>
    </div>
  );
}

function CompletedTab() {
  const completedStudies = () => getStudiesByStatus('completed');
  const [expandedStudies, setExpandedStudies] = createSignal(new Set());
  const [showPreviousReviewers, setShowPreviousReviewers] = createSignal(null);

  const toggleExpanded = studyId => {
    setExpandedStudies(prev => {
      const next = new Set(prev);
      if (next.has(studyId)) {
        next.delete(studyId);
      } else {
        next.add(studyId);
      }
      return next;
    });
  };

  // Get reviewer names for a study
  const getReviewerNames = study => {
    return study.assignedTo.map(id => getMemberName(id));
  };

  // Confidence rating colors
  const getRatingStyle = rating => {
    switch (rating) {
      case 'High':
        return { bg: tokens.successLight, text: tokens.success };
      case 'Moderate':
        return { bg: tokens.warningLight, text: tokens.warning };
      case 'Low':
        return { bg: '#ffedd5', text: '#c2410c' };
      case 'Critically Low':
        return { bg: tokens.dangerLight, text: tokens.danger };
      default:
        return { bg: tokens.slate100, text: tokens.slate600 };
    }
  };

  return (
    <div class='space-y-2'>
      <Show
        when={completedStudies().length > 0}
        fallback={
          <EmptyState
            icon={<FiCheckCircle class='h-6 w-6' />}
            title='No completed reviews'
            description='Studies that have been fully reviewed will appear here.'
          />
        }
      >
        <For each={completedStudies()}>
          {study => (
            <StudyRow
              study={study}
              expanded={expandedStudies().has(study.id)}
              onToggle={() => toggleExpanded(study.id)}
              badges={
                <>
                  {/* Checklist type badge */}
                  <span
                    class='rounded-full px-2 py-1 text-xs font-medium'
                    style={{ background: tokens.slate100, color: tokens.slate700 }}
                  >
                    {study.checklistType}
                  </span>
                  {/* Rating badge */}
                  <span
                    class='rounded-full px-2.5 py-1 text-xs font-medium'
                    style={{
                      background: getRatingStyle(study.rating).bg,
                      color: getRatingStyle(study.rating).text,
                    }}
                  >
                    {study.rating} Confidence
                  </span>
                </>
              }
              actions={
                <>
                  {/* View Previous Reviewers (for dual-reviewer) */}
                  <Show when={study.assignedTo.length >= 2}>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setShowPreviousReviewers(study.id);
                      }}
                      class='rounded-lg px-3 py-1.5 text-sm font-medium transition-colors'
                      style={{ background: tokens.slate100, color: tokens.slate700 }}
                    >
                      View Previous
                    </button>
                  </Show>
                  {/* Open button */}
                  <button
                    class='rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors'
                    style={{ background: tokens.blue600 }}
                  >
                    Open
                  </button>
                </>
              }
            />
          )}
        </For>
      </Show>

      {/* Previous Reviewers Modal (simple inline implementation) */}
      <Show when={showPreviousReviewers()}>
        {studyId => {
          const study = () => completedStudies().find(s => s.id === studyId());
          return (
            <div
              class='fixed inset-0 z-50 flex items-center justify-center bg-black/50'
              onClick={() => setShowPreviousReviewers(null)}
            >
              <div
                class='w-full max-w-lg rounded-xl bg-white p-6 shadow-xl'
                onClick={e => e.stopPropagation()}
              >
                <div class='mb-4 flex items-center justify-between'>
                  <h3 class='text-lg font-semibold' style={{ color: tokens.slate900 }}>
                    Previous Reviewer Assessments
                  </h3>
                  <button
                    onClick={() => setShowPreviousReviewers(null)}
                    class='rounded-lg p-2 transition-colors hover:bg-gray-100'
                    style={{ color: tokens.slate400 }}
                  >
                    <FiX class='h-5 w-5' />
                  </button>
                </div>
                <p class='mb-4 text-sm' style={{ color: tokens.slate500 }}>
                  {study()?.title}
                </p>
                <div class='space-y-3'>
                  <For each={getReviewerNames(study())}>
                    {(name, index) => (
                      <div
                        class='flex items-center justify-between rounded-lg border p-4'
                        style={{ 'border-color': tokens.slate200 }}
                      >
                        <div class='flex items-center gap-3'>
                          <Avatar name={name} size='36px' fontSize='12px' />
                          <div>
                            <p class='font-medium' style={{ color: tokens.slate900 }}>
                              {name}
                            </p>
                            <p class='text-xs' style={{ color: tokens.slate500 }}>
                              Reviewer {index() + 1}
                            </p>
                          </div>
                        </div>
                        <button
                          class='rounded-lg px-3 py-1.5 text-sm font-medium'
                          style={{ background: tokens.blue50, color: tokens.blue700 }}
                        >
                          View Checklist
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>
          );
        }}
      </Show>
    </div>
  );
}

/**
 * MiniRobvisCell - Individual cell in the mini robvis traffic light grid
 */
function MiniRobvisCell(props) {
  const colors = {
    yes: tokens.success,
    'partial-yes': '#fbbf24',
    no: tokens.danger,
    'no-ma': tokens.slate300,
  };
  return (
    <div
      class='h-4 w-4 rounded-sm'
      style={{ background: colors[props.value] || tokens.slate200 }}
      title={props.title}
    />
  );
}

/**
 * MiniRobvisChart - Compact traffic light grid preview
 */
function MiniRobvisChart(props) {
  // Mock data for 5 studies x 16 questions
  const mockRobvisData = [
    { study: 'Cherkin 2016', responses: ['yes', 'yes', 'partial-yes', 'yes', 'no', 'yes', 'yes', 'partial-yes', 'yes', 'yes', 'no-ma', 'yes', 'yes', 'partial-yes', 'yes', 'yes'] },
    { study: 'de Jong 2016', responses: ['yes', 'partial-yes', 'yes', 'yes', 'yes', 'no', 'yes', 'yes', 'partial-yes', 'yes', 'yes', 'no', 'yes', 'yes', 'yes', 'partial-yes'] },
    { study: 'Jastrowski 2019', responses: ['partial-yes', 'yes', 'no', 'yes', 'yes', 'yes', 'partial-yes', 'yes', 'yes', 'no', 'yes', 'yes', 'no-ma', 'yes', 'partial-yes', 'yes'] },
    { study: 'Schmidt 2020', responses: ['yes', 'yes', 'yes', 'partial-yes', 'yes', 'yes', 'yes', 'no', 'yes', 'yes', 'yes', 'partial-yes', 'yes', 'yes', 'yes', 'yes'] },
    { study: 'Gardner-Nix 2021', responses: ['no', 'yes', 'yes', 'yes', 'partial-yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'no', 'partial-yes', 'yes', 'yes'] },
  ];

  return (
    <div class='overflow-x-auto'>
      {/* Header row with question numbers */}
      <div class='mb-1 flex items-center gap-0.5'>
        <div class='w-28 shrink-0' /> {/* Spacer for study names */}
        <For each={Array.from({ length: 16 }, (_, i) => i + 1)}>
          {q => (
            <div class='flex h-4 w-4 items-center justify-center text-[8px] font-medium' style={{ color: tokens.slate400 }}>
              {q}
            </div>
          )}
        </For>
      </div>
      {/* Data rows */}
      <div class='space-y-0.5'>
        <For each={mockRobvisData}>
          {row => (
            <div class='flex items-center gap-0.5'>
              <div class='w-28 shrink-0 truncate text-xs' style={{ color: tokens.slate600 }}>
                {row.study}
              </div>
              <For each={row.responses}>
                {(value, i) => <MiniRobvisCell value={value} title={`Q${i() + 1}: ${value}`} />}
              </For>
            </div>
          )}
        </For>
      </div>
      {/* Legend */}
      <div class='mt-3 flex items-center gap-4'>
        {[
          { label: 'Yes', color: tokens.success },
          { label: 'Partial Yes', color: '#fbbf24' },
          { label: 'No', color: tokens.danger },
          { label: 'No MA', color: tokens.slate300 },
        ].map(item => (
          <div class='flex items-center gap-1.5'>
            <div class='h-3 w-3 rounded-sm' style={{ background: item.color }} />
            <span class='text-xs' style={{ color: tokens.slate500 }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * MiniDistributionChart - Compact stacked bar distribution preview
 */
function MiniDistributionChart() {
  const mockDistribution = [
    { q: 1, yes: 80, partialYes: 15, no: 5, noMa: 0 },
    { q: 2, yes: 70, partialYes: 20, no: 10, noMa: 0 },
    { q: 3, yes: 50, partialYes: 25, no: 20, noMa: 5 },
    { q: 4, yes: 85, partialYes: 10, no: 5, noMa: 0 },
    { q: 5, yes: 60, partialYes: 20, no: 15, noMa: 5 },
    { q: 6, yes: 75, partialYes: 15, no: 10, noMa: 0 },
    { q: 7, yes: 65, partialYes: 25, no: 10, noMa: 0 },
  ];

  return (
    <div class='space-y-2'>
      <For each={mockDistribution}>
        {item => (
          <div class='flex items-center gap-2'>
            <span class='w-6 text-xs font-medium' style={{ color: tokens.slate500 }}>Q{item.q}</span>
            <div class='flex h-5 flex-1 overflow-hidden rounded'>
              <div style={{ width: `${item.yes}%`, background: tokens.success }} />
              <div style={{ width: `${item.partialYes}%`, background: '#fbbf24' }} />
              <div style={{ width: `${item.no}%`, background: tokens.danger }} />
              <div style={{ width: `${item.noMa}%`, background: tokens.slate300 }} />
            </div>
          </div>
        )}
      </For>
      <p class='text-center text-xs italic' style={{ color: tokens.slate400 }}>
        Showing questions 1-7 of 16
      </p>
    </div>
  );
}

function FiguresTab() {
  const completedStudies = () => getStudiesByStatus('completed');

  return (
    <div class='space-y-6'>
      {/* Summary Stats */}
      <div class='grid grid-cols-4 gap-4'>
        {[
          { label: 'Total Studies', value: mockStudies.length, sub: 'All studies' },
          { label: 'High Confidence', value: 1, sub: `${Math.round((1 / mockStudies.length) * 100)}%` },
          { label: 'Moderate', value: 0, sub: '0%' },
          { label: 'Low/Critically Low', value: 0, sub: '0%' },
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

      {/* Robvis Traffic Light Chart */}
      <Card
        header={
          <>
            <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
              AMSTAR2 Traffic Light (Robvis)
            </h3>
            <div class='flex items-center gap-2'>
              <button
                class='flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors'
                style={{ 'border-color': tokens.slate200, color: tokens.slate600 }}
              >
                <FiSettings class='h-4 w-4' />
                Settings
              </button>
              <button
                class='flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white'
                style={{ background: tokens.blue600 }}
              >
                <FiDownload class='h-4 w-4' />
                Export
              </button>
            </div>
          </>
        }
      >
        <MiniRobvisChart />
      </Card>

      {/* Charts side by side */}
      <div class='grid grid-cols-2 gap-6'>
        {/* Distribution Chart */}
        <Card
          header={
            <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
              Response Distribution
            </h3>
          }
        >
          <MiniDistributionChart />
        </Card>

        {/* Confidence Ratings Bar */}
        <Card
          header={
            <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
              AMSTAR2 Confidence Ratings
            </h3>
          }
        >
          <div class='space-y-3'>
            {[
              { label: 'High', value: 1, max: 5, color: tokens.success },
              { label: 'Moderate', value: 0, max: 5, color: tokens.warning },
              { label: 'Low', value: 0, max: 5, color: '#f97316' },
              { label: 'Critically Low', value: 0, max: 5, color: tokens.danger },
            ].map(item => (
              <div class='flex items-center gap-4'>
                <span class='w-28 text-sm' style={{ color: tokens.slate600 }}>
                  {item.label}
                </span>
                <div
                  class='h-8 flex-1 overflow-hidden rounded-lg'
                  style={{ background: tokens.slate100 }}
                >
                  <Show when={item.value > 0}>
                    <div
                      class='flex h-full items-center justify-end pr-2 text-xs font-medium text-white'
                      style={{
                        width: `${Math.max((item.value / item.max) * 100, 15)}%`,
                        background: item.color,
                      }}
                    >
                      {item.value}
                    </div>
                  </Show>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Critical Domains Summary */}
      <Card
        header={
          <h3 class='text-base font-semibold' style={{ color: tokens.slate900 }}>
            Critical Domains Summary
          </h3>
        }
      >
        <div class='flex flex-wrap gap-3'>
          {[2, 4, 7, 9, 11, 13, 15].map(domain => (
            <div
              class='flex flex-col items-center rounded-lg border px-4 py-3'
              style={{ 'border-color': tokens.slate100 }}
            >
              <span class='mb-2 text-xs font-medium' style={{ color: tokens.slate600 }}>
                Domain {domain}
              </span>
              <div class='flex items-center gap-1'>
                <span class='h-3 w-3 rounded-full' style={{ background: tokens.success }} title='Yes' />
                <span class='h-3 w-3 rounded-full' style={{ background: tokens.success }} title='Yes' />
                <span class='h-3 w-3 rounded-full' style={{ background: '#fbbf24' }} title='Partial Yes' />
                <span class='h-3 w-3 rounded-full' style={{ background: tokens.slate300 }} title='No MA' />
                <span class='h-3 w-3 rounded-full' style={{ background: tokens.danger }} title='No' />
              </div>
            </div>
          ))}
        </div>
      </Card>

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
            { icon: FiDownload, label: 'Download CSV', desc: 'Full data export', color: tokens.success },
            { icon: FiBarChart2, label: 'Export Charts', desc: 'PNG or SVG', color: tokens.blue600 },
            { icon: FiExternalLink, label: 'Share Report', desc: 'Generate link', color: tokens.blue600 },
          ].map(item => (
            <button
              class='flex items-center gap-3 rounded-lg border p-4 text-left transition-all hover:border-gray-300'
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

  // Calculate counts from studies data
  const todoCount = () => mockStudies.filter(s => s.status === 'in-review').length;
  const reconcileCount = () => mockStudies.filter(s => s.status === 'reconcile').length;
  const completedCount = () => mockStudies.filter(s => s.status === 'completed').length;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FiBarChart2 },
    { id: 'studies', label: 'Studies', icon: FiBook, count: mockStudies.length },
    { id: 'todo', label: 'To Do', icon: FiClipboard, count: todoCount() },
    { id: 'reconcile', label: 'Reconcile', icon: FiGitMerge, count: reconcileCount() },
    { id: 'completed', label: 'Completed', icon: FiCheckCircle, count: completedCount() },
    { id: 'figures', label: 'Figures', icon: FiBarChart2 },
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

      {/* Load Inter font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      `}</style>
    </div>
  );
}
