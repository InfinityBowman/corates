/**
 * Add Studies Mock - Slide-over Panel with Tabs
 *
 * A slide-over panel approach where all import options are available via tabs.
 * Shows real-time deduplication and metadata enrichment as studies are added.
 * Studies queue up in a staging area before final confirmation.
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
  FiChevronDown,
  FiExternalLink,
  FiEdit2,
  FiRefreshCw,
  FiPlus,
  FiArrowRight,
  FiCopy,
  FiInfo,
} from 'solid-icons/fi';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockStagedStudies = [
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
    status: 'ready',
    metadataScore: 100,
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
    metadataScore: 100,
  },
  {
    id: '3',
    title: 'Scanning PDF for metadata...',
    authors: null,
    journal: null,
    year: null,
    doi: null,
    source: 'pdf',
    fileName: 'mindfulness-study-2019.pdf',
    hasPdf: true,
    status: 'processing',
    metadataScore: 0,
  },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function SourceBadge(props) {
  const config = {
    pdf: { label: 'PDF', color: 'bg-blue-100 text-blue-700', icon: FiFile },
    reference: { label: 'RIS', color: 'bg-purple-100 text-purple-700', icon: FiFolder },
    doi: { label: 'DOI', color: 'bg-emerald-100 text-emerald-700', icon: FiLink },
    pmid: { label: 'PMID', color: 'bg-teal-100 text-teal-700', icon: FiLink },
    'google-drive': { label: 'Drive', color: 'bg-amber-100 text-amber-700', icon: FiFolder },
  };
  const c = config[props.source] || { label: props.source, color: 'bg-slate-100 text-slate-600', icon: FiFile };
  const Icon = c.icon;

  return (
    <span class={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${c.color}`}>
      <Icon class="h-3 w-3" />
      {c.label}
    </span>
  );
}

function MetadataScoreRing(props) {
  const circumference = 2 * Math.PI * 12;
  const offset = circumference - (props.score / 100) * circumference;
  const color = props.score >= 80 ? '#10b981' : props.score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div class="relative h-8 w-8">
      <svg class="h-8 w-8 -rotate-90">
        <circle cx="16" cy="16" r="12" stroke="#e2e8f0" stroke-width="3" fill="none" />
        <circle
          cx="16"
          cy="16"
          r="12"
          stroke={color}
          stroke-width="3"
          fill="none"
          stroke-linecap="round"
          stroke-dasharray={circumference}
          stroke-dashoffset={offset}
          class="transition-all duration-500"
        />
      </svg>
      <span class="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-600">
        {props.score}
      </span>
    </div>
  );
}

function DuplicateAlert(props) {
  return (
    <div class="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div class="flex items-start gap-2">
        <FiCopy class="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-amber-800">Duplicate detected</p>
          <p class="text-xs text-amber-600 mt-0.5">
            This appears to match "{props.matchTitle}" already in your staging area.
            We'll merge the metadata automatically.
          </p>
        </div>
        <button class="text-xs text-amber-700 hover:text-amber-900 font-medium">Keep both</button>
      </div>
    </div>
  );
}

// ============================================================================
// TAB CONTENT COMPONENTS
// ============================================================================

function PdfUploadTab() {
  const [dragOver, setDragOver] = createSignal(false);

  return (
    <div class="space-y-4">
      <div
        class={`rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
          dragOver()
            ? 'border-violet-400 bg-violet-50'
            : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={() => setDragOver(false)}
      >
        <div class="flex flex-col items-center gap-3">
          <div class={`flex h-14 w-14 items-center justify-center rounded-xl ${dragOver() ? 'bg-violet-100 text-violet-600' : 'bg-slate-200 text-slate-400'}`}>
            <FiUpload class="h-7 w-7" />
          </div>
          <div>
            <p class="font-medium text-slate-700">Drop PDF files here</p>
            <p class="text-sm text-slate-500 mt-1">or click to browse</p>
          </div>
        </div>
      </div>

      <div class="rounded-lg bg-blue-50 border border-blue-100 p-3">
        <div class="flex gap-2">
          <FiInfo class="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p class="text-xs text-blue-700">
            We'll automatically extract metadata (title, authors, DOI) from your PDFs.
            If we find a DOI, we'll enrich with data from CrossRef and PubMed.
          </p>
        </div>
      </div>
    </div>
  );
}

function DoiLookupTab() {
  const [input, setInput] = createSignal('');
  const [isSearching, setIsSearching] = createSignal(false);

  return (
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-2">
          DOI or PMID
        </label>
        <div class="flex gap-2">
          <input
            type="text"
            value={input()}
            onInput={(e) => setInput(e.target.value)}
            placeholder="10.1001/jama.2016.0086 or 26903338"
            class="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm placeholder-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          <button
            class="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
            disabled={!input() || isSearching()}
          >
            <Show when={isSearching()} fallback={<FiSearch class="h-4 w-4" />}>
              <FiLoader class="h-4 w-4 animate-spin" />
            </Show>
            Lookup
          </button>
        </div>
      </div>

      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-slate-200" />
        </div>
        <div class="relative flex justify-center">
          <span class="bg-white px-3 text-xs text-slate-400">or paste multiple</span>
        </div>
      </div>

      <div>
        <textarea
          placeholder="Paste multiple DOIs or PMIDs, one per line..."
          rows="4"
          class="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm placeholder-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100 resize-none"
        />
        <div class="flex justify-end mt-2">
          <button class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <FiPlus class="h-4 w-4" />
            Add All
          </button>
        </div>
      </div>
    </div>
  );
}

function ReferenceFileTab() {
  const [dragOver, setDragOver] = createSignal(false);

  return (
    <div class="space-y-4">
      <div
        class={`rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
          dragOver()
            ? 'border-violet-400 bg-violet-50'
            : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={() => setDragOver(false)}
      >
        <div class="flex flex-col items-center gap-3">
          <div class={`flex h-14 w-14 items-center justify-center rounded-xl ${dragOver() ? 'bg-violet-100 text-violet-600' : 'bg-slate-200 text-slate-400'}`}>
            <FiFolder class="h-7 w-7" />
          </div>
          <div>
            <p class="font-medium text-slate-700">Drop reference files or folders</p>
            <p class="text-sm text-slate-500 mt-1">RIS, BibTeX (.bib), EndNote XML</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <button class="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 p-3 text-slate-500 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 transition-all">
          <span class="text-xs font-medium">Zotero</span>
        </button>
        <button class="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 p-3 text-slate-500 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 transition-all">
          <span class="text-xs font-medium">Mendeley</span>
        </button>
        <button class="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 p-3 text-slate-500 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 transition-all">
          <span class="text-xs font-medium">EndNote</span>
        </button>
      </div>
    </div>
  );
}

function GoogleDriveTab() {
  const [connected, setConnected] = createSignal(false);

  return (
    <div class="space-y-4">
      <Show
        when={connected()}
        fallback={
          <div class="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <div class="flex flex-col items-center gap-3">
              <div class="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-200 text-slate-400">
                <svg class="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" fill="none" />
                </svg>
              </div>
              <div>
                <p class="font-medium text-slate-700">Connect Google Drive</p>
                <p class="text-sm text-slate-500 mt-1">Import PDFs directly from your Drive</p>
              </div>
              <button
                class="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
                onClick={() => setConnected(true)}
              >
                Connect
              </button>
            </div>
          </div>
        }
      >
        <div class="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-sm text-emerald-700">
              <FiCheckCircle class="h-4 w-4" />
              Connected as user@gmail.com
            </div>
            <button class="text-xs text-emerald-600 hover:text-emerald-700">Disconnect</button>
          </div>
        </div>

        <div class="rounded-lg border border-slate-200 divide-y divide-slate-100">
          <div class="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
            <FiFolder class="h-5 w-5 text-amber-500" />
            <span class="text-sm font-medium text-slate-700">Research Papers</span>
            <span class="text-xs text-slate-400 ml-auto">12 PDFs</span>
          </div>
          <div class="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
            <FiFolder class="h-5 w-5 text-amber-500" />
            <span class="text-sm font-medium text-slate-700">Systematic Review</span>
            <span class="text-xs text-slate-400 ml-auto">8 PDFs</span>
          </div>
          <div class="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
            <FiFile class="h-5 w-5 text-blue-500" />
            <span class="text-sm font-medium text-slate-700">study-2024.pdf</span>
            <button class="ml-auto text-xs text-violet-600 hover:text-violet-700 font-medium">Add</button>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AddStudiesPanel() {
  const [isOpen, setIsOpen] = createSignal(true);
  const [activeTab, setActiveTab] = createSignal('pdf');
  const [stagedStudies, setStagedStudies] = createSignal(mockStagedStudies);
  const [showDupeAlert, setShowDupeAlert] = createSignal(true);

  const tabs = [
    { id: 'pdf', label: 'PDFs', icon: FiUpload },
    { id: 'doi', label: 'DOI/PMID', icon: FiLink },
    { id: 'reference', label: 'References', icon: FiFolder },
    { id: 'drive', label: 'Drive', icon: FiExternalLink },
  ];

  const readyCount = createMemo(() => stagedStudies().filter(s => s.status === 'ready').length);
  const processingCount = createMemo(() => stagedStudies().filter(s => s.status === 'processing').length);

  const removeStudy = (id) => {
    setStagedStudies(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div class="min-h-screen bg-slate-100">
      {/* Demo Header */}
      <div class="bg-white border-b border-slate-200 px-6 py-4">
        <div class="mx-auto max-w-6xl flex items-center justify-between">
          <div>
            <h1 class="text-lg font-semibold text-slate-900">Add Studies - Panel Approach</h1>
            <p class="text-sm text-slate-500">Slide-over panel with tabs for each import source</p>
          </div>
          <button
            class="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
            onClick={() => setIsOpen(true)}
          >
            <FiPlus class="h-4 w-4" />
            Add Studies
          </button>
        </div>
      </div>

      {/* Main Content Area (behind panel) */}
      <div class="mx-auto max-w-6xl p-6">
        <div class="rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-400">
          <p>Project content would be here...</p>
        </div>
      </div>

      {/* Slide-over Panel */}
      <Show when={isOpen()}>
        <div class="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            class="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div class="absolute inset-y-0 right-0 flex max-w-xl w-full">
            <div class="relative w-full bg-white shadow-2xl flex flex-col">
              {/* Panel Header */}
              <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h2 class="text-lg font-semibold text-slate-900">Add Studies</h2>
                <button
                  class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <FiX class="h-5 w-5" />
                </button>
              </div>

              {/* Tabs */}
              <div class="border-b border-slate-200">
                <nav class="flex px-6 -mb-px">
                  <For each={tabs}>
                    {tab => {
                      const Icon = tab.icon;
                      const isActive = activeTab() === tab.id;
                      return (
                        <button
                          class={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            isActive
                              ? 'border-violet-600 text-violet-700'
                              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
                          }`}
                          onClick={() => setActiveTab(tab.id)}
                        >
                          <Icon class="h-4 w-4" />
                          {tab.label}
                        </button>
                      );
                    }}
                  </For>
                </nav>
              </div>

              {/* Tab Content */}
              <div class="flex-1 overflow-y-auto">
                <div class="p-6">
                  <Show when={activeTab() === 'pdf'}><PdfUploadTab /></Show>
                  <Show when={activeTab() === 'doi'}><DoiLookupTab /></Show>
                  <Show when={activeTab() === 'reference'}><ReferenceFileTab /></Show>
                  <Show when={activeTab() === 'drive'}><GoogleDriveTab /></Show>
                </div>

                {/* Duplicate Alert (contextual) */}
                <Show when={showDupeAlert()}>
                  <div class="px-6 pb-4">
                    <DuplicateAlert matchTitle="Mindfulness-Based Stress Reduction for Chronic Low Back Pain" />
                  </div>
                </Show>

                {/* Staging Area */}
                <div class="border-t border-slate-200">
                  <div class="px-6 py-3 bg-slate-50 flex items-center justify-between">
                    <h3 class="text-sm font-medium text-slate-700">
                      Staging Area
                      <Show when={processingCount() > 0}>
                        <span class="ml-2 text-xs text-slate-400">
                          ({processingCount()} processing...)
                        </span>
                      </Show>
                    </h3>
                    <span class="text-xs text-slate-500">{stagedStudies().length} studies</span>
                  </div>

                  <div class="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    <For each={stagedStudies()}>
                      {study => (
                        <div class={`px-6 py-3 hover:bg-slate-50 transition-colors ${study.status === 'processing' ? 'opacity-60' : ''}`}>
                          <div class="flex items-start gap-3">
                            <Show
                              when={study.status !== 'processing'}
                              fallback={
                                <div class="flex h-8 w-8 items-center justify-center">
                                  <FiLoader class="h-5 w-5 text-violet-500 animate-spin" />
                                </div>
                              }
                            >
                              <MetadataScoreRing score={study.metadataScore} />
                            </Show>
                            <div class="flex-1 min-w-0">
                              <div class="flex items-center gap-2 mb-0.5">
                                <SourceBadge source={study.source} />
                              </div>
                              <p class="text-sm font-medium text-slate-900 truncate">{study.title}</p>
                              <Show when={study.authors}>
                                <p class="text-xs text-slate-500 truncate">{study.authors}</p>
                              </Show>
                            </div>
                            <button
                              class="shrink-0 rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              onClick={() => removeStudy(study.id)}
                            >
                              <FiTrash2 class="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </div>

              {/* Panel Footer */}
              <div class="border-t border-slate-200 px-6 py-4 bg-white">
                <div class="flex items-center justify-between">
                  <button
                    class="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                    onClick={() => setStagedStudies([])}
                  >
                    Clear all
                  </button>
                  <button
                    class="flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={readyCount() === 0 || processingCount() > 0}
                  >
                    <Show
                      when={processingCount() === 0}
                      fallback={
                        <>
                          <FiLoader class="h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      }
                    >
                      <FiCheck class="h-4 w-4" />
                      Add {readyCount()} {readyCount() === 1 ? 'Study' : 'Studies'}
                    </Show>
                  </button>
                </div>
              </div>
            </div>
          </div>
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
