/**
 * ReconciliationEngine - Unified shell for all checklist reconciliation types.
 *
 * Replaces the three *WithPdf.tsx wrappers. Owns: split-screen layout, PDF viewer,
 * presence tracking, remote cursors, header composition, save dialog, navigation
 * buttons. Delegates type-specific rendering to the adapter.
 */

import { useState, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { SplitScreenLayout } from '@/components/checklist/SplitScreenLayout';
import { useReconciliationPresence } from '@/hooks/useReconciliationPresence';
import { PresenceAvatars } from '../PresenceAvatars';
import { RemoteCursors } from '../RemoteCursors';
import { useReconciliationEngine } from './useReconciliationEngine';
import type { ReconciliationAdapter, ReconciliationEngineProps, EngineContext } from './types';

const EmbedPdfViewer = lazy(() => import('@/components/pdf/EmbedPdfViewer'));

// Adapter registry - adapters register themselves here via registerReconciliationAdapter
const adapterRegistry = new Map<string, ReconciliationAdapter>();

export function registerReconciliationAdapter(
  checklistType: string,
  adapter: ReconciliationAdapter,
) {
  adapterRegistry.set(checklistType, adapter);
}

function getReconciliationAdapter(checklistType: string): ReconciliationAdapter {
  const adapter = adapterRegistry.get(checklistType);
  if (!adapter) {
    throw new Error(
      `No reconciliation adapter registered for checklist type "${checklistType}". ` +
        `Registered types: ${[...adapterRegistry.keys()].join(', ') || '(none)'}`,
    );
  }
  return adapter;
}

export function ReconciliationEngine({
  checklistType,
  checklist1,
  checklist2,
  reconciledChecklist,
  reconciledChecklistId: _reconciledChecklistId,
  reviewer1Name,
  reviewer2Name,
  onSaveReconciled,
  onCancel,
  updateChecklistAnswer,
  getTextRef,
  setTextValue,
  pdfData,
  pdfFileName,
  pdfUrl,
  pdfLoading,
  pdfs,
  selectedPdfId,
  onPdfSelect,
  getAwareness,
  currentUser,
}: ReconciliationEngineProps) {
  const adapter = useMemo(() => getReconciliationAdapter(checklistType), [checklistType]);

  // -----------------------------------------------------------------------
  // Engine hook - owns all navigation, save, and derived state
  // -----------------------------------------------------------------------

  const engine = useReconciliationEngine({
    adapter,
    checklist1,
    checklist2,
    reconciledChecklist,
    updateChecklistAnswer,
    setTextValue,
    onSaveReconciled,
    checklist1Id: (checklist1 as any)?.id ?? null,
    checklist2Id: (checklist2 as any)?.id ?? null,
  });

  // -----------------------------------------------------------------------
  // Presence tracking
  // -----------------------------------------------------------------------

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerScrollY, setContainerScrollY] = useState(0);

  const stableGetAwareness = useMemo(
    () => (getAwareness ? () => getAwareness() : undefined),
    [getAwareness],
  );

  const presence = useReconciliationPresence({
    getAwareness: stableGetAwareness,
    getCurrentPage: engine.currentPage,
    checklistType: adapter.checklistType,
    currentUser,
    containerRef,
  });

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setContainerScrollY((event.target as HTMLDivElement).scrollTop);
  }, []);

  // -----------------------------------------------------------------------
  // Build EngineContext for renderPage
  // -----------------------------------------------------------------------

  const engineContext: EngineContext | null = useMemo(() => {
    if (!engine.currentItem) return null;
    return {
      currentItem: engine.currentItem,
      navItems: engine.navItems,
      checklist1,
      checklist2,
      finalAnswers: engine.finalAnswers,
      comparison: engine.comparison,
      reviewer1Name,
      reviewer2Name,
      isAgreement: engine.currentIsAgreement,
      updateChecklistAnswer,
      getTextRef,
      setTextValue,
    };
  }, [
    engine.currentItem,
    engine.navItems,
    checklist1,
    checklist2,
    engine.finalAnswers,
    engine.comparison,
    reviewer1Name,
    reviewer2Name,
    engine.currentIsAgreement,
    updateChecklistAnswer,
    getTextRef,
    setTextValue,
  ]);

  // -----------------------------------------------------------------------
  // Header content (memoized)
  // -----------------------------------------------------------------------

  const NavbarComponent = adapter.NavbarComponent;

  const headerContent = (
    <>
      {/* Back button */}
      <button
        onClick={onCancel}
        className='hover:bg-secondary shrink-0 rounded-lg p-2 transition-colors'
        title='Go back'
      >
        <ArrowLeftIcon className='text-muted-foreground size-5' />
      </button>

      {/* Title */}
      <div className='shrink-0'>
        <h1 className='text-foreground text-lg font-bold'>{adapter.title}</h1>
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
            onUserClick={(_userId, page) => {
              engine.goToPage(page);
            }}
            getPageLabel={pageIndex => adapter.getPageLabel(pageIndex)}
          />
          <div className='bg-border h-8 w-px shrink-0' />
        </>
      )}

      {/* Navbar */}
      {engine.navItems.length > 0 && (
        <div className='flex min-w-0 flex-1 items-center overflow-x-auto'>
          <NavbarComponent
            navItems={engine.navItems}
            currentPage={engine.currentPage}
            viewMode={engine.viewMode}
            finalAnswers={engine.finalAnswers}
            comparison={engine.comparison}
            usersByPage={presence.usersByPage}
            goToPage={engine.goToPage}
            setViewMode={engine.setViewMode}
            onReset={engine.handleReset}
            expandedDomain={engine.expandedDomain}
            setExpandedDomain={engine.setExpandedDomain}
          />
        </div>
      )}
    </>
  );

  // -----------------------------------------------------------------------
  // PDF state
  // -----------------------------------------------------------------------

  const hasPdf = !!(pdfData || pdfLoading);

  // -----------------------------------------------------------------------
  // Summary component
  // -----------------------------------------------------------------------

  const SummaryComponent = adapter.SummaryComponent;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className='flex h-full flex-col bg-blue-50'>
      {/* Save confirmation dialog */}
      <AlertDialog open={engine.finishDialogOpen} onOpenChange={engine.setFinishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finish reconciliation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the reconciled checklist as completed. You will no longer be able to
              edit these reconciliation answers afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant='outline'
              onClick={() => engine.setFinishDialogOpen(false)}
              disabled={engine.saving}
            >
              Cancel
            </Button>
            <AlertDialogAction disabled={engine.saving} onClick={engine.confirmSave}>
              {engine.saving ? 'Saving...' : 'Finish'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

          <div className='mx-auto max-w-7xl px-4 py-4'>
            {/* Warning banner (adapter-specific: aim mismatch, critical risk) */}
            {adapter.renderWarningBanner?.(checklist1, checklist2, reconciledChecklist)}

            {/* Question/item pages */}
            {engine.viewMode === 'questions' && (
              <>
                {engineContext ?
                  <>
                    {adapter.renderPage(engineContext)}

                    {/* Navigation buttons */}
                    <div className='mt-4 flex items-center justify-between'>
                      <button
                        onClick={engine.goToPrevious}
                        disabled={engine.currentPage === 0}
                        className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
                          engine.currentPage === 0 ?
                            'bg-secondary text-muted-foreground/70 cursor-not-allowed'
                          : 'bg-card text-secondary-foreground hover:bg-secondary shadow'
                        }`}
                      >
                        <ArrowLeftIcon className='size-4' />
                        Previous
                      </button>

                      <div className='text-muted-foreground text-sm'>
                        {adapter.pageCounterLabel} {engine.currentPage + 1} of{' '}
                        {engine.navItems.length}
                      </div>

                      <button
                        onClick={engine.goToNext}
                        className='flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow transition-colors hover:bg-blue-700'
                      >
                        {engine.currentPage === engine.navItems.length - 1 ?
                          'Review Summary'
                        : 'Next'}
                        <ArrowRightIcon className='size-4' />
                      </button>
                    </div>
                  </>
                : <div className='py-12 text-center'>Loading...</div>}
              </>
            )}

            {/* Summary view */}
            {engine.viewMode === 'summary' && (
              <SummaryComponent
                navItems={engine.navItems}
                finalAnswers={engine.finalAnswers}
                comparison={engine.comparison}
                summaryStats={engine.summaryStats}
                allAnswered={engine.allAnswered}
                saving={engine.saving}
                onGoToPage={engine.goToPage}
                onSave={engine.handleSave}
                onBack={engine.goToPrevious}
                reconciledName={engine.reconciledName}
                onReconciledNameChange={engine.setReconciledName}
              />
            )}
          </div>
        </div>

        {/* Second panel: PDF Viewer (read-only) */}
        {hasPdf && (
          <>
            {pdfLoading ?
              <div className='bg-secondary flex h-full items-center justify-center'>
                <div className='text-muted-foreground flex items-center gap-3'>
                  <div className='size-6 animate-spin rounded-full border-b-2 border-blue-600' />
                  Loading PDF...
                </div>
              </div>
            : <Suspense
                fallback={
                  <div className='bg-secondary flex h-full items-center justify-center'>
                    <div className='size-6 animate-spin rounded-full border-b-2 border-blue-600' />
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
