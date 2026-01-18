/**
 * ROB2Reconciliation - Main view for comparing and reconciling two ROB-2 checklists
 * Shows one item per page with navigation through Preliminary, Domains, and Overall
 */

import { createSignal, createMemo, createEffect, Show, Switch, Match } from 'solid-js';
import { FiArrowLeft, FiArrowRight, FiAlertTriangle } from 'solid-icons/fi';
import { showToast } from '@/components/ui/toast';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogPositioner,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  compareChecklists,
  hasAimMismatch,
  getActiveDomainKeys,
} from '@corates/shared/checklists/rob2';
import {
  buildNavigationItems,
  hasNavItemAnswer,
  isNavItemAgreement,
  getAnsweredCount,
  getSectionKeyForPage,
  NAV_ITEM_TYPES,
} from './navbar-utils.js';
import PreliminaryPage from './pages/PreliminaryPage.jsx';
import SignallingQuestionPage from './pages/SignallingQuestionPage.jsx';
import DomainDirectionPage from './pages/DomainDirectionPage.jsx';
import OverallDirectionPage from './pages/OverallDirectionPage.jsx';
import ROB2SummaryView from './ROB2SummaryView.jsx';

/**
 * ROB2Reconciliation - Main view for comparing and reconciling two ROB-2 checklists
 * @param {Object} props
 * @param {Object} props.checklist1 - First reviewer's checklist data
 * @param {Object} props.checklist2 - Second reviewer's checklist data
 * @param {Object} props.reconciledChecklist - The reconciled checklist data (read from Yjs, reactive)
 * @param {string} props.reconciledChecklistId - ID of the reconciled checklist
 * @param {Function} props.onSaveReconciled - Callback when reconciled checklist is saved
 * @param {Function} props.onCancel - Callback to cancel and go back
 * @param {string} props.reviewer1Name - Display name for first reviewer
 * @param {string} props.reviewer2Name - Display name for second reviewer
 * @param {Function} props.setNavbarStore - Store setter for navbar state
 * @param {Function} props.updateChecklistAnswer - Function to update answer in reconciled checklist
 * @param {Function} props.getRob2Text - Function to get Y.Text for comments (domainKey, fieldKey, questionKey) => Y.Text
 * @returns {JSX.Element}
 */
export default function ROB2Reconciliation(props) {
  const [saving, setSaving] = createSignal(false);
  // Finish confirmation dialog state
  const [finishDialogOpen, setFinishDialogOpen] = createSignal(false);

  // Navigation state (localStorage-backed)
  const getStorageKey = () => {
    if (!props.checklist1?.id || !props.checklist2?.id) return null;
    return `rob2-reconciliation-nav-${props.checklist1.id}-${props.checklist2.id}`;
  };

  const saveNavigationState = (page, mode) => {
    const key = getStorageKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify({ currentPage: page, viewMode: mode }));
    } catch (e) {
      console.error('Failed to save navigation state:', e);
    }
  };

  const [currentPage, setCurrentPage] = createSignal(0);
  const [viewMode, setViewMode] = createSignal('questions');
  const [expandedDomain, setExpandedDomain] = createSignal(null);

  // Initialize navigation state from localStorage
  createEffect(() => {
    if (!props.checklist1?.id || !props.checklist2?.id) return;
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
  });

  // Auto-expand domain based on current page
  createEffect(() => {
    const items = navItems();
    const page = currentPage();
    if (items.length > 0 && expandedDomain() === null) {
      const sectionKey = getSectionKeyForPage(items, page);
      if (sectionKey) {
        setExpandedDomain(sectionKey);
      }
    }
  });

  // Save navigation state when it changes
  createEffect(() => {
    saveNavigationState(currentPage(), viewMode());
  });

  // Determine aim type from reconciled checklist
  const isAdhering = createMemo(() => {
    return props.reconciledChecklist?.preliminary?.aim === 'ADHERING';
  });

  // Check for aim mismatch between reviewers (blocking issue)
  // Only show mismatch if reviewers disagree AND final aim hasn't been set yet
  const aimMismatch = createMemo(() => {
    const reviewersMismatch = hasAimMismatch(props.checklist1, props.checklist2);
    if (!reviewersMismatch) return false;

    // If final aim has been set, mismatch is resolved
    const finalAim = props.reconciledChecklist?.preliminary?.aim;
    return !finalAim;
  });

  // Build navigation items based on aim type
  const navItems = createMemo(() => buildNavigationItems(isAdhering()));
  const totalPages = () => navItems().length;

  // Clamp currentPage when navItems change (e.g., after aim change) to prevent out-of-bounds index
  createEffect(() => {
    const items = navItems();
    const total = items.length;
    if (total === 0) return;

    const page = currentPage();
    const clampedPage = Math.max(0, Math.min(page, total - 1));

    if (clampedPage !== page) {
      setCurrentPage(clampedPage);
    }

    // Resync expanded domain to the (potentially clamped) page
    const sectionKey = getSectionKeyForPage(items, clampedPage);
    if (sectionKey && sectionKey !== expandedDomain()) {
      setExpandedDomain(sectionKey);
    }
  });

  // Compare the two checklists
  const comparison = createMemo(() => {
    if (!props.checklist1 || !props.checklist2) return null;
    return compareChecklists(props.checklist1, props.checklist2);
  });

  // Get final answers from reconciled checklist (reactive)
  const finalAnswers = createMemo(() => {
    return props.reconciledChecklist || {};
  });

  // Expose navbar props for external rendering via store
  createEffect(() => {
    if (props.setNavbarStore) {
      props.setNavbarStore({
        navItems: navItems(),
        viewMode: viewMode(),
        currentPage: currentPage(),
        comparison: comparison(),
        finalAnswers: finalAnswers(),
        aimMismatch: aimMismatch(),
        expandedDomain: expandedDomain(),
        setViewMode,
        goToPage,
        setExpandedDomain,
        onReset: handleReset,
      });
    }
  });

  // Current navigation item
  const currentNavItem = () => navItems()[currentPage()];

  // Navigation functions
  function goToNext() {
    const item = currentNavItem();

    // Auto-fill from reviewer1 if no final answer yet and reviewers agree
    if (item && !hasNavItemAnswer(item, finalAnswers()) && isNavItemAgreement(item, comparison())) {
      autoFillFromReviewer1(item);
    }

    if (currentPage() < totalPages() - 1) {
      const nextPage = currentPage() + 1;
      setCurrentPage(nextPage);

      // Auto-expand domain if moving to a new one
      const sectionKey = getSectionKeyForPage(navItems(), nextPage);
      if (sectionKey && sectionKey !== expandedDomain()) {
        setExpandedDomain(sectionKey);
      }
    } else {
      setViewMode('summary');
    }
  }

  function goToPrevious() {
    if (viewMode() === 'summary') {
      setViewMode('questions');
      return;
    }
    if (currentPage() > 0) {
      const prevPage = currentPage() - 1;
      setCurrentPage(prevPage);

      // Auto-expand domain if moving to a new one
      const sectionKey = getSectionKeyForPage(navItems(), prevPage);
      if (sectionKey && sectionKey !== expandedDomain()) {
        setExpandedDomain(sectionKey);
      }
    }
  }

  function goToPage(index) {
    setCurrentPage(index);
    setViewMode('questions');

    // Auto-expand the domain containing this page
    const sectionKey = getSectionKeyForPage(navItems(), index);
    if (sectionKey) {
      setExpandedDomain(sectionKey);
    }
  }

  // Auto-fill final answer from reviewer 1
  function autoFillFromReviewer1(item) {
    if (!props.updateChecklistAnswer) return;

    if (item.type === NAV_ITEM_TYPES.PRELIMINARY) {
      const value = props.checklist1?.preliminary?.[item.key];
      if (value !== undefined) {
        updatePreliminaryField(item.key, value);
      }
    } else if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
      const answer = props.checklist1?.[item.domainKey]?.answers?.[item.key];
      if (answer) {
        updateDomainQuestionAnswer(item.domainKey, item.key, answer.answer);
        copyCommentToYText(item.domainKey, 'comment', item.key, answer.comment);
      }
    } else if (item.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION) {
      const direction = props.checklist1?.[item.domainKey]?.direction;
      if (direction) {
        updateDomainDirection(item.domainKey, direction);
      }
    } else if (item.type === NAV_ITEM_TYPES.OVERALL_DIRECTION) {
      const direction = props.checklist1?.overall?.direction;
      if (direction) {
        updateOverallDirection(direction);
      }
    }
  }

  // Helper to copy comment text to Y.Text
  function copyCommentToYText(sectionKey, fieldKey, questionKey, commentText) {
    if (!props.getRob2Text) return;
    const yText = props.getRob2Text(sectionKey, fieldKey, questionKey);
    if (!yText) return;
    const text = (commentText || '').slice(0, 2000);
    yText.doc.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, text);
    });
  }

  // Update functions for different item types
  function updatePreliminaryField(key, value) {
    if (!props.updateChecklistAnswer) return;
    const currentPrelim = finalAnswers().preliminary || {};
    props.updateChecklistAnswer('preliminary', {
      ...currentPrelim,
      [key]: value,
    });
  }

  function updateDomainQuestionAnswer(domainKey, questionKey, answer) {
    if (!props.updateChecklistAnswer) return;
    const currentDomain = finalAnswers()[domainKey] || { answers: {} };
    props.updateChecklistAnswer(domainKey, {
      ...currentDomain,
      answers: {
        ...currentDomain.answers,
        [questionKey]: { answer },
      },
    });
  }

  function updateDomainDirection(domainKey, direction) {
    if (!props.updateChecklistAnswer) return;
    const currentDomain = finalAnswers()[domainKey] || { answers: {} };
    props.updateChecklistAnswer(domainKey, {
      ...currentDomain,
      direction,
    });
  }

  function updateOverallDirection(direction) {
    if (!props.updateChecklistAnswer) return;
    const currentOverall = finalAnswers().overall || {};
    props.updateChecklistAnswer('overall', {
      ...currentOverall,
      direction,
    });
  }

  // Reset all reconciliation answers
  async function handleReset() {
    if (!props.updateChecklistAnswer) return;

    // Reset preliminary
    props.updateChecklistAnswer('preliminary', {});

    // Reset domains
    const activeDomains = getActiveDomainKeys(isAdhering());
    for (const domainKey of activeDomains) {
      props.updateChecklistAnswer(domainKey, {
        answers: {},
        direction: null,
      });
    }

    // Reset overall
    props.updateChecklistAnswer('overall', {
      direction: null,
    });

    setCurrentPage(0);
    setViewMode('questions');
    showToast.info('Reconciliation Reset', 'All reconciliations have been cleared.');
  }

  // Check if all items have been answered
  const allAnswered = createMemo(() => {
    const items = navItems();
    const finals = finalAnswers();
    return items.every(item => hasNavItemAnswer(item, finals));
  });

  // Summary stats for summary view
  const summaryStats = createMemo(() => {
    const items = navItems();
    const comp = comparison();
    const finals = finalAnswers();

    const total = items.length;
    const agreed = items.filter(item => isNavItemAgreement(item, comp)).length;
    const answered = getAnsweredCount(items, finals);

    return {
      total,
      agreed,
      disagreed: total - agreed,
      agreementPercentage: total > 0 ? Math.round((agreed / total) * 100) : 0,
      answered,
    };
  });

  // Handle save
  // Handle save - opens confirmation dialog
  function handleSave() {
    if (!allAnswered()) {
      showToast.error('Incomplete Review', 'Please review all items before saving.');
      return;
    }
    setFinishDialogOpen(true);
  }

  // Execute save after confirmation
  async function confirmSave() {
    setSaving(true);
    try {
      await props.onSaveReconciled?.();
      setFinishDialogOpen(false);
    } catch (err) {
      console.error('Error saving reconciled checklist:', err);
      showToast.error('Save Failed', 'Failed to save reconciled checklist. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Get current item's comparison data
  const getCurrentItemComparison = () => {
    const item = currentNavItem();
    const comp = comparison();
    if (!item || !comp) return null;

    if (item.type === NAV_ITEM_TYPES.PRELIMINARY) {
      return comp.preliminary?.fields?.find(f => f.key === item.key);
    }
    if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
      const domain = comp.domains?.[item.domainKey];
      if (!domain) return null;
      const allItems = [
        ...(domain.questions?.agreements || []),
        ...(domain.questions?.disagreements || []),
      ];
      return allItems.find(c => c.key === item.key);
    }
    if (item.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION) {
      return comp.domains?.[item.domainKey];
    }
    if (item.type === NAV_ITEM_TYPES.OVERALL_DIRECTION) {
      return comp.overall;
    }
    return null;
  };

  return (
    <div class='bg-blue-50'>
      <div class='mx-auto max-w-7xl px-4 py-4'>
        {/* Finish confirmation dialog */}
        <AlertDialog open={finishDialogOpen()} onOpenChange={setFinishDialogOpen}>
          <AlertDialogBackdrop />
          <AlertDialogPositioner>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogIcon variant='warning' />
                <div>
                  <AlertDialogTitle>Finish reconciliation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark the reconciled checklist as completed. You will no longer be able
                    to edit these reconciliation answers afterwards.
                  </AlertDialogDescription>
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={saving()}>Cancel</AlertDialogCancel>
                <AlertDialogAction variant='warning' disabled={saving()} onClick={confirmSave}>
                  {saving() ? 'Saving...' : 'Finish'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogPositioner>
        </AlertDialog>

        {/* Aim Mismatch Warning Banner */}
        <Show when={aimMismatch()}>
          <div class='mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
            <FiAlertTriangle class='h-5 w-5 shrink-0' />
            <div>
              <span class='font-medium'>Aim Mismatch Detected:</span> Reviewers selected different
              aims. You must reconcile the aim field before proceeding to domain assessment.
            </div>
          </div>
        </Show>

        {/* Main Content */}
        <Show when={viewMode() === 'questions'}>
          <Show when={currentNavItem()} fallback={<div class='py-12 text-center'>Loading...</div>}>
            <Switch>
              {/* Preliminary Field */}
              <Match when={currentNavItem()?.type === NAV_ITEM_TYPES.PRELIMINARY}>
                <PreliminaryPage
                  fieldKey={currentNavItem().key}
                  reviewer1Value={props.checklist1?.preliminary?.[currentNavItem().key]}
                  reviewer2Value={props.checklist2?.preliminary?.[currentNavItem().key]}
                  finalValue={finalAnswers().preliminary?.[currentNavItem().key]}
                  reviewer1Name={props.reviewer1Name || 'Reviewer 1'}
                  reviewer2Name={props.reviewer2Name || 'Reviewer 2'}
                  isAgreement={isNavItemAgreement(currentNavItem(), comparison())}
                  isAimMismatch={currentNavItem().key === 'aim' && aimMismatch()}
                  onFinalChange={value => updatePreliminaryField(currentNavItem().key, value)}
                  onUseReviewer1={() => {
                    const value = props.checklist1?.preliminary?.[currentNavItem().key];
                    if (value !== undefined) {
                      updatePreliminaryField(currentNavItem().key, value);
                    }
                  }}
                  onUseReviewer2={() => {
                    const value = props.checklist2?.preliminary?.[currentNavItem().key];
                    if (value !== undefined) {
                      updatePreliminaryField(currentNavItem().key, value);
                    }
                  }}
                />
              </Match>

              {/* Domain Question */}
              <Match when={currentNavItem()?.type === NAV_ITEM_TYPES.DOMAIN_QUESTION}>
                <SignallingQuestionPage
                  domainKey={currentNavItem().domainKey}
                  questionKey={currentNavItem().key}
                  reviewer1Data={
                    props.checklist1?.[currentNavItem().domainKey]?.answers?.[currentNavItem().key]
                  }
                  reviewer2Data={
                    props.checklist2?.[currentNavItem().domainKey]?.answers?.[currentNavItem().key]
                  }
                  finalData={
                    finalAnswers()[currentNavItem().domainKey]?.answers?.[currentNavItem().key]
                  }
                  finalCommentYText={props.getRob2Text?.(
                    currentNavItem().domainKey,
                    'comment',
                    currentNavItem().key,
                  )}
                  reviewer1Name={props.reviewer1Name || 'Reviewer 1'}
                  reviewer2Name={props.reviewer2Name || 'Reviewer 2'}
                  isAgreement={isNavItemAgreement(currentNavItem(), comparison())}
                  onFinalAnswerChange={answer =>
                    updateDomainQuestionAnswer(
                      currentNavItem().domainKey,
                      currentNavItem().key,
                      answer,
                    )
                  }
                  onUseReviewer1={() => {
                    const data =
                      props.checklist1?.[currentNavItem().domainKey]?.answers?.[
                        currentNavItem().key
                      ];
                    if (data) {
                      updateDomainQuestionAnswer(
                        currentNavItem().domainKey,
                        currentNavItem().key,
                        data.answer,
                      );
                      copyCommentToYText(
                        currentNavItem().domainKey,
                        'comment',
                        currentNavItem().key,
                        data.comment,
                      );
                    }
                  }}
                  onUseReviewer2={() => {
                    const data =
                      props.checklist2?.[currentNavItem().domainKey]?.answers?.[
                        currentNavItem().key
                      ];
                    if (data) {
                      updateDomainQuestionAnswer(
                        currentNavItem().domainKey,
                        currentNavItem().key,
                        data.answer,
                      );
                      copyCommentToYText(
                        currentNavItem().domainKey,
                        'comment',
                        currentNavItem().key,
                        data.comment,
                      );
                    }
                  }}
                />
              </Match>

              {/* Domain Direction */}
              <Match when={currentNavItem()?.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION}>
                <DomainDirectionPage
                  domainKey={currentNavItem().domainKey}
                  reviewer1Answers={props.checklist1?.[currentNavItem().domainKey]?.answers}
                  reviewer2Answers={props.checklist2?.[currentNavItem().domainKey]?.answers}
                  finalAnswers={finalAnswers()[currentNavItem().domainKey]?.answers}
                  reviewer1Direction={props.checklist1?.[currentNavItem().domainKey]?.direction}
                  reviewer2Direction={props.checklist2?.[currentNavItem().domainKey]?.direction}
                  finalDirection={finalAnswers()[currentNavItem().domainKey]?.direction}
                  reviewer1Name={props.reviewer1Name || 'Reviewer 1'}
                  reviewer2Name={props.reviewer2Name || 'Reviewer 2'}
                  directionMatch={getCurrentItemComparison()?.directionMatch}
                  onFinalDirectionChange={direction =>
                    updateDomainDirection(currentNavItem().domainKey, direction)
                  }
                  onUseReviewer1={() => {
                    const direction = props.checklist1?.[currentNavItem().domainKey]?.direction;
                    if (direction) {
                      updateDomainDirection(currentNavItem().domainKey, direction);
                    }
                  }}
                  onUseReviewer2={() => {
                    const direction = props.checklist2?.[currentNavItem().domainKey]?.direction;
                    if (direction) {
                      updateDomainDirection(currentNavItem().domainKey, direction);
                    }
                  }}
                />
              </Match>

              {/* Overall Direction */}
              <Match when={currentNavItem()?.type === NAV_ITEM_TYPES.OVERALL_DIRECTION}>
                <OverallDirectionPage
                  checklist1={props.checklist1}
                  checklist2={props.checklist2}
                  finalChecklist={finalAnswers()}
                  reviewer1Direction={props.checklist1?.overall?.direction}
                  reviewer2Direction={props.checklist2?.overall?.direction}
                  finalDirection={finalAnswers().overall?.direction}
                  reviewer1Name={props.reviewer1Name || 'Reviewer 1'}
                  reviewer2Name={props.reviewer2Name || 'Reviewer 2'}
                  directionMatch={getCurrentItemComparison()?.directionMatch}
                  onFinalDirectionChange={updateOverallDirection}
                  onUseReviewer1={() => {
                    const direction = props.checklist1?.overall?.direction;
                    if (direction) {
                      updateOverallDirection(direction);
                    }
                  }}
                  onUseReviewer2={() => {
                    const direction = props.checklist2?.overall?.direction;
                    if (direction) {
                      updateOverallDirection(direction);
                    }
                  }}
                />
              </Match>
            </Switch>

            {/* Navigation Buttons */}
            <div class='mt-4 flex items-center justify-between'>
              <button
                onClick={goToPrevious}
                disabled={currentPage() === 0}
                class={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
                  currentPage() === 0 ?
                    'cursor-not-allowed bg-gray-100 text-gray-400'
                  : 'bg-white text-gray-700 shadow hover:bg-gray-100'
                }`}
              >
                <FiArrowLeft class='h-4 w-4' />
                Previous
              </button>

              <div class='text-sm text-gray-600'>
                Item {currentPage() + 1} of {totalPages()}
              </div>

              <button
                onClick={goToNext}
                class='flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow transition-colors hover:bg-blue-700'
              >
                {currentPage() === totalPages() - 1 ? 'Review Summary' : 'Next'}
                <FiArrowRight class='h-4 w-4' />
              </button>
            </div>
          </Show>
        </Show>

        {/* Summary View */}
        <Show when={viewMode() === 'summary'}>
          <ROB2SummaryView
            navItems={navItems()}
            finalAnswers={finalAnswers()}
            comparison={comparison()}
            summary={summaryStats()}
            onGoToPage={goToPage}
            onSave={handleSave}
            onBack={goToPrevious}
            allAnswered={allAnswered()}
            saving={saving()}
          />
        </Show>
      </div>
    </div>
  );
}
