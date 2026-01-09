/**
 * Add Studies Mock - Inline Progressive Disclosure
 *
 * An inline approach that lives directly on the page.
 * Starts compact, expands with progressive disclosure.
 * Good for quick additions without losing context.
 */

import { For, Show, createSignal } from 'solid-js';
import {
  FiX,
  FiCheck,
  FiUpload,
  FiFile,
  FiFolder,
  FiLink,
  FiTrash2,
  FiCheckCircle,
  FiLoader,
  FiChevronDown,
  FiChevronUp,
  FiExternalLink,
  FiEdit2,
  FiPlus,
} from 'solid-icons/fi';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockPendingStudies = [
  {
    id: '1',
    title:
      'Mindfulness-Based Stress Reduction for Chronic Low Back Pain: A Randomized Controlled Trial',
    authors: 'Cherkin DC, Sherman KJ, Balderson BH, et al.',
    journal: 'JAMA',
    year: 2016,
    doi: '10.1001/jama.2016.0086',
    source: 'pdf',
    fileName: 'cherkin-2016-mbsr.pdf',
    hasPdf: true,
    status: 'ready',
  },
  {
    id: '2',
    title: 'Effects of Mindfulness-Based Cognitive Therapy on Body Awareness',
    authors: 'de Jong M, Lazar SW, Hug K, et al.',
    journal: 'Frontiers in Psychology',
    year: 2016,
    doi: '10.3389/fpsyg.2016.00967',
    source: 'doi',
    hasPdf: false,
    status: 'ready',
  },
];

const mockExistingStudies = [
  {
    id: 'e1',
    title: 'A Pilot Study of Mindfulness Meditation for Pediatric Chronic Pain',
    authors: 'Jastrowski Mano KE, et al.',
    journal: 'Children',
    year: 2019,
    status: 'in-review',
  },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function SourceIcon(props) {
  const colors = {
    pdf: 'bg-blue-100 text-blue-600',
    doi: 'bg-emerald-100 text-emerald-600',
    reference: 'bg-purple-100 text-purple-600',
    'google-drive': 'bg-amber-100 text-amber-600',
  };

  const renderIcon = () => {
    switch (props.source) {
      case 'pdf':
        return <FiFile class='h-4 w-4' />;
      case 'doi':
        return <FiLink class='h-4 w-4' />;
      case 'reference':
        return <FiFolder class='h-4 w-4' />;
      case 'google-drive':
        return <FiExternalLink class='h-4 w-4' />;
      default:
        return <FiFile class='h-4 w-4' />;
    }
  };

  return (
    <div
      class={`flex h-8 w-8 items-center justify-center rounded-lg ${colors[props.source] || 'bg-slate-100 text-slate-500'}`}
    >
      {renderIcon()}
    </div>
  );
}

function QuickImportButton(props) {
  return (
    <button
      class={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
        props.active ?
          'border-violet-300 bg-violet-50 text-violet-700'
        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      }`}
      onClick={props.onClick}
    >
      {props.icon}
      {props.label}
    </button>
  );
}

function ProcessingCard(props) {
  return (
    <div class='flex animate-pulse items-center gap-3 rounded-lg border border-slate-200 bg-white p-3'>
      <div class='flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100'>
        <FiLoader class='h-5 w-5 animate-spin text-violet-600' />
      </div>
      <div class='flex-1'>
        <p class='text-sm font-medium text-slate-700'>{props.message}</p>
        <p class='text-xs text-slate-400'>{props.detail}</p>
      </div>
    </div>
  );
}

// ============================================================================
// INLINE IMPORT SECTIONS
// ============================================================================

function DoiInputSection(props) {
  const [input, setInput] = createSignal('');
  const [isSearching, setIsSearching] = createSignal(false);

  return (
    <div class='rounded-xl border border-slate-200 bg-white p-4'>
      <div class='mb-3 flex items-center justify-between'>
        <h3 class='flex items-center gap-2 text-sm font-medium text-slate-900'>
          <FiLink class='h-4 w-4 text-emerald-500' />
          DOI / PMID Lookup
        </h3>
        <button class='text-xs text-slate-400 hover:text-slate-600' onClick={props.onClose}>
          <FiX class='h-4 w-4' />
        </button>
      </div>
      <div class='flex gap-2'>
        <input
          type='text'
          value={input()}
          onInput={e => setInput(e.target.value)}
          placeholder='10.1001/jama.2016.0086 or PMID:26903338'
          class='flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100 focus:outline-none'
        />
        <button
          class='flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50'
          disabled={!input() || isSearching()}
        >
          <Show when={isSearching()} fallback={<FiPlus class='h-4 w-4' />}>
            <FiLoader class='h-4 w-4 animate-spin' />
          </Show>
          Add
        </button>
      </div>
      <p class='mt-2 text-xs text-slate-400'>
        Paste multiple identifiers separated by commas or newlines
      </p>
    </div>
  );
}

function ReferenceUploadSection(props) {
  const [dragOver, setDragOver] = createSignal(false);

  return (
    <div class='rounded-xl border border-slate-200 bg-white p-4'>
      <div class='mb-3 flex items-center justify-between'>
        <h3 class='flex items-center gap-2 text-sm font-medium text-slate-900'>
          <FiFolder class='h-4 w-4 text-purple-500' />
          Reference Manager Import
        </h3>
        <button class='text-xs text-slate-400 hover:text-slate-600' onClick={props.onClose}>
          <FiX class='h-4 w-4' />
        </button>
      </div>
      <div
        class={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-all ${
          dragOver() ?
            'border-purple-400 bg-purple-50'
          : 'border-slate-200 bg-slate-50 hover:border-purple-300 hover:bg-purple-50/50'
        }`}
        onDragOver={e => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={() => setDragOver(false)}
      >
        <FiFolder class='mx-auto mb-2 h-6 w-6 text-slate-400' />
        <p class='text-sm font-medium text-slate-600'>Drop files or click to browse</p>
        <p class='mt-1 text-xs text-slate-400'>RIS, BibTeX (.bib), EndNote XML</p>
      </div>
    </div>
  );
}

function GoogleDriveSection(props) {
  const [connected, setConnected] = createSignal(false);

  return (
    <div class='rounded-xl border border-slate-200 bg-white p-4'>
      <div class='mb-3 flex items-center justify-between'>
        <h3 class='flex items-center gap-2 text-sm font-medium text-slate-900'>
          <svg class='h-4 w-4 text-amber-500' viewBox='0 0 24 24' fill='currentColor'>
            <path
              d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'
              stroke='currentColor'
              stroke-width='2'
              fill='none'
            />
          </svg>
          Google Drive
        </h3>
        <button class='text-xs text-slate-400 hover:text-slate-600' onClick={props.onClose}>
          <FiX class='h-4 w-4' />
        </button>
      </div>
      <Show
        when={connected()}
        fallback={
          <button
            class='w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100'
            onClick={() => setConnected(true)}
          >
            Connect Google Drive
          </button>
        }
      >
        <div class='space-y-2'>
          <div class='flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700'>
            <FiCheckCircle class='h-4 w-4' />
            Connected
          </div>
          <button class='w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700'>
            Open Picker
          </button>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AddStudiesInline() {
  const [dragOver, setDragOver] = createSignal(false);
  const [expanded, setExpanded] = createSignal(false);
  const [activeImport, setActiveImport] = createSignal(null); // 'doi', 'reference', 'drive'
  const [pendingStudies, setPendingStudies] = createSignal(mockPendingStudies);
  const [isProcessing, setIsProcessing] = createSignal(false);

  const toggleImport = type => {
    setActiveImport(prev => (prev === type ? null : type));
    setExpanded(true);
  };

  const removeStudy = id => {
    setPendingStudies(prev => prev.filter(s => s.id !== id));
  };

  const addAllStudies = () => {
    // Would add to project
    setPendingStudies([]);
    setExpanded(false);
  };

  return (
    <div class='min-h-screen bg-slate-50'>
      {/* Demo Header */}
      <div class='border-b border-slate-200 bg-white px-6 py-4'>
        <div class='mx-auto max-w-4xl'>
          <h1 class='text-lg font-semibold text-slate-900'>Add Studies - Inline Approach</h1>
          <p class='text-sm text-slate-500'>Progressive disclosure, lives directly on the page</p>
        </div>
      </div>

      {/* Main Content */}
      <div class='mx-auto max-w-4xl space-y-6 p-6'>
        {/* ADD STUDIES SECTION */}
        <div class='overflow-hidden rounded-2xl border border-slate-200 bg-white'>
          {/* Primary Drop Zone */}
          <div
            class={`p-6 transition-all ${
              dragOver() ?
                'border-b-2 border-violet-300 bg-violet-50'
              : 'bg-gradient-to-b from-slate-50 to-white'
            }`}
            onDragOver={e => {
              e.preventDefault();
              setDragOver(true);
              setExpanded(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={() => {
              setDragOver(false);
              setIsProcessing(true);
            }}
          >
            <div class='flex items-center gap-4'>
              <div
                class={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  dragOver() ? 'bg-violet-200 text-violet-700' : 'bg-violet-100 text-violet-600'
                }`}
              >
                <FiUpload class='h-7 w-7' />
              </div>
              <div class='flex-1'>
                <p class='font-medium text-slate-900'>
                  <Show when={dragOver()} fallback='Add Studies'>
                    Drop to upload
                  </Show>
                </p>
                <p class='text-sm text-slate-500'>
                  Drop PDFs here or use other import options below
                </p>
              </div>
              <button class='flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700'>
                <FiUpload class='h-4 w-4' />
                Browse PDFs
              </button>
            </div>

            {/* Quick Import Buttons */}
            <div class='mt-4 flex items-center gap-2 border-t border-slate-100 pt-4'>
              <span class='mr-2 text-xs text-slate-400'>Or import from:</span>
              <QuickImportButton
                icon={<FiLink class='h-4 w-4' />}
                label='DOI / PMID'
                active={activeImport() === 'doi'}
                onClick={() => toggleImport('doi')}
              />
              <QuickImportButton
                icon={<FiFolder class='h-4 w-4' />}
                label='Reference File'
                active={activeImport() === 'reference'}
                onClick={() => toggleImport('reference')}
              />
              <QuickImportButton
                icon={
                  <svg class='h-4 w-4' viewBox='0 0 24 24' fill='currentColor'>
                    <path
                      d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'
                      stroke='currentColor'
                      stroke-width='2'
                      fill='none'
                    />
                  </svg>
                }
                label='Google Drive'
                active={activeImport() === 'drive'}
                onClick={() => toggleImport('drive')}
              />
            </div>
          </div>

          {/* Expandable Import Sections */}
          <Show when={activeImport()}>
            <div class='border-t border-slate-200 bg-slate-50 p-4'>
              <Show when={activeImport() === 'doi'}>
                <DoiInputSection onClose={() => setActiveImport(null)} />
              </Show>
              <Show when={activeImport() === 'reference'}>
                <ReferenceUploadSection onClose={() => setActiveImport(null)} />
              </Show>
              <Show when={activeImport() === 'drive'}>
                <GoogleDriveSection onClose={() => setActiveImport(null)} />
              </Show>
            </div>
          </Show>

          {/* Processing Indicator */}
          <Show when={isProcessing()}>
            <div class='border-t border-slate-200 bg-slate-50 p-4'>
              <ProcessingCard
                message='Processing mindfulness-study.pdf'
                detail='Extracting metadata and checking for duplicates...'
              />
            </div>
          </Show>

          {/* Pending Studies (Staging Area) */}
          <Show when={pendingStudies().length > 0}>
            <div class='border-t border-slate-200'>
              <button
                class='flex w-full items-center justify-between bg-slate-50 px-6 py-3 transition-colors hover:bg-slate-100'
                onClick={() => setExpanded(!expanded())}
              >
                <div class='flex items-center gap-2'>
                  <span class='flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-medium text-white'>
                    {pendingStudies().length}
                  </span>
                  <span class='text-sm font-medium text-slate-700'>
                    {pendingStudies().length === 1 ? 'study' : 'studies'} ready to add
                  </span>
                </div>
                <div class='flex items-center gap-3'>
                  {/* <button
                    class='flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-700'
                    onClick={e => {
                      e.stopPropagation();
                      addAllStudies();
                    }}
                  >
                    <FiCheck class='h-4 w-4' />
                    Add All
                  </button> */}
                  <Show
                    when={expanded()}
                    fallback={<FiChevronDown class='h-5 w-5 text-slate-400' />}
                  >
                    <FiChevronUp class='h-5 w-5 text-slate-400' />
                  </Show>
                </div>
              </button>

              <Show when={expanded()}>
                <div class='divide-y divide-slate-100'>
                  <For each={pendingStudies()}>
                    {study => (
                      <div class='flex items-start gap-3 px-6 py-4 transition-colors hover:bg-slate-50'>
                        <SourceIcon source={study.source} />
                        <div class='min-w-0 flex-1'>
                          <p class='text-sm leading-snug font-medium text-slate-900'>
                            {study.title}
                          </p>
                          <p class='mt-0.5 text-xs text-slate-500'>{study.authors}</p>
                          <div class='mt-1 flex items-center gap-2 text-xs text-slate-400'>
                            <Show when={study.journal}>
                              <span>{study.journal}</span>
                            </Show>
                            <Show when={study.year}>
                              <span>({study.year})</span>
                            </Show>
                            <Show when={study.doi}>
                              <span class='flex items-center gap-1'>
                                <FiExternalLink class='h-3 w-3' />
                                DOI
                              </span>
                            </Show>
                            <Show when={study.hasPdf}>
                              <span class='flex items-center gap-1 text-violet-500'>
                                <FiFile class='h-3 w-3' />
                                PDF
                              </span>
                            </Show>
                          </div>
                        </div>
                        <div class='flex shrink-0 items-center gap-1'>
                          <button class='rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600'>
                            <FiEdit2 class='h-4 w-4' />
                          </button>
                          <button
                            class='rounded p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600'
                            onClick={() => removeStudy(study.id)}
                          >
                            <FiTrash2 class='h-4 w-4' />
                          </button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>

          {/* Deduplication Info */}
          <Show when={pendingStudies().length > 0}>
            <div class='border-t border-emerald-100 bg-emerald-50 px-6 py-3'>
              <div class='flex items-center gap-2 text-xs text-emerald-700'>
                <FiCheckCircle class='h-4 w-4' />
                <span>No duplicates detected with existing studies</span>
              </div>
            </div>
          </Show>
        </div>

        {/* EXISTING STUDIES (for context) */}
        <div class='rounded-xl border border-slate-200 bg-white p-6'>
          <h3 class='mb-4 text-sm font-medium text-slate-900'>
            Existing Studies ({mockExistingStudies.length})
          </h3>
          <div class='space-y-3'>
            <For each={mockExistingStudies}>
              {study => (
                <div class='flex items-center gap-3 rounded-lg border border-slate-100 p-3'>
                  <div class='flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400'>
                    <FiFile class='h-5 w-5' />
                  </div>
                  <div class='min-w-0 flex-1'>
                    <p class='truncate text-sm font-medium text-slate-900'>{study.title}</p>
                    <p class='text-xs text-slate-500'>
                      {study.journal} ({study.year})
                    </p>
                  </div>
                  <span class='rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700'>
                    {study.status}
                  </span>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
      `}</style>
    </div>
  );
}
