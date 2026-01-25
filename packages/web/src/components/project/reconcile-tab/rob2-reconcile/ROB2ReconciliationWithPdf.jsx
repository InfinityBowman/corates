/**
 * ROB2ReconciliationWithPdf - Wrapper that combines ROB2Reconciliation with a PDF viewer
 * in a split-screen layout. The PDF is read-only during reconciliation.
 *
 * Includes presence features:
 * - Shows avatars of other users viewing the reconciliation
 * - Shows remote mouse cursors in real-time
 */

import { Show, createMemo, createSignal, lazy, Suspense } from 'solid-js';
import { createStore } from 'solid-js/store';
import { FiArrowLeft } from 'solid-icons/fi';
import ROB2Reconciliation from './ROB2Reconciliation.jsx';
import ROB2Navbar from './ROB2Navbar.jsx';
import SplitScreenLayout from '@/components/checklist/SplitScreenLayout.jsx';
import { useReconciliationPresence } from '@primitives/useReconciliationPresence.js';
import PresenceAvatars from '../PresenceAvatars.jsx';
import RemoteCursors from '../RemoteCursors.jsx';

const EmbedPdfViewer = lazy(() => import('@pdf/embedpdf/EmbedPdfViewer.jsx'));

/**
 * ROB2ReconciliationWithPdf - Wrapper that combines ROB2Reconciliation with a PDF viewer
 * in a split-screen layout. The PDF is read-only during reconciliation.
 *
 * @param {Object} props
 * @param {Object} props.checklist1 - First reviewer's checklist data
 * @param {Object} props.checklist2 - Second reviewer's checklist data
 * @param {Object} props.reconciledChecklist - The reconciled checklist data
 * @param {string} props.reconciledChecklistId - ID of the reconciled checklist
 * @param {Function} props.onSaveReconciled - Callback when reconciled checklist is saved
 * @param {Function} props.onCancel - Callback to cancel and go back
 * @param {string} props.reviewer1Name - Display name for first reviewer
 * @param {string} props.reviewer2Name - Display name for second reviewer
 * @param {ArrayBuffer} props.pdfData - ArrayBuffer of the study PDF (optional)
 * @param {string} props.pdfFileName - Name of the PDF file (optional)
 * @param {string} props.pdfUrl - URL for opening PDF in new tab
 * @param {boolean} props.pdfLoading - Whether PDF is still loading
 * @param {Array} props.pdfs - Array of PDFs for multi-PDF selection
 * @param {string} props.selectedPdfId - Currently selected PDF ID
 * @param {Function} props.onPdfSelect - Handler for PDF selection change
 * @param {Function} props.updateChecklistAnswer - Function to update answer
 * @param {Function} props.getRob2Text - Function to get Y.Text for comments (domainKey, questionKey) => Y.Text
 * @param {Function} props.getAwareness - Function to get Yjs awareness instance
 * @param {Function} props.currentUser - Reactive getter for current user { id, name, image }
 * @param {string} [props.checklistType='ROB2'] - Checklist type for presence filtering
 * @returns {JSX.Element}
 */
export default function ROB2ReconciliationWithPdf(props) {
  // Container ref for mouse cursor tracking
  let containerRef;
  const [containerScrollY, setContainerScrollY] = createSignal(0);

  // Navbar store for deep reactivity - ROB2Reconciliation will update this
  const [navbarStore, setNavbarStore] = createStore({
    navItems: [],
    viewMode: 'questions',
    currentPage: 0,
    comparison: null,
    finalAnswers: {},
    aimMismatch: false,
    expandedDomain: null,
    setViewMode: null,
    goToPage: null,
    setExpandedDomain: null,
    onReset: null,
  });

  // Presence tracking
  const presence = useReconciliationPresence({
    getAwareness: () => props.getAwareness?.(),
    getCurrentPage: () => navbarStore.currentPage,
    checklistType: () => props.checklistType || 'ROB2',
    currentUser: () => props.currentUser?.(),
    containerRef: () => containerRef,
  });

  // Handle scroll updates for cursor position adjustment
  function handleScroll(event) {
    setContainerScrollY(event.target.scrollTop);
  }

  // Check if we have PDF to show (reactive)
  const hasPdf = createMemo(() => !!(props.pdfData || props.pdfLoading));

  // Build header content with back button, title, and navbar
  const headerContent = (
    <>
      {/* Back button */}
      <button
        onClick={() => props.onCancel?.()}
        class='hover:bg-secondary shrink-0 rounded-lg p-2 transition-colors'
        title='Go back'
      >
        <FiArrowLeft class='text-muted-foreground h-5 w-5' />
      </button>

      {/* Title */}
      <div class='shrink-0'>
        <h1 class='text-foreground text-lg font-bold'>ROB-2 Reconciliation</h1>
        <p class='text-muted-foreground text-xs'>
          {props.reviewer1Name || 'Reviewer 1'} vs {props.reviewer2Name || 'Reviewer 2'}
        </p>
      </div>

      <div class='bg-border h-8 w-px shrink-0' />

      {/* Presence avatars - show other users viewing this reconciliation */}
      <Show when={presence.remoteUsers().length > 0}>
        <PresenceAvatars
          users={presence.remoteUsers()}
          onUserClick={(userId, currentPage) => {
            navbarStore.goToPage?.(currentPage);
          }}
          getPageLabel={pageIndex => `Item ${pageIndex + 1}`}
        />
        <div class='bg-border h-8 w-px shrink-0' />
      </Show>

      {/* Navbar - navigation pills */}
      <Show when={navbarStore.navItems?.length > 0}>
        <div class='flex min-w-0 flex-1 items-center overflow-x-auto'>
          <ROB2Navbar store={navbarStore} />
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
        {/* First panel: Reconciliation view with cursor tracking */}
        <div ref={containerRef} class='relative h-full overflow-auto' onScroll={handleScroll}>
          {/* Remote cursors overlay */}
          <RemoteCursors
            users={presence.usersWithCursors()}
            containerScrollY={containerScrollY()}
          />

          <ROB2Reconciliation
            checklist1={props.checklist1}
            checklist2={props.checklist2}
            reconciledChecklist={props.reconciledChecklist}
            reconciledChecklistId={props.reconciledChecklistId}
            reviewer1Name={props.reviewer1Name}
            reviewer2Name={props.reviewer2Name}
            onSaveReconciled={props.onSaveReconciled}
            onCancel={props.onCancel}
            setNavbarStore={setNavbarStore}
            updateChecklistAnswer={props.updateChecklistAnswer}
            getRob2Text={props.getRob2Text}
          />
        </div>

        {/* Second panel: PDF Viewer (read-only) - only rendered when PDF exists */}
        <Show when={hasPdf}>
          <Show
            when={!props.pdfLoading}
            fallback={
              <div class='bg-secondary flex h-full items-center justify-center'>
                <div class='text-muted-foreground flex items-center gap-3'>
                  <div class='h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600' />
                  Loading PDF...
                </div>
              </div>
            }
          >
            <Suspense
              fallback={
                <div class='bg-secondary flex h-full items-center justify-center'>
                  <div class='h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600' />
                </div>
              }
            >
              <EmbedPdfViewer
                pdfData={props.pdfData}
                pdfFileName={props.pdfFileName}
                readOnly={true}
                pdfs={props.pdfs}
                selectedPdfId={props.selectedPdfId}
                onPdfSelect={props.onPdfSelect}
              />
            </Suspense>
          </Show>
        </Show>
      </SplitScreenLayout>
    </div>
  );
}
