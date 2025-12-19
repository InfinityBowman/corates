/**
 * ReconciliationWithPdf - Wrapper that combines ChecklistReconciliation with a PDF viewer
 * in a split-screen layout. The PDF is read-only during reconciliation.
 */

import { createSignal, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { AiOutlineArrowLeft } from 'solid-icons/ai';
import PdfViewer from '@/components/checklist-ui/pdf/PdfViewer.jsx';
import ChecklistReconciliation from './ChecklistReconciliation.jsx';
import Navbar from './Navbar.jsx';
import SplitPanelControls from '@/components/checklist-ui/SplitPanelControls.jsx';

export default function ReconciliationWithPdf(props) {
  // props.checklist1 - First reviewer's checklist data
  // props.checklist2 - Second reviewer's checklist data
  // props.onSaveReconciled - Callback when reconciled checklist is saved
  // props.onSaveProgress - Callback to save progress for resuming later
  // props.savedProgress - Previously saved progress (if resuming)
  // props.onCancel - Callback to cancel and go back
  // props.reviewer1Name - Display name for first reviewer
  // props.reviewer2Name - Display name for second reviewer
  // props.pdfData - ArrayBuffer of the study PDF (optional)
  // props.pdfFileName - Name of the PDF file (optional)
  // props.pdfLoading - Whether PDF is still loading
  // props.pdfs - Array of PDFs for multi-PDF selection
  // props.selectedPdfId - Currently selected PDF ID
  // props.onPdfSelect - Handler for PDF selection change
  // props.getReconciliationNote - Function to get Y.Text for a reconciliation note (questionKey => Y.Text)

  // Layout state
  const [showPdf, setShowPdf] = createSignal(true);
  const [layout, setLayout] = createSignal('vertical'); // 'vertical' = side by side, 'horizontal' = stacked
  const [splitRatio, setSplitRatio] = createSignal(60); // Slightly more space for reconciliation
  const [isDragging, setIsDragging] = createSignal(false);

  // Navbar store for deep reactivity - ChecklistReconciliation will update this
  const [navbarStore, setNavbarStore] = createStore({
    questionKeys: [],
    viewMode: 'questions',
    currentPage: 0,
    comparisonByQuestion: {},
    finalAnswers: {},
    summary: null,
    reviewedCount: 0,
    totalPages: 0,
    setViewMode: null,
    goToQuestion: null,
    onReset: null,
  });

  let containerRef;

  function handleMouseDown(e) {
    e.preventDefault();
    setIsDragging(true);

    const handleMouseMove = event => {
      if (!containerRef) return;

      const rect = containerRef.getBoundingClientRect();
      let ratio;

      ratio = layout() === 'vertical' ? ((event.clientX - rect.left) / rect.width) * 100 : ((event.clientY - rect.top) / rect.height) * 100;

      // Clamp between 30% and 80%
      ratio = Math.max(30, Math.min(80, ratio));
      setSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  // Check if we have PDF to show
  const hasPdf = () => props.pdfData || props.pdfLoading;

  return (
    <div class='flex h-full flex-col bg-blue-50'>
      {/* Header toolbar */}
      <div class='flex shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 py-2'>
        {/* Back button */}
        <button
          onClick={() => props.onCancel?.()}
          class='shrink-0 rounded-lg p-2 transition-colors hover:bg-gray-100'
          title='Go back'
        >
          <AiOutlineArrowLeft class='h-5 w-5 text-gray-600' />
        </button>

        {/* Title */}
        <div class='shrink-0'>
          <h1 class='text-lg font-bold text-gray-900'>Reconciliation</h1>
          <p class='text-xs text-gray-500'>
            {props.reviewer1Name || 'Reviewer 1'} vs {props.reviewer2Name || 'Reviewer 2'}
          </p>
        </div>

        <div class='h-8 w-px shrink-0 bg-gray-200' />

        {/* Navbar - question navigation pills */}
        <Show when={navbarStore.questionKeys.length > 0}>
          <div class='flex flex-1 items-center gap-4 overflow-x-auto'>
            <Navbar store={navbarStore} />
            {/* Progress indicator */}
            {/* <div class='flex items-center gap-2 text-sm text-gray-600 shrink-0'>
              <span class='font-medium'>{navbarStore.reviewedCount}</span>/
              <span>{navbarStore.totalPages}</span>
              <Show when={navbarStore.summary}>
                <span class='px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded'>
                  {navbarStore.summary.agreementCount} agree
                </span>
                <span class='px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded'>
                  {navbarStore.summary.disagreementCount} differ
                </span>
              </Show>
            </div> */}
          </div>
        </Show>

        <Show when={hasPdf()}>
          <SplitPanelControls
            showSecondPanel={showPdf()}
            onToggleSecondPanel={() => setShowPdf(!showPdf())}
            layout={layout()}
            onSetLayout={setLayout}
            onResetRatio={() => setSplitRatio(60)}
            secondPanelLabel='PDF viewer'
            defaultRatioLabel='60/40'
          />
        </Show>
      </div>

      {/* Split content area */}
      <div
        ref={containerRef}
        class={`flex flex-1 overflow-hidden ${
          layout() === 'vertical' ? 'flex-row' : 'flex-col'
        } ${isDragging() ? 'select-none' : ''}`}
      >
        {/* First panel: Reconciliation view */}
        <div
          class='overflow-auto'
          style={{
            [layout() === 'vertical' ? 'width' : 'height']:
              showPdf() && hasPdf() ? `${splitRatio()}%` : '100%',
          }}
        >
          <ChecklistReconciliation
            checklist1={props.checklist1}
            checklist2={props.checklist2}
            reviewer1Name={props.reviewer1Name}
            reviewer2Name={props.reviewer2Name}
            savedProgress={props.savedProgress}
            onSaveProgress={props.onSaveProgress}
            onSaveReconciled={props.onSaveReconciled}
            onCancel={props.onCancel}
            setNavbarStore={setNavbarStore}
            getReconciliationNote={props.getReconciliationNote}
          />
        </div>

        {/* Divider / Resize handle */}
        <Show when={showPdf() && hasPdf()}>
          <div
            onMouseDown={handleMouseDown}
            class={` ${layout() === 'vertical' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'} shrink-0 bg-gray-200 transition-colors hover:bg-blue-400 active:bg-blue-500 ${isDragging() ? 'bg-blue-500' : ''} `}
          />

          {/* Second panel: PDF Viewer (read-only) */}
          <div
            class='overflow-hidden'
            style={{
              [layout() === 'vertical' ? 'width' : 'height']: `${100 - splitRatio()}%`,
            }}
          >
            <Show
              when={!props.pdfLoading}
              fallback={
                <div class='flex h-full items-center justify-center bg-gray-100'>
                  <div class='flex items-center gap-3 text-gray-500'>
                    <div class='h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600' />
                    Loading PDF...
                  </div>
                </div>
              }
            >
              <PdfViewer
                pdfData={props.pdfData}
                pdfFileName={props.pdfFileName}
                readOnly={true}
                pdfs={props.pdfs}
                selectedPdfId={props.selectedPdfId}
                onPdfSelect={props.onPdfSelect}
              />
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}
