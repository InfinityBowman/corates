/**
 * RobinsIReconciliation - Main view for comparing and reconciling two ROBINS-I checklists
 * Shows one item per page with navigation through Section B, Domains, and Overall
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { showToast } from '@/components/ui/toast';
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
import {
  compareChecklists,
  getSectionBKeys,
  getDomainKeysForComparison,
} from '@/components/checklist/ROBINSIChecklist/checklist-compare.js';
import {
  buildNavigationItems,
  hasNavItemAnswer,
  isNavItemAgreement,
  getAnsweredCount,
  isSectionBCritical,
  getSectionKeyForPage,
  NAV_ITEM_TYPES,
} from './navbar-utils.js';
import { SectionBQuestionPage } from './pages/SectionBQuestionPage';
import { DomainQuestionPage } from './pages/DomainQuestionPage';
import { DomainJudgementPage } from './pages/DomainJudgementPage';
import { OverallJudgementPage } from './pages/OverallJudgementPage';
import { RobinsISummaryView } from './RobinsISummaryView';

interface NavbarState {
  navItems: any[];
  viewMode: string;
  currentPage: number;
  comparison: any;
  finalAnswers: any;
  sectionBCritical: boolean;
  expandedDomain: string | null;
  setViewMode: ((_mode: string) => void) | null;
  goToPage: ((_index: number) => void) | null;
  setExpandedDomain: ((_domain: string | null) => void) | null;
  onReset: (() => void) | null;
}

interface RobinsIReconciliationProps {
  checklist1: any;
  checklist2: any;
  reconciledChecklist: any;
  reconciledChecklistId?: string | null;
  onSaveReconciled?: () => void;
  onCancel?: () => void;
  reviewer1Name: string;
  reviewer2Name: string;
  setNavbarStore: (_state: NavbarState) => void;
  updateChecklistAnswer?: (_sectionKey: string, _data: any) => void;
  getRobinsText?: (_sectionKey: string, _fieldKey: string, _questionKey: string) => any;
}

/**
 * Copy comment text to Y.Text
 */
function copyCommentToYText(
  getRobinsText: RobinsIReconciliationProps['getRobinsText'],
  sectionKey: string,
  fieldKey: string,
  questionKey: string,
  commentText: string | null | undefined,
) {
  if (!getRobinsText) return;
  const yText = getRobinsText(sectionKey, fieldKey, questionKey);
  if (!yText) return;
  const text = (commentText || '').slice(0, 2000);
  yText.doc.transact(() => {
    yText.delete(0, yText.length);
    yText.insert(0, text);
  });
}

export function RobinsIReconciliation({
  checklist1,
  checklist2,
  reconciledChecklist,
  onSaveReconciled,
  reviewer1Name,
  reviewer2Name,
  setNavbarStore,
  updateChecklistAnswer,
  getRobinsText,
}: RobinsIReconciliationProps) {
  const [saving, setSaving] = useState(false);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);

  // Navigation state (localStorage-backed)
  const getStorageKey = useCallback(() => {
    if (!checklist1?.id || !checklist2?.id) return null;
    return `robins-reconciliation-nav-${checklist1.id}-${checklist2.id}`;
  }, [checklist1?.id, checklist2?.id]);

  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState('questions');
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  // Initialize navigation state from localStorage on mount
  useEffect(() => {
    const key = getStorageKey();
    if (!key) return;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCurrentPage(parsed.currentPage ?? 0);
        setViewMode(parsed.viewMode ?? 'questions');
      }
    } catch (e) {
      console.error('Failed to load navigation state:', e);
    }
  }, [getStorageKey]);

  // Save navigation state when it changes
  useEffect(() => {
    const key = getStorageKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify({ currentPage, viewMode }));
    } catch (e) {
      console.error('Failed to save navigation state:', e);
    }
  }, [currentPage, viewMode, getStorageKey]);

  // Determine protocol type from checklist (for Domain 1A vs 1B)
  const isPerProtocol = useMemo(
    () => checklist1?.sectionC?.isPerProtocol || false,
    [checklist1],
  );

  // Build navigation items based on protocol type
  const navItems = useMemo(() => buildNavigationItems(isPerProtocol), [isPerProtocol]);
  const totalPages = navItems.length;

  // Compare the two checklists
  const comparison = useMemo(() => {
    if (!checklist1 || !checklist2) return null;
    return compareChecklists(checklist1, checklist2);
  }, [checklist1, checklist2]);

  // Check if Section B indicates critical risk
  const sectionBCritical = useMemo(() => {
    const critical1 = isSectionBCritical(checklist1?.sectionB);
    const critical2 = isSectionBCritical(checklist2?.sectionB);
    return critical1 || critical2;
  }, [checklist1, checklist2]);

  // Get final answers from reconciled checklist (reactive)
  const finalAnswers = useMemo(
    () => reconciledChecklist || {},
    [reconciledChecklist],
  );

  // Auto-expand domain based on current page
  useEffect(() => {
    if (navItems.length > 0 && expandedDomain === null) {
      const sectionKey = getSectionKeyForPage(navItems, currentPage);
      if (sectionKey) {
        setExpandedDomain(sectionKey);
      }
    }
  }, [navItems, currentPage, expandedDomain]);

  // Navigation function for going to a specific page
  const goToPage = useCallback((index: number) => {
    setCurrentPage(index);
    setViewMode('questions');
    // Auto-expand the domain containing this page
    const sectionKey = getSectionKeyForPage(navItems, index);
    if (sectionKey) {
      setExpandedDomain(sectionKey);
    }
  }, [navItems]);

  // Reset all reconciliation answers
  const handleReset = useCallback(() => {
    if (!updateChecklistAnswer) return;

    const sectionBKeys = getSectionBKeys();
    const emptySectionB: Record<string, any> = {};
    sectionBKeys.forEach((key: string) => {
      emptySectionB[key] = { answer: null, comment: '' };
    });
    updateChecklistAnswer('sectionB', emptySectionB);

    const activeDomains = getDomainKeysForComparison(isPerProtocol);
    for (const domainKey of activeDomains) {
      updateChecklistAnswer(domainKey, {
        answers: {},
        judgement: null,
        direction: null,
      });
    }

    updateChecklistAnswer('overall', {
      judgement: null,
      direction: null,
    });

    setCurrentPage(0);
    setViewMode('questions');
    showToast.info('Reconciliation Reset', 'All reconciliations have been cleared.');
  }, [updateChecklistAnswer, isPerProtocol]);

  // Expose navbar props for external rendering via store
  useEffect(() => {
    setNavbarStore({
      navItems,
      viewMode,
      currentPage,
      comparison,
      finalAnswers,
      sectionBCritical,
      expandedDomain,
      setViewMode,
      goToPage,
      setExpandedDomain,
      onReset: handleReset,
    });
  }, [
    navItems,
    viewMode,
    currentPage,
    comparison,
    finalAnswers,
    sectionBCritical,
    expandedDomain,
    setNavbarStore,
    goToPage,
    handleReset,
  ]);

  // Current navigation item
  const currentNavItem = navItems[currentPage];

  // Update functions - only send the changed field to avoid overwriting Y.Text objects
  function updateSectionBAnswer(key: string, answer: string) {
    if (!updateChecklistAnswer) return;
    updateChecklistAnswer('sectionB', {
      [key]: { answer },
    });
  }

  function updateDomainQuestionAnswer(domainKey: string, questionKey: string, answer: string) {
    if (!updateChecklistAnswer) return;
    updateChecklistAnswer(domainKey, {
      answers: { [questionKey]: { answer } },
    });
  }

  function updateDomainJudgement(
    domainKey: string,
    judgement: string | null | undefined,
    direction: string | null | undefined,
  ) {
    if (!updateChecklistAnswer) return;
    updateChecklistAnswer(domainKey, {
      judgement,
      direction: direction || null,
    });
  }

  function updateOverallJudgement(
    judgement: string | null | undefined,
    direction: string | null | undefined,
  ) {
    if (!updateChecklistAnswer) return;
    updateChecklistAnswer('overall', {
      judgement,
      direction: direction || null,
    });
  }

  // Auto-fill final answer from reviewer 1
  function autoFillFromReviewer1(item: any) {
    if (!updateChecklistAnswer) return;

    if (item.type === NAV_ITEM_TYPES.SECTION_B) {
      const answer = checklist1?.sectionB?.[item.key];
      if (answer) {
        updateSectionBAnswer(item.key, answer.answer);
        copyCommentToYText(getRobinsText, 'sectionB', 'comment', item.key, answer.comment);
      }
    } else if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
      const answer = checklist1?.[item.domainKey]?.answers?.[item.key];
      if (answer) {
        updateDomainQuestionAnswer(item.domainKey, item.key, answer.answer);
        copyCommentToYText(getRobinsText, item.domainKey, 'comment', item.key, answer.comment);
      }
    } else if (item.type === NAV_ITEM_TYPES.DOMAIN_JUDGEMENT) {
      const domain = checklist1?.[item.domainKey];
      if (domain?.judgement) {
        updateDomainJudgement(item.domainKey, domain.judgement, domain.direction);
      }
    } else if (item.type === NAV_ITEM_TYPES.OVERALL_JUDGEMENT) {
      const overall = checklist1?.overall;
      if (overall?.judgement) {
        updateOverallJudgement(overall.judgement, overall.direction);
      }
    }
  }

  // Navigation functions
  function goToNext() {
    const item = currentNavItem;

    // Auto-fill from reviewer1 if no final answer yet and reviewers agree
    if (
      item &&
      !hasNavItemAnswer(item, finalAnswers) &&
      isNavItemAgreement(item, comparison as any)
    ) {
      autoFillFromReviewer1(item);
    }

    if (currentPage < totalPages - 1) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);

      const sectionKey = getSectionKeyForPage(navItems, nextPage);
      if (sectionKey && sectionKey !== expandedDomain) {
        setExpandedDomain(sectionKey);
      }
    } else {
      setViewMode('summary');
    }
  }

  function goToPrevious() {
    if (viewMode === 'summary') {
      setViewMode('questions');
      return;
    }
    if (currentPage > 0) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);

      const sectionKey = getSectionKeyForPage(navItems, prevPage);
      if (sectionKey && sectionKey !== expandedDomain) {
        setExpandedDomain(sectionKey);
      }
    }
  }

  // Check if all items have been answered
  const allAnswered = useMemo(
    () => navItems.every(item => hasNavItemAnswer(item, finalAnswers)),
    [navItems, finalAnswers],
  );

  // Summary stats for summary view
  const summaryStats = useMemo(() => {
    const total = navItems.length;
    const agreed = navItems.filter(item => isNavItemAgreement(item, comparison as any)).length;
    const answered = getAnsweredCount(navItems, finalAnswers);

    return {
      total,
      agreed,
      disagreed: total - agreed,
      agreementPercentage: total > 0 ? Math.round((agreed / total) * 100) : 0,
      answered,
    };
  }, [navItems, comparison, finalAnswers]);

  // Handle save - opens confirmation dialog
  function handleSave() {
    if (!allAnswered) {
      showToast.error('Incomplete Review', 'Please review all items before saving.');
      return;
    }
    setFinishDialogOpen(true);
  }

  // Execute save after confirmation
  async function confirmSave() {
    setSaving(true);
    try {
      await onSaveReconciled?.();
      setFinishDialogOpen(false);
    } catch (err) {
      console.error('Error saving reconciled checklist:', err);
      showToast.error('Save Failed', 'Failed to save reconciled checklist. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Get current item's comparison data
  function getCurrentItemComparison() {
    const item = currentNavItem;
    if (!item || !comparison) return null;
    const comp = comparison as Record<string, any>;

    if (item.type === NAV_ITEM_TYPES.SECTION_B) {
      const allItems = [
        ...(comp.sectionB?.agreements || []),
        ...(comp.sectionB?.disagreements || []),
      ];
      return allItems.find((c: any) => c.key === item.key);
    }
    if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
      const domain = comp.domains?.[item.domainKey];
      if (!domain) return null;
      const allItems = [
        ...(domain.questions?.agreements || []),
        ...(domain.questions?.disagreements || []),
      ];
      return allItems.find((c: any) => c.key === item.key);
    }
    if (item.type === NAV_ITEM_TYPES.DOMAIN_JUDGEMENT) {
      return comp.domains?.[item.domainKey];
    }
    if (item.type === NAV_ITEM_TYPES.OVERALL_JUDGEMENT) {
      return comp.overall;
    }
    return null;
  }

  const currentItemComparison = getCurrentItemComparison();

  return (
    <div className="bg-blue-50">
      <div className="mx-auto max-w-7xl px-4 py-4">
        {/* Finish confirmation dialog */}
        <AlertDialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finish reconciliation?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the reconciled checklist as completed. You will no longer be able
                to edit these reconciliation answers afterwards.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setFinishDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <AlertDialogAction disabled={saving} onClick={confirmSave}>
                {saving ? 'Saving...' : 'Finish'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Critical Risk Warning Banner */}
        {sectionBCritical && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangleIcon className="h-5 w-5 shrink-0" />
            <div>
              <span className="font-medium">Critical Risk Detected:</span> Section B indicates this
              study may be at critical risk of bias. Consider whether to proceed with full domain
              assessment.
            </div>
          </div>
        )}

        {/* Main Content */}
        {viewMode === 'questions' && (
          <>
            {currentNavItem ? (
              <>
                {/* Section B Question */}
                {currentNavItem.type === NAV_ITEM_TYPES.SECTION_B && (
                  <SectionBQuestionPage
                    questionKey={currentNavItem.key}
                    reviewer1Data={checklist1?.sectionB?.[currentNavItem.key]}
                    reviewer2Data={checklist2?.sectionB?.[currentNavItem.key]}
                    finalData={finalAnswers.sectionB?.[currentNavItem.key]}
                    finalCommentYText={getRobinsText?.(
                      'sectionB',
                      'comment',
                      currentNavItem.key,
                    )}
                    reviewer1Name={reviewer1Name || 'Reviewer 1'}
                    reviewer2Name={reviewer2Name || 'Reviewer 2'}
                    isAgreement={isNavItemAgreement(currentNavItem, comparison as any)}
                    onFinalAnswerChange={answer =>
                      updateSectionBAnswer(currentNavItem.key, answer)
                    }
                    onUseReviewer1={() => {
                      const data = checklist1?.sectionB?.[currentNavItem.key];
                      if (data) {
                        updateSectionBAnswer(currentNavItem.key, data.answer);
                        copyCommentToYText(
                          getRobinsText,
                          'sectionB',
                          'comment',
                          currentNavItem.key,
                          data.comment,
                        );
                      }
                    }}
                    onUseReviewer2={() => {
                      const data = checklist2?.sectionB?.[currentNavItem.key];
                      if (data) {
                        updateSectionBAnswer(currentNavItem.key, data.answer);
                        copyCommentToYText(
                          getRobinsText,
                          'sectionB',
                          'comment',
                          currentNavItem.key,
                          data.comment,
                        );
                      }
                    }}
                  />
                )}

                {/* Domain Question */}
                {currentNavItem.type === NAV_ITEM_TYPES.DOMAIN_QUESTION && (
                  <DomainQuestionPage
                    domainKey={currentNavItem.domainKey}
                    questionKey={currentNavItem.key}
                    reviewer1Data={
                      checklist1?.[currentNavItem.domainKey]?.answers?.[currentNavItem.key]
                    }
                    reviewer2Data={
                      checklist2?.[currentNavItem.domainKey]?.answers?.[currentNavItem.key]
                    }
                    finalData={
                      finalAnswers[currentNavItem.domainKey]?.answers?.[currentNavItem.key]
                    }
                    finalCommentYText={getRobinsText?.(
                      currentNavItem.domainKey,
                      'comment',
                      currentNavItem.key,
                    )}
                    reviewer1Name={reviewer1Name || 'Reviewer 1'}
                    reviewer2Name={reviewer2Name || 'Reviewer 2'}
                    isAgreement={isNavItemAgreement(currentNavItem, comparison as any)}
                    onFinalAnswerChange={answer =>
                      updateDomainQuestionAnswer(
                        currentNavItem.domainKey,
                        currentNavItem.key,
                        answer,
                      )
                    }
                    onUseReviewer1={() => {
                      const data =
                        checklist1?.[currentNavItem.domainKey]?.answers?.[currentNavItem.key];
                      if (data) {
                        updateDomainQuestionAnswer(
                          currentNavItem.domainKey,
                          currentNavItem.key,
                          data.answer,
                        );
                        copyCommentToYText(
                          getRobinsText,
                          currentNavItem.domainKey,
                          'comment',
                          currentNavItem.key,
                          data.comment,
                        );
                      }
                    }}
                    onUseReviewer2={() => {
                      const data =
                        checklist2?.[currentNavItem.domainKey]?.answers?.[currentNavItem.key];
                      if (data) {
                        updateDomainQuestionAnswer(
                          currentNavItem.domainKey,
                          currentNavItem.key,
                          data.answer,
                        );
                        copyCommentToYText(
                          getRobinsText,
                          currentNavItem.domainKey,
                          'comment',
                          currentNavItem.key,
                          data.comment,
                        );
                      }
                    }}
                  />
                )}

                {/* Domain Judgement */}
                {currentNavItem.type === NAV_ITEM_TYPES.DOMAIN_JUDGEMENT && (
                  <DomainJudgementPage
                    domainKey={currentNavItem.domainKey}
                    reviewer1Data={checklist1?.[currentNavItem.domainKey]}
                    reviewer2Data={checklist2?.[currentNavItem.domainKey]}
                    finalData={finalAnswers[currentNavItem.domainKey]}
                    reviewer1Name={reviewer1Name || 'Reviewer 1'}
                    reviewer2Name={reviewer2Name || 'Reviewer 2'}
                    judgementMatch={currentItemComparison?.judgementMatch}
                    directionMatch={currentItemComparison?.directionMatch}
                    onFinalJudgementChange={judgement =>
                      updateDomainJudgement(
                        currentNavItem.domainKey,
                        judgement,
                        finalAnswers[currentNavItem.domainKey]?.direction,
                      )
                    }
                    onFinalDirectionChange={direction =>
                      updateDomainJudgement(
                        currentNavItem.domainKey,
                        finalAnswers[currentNavItem.domainKey]?.judgement,
                        direction,
                      )
                    }
                    onUseReviewer1Judgement={() => {
                      const data = checklist1?.[currentNavItem.domainKey];
                      if (data)
                        updateDomainJudgement(
                          currentNavItem.domainKey,
                          data.judgement,
                          finalAnswers[currentNavItem.domainKey]?.direction,
                        );
                    }}
                    onUseReviewer2Judgement={() => {
                      const data = checklist2?.[currentNavItem.domainKey];
                      if (data)
                        updateDomainJudgement(
                          currentNavItem.domainKey,
                          data.judgement,
                          finalAnswers[currentNavItem.domainKey]?.direction,
                        );
                    }}
                    onUseReviewer1Direction={() => {
                      const data = checklist1?.[currentNavItem.domainKey];
                      if (data)
                        updateDomainJudgement(
                          currentNavItem.domainKey,
                          finalAnswers[currentNavItem.domainKey]?.judgement,
                          data.direction,
                        );
                    }}
                    onUseReviewer2Direction={() => {
                      const data = checklist2?.[currentNavItem.domainKey];
                      if (data)
                        updateDomainJudgement(
                          currentNavItem.domainKey,
                          finalAnswers[currentNavItem.domainKey]?.judgement,
                          data.direction,
                        );
                    }}
                  />
                )}

                {/* Overall Judgement */}
                {currentNavItem.type === NAV_ITEM_TYPES.OVERALL_JUDGEMENT && (
                  <OverallJudgementPage
                    reviewer1Data={checklist1?.overall}
                    reviewer2Data={checklist2?.overall}
                    finalData={finalAnswers.overall}
                    reviewer1Name={reviewer1Name || 'Reviewer 1'}
                    reviewer2Name={reviewer2Name || 'Reviewer 2'}
                    judgementMatch={currentItemComparison?.judgementMatch}
                    directionMatch={currentItemComparison?.directionMatch}
                    onFinalJudgementChange={judgement =>
                      updateOverallJudgement(judgement, finalAnswers.overall?.direction)
                    }
                    onFinalDirectionChange={direction =>
                      updateOverallJudgement(finalAnswers.overall?.judgement, direction)
                    }
                    onUseReviewer1Judgement={() => {
                      const data = checklist1?.overall;
                      if (data)
                        updateOverallJudgement(data.judgement, finalAnswers.overall?.direction);
                    }}
                    onUseReviewer2Judgement={() => {
                      const data = checklist2?.overall;
                      if (data)
                        updateOverallJudgement(data.judgement, finalAnswers.overall?.direction);
                    }}
                    onUseReviewer1Direction={() => {
                      const data = checklist1?.overall;
                      if (data)
                        updateOverallJudgement(finalAnswers.overall?.judgement, data.direction);
                    }}
                    onUseReviewer2Direction={() => {
                      const data = checklist2?.overall;
                      if (data)
                        updateOverallJudgement(finalAnswers.overall?.judgement, data.direction);
                    }}
                  />
                )}

                {/* Navigation Buttons */}
                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={goToPrevious}
                    disabled={currentPage === 0}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
                      currentPage === 0
                        ? 'bg-secondary text-muted-foreground/70 cursor-not-allowed'
                        : 'bg-card text-secondary-foreground hover:bg-secondary shadow'
                    }`}
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Previous
                  </button>

                  <div className="text-muted-foreground text-sm">
                    Item {currentPage + 1} of {totalPages}
                  </div>

                  <button
                    onClick={goToNext}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow transition-colors hover:bg-blue-700"
                  >
                    {currentPage === totalPages - 1 ? 'Review Summary' : 'Next'}
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="py-12 text-center">Loading...</div>
            )}
          </>
        )}

        {/* Summary View */}
        {viewMode === 'summary' && (
          <RobinsISummaryView
            navItems={navItems}
            finalAnswers={finalAnswers}
            comparison={comparison}
            summary={summaryStats}
            onGoToPage={goToPage}
            onSave={handleSave}
            onBack={goToPrevious}
            allAnswered={allAnswered}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}
