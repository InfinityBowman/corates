/**
 * ReconciliationWithPdf - Wrapper that combines AMSTAR2 ChecklistReconciliation with a PDF
 * viewer in a split-screen layout. The PDF is read-only during reconciliation.
 *
 * Includes presence features:
 * - Shows avatars of other users viewing the reconciliation
 * - Shows colored rings on question pills indicating viewer positions
 * - Shows remote mouse cursors in real-time
 */

import { useState, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { ArrowLeftIcon } from 'lucide-react';
import { ChecklistReconciliation } from './ChecklistReconciliation';
import { Navbar } from './Navbar';
import { SplitScreenLayout } from '@/components/checklist/SplitScreenLayout';
import { useReconciliationPresence } from '@/hooks/useReconciliationPresence';
import { PresenceAvatars } from '../PresenceAvatars';
import { RemoteCursors } from '../RemoteCursors';
import type { PresenceUser } from '@/hooks/useReconciliationPresence';

const EmbedPdfViewer = lazy(() => import('@/components/pdf/EmbedPdfViewer'));

interface NavbarState {
  questionKeys: string[];
  viewMode: string;
  currentPage: number;
  comparisonByQuestion: Record<string, any>;
  finalAnswers: Record<string, any>;
  summary: any;
  reviewedCount: number;
  totalPages: number;
  setViewMode: ((_mode: string) => void) | null;
  goToQuestion: ((_index: number) => void) | null;
  onReset: (() => void) | null;
}

const INITIAL_NAVBAR_STATE: NavbarState = {
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
};

interface ReconciliationWithPdfProps {
  checklist1: any;
  checklist2: any;
  reconciledChecklist: any;
  reconciledChecklistId: string | null;
  onSaveReconciled: (_name?: string) => void;
  onCancel: () => void;
  reviewer1Name: string;
  reviewer2Name: string;
  pdfData: ArrayBuffer | null;
  pdfFileName: string | null;
  pdfUrl: string | null;
  pdfLoading: boolean;
  pdfs: any[];
  selectedPdfId: string | null;
  onPdfSelect: (_pdfId: string) => void;
  getQuestionNote: (_questionKey: string) => any;
  updateChecklistAnswer: (_questionKey: string, _questionData: any) => void;
  getAwareness?: () => any;
  currentUser: PresenceUser | null;
  checklistType?: string;
}

export function ReconciliationWithPdf({
  checklist1,
  checklist2,
  reconciledChecklist,
  reconciledChecklistId,
  onSaveReconciled,
  onCancel,
  reviewer1Name,
  reviewer2Name,
  pdfData,
  pdfFileName,
  pdfUrl,
  pdfLoading,
  pdfs,
  selectedPdfId,
  onPdfSelect,
  getQuestionNote,
  updateChecklistAnswer,
  getAwareness,
  currentUser,
  checklistType = 'AMSTAR2',
}: ReconciliationWithPdfProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerScrollY, setContainerScrollY] = useState(0);
  const [navbarStore, setNavbarStore] = useState<NavbarState>(INITIAL_NAVBAR_STATE);

  // Stable reference for getAwareness to avoid re-running presence effects on every render
  const stableGetAwareness = useMemo(
    () => (getAwareness ? () => getAwareness() : undefined),
    [getAwareness],
  );

  // Presence tracking
  const presence = useReconciliationPresence({
    getAwareness: stableGetAwareness,
    getCurrentPage: navbarStore.currentPage,
    checklistType,
    currentUser,
    containerRef,
  });

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setContainerScrollY((event.target as HTMLDivElement).scrollTop);
  }, []);

  const hasPdf = !!(pdfData || pdfLoading);

  const headerContent = useMemo(
    () => (
      <>
        {/* Back button */}
        <button
          onClick={onCancel}
          className='hover:bg-secondary shrink-0 rounded-lg p-2 transition-colors'
          title='Go back'
        >
          <ArrowLeftIcon className='text-muted-foreground h-5 w-5' />
        </button>

        {/* Title */}
        <div className='shrink-0'>
          <h1 className='text-foreground text-lg font-bold'>Reconciliation</h1>
          <p className='text-muted-foreground text-xs'>
            {reviewer1Name || 'Reviewer 1'} vs {reviewer2Name || 'Reviewer 2'}
          </p>
        </div>

        <div className='bg-border h-8 w-px shrink-0' />

        {/* Presence avatars */}
        {presence.remoteUsers.length > 0 && (
          <>
            <PresenceAvatars
              users={presence.remoteUsers}
              onUserClick={(_userId, currentPage) => {
                navbarStore.goToQuestion?.(currentPage);
              }}
              getPageLabel={pageIndex => `Question ${pageIndex + 1}`}
            />
            <div className='bg-border h-8 w-px shrink-0' />
          </>
        )}

        {/* Navbar */}
        {navbarStore.questionKeys.length > 0 && (
          <div className='flex flex-1 items-center gap-4 overflow-x-auto'>
            <Navbar store={navbarStore} usersByPage={presence.usersByPage} />
          </div>
        )}
      </>
    ),
    [
      onCancel,
      reviewer1Name,
      reviewer2Name,
      presence.remoteUsers,
      presence.usersByPage,
      navbarStore,
    ],
  );

  return (
    <div className='flex h-full flex-col bg-blue-50'>
      <SplitScreenLayout
        defaultLayout='vertical'
        defaultRatio={60}
        showSecondPanel={false}
        headerContent={headerContent}
        secondPanelLabel='PDF viewer'
        pdfUrl={pdfUrl}
        pdfData={pdfData}
      >
        {/* First panel: Reconciliation view with cursor tracking */}
        <div ref={containerRef} className='relative h-full overflow-auto' onScroll={handleScroll}>
          <RemoteCursors users={presence.usersWithCursors} containerScrollY={containerScrollY} />

          <ChecklistReconciliation
            checklist1={checklist1}
            checklist2={checklist2}
            reconciledChecklist={reconciledChecklist}
            reconciledChecklistId={reconciledChecklistId}
            reviewer1Name={reviewer1Name}
            reviewer2Name={reviewer2Name}
            onSaveReconciled={onSaveReconciled}
            onCancel={onCancel}
            setNavbarStore={setNavbarStore}
            getQuestionNote={getQuestionNote}
            updateChecklistAnswer={updateChecklistAnswer}
          />
        </div>

        {/* Second panel: PDF Viewer (read-only) */}
        {hasPdf && (
          <>
            {pdfLoading ?
              <div className='bg-secondary flex h-full items-center justify-center'>
                <div className='text-muted-foreground flex items-center gap-3'>
                  <div className='h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600' />
                  Loading PDF...
                </div>
              </div>
            : <Suspense
                fallback={
                  <div className='bg-secondary flex h-full items-center justify-center'>
                    <div className='h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600' />
                  </div>
                }
              >
                <EmbedPdfViewer
                  pdfData={pdfData}
                  pdfFileName={pdfFileName ?? undefined}
                  readOnly={true}
                  pdfs={pdfs}
                  selectedPdfId={selectedPdfId}
                  onPdfSelect={onPdfSelect}
                />
              </Suspense>
            }
          </>
        )}
      </SplitScreenLayout>
    </div>
  );
}
