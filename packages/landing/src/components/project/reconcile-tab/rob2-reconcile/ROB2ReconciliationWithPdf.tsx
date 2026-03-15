/**
 * ROB2ReconciliationWithPdf - Wrapper that combines ROB2Reconciliation with a PDF viewer
 * in a split-screen layout. The PDF is read-only during reconciliation.
 *
 * Includes presence features:
 * - Shows avatars of other users viewing the reconciliation
 * - Shows remote mouse cursors in real-time
 */

import { useState, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { ArrowLeftIcon } from 'lucide-react';
import { ROB2Reconciliation } from './ROB2Reconciliation';
import { ROB2Navbar } from './ROB2Navbar';
import { SplitScreenLayout } from '@/components/checklist/SplitScreenLayout';
import { useReconciliationPresence } from '@/hooks/useReconciliationPresence';
import { PresenceAvatars } from '../PresenceAvatars';
import { RemoteCursors } from '../RemoteCursors';
import type { PresenceUser } from '@/hooks/useReconciliationPresence';

const EmbedPdfViewer = lazy(() => import('@/components/pdf/EmbedPdfViewer'));

interface NavbarState {
  navItems: any[];
  viewMode: string;
  currentPage: number;
  comparison: any;
  finalAnswers: any;
  aimMismatch: boolean;
  expandedDomain: string | null;
  skippableQuestions: Set<string>;
  setViewMode: ((_mode: string) => void) | null;
  goToPage: ((_index: number) => void) | null;
  setExpandedDomain: ((_domain: string) => void) | null;
  onReset: (() => void) | null;
}

const INITIAL_NAVBAR_STATE: NavbarState = {
  navItems: [],
  viewMode: 'questions',
  currentPage: 0,
  comparison: null,
  finalAnswers: {},
  aimMismatch: false,
  expandedDomain: null,
  skippableQuestions: new Set(),
  setViewMode: null,
  goToPage: null,
  setExpandedDomain: null,
  onReset: null,
};

interface ROB2ReconciliationWithPdfProps {
  checklist1: any;
  checklist2: any;
  reconciledChecklist: any;
  reconciledChecklistId: string | null;
  onSaveReconciled: () => Promise<void>;
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
  updateChecklistAnswer: (_sectionKey: string, _data: any) => void;
  getRob2Text: ((..._args: any[]) => any) | null;
  getAwareness?: () => any;
  currentUser: PresenceUser | null;
  checklistType?: string;
}

export function ROB2ReconciliationWithPdf({
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
  updateChecklistAnswer,
  getRob2Text,
  getAwareness,
  currentUser,
  checklistType = 'ROB2',
}: ROB2ReconciliationWithPdfProps) {
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
          className="hover:bg-secondary shrink-0 rounded-lg p-2 transition-colors"
          title="Go back"
        >
          <ArrowLeftIcon className="text-muted-foreground h-5 w-5" />
        </button>

        {/* Title */}
        <div className="shrink-0">
          <h1 className="text-foreground text-lg font-bold">ROB-2 Reconciliation</h1>
          <p className="text-muted-foreground text-xs">
            {reviewer1Name || 'Reviewer 1'} vs {reviewer2Name || 'Reviewer 2'}
          </p>
        </div>

        <div className="bg-border h-8 w-px shrink-0" />

        {/* Presence avatars */}
        {presence.remoteUsers.length > 0 && (
          <>
            <PresenceAvatars
              users={presence.remoteUsers}
              onUserClick={(_userId: string, currentPage: number) => {
                navbarStore.goToPage?.(currentPage);
              }}
              getPageLabel={(pageIndex: number) => `Item ${pageIndex + 1}`}
            />
            <div className="bg-border h-8 w-px shrink-0" />
          </>
        )}

        {/* Navbar - navigation pills */}
        {navbarStore.navItems?.length > 0 && (
          <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
            <ROB2Navbar store={navbarStore} />
          </div>
        )}
      </>
    ),
    [onCancel, reviewer1Name, reviewer2Name, presence.remoteUsers, navbarStore],
  );

  return (
    <div className="flex h-full flex-col bg-blue-50">
      <SplitScreenLayout
        defaultLayout="vertical"
        defaultRatio={60}
        showSecondPanel={false}
        headerContent={headerContent}
        secondPanelLabel="PDF viewer"
        pdfUrl={pdfUrl}
        pdfData={pdfData}
      >
        {/* First panel: Reconciliation view with cursor tracking */}
        <div ref={containerRef} className="relative h-full overflow-auto" onScroll={handleScroll}>
          <RemoteCursors users={presence.usersWithCursors} containerScrollY={containerScrollY} />

          <ROB2Reconciliation
            checklist1={checklist1}
            checklist2={checklist2}
            reconciledChecklist={reconciledChecklist}
            reconciledChecklistId={reconciledChecklistId}
            reviewer1Name={reviewer1Name}
            reviewer2Name={reviewer2Name}
            onSaveReconciled={onSaveReconciled}
            onCancel={onCancel}
            setNavbarStore={setNavbarStore}
            updateChecklistAnswer={updateChecklistAnswer}
            getRob2Text={getRob2Text}
          />
        </div>

        {/* Second panel: PDF Viewer (read-only) */}
        {hasPdf && (
          <>
            {pdfLoading ? (
              <div className="bg-secondary flex h-full items-center justify-center">
                <div className="text-muted-foreground flex items-center gap-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
                  Loading PDF...
                </div>
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="bg-secondary flex h-full items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
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
            )}
          </>
        )}
      </SplitScreenLayout>
    </div>
  );
}
