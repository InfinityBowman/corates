/**
 * ReconciliationWithPdf - Wrapper that combines ChecklistReconciliation with a PDF viewer
 * in a split-screen layout. The PDF is read-only during reconciliation.
 */

import { Show, createMemo } from 'solid-js';
import { createStore } from 'solid-js/store';
import { AiOutlineArrowLeft } from 'solid-icons/ai';
import PdfViewer from '@/components/checklist-ui/pdf/PdfViewer.jsx';
import ChecklistReconciliation from './ChecklistReconciliation.jsx';
import Navbar from './Navbar.jsx';
import SplitScreenLayout from '@/components/checklist-ui/SplitScreenLayout.jsx';

export default function ReconciliationWithPdf(props) {
  // props.checklist1 - First reviewer's checklist data
  // props.checklist2 - Second reviewer's checklist data
  // props.reconciledChecklist - The reconciled checklist data (third checklist both reviewers edit)
  // props.reconciledChecklistId - ID of the reconciled checklist
  // props.onSaveReconciled - Callback when reconciled checklist is saved (receives reconciledName)
  // props.onCancel - Callback to cancel and go back
  // props.reviewer1Name - Display name for first reviewer
  // props.reviewer2Name - Display name for second reviewer
  // props.pdfData - ArrayBuffer of the study PDF (optional)
  // props.pdfFileName - Name of the PDF file (optional)
  // props.pdfUrl - URL for the PDF (optional, for server-hosted PDFs)
  // props.pdfLoading - Whether PDF is still loading
  // props.pdfs - Array of PDFs for multi-PDF selection
  // props.selectedPdfId - Currently selected PDF ID
  // props.onPdfSelect - Handler for PDF selection change
  // props.getQuestionNote - Function to get Y.Text for a question note (questionKey => Y.Text)
  // props.updateChecklistAnswer - Function to update a question answer (questionKey, questionData)

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
