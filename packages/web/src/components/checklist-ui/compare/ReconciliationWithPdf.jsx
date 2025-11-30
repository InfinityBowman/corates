/**
 * ReconciliationWithPdf - Wrapper that combines ChecklistReconciliation with a PDF viewer
 * in a split-screen layout. The PDF is read-only during reconciliation.
 */

import { createSignal, Show } from 'solid-js';
import PdfViewer from '@/components/checklist-ui/pdf/PdfViewer.jsx';
import ChecklistReconciliation from './ChecklistReconciliation.jsx';

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

  // Layout state
  const [showPdf, setShowPdf] = createSignal(true);
  const [layout, setLayout] = createSignal('vertical'); // 'vertical' = side by side, 'horizontal' = stacked
  const [splitRatio, setSplitRatio] = createSignal(60); // Slightly more space for reconciliation
  const [isDragging, setIsDragging] = createSignal(false);

  let containerRef;

  function handleMouseDown(e) {
    e.preventDefault();
    setIsDragging(true);

    const handleMouseMove = event => {
      if (!containerRef) return;

      const rect = containerRef.getBoundingClientRect();
      let ratio;

      if (layout() === 'vertical') {
        ratio = ((event.clientX - rect.left) / rect.width) * 100;
      } else {
        ratio = ((event.clientY - rect.top) / rect.height) * 100;
      }

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
    <div class='h-screen flex flex-col bg-blue-50'>
      {/* Layout controls toolbar */}
      <div class='bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-end gap-2 shrink-0'>
        <Show when={hasPdf()}>
          {/* Toggle PDF panel */}
          <button
            onClick={() => setShowPdf(!showPdf())}
            class={`p-1.5 rounded transition-colors ${
              showPdf() ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title={showPdf() ? 'Hide PDF viewer' : 'Show PDF viewer'}
          >
            <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
              />
            </svg>
          </button>

          <Show when={showPdf()}>
            <div class='h-4 w-px bg-gray-300 mx-1' />

            {/* Vertical split (side by side) */}
            <button
              onClick={() => setLayout('vertical')}
              class={`p-1.5 rounded transition-colors ${
                layout() === 'vertical' ?
                  'bg-blue-100 text-blue-700'
                : 'hover:bg-gray-100 text-gray-600'
              }`}
              title='Side by side'
            >
              <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2'
                />
              </svg>
            </button>

            {/* Horizontal split (stacked) */}
            <button
              onClick={() => setLayout('horizontal')}
              class={`p-1.5 rounded transition-colors ${
                layout() === 'horizontal' ?
                  'bg-blue-100 text-blue-700'
                : 'hover:bg-gray-100 text-gray-600'
              }`}
              title='Stacked'
            >
              <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M4 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z'
                />
              </svg>
            </button>

            {/* Reset ratio */}
            <button
              onClick={() => setSplitRatio(60)}
              class='p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors'
              title='Reset split (60/40)'
            >
              <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                />
              </svg>
            </button>
          </Show>
        </Show>
      </div>

      {/* Split content area */}
      <div
        ref={containerRef}
        class={`flex-1 flex overflow-hidden ${
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
          />
        </div>

        {/* Divider / Resize handle */}
        <Show when={showPdf() && hasPdf()}>
          <div
            onMouseDown={handleMouseDown}
            class={`
              ${layout() === 'vertical' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
              bg-gray-200 hover:bg-blue-400 active:bg-blue-500 transition-colors shrink-0
              ${isDragging() ? 'bg-blue-500' : ''}
            `}
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
                <div class='flex items-center justify-center h-full bg-gray-100'>
                  <div class='flex items-center gap-3 text-gray-500'>
                    <div class='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600' />
                    Loading PDF...
                  </div>
                </div>
              }
            >
              <PdfViewer pdfData={props.pdfData} pdfFileName={props.pdfFileName} readOnly={true} />
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}
