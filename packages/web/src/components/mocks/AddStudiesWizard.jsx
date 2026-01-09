/**
 * Add Studies Mock - Wizard Style
 *
 * A step-by-step wizard flow in a large modal:
 * Step 1: Choose import sources (can select multiple)
 * Step 2: Upload/import from each source
 * Step 3: Review, dedupe, enrich metadata
 * Step 4: Confirm and add to project
 */

import { For, Show, createSignal, createMemo } from 'solid-js';
import {
  FiX,
  FiCheck,
  FiUpload,
  FiSearch,
  FiFile,
  FiFolder,
  FiLink,
  FiTrash2,
  FiAlertCircle,
  FiCheckCircle,
  FiLoader,
  FiChevronRight,
  FiChevronLeft,
  FiExternalLink,
  FiEdit2,
  FiRefreshCw,
} from 'solid-icons/fi';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockImportedStudies = [
  {
    id: '1',
    title: 'Mindfulness-Based Stress Reduction for Chronic Low Back Pain',
    authors: 'Cherkin DC, Sherman KJ, Balderson BH, et al.',
    journal: 'JAMA',
    year: 2016,
    doi: '10.1001/jama.2016.0086',
    source: 'pdf',
    fileName: 'cherkin-2016-mbsr.pdf',
    hasPdf: true,
    metadataStatus: 'enriched',
    duplicate: false,
  },
  {
    id: '2',
    title: 'Effects of Mindfulness-Based Cognitive Therapy on Body Awareness',
    authors: 'de Jong M, Lazar SW, Hug K, et al.',
    journal: 'Frontiers in Psychology',
    year: 2016,
    doi: '10.3389/fpsyg.2016.00967',
    source: 'reference',
    fileName: 'bibliography.ris',
    hasPdf: false,
    metadataStatus: 'complete',
    duplicate: false,
  },
  {
    id: '3',
    title: 'Mindfulness-Based Stress Reduction for Chronic Low Back Pain',
    authors: 'Cherkin DC, Sherman KJ, Balderson BH',
    journal: 'JAMA',
    year: 2016,
    doi: '10.1001/jama.2016.0086',
    source: 'doi',
    hasPdf: false,
    metadataStatus: 'enriched',
    duplicate: true,
    duplicateOf: '1',
  },
  {
    id: '4',
    title: 'A Pilot Study of Mindfulness Meditation for Pediatric Chronic Pain',
    authors: 'Jastrowski Mano KE, Salamon KS, Hainsworth KR',
    journal: 'Children',
    year: 2019,
    doi: null,
    source: 'google-drive',
    fileName: 'mindfulness-pediatric-2019.pdf',
    hasPdf: true,
    metadataStatus: 'partial',
    duplicate: false,
  },
  {
    id: '5',
    title: 'Unknown Title - Metadata Extraction Failed',
    authors: null,
    journal: null,
    year: null,
    doi: null,
    source: 'pdf',
    fileName: 'scan_20231215.pdf',
    hasPdf: true,
    metadataStatus: 'failed',
    duplicate: false,
  },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function StepIndicator(props) {
  return (
    <div class="flex items-center gap-2">
      <For each={props.steps}>
        {(step, index) => (
          <>
            <div class={`flex items-center gap-2 ${index() < props.currentStep ? 'text-emerald-600' : index() === props.currentStep ? 'text-violet-600' : 'text-slate-400'}`}>
              <div class={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                index() < props.currentStep
                  ? 'bg-emerald-100 text-emerald-600'
                  : index() === props.currentStep
                  ? 'bg-violet-100 text-violet-600'
                  : 'bg-slate-100 text-slate-400'
              }`}>
                <Show when={index() < props.currentStep} fallback={index() + 1}>
                  <FiCheck class="h-4 w-4" />
                </Show>
              </div>
              <span class={`text-sm font-medium ${index() <= props.currentStep ? 'text-slate-900' : 'text-slate-400'}`}>
                {step}
              </span>
            </div>
            <Show when={index() < props.steps.length - 1}>
              <div class={`h-px w-8 ${index() < props.currentStep ? 'bg-emerald-300' : 'bg-slate-200'}`} />
            </Show>
          </>
        )}
      </For>
    </div>
  );
}

function SourceCard(props) {
  return (
    <button
      class={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all ${
        props.selected
          ? 'border-violet-500 bg-violet-50 text-violet-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      }`}
      onClick={props.onToggle}
    >
      <div class={`flex h-12 w-12 items-center justify-center rounded-xl ${
        props.selected ? 'bg-violet-100' : 'bg-slate-100'
      }`}>
        {props.icon}
      </div>
      <div class="text-center">
        <p class="font-medium">{props.title}</p>
        <p class={`text-xs ${props.selected ? 'text-violet-500' : 'text-slate-400'}`}>{props.description}</p>
      </div>
      <Show when={props.selected}>
        <div class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white">
          <FiCheck class="h-3 w-3" />
        </div>
      </Show>
    </button>
  );
}

function SourceBadge(props) {
  const config = {
    pdf: { label: 'PDF', color: 'bg-blue-100 text-blue-700' },
    reference: { label: 'Reference', color: 'bg-purple-100 text-purple-700' },
    doi: { label: 'DOI', color: 'bg-emerald-100 text-emerald-700' },
    'google-drive': { label: 'Drive', color: 'bg-amber-100 text-amber-700' },
  };
  const c = config[props.source] || { label: props.source, color: 'bg-slate-100 text-slate-600' };

  return (
    <span class={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${c.color}`}>
      {c.label}
    </span>
  );
}

function MetadataStatus(props) {
  const config = {
    enriched: { icon: <FiCheckCircle class="h-3.5 w-3.5" />, label: 'Enriched', color: 'text-emerald-600' },
    complete: { icon: <FiCheck class="h-3.5 w-3.5" />, label: 'Complete', color: 'text-emerald-600' },
    partial: { icon: <FiAlertCircle class="h-3.5 w-3.5" />, label: 'Partial', color: 'text-amber-600' },
    failed: { icon: <FiX class="h-3.5 w-3.5" />, label: 'Failed', color: 'text-rose-600' },
    loading: { icon: <FiLoader class="h-3.5 w-3.5 animate-spin" />, label: 'Scanning...', color: 'text-slate-500' },
  };
  const c = config[props.status] || config.partial;

  return (
    <span class={`inline-flex items-center gap-1 text-xs ${c.color}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

function Step1SelectSources(props) {
  return (
    <div class="space-y-6">
      <div class="text-center">
        <h2 class="text-xl font-semibold text-slate-900">Choose Import Sources</h2>
        <p class="mt-1 text-sm text-slate-500">
          Select one or more ways to add studies. We'll deduplicate automatically.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="relative">
          <SourceCard
            icon={<FiUpload class="h-6 w-6" />}
            title="Upload PDFs"
            description="Drag & drop or browse"
            selected={props.sources.pdf}
            onToggle={() => props.toggleSource('pdf')}
          />
        </div>
        <div class="relative">
          <SourceCard
            icon={<FiFolder class="h-6 w-6" />}
            title="Reference Manager"
            description="RIS, BibTeX, EndNote"
            selected={props.sources.reference}
            onToggle={() => props.toggleSource('reference')}
          />
        </div>
        <div class="relative">
          <SourceCard
            icon={<FiLink class="h-6 w-6" />}
            title="DOI / PMID"
            description="Lookup by identifier"
            selected={props.sources.doi}
            onToggle={() => props.toggleSource('doi')}
          />
        </div>
        <div class="relative">
          <SourceCard
            icon={
              <svg class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" fill="none" />
              </svg>
            }
            title="Google Drive"
            description="Import from Drive"
            selected={props.sources.googleDrive}
            onToggle={() => props.toggleSource('googleDrive')}
          />
        </div>
      </div>

      <div class="rounded-lg bg-slate-50 p-4">
        <p class="text-xs text-slate-500">
          <strong class="text-slate-700">Smart deduplication:</strong> If you import the same study from multiple sources
          (e.g., a PDF and a DOI lookup), we'll detect it and merge the metadata automatically.
        </p>
      </div>
    </div>
  );
}

function Step2ImportContent(props) {
  const [pdfFiles, setPdfFiles] = createSignal([]);
  const [refFiles, setRefFiles] = createSignal([]);
  const [doiInput, setDoiInput] = createSignal('');
  const [driveConnected, setDriveConnected] = createSignal(false);

  return (
    <div class="space-y-6">
      <div class="text-center">
        <h2 class="text-xl font-semibold text-slate-900">Import Your Studies</h2>
        <p class="mt-1 text-sm text-slate-500">
          Add content from your selected sources
        </p>
      </div>

      <div class="space-y-4">
        {/* PDF Upload */}
        <Show when={props.sources.pdf}>
          <div class="rounded-xl border border-slate-200 bg-white p-4">
            <h3 class="mb-3 flex items-center gap-2 font-medium text-slate-900">
              <FiUpload class="h-4 w-4 text-blue-500" />
              PDF Upload
            </h3>
            <div class="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center hover:border-violet-300 hover:bg-violet-50/30 transition-all cursor-pointer">
              <FiUpload class="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p class="text-sm font-medium text-slate-700">Drop PDF files here or click to browse</p>
              <p class="text-xs text-slate-400 mt-1">Supports multiple files</p>
            </div>
            <Show when={pdfFiles().length > 0}>
              <div class="mt-3 space-y-2">
                <For each={pdfFiles()}>
                  {file => (
                    <div class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <div class="flex items-center gap-2">
                        <FiFile class="h-4 w-4 text-slate-400" />
                        <span class="text-sm text-slate-700">{file.name}</span>
                      </div>
                      <button class="text-slate-400 hover:text-rose-500">
                        <FiX class="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        {/* Reference Manager */}
        <Show when={props.sources.reference}>
          <div class="rounded-xl border border-slate-200 bg-white p-4">
            <h3 class="mb-3 flex items-center gap-2 font-medium text-slate-900">
              <FiFolder class="h-4 w-4 text-purple-500" />
              Reference Manager Files
            </h3>
            <div class="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center hover:border-violet-300 hover:bg-violet-50/30 transition-all cursor-pointer">
              <FiFolder class="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p class="text-sm font-medium text-slate-700">Drop reference files or folders</p>
              <p class="text-xs text-slate-400 mt-1">RIS, BibTeX (.bib), EndNote XML</p>
            </div>
          </div>
        </Show>

        {/* DOI/PMID */}
        <Show when={props.sources.doi}>
          <div class="rounded-xl border border-slate-200 bg-white p-4">
            <h3 class="mb-3 flex items-center gap-2 font-medium text-slate-900">
              <FiLink class="h-4 w-4 text-emerald-500" />
              DOI / PMID Lookup
            </h3>
            <div class="flex gap-2">
              <input
                type="text"
                placeholder="Enter DOI or PMID (one per line)"
                value={doiInput()}
                onInput={e => setDoiInput(e.target.value)}
                class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
              />
              <button class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors">
                <FiSearch class="h-4 w-4" />
              </button>
            </div>
            <p class="mt-2 text-xs text-slate-400">
              Examples: 10.1001/jama.2016.0086 or PMID: 26903338
            </p>
          </div>
        </Show>

        {/* Google Drive */}
        <Show when={props.sources.googleDrive}>
          <div class="rounded-xl border border-slate-200 bg-white p-4">
            <h3 class="mb-3 flex items-center gap-2 font-medium text-slate-900">
              <svg class="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" fill="none" />
              </svg>
              Google Drive
            </h3>
            <Show
              when={driveConnected()}
              fallback={
                <button
                  class="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                  onClick={() => setDriveConnected(true)}
                >
                  Connect Google Drive
                </button>
              }
            >
              <div class="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2 text-sm text-emerald-700">
                    <FiCheckCircle class="h-4 w-4" />
                    Connected to Google Drive
                  </div>
                  <button class="text-sm text-emerald-600 hover:text-emerald-700">Browse Files</button>
                </div>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}

function Step3ReviewDedupe(props) {
  const [studies, setStudies] = createSignal(mockImportedStudies);

  const duplicates = createMemo(() => studies().filter(s => s.duplicate));
  const unique = createMemo(() => studies().filter(s => !s.duplicate));
  const needsAttention = createMemo(() => studies().filter(s => s.metadataStatus === 'failed' || s.metadataStatus === 'partial'));

  const removeStudy = (id) => {
    setStudies(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div class="space-y-6">
      <div class="text-center">
        <h2 class="text-xl font-semibold text-slate-900">Review & Confirm</h2>
        <p class="mt-1 text-sm text-slate-500">
          We found {unique().length} unique studies. Review and edit before adding.
        </p>
      </div>

      {/* Summary Stats */}
      <div class="grid grid-cols-4 gap-3">
        <div class="rounded-lg bg-slate-50 p-3 text-center">
          <p class="text-2xl font-bold text-slate-900">{studies().length}</p>
          <p class="text-xs text-slate-500">Total imported</p>
        </div>
        <div class="rounded-lg bg-emerald-50 p-3 text-center">
          <p class="text-2xl font-bold text-emerald-700">{unique().length}</p>
          <p class="text-xs text-emerald-600">Unique studies</p>
        </div>
        <div class="rounded-lg bg-amber-50 p-3 text-center">
          <p class="text-2xl font-bold text-amber-700">{duplicates().length}</p>
          <p class="text-xs text-amber-600">Duplicates found</p>
        </div>
        <div class="rounded-lg bg-rose-50 p-3 text-center">
          <p class="text-2xl font-bold text-rose-700">{needsAttention().length}</p>
          <p class="text-xs text-rose-600">Needs attention</p>
        </div>
      </div>

      {/* Duplicates Warning */}
      <Show when={duplicates().length > 0}>
        <div class="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div class="flex items-start gap-3">
            <FiAlertCircle class="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div class="flex-1">
              <p class="font-medium text-amber-800">Duplicates Detected</p>
              <p class="text-sm text-amber-700 mt-1">
                {duplicates().length} duplicate{duplicates().length > 1 ? 's' : ''} found across your import sources.
                These will be automatically merged - we'll keep the best metadata and any attached PDFs.
              </p>
              <div class="mt-3 space-y-2">
                <For each={duplicates()}>
                  {study => (
                    <div class="flex items-center justify-between rounded bg-white/60 px-3 py-2 text-sm">
                      <div class="flex items-center gap-2">
                        <SourceBadge source={study.source} />
                        <span class="text-amber-900 truncate max-w-md">{study.title}</span>
                      </div>
                      <span class="text-xs text-amber-600">Duplicate of #{study.duplicateOf}</span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Studies List */}
      <div class="rounded-xl border border-slate-200 bg-white">
        <div class="border-b border-slate-100 px-4 py-3">
          <h3 class="font-medium text-slate-900">Studies to Add ({unique().length})</h3>
        </div>
        <div class="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          <For each={unique()}>
            {study => (
              <div class={`p-4 hover:bg-slate-50 transition-colors ${study.metadataStatus === 'failed' ? 'bg-rose-50/50' : ''}`}>
                <div class="flex items-start gap-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                    <Show when={study.hasPdf} fallback={<FiFile class="h-5 w-5" />}>
                      <FiFile class="h-5 w-5 text-violet-500" />
                    </Show>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <SourceBadge source={study.source} />
                      <MetadataStatus status={study.metadataStatus} />
                    </div>
                    <p class="font-medium text-slate-900 truncate">{study.title}</p>
                    <Show when={study.authors}>
                      <p class="text-sm text-slate-500 truncate">{study.authors}</p>
                    </Show>
                    <div class="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <Show when={study.journal}>
                        <span>{study.journal}</span>
                      </Show>
                      <Show when={study.year}>
                        <span>{study.year}</span>
                      </Show>
                      <Show when={study.doi}>
                        <span class="flex items-center gap-1">
                          <FiExternalLink class="h-3 w-3" />
                          {study.doi}
                        </span>
                      </Show>
                    </div>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <Show when={study.metadataStatus === 'partial' || study.metadataStatus === 'failed'}>
                      <button class="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-violet-600 transition-colors" title="Edit metadata">
                        <FiEdit2 class="h-4 w-4" />
                      </button>
                      <button class="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-amber-600 transition-colors" title="Retry metadata extraction">
                        <FiRefreshCw class="h-4 w-4" />
                      </button>
                    </Show>
                    <button
                      class="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      onClick={() => removeStudy(study.id)}
                      title="Remove"
                    >
                      <FiTrash2 class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AddStudiesWizard() {
  const [isOpen, setIsOpen] = createSignal(true);
  const [currentStep, setCurrentStep] = createSignal(0);
  const [selectedSources, setSelectedSources] = createSignal({
    pdf: true,
    reference: false,
    doi: true,
    googleDrive: false,
  });

  const steps = ['Select Sources', 'Import', 'Review'];

  const toggleSource = (source) => {
    setSelectedSources(prev => ({ ...prev, [source]: !prev[source] }));
  };

  const hasSelectedSource = createMemo(() => Object.values(selectedSources()).some(v => v));

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  return (
    <div class="min-h-screen bg-slate-100 p-8">
      {/* Demo Controls */}
      <div class="mx-auto max-w-2xl mb-6">
        <div class="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p class="text-sm text-amber-800">
            <strong>Mock Preview:</strong> Add Studies Wizard Flow.
            Click through the steps to see the full workflow.
          </p>
        </div>
      </div>

      {/* Modal Backdrop */}
      <Show when={isOpen()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          {/* Modal */}
          <div class="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <StepIndicator steps={steps} currentStep={currentStep()} />
              <button
                class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <FiX class="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div class="px-6 py-6">
              <Show when={currentStep() === 0}>
                <Step1SelectSources
                  sources={selectedSources()}
                  toggleSource={toggleSource}
                />
              </Show>
              <Show when={currentStep() === 1}>
                <Step2ImportContent sources={selectedSources()} />
              </Show>
              <Show when={currentStep() === 2}>
                <Step3ReviewDedupe />
              </Show>
            </div>

            {/* Footer */}
            <div class="flex items-center justify-between border-t border-slate-100 px-6 py-4">
              <Show when={currentStep() > 0} fallback={<div />}>
                <button
                  class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  onClick={prevStep}
                >
                  <FiChevronLeft class="h-4 w-4" />
                  Back
                </button>
              </Show>

              <div class="flex items-center gap-3">
                <button
                  class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </button>
                <Show
                  when={currentStep() < steps.length - 1}
                  fallback={
                    <button class="flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors">
                      <FiCheck class="h-4 w-4" />
                      Add 4 Studies
                    </button>
                  }
                >
                  <button
                    class="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={nextStep}
                    disabled={currentStep() === 0 && !hasSelectedSource()}
                  >
                    Continue
                    <FiChevronRight class="h-4 w-4" />
                  </button>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Reopen Button */}
      <Show when={!isOpen()}>
        <div class="mx-auto max-w-2xl">
          <button
            class="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
            onClick={() => {
              setIsOpen(true);
              setCurrentStep(0);
            }}
          >
            Open Add Studies Wizard
          </button>
        </div>
      </Show>

      {/* Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
      `}</style>
    </div>
  );
}
