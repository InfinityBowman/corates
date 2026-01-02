/**
 * ReconciliationWithPdf - Wrapper that combines ChecklistReconciliation with a PDF viewer
 * in a split-screen layout. The PDF is read-only during reconciliation.
 */

import { Show, createMemo } from 'solid-js';
import { createStore } from 'solid-js/store';
import { AiOutlineArrowLeft } from 'solid-icons/ai';
import PdfViewer from '@/components/checklist/pdf/PdfViewer.jsx';
import ChecklistReconciliation from './ChecklistReconciliation.jsx';
import Navbar from './Navbar.jsx';
import SplitScreenLayout from '@/components/checklist/SplitScreenLayout.jsx';

/**
 * ReconciliationWithPdf - Wrapper that combines ChecklistReconciliation with a PDF viewer
 * in a split-screen layout. The PDF is read-only during reconciliation.
 * @param {Object} props
 * @param {Object} props.checklist1 - First reviewer's checklist data
 * @param {Object} props.checklist2 - Second reviewer's checklist data
 * @param {Object} props.reconciledChecklist - The reconciled checklist data (third checklist both reviewers edit)
 * @param {string} props.reconciledChecklistId - ID of the reconciled checklist
 * @param {Function} props.onSaveReconciled - Callback when reconciled checklist is saved (receives reconciledName)
 * @param {Function} props.onCancel - Callback to cancel and go back
 * @param {string} props.reviewer1Name - Display name for first reviewer
 * @param {string} props.reviewer2Name - Display name for second reviewer
 * @param {ArrayBuffer} props.pdfData - ArrayBuffer of the study PDF (optional)
 * @param {string} props.pdfFileName - Name of the PDF file (optional)
 * @param {boolean} props.pdfLoading - Whether PDF is still loading
 * @param {Array} props.pdfs - Array of PDFs for multi-PDF selection
 * @param {string} props.selectedPdfId - Currently selected PDF ID
 * @param {Function} props.onPdfSelect - Handler for PDF selection change
 * @param {Function} props.getQuestionNote - Function to get Y.Text for a question note (questionKey => Y.Text)
 * @param {Function} props.updateChecklistAnswer - Function to update a question answer (questionKey, questionData)
 * @returns {JSX.Element}
 */
export default function ReconciliationWithPdf(props) {
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

  // Check if we have PDF to show (reactive)
  const hasPdf = createMemo(() => !!(props.pdfData || props.pdfLoading));

  // Build header content with back button, title, and navbar
  const headerContent = (
    <>
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
        </div>
      </Show>
    </>
  );

  return (
    <div class='flex h-full flex-col bg-blue-50'>
      <SplitScreenLayout
        defaultLayout='vertical'
        defaultRatio={60}
        showSecondPanel={false}
        headerContent={headerContent}
        secondPanelLabel='PDF viewer'
        pdfUrl={props.pdfUrl}
        pdfData={props.pdfData}
      >
        {/* First panel: Reconciliation view */}
        <ChecklistReconciliation
          checklist1={props.checklist1}
          checklist2={props.checklist2}
          reconciledChecklist={props.reconciledChecklist}
          reconciledChecklistId={props.reconciledChecklistId}
          reviewer1Name={props.reviewer1Name}
          reviewer2Name={props.reviewer2Name}
          onSaveReconciled={props.onSaveReconciled}
          onCancel={props.onCancel}
          setNavbarStore={setNavbarStore}
          getQuestionNote={props.getQuestionNote}
          updateChecklistAnswer={(questionKey, questionData) =>
            props.updateChecklistAnswer?.(questionKey, questionData)
          }
        />

        {/* Second panel: PDF Viewer (read-only) - only rendered when PDF exists */}
        <Show when={hasPdf}>
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
        </Show>
      </SplitScreenLayout>
    </div>
  );
}
