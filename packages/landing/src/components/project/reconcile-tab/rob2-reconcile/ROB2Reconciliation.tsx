/**
 * ROB2Reconciliation - Main view for comparing and reconciling two ROB-2 checklists
 * Shows one item per page with navigation through Preliminary, Domains, and Overall
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, AlertTriangleIcon } from 'lucide-react';
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
  hasAimMismatch,
  getActiveDomainKeys,
  getDomainQuestions,
  scoreRob2Domain,
} from '@corates/shared/checklists/rob2';
import {
  buildNavigationItems,
  hasNavItemAnswer,
  isNavItemAgreement,
  getAnsweredCount,
  getSectionKeyForPage,
  NAV_ITEM_TYPES,
} from './navbar-utils.js';
import { PreliminaryPage } from './pages/PreliminaryPage';
import { SignallingQuestionPage } from './pages/SignallingQuestionPage';
import { DomainDirectionPage } from './pages/DomainDirectionPage';
import { OverallDirectionPage } from './pages/OverallDirectionPage';
import { ROB2SummaryView } from './ROB2SummaryView';

/**
 * Preliminary text fields that can be synced via Y.Text
 */
const PRELIMINARY_TEXT_FIELDS = ['experimental', 'comparator', 'numericalResult'];

/**
 * Copy comment text to Y.Text
 */
function copyCommentToYText(
  getRob2Text: any,
  sectionKey: string,
  fieldKey: string,
  questionKey: string,
  commentText: string | null,
) {
  if (!getRob2Text) return;
  const yText = getRob2Text(sectionKey, fieldKey, questionKey);
  if (!yText) return;
  const text = (commentText || '').slice(0, 2000);
  yText.doc.transact(() => {
    yText.delete(0, yText.length);
    yText.insert(0, text);
  });
}

/**
 * Copy preliminary text field value to Y.Text when using "Use This"
 */
function copyPreliminaryTextToYText(
  getRob2Text: any,
  fieldKey: string,
  value: any,
) {
  if (!PRELIMINARY_TEXT_FIELDS.includes(fieldKey)) return;
  if (!getRob2Text) return;
  const yText = getRob2Text('preliminary', fieldKey);
  if (!yText) return;
  const text = (typeof value === 'string' ? value : '').slice(0, 2000);
  yText.doc.transact(() => {
    yText.delete(0, yText.length);
    yText.insert(0, text);
  });
}

interface ROB2ReconciliationProps {
  checklist1: any;
  checklist2: any;
  reconciledChecklist: any;
  reconciledChecklistId: string | null;
  onSaveReconciled: () => Promise<void>;
  onCancel: () => void;
  reviewer1Name: string;
  reviewer2Name: string;
  setNavbarStore: (_store: any) => void;
  updateChecklistAnswer: (_sectionKey: string, _data: any) => void;
  getRob2Text: ((..._args: any[]) => any) | null;
}

/**
 * ROB2Reconciliation - Main view for comparing and reconciling two ROB-2 checklists
 */
export function ROB2Reconciliation({
  checklist1,
  checklist2,
  reconciledChecklist,
  reconciledChecklistId: _reconciledChecklistId,
  onSaveReconciled,
  onCancel: _onCancel,
  reviewer1Name,
  reviewer2Name,
  setNavbarStore,
  updateChecklistAnswer,
  getRob2Text,
}: ROB2ReconciliationProps) {
  const [saving, setSaving] = useState(false);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState('questions');
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  // Track whether we've initialized from localStorage
  const initializedRef = useRef(false);

  // Storage key for navigation persistence
  const storageKey = useMemo(() => {
    if (!checklist1?.id || !checklist2?.id) return null;
    return `rob2-reconciliation-nav-${checklist1.id}-${checklist2.id}`;
  }, [checklist1?.id, checklist2?.id]);

  // Determine aim type from reconciled checklist
  const isAdhering = reconciledChecklist?.preliminary?.aim === 'ADHERING';

  // Check for aim mismatch between reviewers
  const aimMismatch = useMemo(() => {
    const reviewersMismatch = hasAimMismatch(checklist1, checklist2);
    if (!reviewersMismatch) return false;
    const finalAim = reconciledChecklist?.preliminary?.aim;
    return !finalAim;
  }, [checklist1, checklist2, reconciledChecklist?.preliminary?.aim]);

  // Build navigation items based on aim type
  const navItems = useMemo(() => buildNavigationItems(isAdhering), [isAdhering]);
  const totalPages = navItems.length;

  // Compare the two checklists using reconciled aim
  const comparison = useMemo(() => {
    if (!checklist1 || !checklist2) return null;
    const reconciledAim = reconciledChecklist?.preliminary?.aim;
    return compareChecklists(checklist1, checklist2, reconciledAim);
  }, [checklist1, checklist2, reconciledChecklist?.preliminary?.aim]);

  // Get final answers from reconciled checklist
  const finalAnswers = useMemo(() => reconciledChecklist || {}, [reconciledChecklist]);

  // Detect which domains have "early completion"
  const earlyCompleteDomains = useMemo(() => {
    const activeDomains = getActiveDomainKeys(isAdhering);
    const result = new Set<string>();

    for (const domainKey of activeDomains) {
      const domainAnswers = finalAnswers[domainKey]?.answers;
      if (!domainAnswers) continue;

      const scoring = scoreRob2Domain(domainKey, domainAnswers);
      if (scoring.isComplete && scoring.judgement !== null) {
        const items = navItems.filter(
          (item) => item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION && item.domainKey === domainKey,
        );
        const hasSkippedQuestion = items.some((item) => {
          const answer = domainAnswers[item.key]?.answer;
          return !answer || answer === 'NA';
        });
        if (hasSkippedQuestion) {
          result.add(domainKey);
        }
      }
    }

    return result;
  }, [finalAnswers, isAdhering, navItems]);

  // Questions that are skippable
  const skippableQuestions = useMemo(() => {
    const skippable = new Set<string>();

    for (const domainKey of earlyCompleteDomains) {
      const domainAnswers = finalAnswers[domainKey]?.answers || {};
      const items = navItems.filter(
        (item) => item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION && item.domainKey === domainKey,
      );
      for (const item of items) {
        const answer = domainAnswers[item.key]?.answer;
        if (!answer || answer === 'NA') {
          skippable.add(item.key);
        }
      }
    }

    return skippable;
  }, [earlyCompleteDomains, finalAnswers, navItems]);

  // Initialize navigation state from localStorage
  useEffect(() => {
    if (initializedRef.current || !storageKey) return;
    initializedRef.current = true;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCurrentPage(parsed.currentPage ?? 0);
        setViewMode(parsed.viewMode ?? 'questions');
      }
    } catch (e) {
      console.error('Failed to load navigation state:', e);
    }
  }, [storageKey]);

  // Auto-expand domain based on current page
  useEffect(() => {
    if (navItems.length > 0 && expandedDomain === null) {
      const sectionKey = getSectionKeyForPage(navItems, currentPage);
      if (sectionKey) {
        setExpandedDomain(sectionKey);
      }
    }
  }, [navItems, currentPage, expandedDomain]);

  // Save navigation state when it changes
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ currentPage, viewMode }));
    } catch (e) {
      console.error('Failed to save navigation state:', e);
    }
  }, [currentPage, viewMode, storageKey]);

  // Clamp currentPage when navItems change
  useEffect(() => {
    if (totalPages === 0) return;
    const clampedPage = Math.max(0, Math.min(currentPage, totalPages - 1));

    if (clampedPage !== currentPage) {
      setCurrentPage(clampedPage);
    }

    const sectionKey = getSectionKeyForPage(navItems, clampedPage);
    if (sectionKey && sectionKey !== expandedDomain) {
      setExpandedDomain(sectionKey);
    }
  }, [navItems, totalPages, currentPage, expandedDomain]);

  // Auto-set NA for skippable questions that are currently unanswered
  useEffect(() => {
    if (skippableQuestions.size === 0) return;

    for (const qKey of skippableQuestions) {
      const item = navItems.find(
        (i) => i.type === NAV_ITEM_TYPES.DOMAIN_QUESTION && i.key === qKey,
      );
      if (!item) continue;

      const currentAnswer = finalAnswers[item.domainKey]?.answers?.[qKey]?.answer;
      if (currentAnswer == null) {
        updateDomainQuestionAnswer(item.domainKey, qKey, 'NA');
      }
    }
    // updateDomainQuestionAnswer is stable (defined below and depends on updateChecklistAnswer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skippableQuestions, navItems, finalAnswers]);

  // Expose navbar props for external rendering via store
  useEffect(() => {
    setNavbarStore({
      navItems,
      viewMode,
      currentPage,
      comparison,
      finalAnswers,
      aimMismatch,
      expandedDomain,
      skippableQuestions,
      setViewMode,
      goToPage,
      setExpandedDomain,
      onReset: handleReset,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    navItems,
    viewMode,
    currentPage,
    comparison,
    finalAnswers,
    aimMismatch,
    expandedDomain,
    skippableQuestions,
  ]);

  const currentNavItem = navItems[currentPage];

  // Update functions for different item types
  function updatePreliminaryField(key: string, value: any) {
    if (!updateChecklistAnswer) return;
    updateChecklistAnswer('preliminary', { [key]: value });
  }

  function updateDomainQuestionAnswer(domainKey: string, questionKey: string, answer: string) {
    if (!updateChecklistAnswer) return;
    updateChecklistAnswer(domainKey, {
      answers: { [questionKey]: { answer } },
    });
  }

  function updateDomainDirection(domainKey: string, direction: string) {
    if (!updateChecklistAnswer) return;
    updateChecklistAnswer(domainKey, { direction });
  }

  function updateOverallDirection(direction: string) {
    if (!updateChecklistAnswer) return;
    updateChecklistAnswer('overall', { direction });
  }

  // Auto-fill final answer from reviewer 1
  function autoFillFromReviewer1(item: any) {
    if (!updateChecklistAnswer) return;

    if (item.type === NAV_ITEM_TYPES.PRELIMINARY) {
      const value = checklist1?.preliminary?.[item.key];
      if (value !== undefined) {
        updatePreliminaryField(item.key, value);
        copyPreliminaryTextToYText(getRob2Text, item.key, value);
      }
    } else if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
      const answer = checklist1?.[item.domainKey]?.answers?.[item.key];
      if (answer) {
        updateDomainQuestionAnswer(item.domainKey, item.key, answer.answer);
        copyCommentToYText(getRob2Text, item.domainKey, 'comment', item.key, answer.comment);
      }
    } else if (item.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION) {
      const direction = checklist1?.[item.domainKey]?.direction;
      if (direction) {
        updateDomainDirection(item.domainKey, direction);
      }
    } else if (item.type === NAV_ITEM_TYPES.OVERALL_DIRECTION) {
      const direction = checklist1?.overall?.direction;
      if (direction) {
        updateOverallDirection(direction);
      }
    }
  }

  // Navigation functions
  function goToNext() {
    const item = currentNavItem;

    // Auto-fill from reviewer1 if no final answer yet and reviewers agree
    if (item && !hasNavItemAnswer(item, finalAnswers) && isNavItemAgreement(item, comparison as any)) {
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

  function goToPage(index: number) {
    setCurrentPage(index);
    setViewMode('questions');

    const sectionKey = getSectionKeyForPage(navItems, index);
    if (sectionKey) {
      setExpandedDomain(sectionKey);
    }
  }

  // Reset all reconciliation answers
  async function handleReset() {
    if (!updateChecklistAnswer) return;

    updateChecklistAnswer('preliminary', {
      studyDesign: null,
      aim: null,
      deviationsToAddress: [],
      sources: {},
      experimental: '',
      comparator: '',
      numericalResult: '',
    });

    const allDomains = ['domain1', 'domain2a', 'domain2b', 'domain3', 'domain4', 'domain5'];
    for (const domainKey of allDomains) {
      const questionKeys = Object.keys(getDomainQuestions(domainKey));
      const answers: Record<string, any> = {};
      for (const qKey of questionKeys) {
        answers[qKey] = { answer: null, comment: '' };
      }

      updateChecklistAnswer(domainKey, {
        answers,
        direction: null,
        judgement: null,
      });
    }

    updateChecklistAnswer('overall', {
      direction: null,
      judgement: null,
    });

    setCurrentPage(0);
    setViewMode('questions');
    showToast.info('Reconciliation Reset', 'All reconciliations have been cleared.');
  }

  // Check if all items have been answered
  const allAnswered = useMemo(
    () => navItems.every((item) => hasNavItemAnswer(item, finalAnswers)),
    [navItems, finalAnswers],
  );

  // Summary stats
  const summaryStats = useMemo(() => {
    const total = navItems.length;
    const agreed = navItems.filter((item) => isNavItemAgreement(item, comparison as any)).length;
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
  const getCurrentItemComparison = useCallback(() => {
    const item = currentNavItem;
    if (!item || !comparison) return null;

    if (item.type === NAV_ITEM_TYPES.PRELIMINARY) {
      return comparison.preliminary?.fields?.find((f: any) => f.key === item.key);
    }
    if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
      const domain = comparison.domains?.[item.domainKey];
      if (!domain) return null;
      const allItems = [
        ...(domain.questions?.agreements || []),
        ...(domain.questions?.disagreements || []),
      ];
      return allItems.find((c: any) => c.key === item.key);
    }
    if (item.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION) {
      return comparison.domains?.[item.domainKey];
    }
    if (item.type === NAV_ITEM_TYPES.OVERALL_DIRECTION) {
      return comparison.overall;
    }
    return null;
  }, [currentNavItem, comparison]);

  return (
    <div className="bg-blue-50">
      <div className="mx-auto max-w-7xl px-4 py-4">
        {/* Finish confirmation dialog */}
        <AlertDialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finish reconciliation?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the reconciled checklist as completed. You will no longer be able to
                edit these reconciliation answers afterwards.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" disabled={saving} onClick={() => setFinishDialogOpen(false)}>
                Cancel
              </Button>
              <AlertDialogAction disabled={saving} onClick={confirmSave}>
                {saving ? 'Saving...' : 'Finish'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Aim Mismatch Warning Banner */}
        {aimMismatch && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangleIcon className="h-5 w-5 shrink-0" />
            <div>
              <span className="font-medium">Aim Mismatch Detected:</span> Reviewers selected
              different aims. You must reconcile the aim field before proceeding to domain
              assessment.
            </div>
          </div>
        )}

        {/* Main Content */}
        {viewMode === 'questions' && (
          <>
            {currentNavItem ? (
              <>
                {/* Preliminary Field */}
                {currentNavItem.type === NAV_ITEM_TYPES.PRELIMINARY && (
                  <PreliminaryPage
                    fieldKey={currentNavItem.key}
                    reviewer1Value={checklist1?.preliminary?.[currentNavItem.key]}
                    reviewer2Value={checklist2?.preliminary?.[currentNavItem.key]}
                    finalValue={finalAnswers.preliminary?.[currentNavItem.key]}
                    reviewer1Name={reviewer1Name || 'Reviewer 1'}
                    reviewer2Name={reviewer2Name || 'Reviewer 2'}
                    isAgreement={isNavItemAgreement(currentNavItem, comparison as any)}
                    isAimMismatch={currentNavItem.key === 'aim' && aimMismatch}
                    onFinalChange={(value: any) =>
                      updatePreliminaryField(currentNavItem.key, value)
                    }
                    getRob2Text={getRob2Text}
                    onUseReviewer1={() => {
                      const key = currentNavItem.key;
                      const value = checklist1?.preliminary?.[key];
                      if (value !== undefined) {
                        updatePreliminaryField(key, value);
                        copyPreliminaryTextToYText(getRob2Text, key, value);
                      }
                    }}
                    onUseReviewer2={() => {
                      const key = currentNavItem.key;
                      const value = checklist2?.preliminary?.[key];
                      if (value !== undefined) {
                        updatePreliminaryField(key, value);
                        copyPreliminaryTextToYText(getRob2Text, key, value);
                      }
                    }}
                  />
                )}

                {/* Domain Question */}
                {currentNavItem.type === NAV_ITEM_TYPES.DOMAIN_QUESTION && (
                  <SignallingQuestionPage
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
                    finalCommentYText={getRob2Text?.(
                      currentNavItem.domainKey,
                      'comment',
                      currentNavItem.key,
                    )}
                    reviewer1Name={reviewer1Name || 'Reviewer 1'}
                    reviewer2Name={reviewer2Name || 'Reviewer 2'}
                    isAgreement={isNavItemAgreement(currentNavItem, comparison as any)}
                    isSkipped={skippableQuestions.has(currentNavItem.key)}
                    onFinalAnswerChange={(answer: string) =>
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
                          getRob2Text,
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
                          getRob2Text,
                          currentNavItem.domainKey,
                          'comment',
                          currentNavItem.key,
                          data.comment,
                        );
                      }
                    }}
                  />
                )}

                {/* Domain Direction */}
                {currentNavItem.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION && (
                  <DomainDirectionPage
                    domainKey={currentNavItem.domainKey}
                    reviewer1Answers={checklist1?.[currentNavItem.domainKey]?.answers}
                    reviewer2Answers={checklist2?.[currentNavItem.domainKey]?.answers}
                    finalAnswers={finalAnswers[currentNavItem.domainKey]?.answers}
                    reviewer1Direction={checklist1?.[currentNavItem.domainKey]?.direction}
                    reviewer2Direction={checklist2?.[currentNavItem.domainKey]?.direction}
                    finalDirection={finalAnswers[currentNavItem.domainKey]?.direction}
                    reviewer1Name={reviewer1Name || 'Reviewer 1'}
                    reviewer2Name={reviewer2Name || 'Reviewer 2'}
                    directionMatch={(getCurrentItemComparison() as any)?.directionMatch}
                    onFinalDirectionChange={(direction: string) =>
                      updateDomainDirection(currentNavItem.domainKey, direction)
                    }
                    onUseReviewer1={() => {
                      const direction = checklist1?.[currentNavItem.domainKey]?.direction;
                      if (direction) {
                        updateDomainDirection(currentNavItem.domainKey, direction);
                      }
                    }}
                    onUseReviewer2={() => {
                      const direction = checklist2?.[currentNavItem.domainKey]?.direction;
                      if (direction) {
                        updateDomainDirection(currentNavItem.domainKey, direction);
                      }
                    }}
                  />
                )}

                {/* Overall Direction */}
                {currentNavItem.type === NAV_ITEM_TYPES.OVERALL_DIRECTION && (
                  <OverallDirectionPage
                    checklist1={checklist1}
                    checklist2={checklist2}
                    finalChecklist={finalAnswers}
                    reviewer1Direction={checklist1?.overall?.direction}
                    reviewer2Direction={checklist2?.overall?.direction}
                    finalDirection={finalAnswers.overall?.direction}
                    reviewer1Name={reviewer1Name || 'Reviewer 1'}
                    reviewer2Name={reviewer2Name || 'Reviewer 2'}
                    directionMatch={(getCurrentItemComparison() as any)?.directionMatch}
                    onFinalDirectionChange={updateOverallDirection}
                    onUseReviewer1={() => {
                      const direction = checklist1?.overall?.direction;
                      if (direction) {
                        updateOverallDirection(direction);
                      }
                    }}
                    onUseReviewer2={() => {
                      const direction = checklist2?.overall?.direction;
                      if (direction) {
                        updateOverallDirection(direction);
                      }
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
          <ROB2SummaryView
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
