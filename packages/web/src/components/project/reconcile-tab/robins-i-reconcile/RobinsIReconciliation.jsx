/**
 * RobinsIReconciliation - Main view for comparing and reconciling two ROBINS-I checklists
 * Shows one item per page with navigation through Section B, Domains, and Overall
 */

import { createSignal, createMemo, createEffect, Show, Switch, Match } from 'solid-js';
import { AiOutlineArrowLeft, AiOutlineArrowRight, AiOutlineWarning } from 'solid-icons/ai';
import { showToast, useConfirmDialog } from '@corates/ui';
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
  NAV_ITEM_TYPES,
} from './navbar-utils.js';
import SectionBQuestionPage from './pages/SectionBQuestionPage.jsx';
import DomainQuestionPage from './pages/DomainQuestionPage.jsx';
import DomainJudgementPage from './pages/DomainJudgementPage.jsx';
import OverallJudgementPage from './pages/OverallJudgementPage.jsx';
import RobinsISummaryView from './RobinsISummaryView.jsx';

/**
 * RobinsIReconciliation - Main view for comparing and reconciling two ROBINS-I checklists
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
 * @param {Function} props.getRobinsText - Function to get Y.Text for comments (sectionKey, fieldKey, questionKey) => Y.Text
 * @returns {JSX.Element}
 */
export default function RobinsIReconciliation(props) {
  const [saving, setSaving] = createSignal(false);
  const confirmDialog = useConfirmDialog();

  // Navigation state (localStorage-backed)
  const getStorageKey = () => {
    if (!props.checklist1?.id || !props.checklist2?.id) return null;
    return `robins-reconciliation-nav-${props.checklist1.id}-${props.checklist2.id}`;
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

  // Save navigation state when it changes
  createEffect(() => {
    saveNavigationState(currentPage(), viewMode());
  });

  // Determine protocol type from checklist (for Domain 1A vs 1B)
  const isPerProtocol = createMemo(() => {
    return props.checklist1?.sectionC?.isPerProtocol || false;
  });

  // Build navigation items based on protocol type
  const navItems = createMemo(() => buildNavigationItems(isPerProtocol()));
  const totalPages = () => navItems().length;

  // Compare the two checklists
  const comparison = createMemo(() => {
    if (!props.checklist1 || !props.checklist2) return null;
    return compareChecklists(props.checklist1, props.checklist2);
  });

  // Check if Section B indicates critical risk
  const sectionBCritical = createMemo(() => {
    // Check both reviewer's Section B for critical risk
    const critical1 = isSectionBCritical(props.checklist1?.sectionB);
    const critical2 = isSectionBCritical(props.checklist2?.sectionB);
    return critical1 || critical2;
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
        sectionBCritical: sectionBCritical(),
        setViewMode,
        goToPage,
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
      setCurrentPage(p => p + 1);
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
      setCurrentPage(p => p - 1);
    }
  }

  function goToPage(index) {
    setCurrentPage(index);
    setViewMode('questions');
  }

  // Auto-fill final answer from reviewer 1
  function autoFillFromReviewer1(item) {
    if (!props.updateChecklistAnswer) return;

    if (item.type === NAV_ITEM_TYPES.SECTION_B) {
      const answer = props.checklist1?.sectionB?.[item.key];
      if (answer) {
        updateSectionBAnswer(item.key, answer.answer);
        copyCommentToYText('sectionB', 'comment', item.key, answer.comment);
      }
    } else if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
      const answer = props.checklist1?.[item.domainKey]?.answers?.[item.key];
      if (answer) {
        updateDomainQuestionAnswer(item.domainKey, item.key, answer.answer);
        copyCommentToYText(item.domainKey, 'comment', item.key, answer.comment);
      }
    } else if (item.type === NAV_ITEM_TYPES.DOMAIN_JUDGEMENT) {
      const domain = props.checklist1?.[item.domainKey];
      if (domain?.judgement) {
        updateDomainJudgement(item.domainKey, domain.judgement, domain.direction);
      }
    } else if (item.type === NAV_ITEM_TYPES.OVERALL_JUDGEMENT) {
      const overall = props.checklist1?.overall;
      if (overall?.judgement) {
        updateOverallJudgement(overall.judgement, overall.direction);
      }
    }
  }

  // Helper to copy comment text to Y.Text
  function copyCommentToYText(sectionKey, fieldKey, questionKey, commentText) {
    if (!props.getRobinsText) return;
    const yText = props.getRobinsText(sectionKey, fieldKey, questionKey);
    if (!yText) return;
    const text = (commentText || '').slice(0, 2000);
    yText.doc.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, text);
    });
  }

  // Update functions for different item types
  function updateSectionBAnswer(key, answer) {
    if (!props.updateChecklistAnswer) return;
    const currentSectionB = finalAnswers().sectionB || {};
    props.updateChecklistAnswer('sectionB', {
      ...currentSectionB,
      [key]: { answer },
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

  function updateDomainJudgement(domainKey, judgement, direction) {
    if (!props.updateChecklistAnswer) return;
    const currentDomain = finalAnswers()[domainKey] || { answers: {} };
    props.updateChecklistAnswer(domainKey, {
      ...currentDomain,
      judgement,
      direction: direction || null,
    });
  }

  function updateOverallJudgement(judgement, direction) {
    if (!props.updateChecklistAnswer) return;
    props.updateChecklistAnswer('overall', {
      judgement,
      direction: direction || null,
    });
  }

  // Reset all reconciliation answers
  async function handleReset() {
    if (!props.updateChecklistAnswer) return;

    // Reset Section B
    const sectionBKeys = getSectionBKeys();
    const emptySectionB = {};
    sectionBKeys.forEach(key => {
      emptySectionB[key] = { answer: null, comment: '' };
    });
    props.updateChecklistAnswer('sectionB', emptySectionB);

    // Reset domains
    const activeDomains = getDomainKeysForComparison(isPerProtocol());
    for (const domainKey of activeDomains) {
      props.updateChecklistAnswer(domainKey, {
        answers: {},
        judgement: null,
        direction: null,
      });
    }

    // Reset overall
    props.updateChecklistAnswer('overall', {
      judgement: null,
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
  async function handleSave() {
    if (!allAnswered()) {
      showToast.error('Incomplete Review', 'Please review all items before saving.');
      return;
    }

    const confirmed = await confirmDialog.open({
      title: 'Finish reconciliation?',
      description:
        'This will mark the reconciled checklist as completed. You will no longer be able to edit these reconciliation answers afterwards.',
      confirmText: 'Finish',
      cancelText: 'Cancel',
      variant: 'warning',
    });

    if (!confirmed) return;

    setSaving(true);
    try {
      await props.onSaveReconciled?.();
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

    if (item.type === NAV_ITEM_TYPES.SECTION_B) {
      const allItems = [
        ...(comp.sectionB?.agreements || []),
        ...(comp.sectionB?.disagreements || []),
      ];
      return allItems.find(c => c.key === item.key);
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
    if (item.type === NAV_ITEM_TYPES.DOMAIN_JUDGEMENT) {
      return comp.domains?.[item.domainKey];
    }
    if (item.type === NAV_ITEM_TYPES.OVERALL_JUDGEMENT) {
      return comp.overall;
    }
    return null;
  };

  return (
    <div class='bg-blue-50'>
      <div class='mx-auto max-w-7xl px-4 py-4'>
        <confirmDialog.ConfirmDialogComponent />

        {/* Critical Risk Warning Banner */}
        <Show when={sectionBCritical()}>
          <div class='mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
            <AiOutlineWarning class='h-5 w-5 shrink-0' />
            <div>
              <span class='font-medium'>Critical Risk Detected:</span> Section B indicates this
              study may be at critical risk of bias. Consider whether to proceed with full domain
              assessment.
            </div>
          </div>
        </Show>

        {/* Main Content */}
        <Show when={viewMode() === 'questions'}>
          <Show when={currentNavItem()} fallback={<div class='py-12 text-center'>Loading...</div>}>
            <Switch>
              {/* Section B Question */}
              <Match when={currentNavItem()?.type === NAV_ITEM_TYPES.SECTION_B}>
                <SectionBQuestionPage
                  questionKey={currentNavItem().key}
                  reviewer1Data={props.checklist1?.sectionB?.[currentNavItem().key]}
                  reviewer2Data={props.checklist2?.sectionB?.[currentNavItem().key]}
                  finalData={finalAnswers().sectionB?.[currentNavItem().key]}
                  finalCommentYText={
                    props.getRobinsText?.('sectionB', 'comment', currentNavItem().key)
                  }
                  reviewer1Name={props.reviewer1Name || 'Reviewer 1'}
                  reviewer2Name={props.reviewer2Name || 'Reviewer 2'}
                  isAgreement={isNavItemAgreement(currentNavItem(), comparison())}
                  onFinalAnswerChange={answer => updateSectionBAnswer(currentNavItem().key, answer)}
                  onUseReviewer1={() => {
                    const data = props.checklist1?.sectionB?.[currentNavItem().key];
                    if (data) {
                      updateSectionBAnswer(currentNavItem().key, data.answer);
                      copyCommentToYText('sectionB', 'comment', currentNavItem().key, data.comment);
                    }
                  }}
                  onUseReviewer2={() => {
                    const data = props.checklist2?.sectionB?.[currentNavItem().key];
                    if (data) {
                      updateSectionBAnswer(currentNavItem().key, data.answer);
                      copyCommentToYText('sectionB', 'comment', currentNavItem().key, data.comment);
                    }
                  }}
                />
              </Match>

              {/* Domain Question */}
              <Match when={currentNavItem()?.type === NAV_ITEM_TYPES.DOMAIN_QUESTION}>
                <DomainQuestionPage
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
                  finalCommentYText={
                    props.getRobinsText?.(
                      currentNavItem().domainKey,
                      'comment',
                      currentNavItem().key,
                    )
                  }
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

              {/* Domain Judgement */}
              <Match when={currentNavItem()?.type === NAV_ITEM_TYPES.DOMAIN_JUDGEMENT}>
                <DomainJudgementPage
                  domainKey={currentNavItem().domainKey}
                  reviewer1Data={props.checklist1?.[currentNavItem().domainKey]}
                  reviewer2Data={props.checklist2?.[currentNavItem().domainKey]}
                  finalData={finalAnswers()[currentNavItem().domainKey]}
                  reviewer1Name={props.reviewer1Name || 'Reviewer 1'}
                  reviewer2Name={props.reviewer2Name || 'Reviewer 2'}
                  judgementMatch={getCurrentItemComparison()?.judgementMatch}
                  directionMatch={getCurrentItemComparison()?.directionMatch}
                  onFinalJudgementChange={judgement =>
                    updateDomainJudgement(
                      currentNavItem().domainKey,
                      judgement,
                      finalAnswers()[currentNavItem().domainKey]?.direction,
                    )
                  }
                  onFinalDirectionChange={direction =>
                    updateDomainJudgement(
                      currentNavItem().domainKey,
                      finalAnswers()[currentNavItem().domainKey]?.judgement,
                      direction,
                    )
                  }
                  onUseReviewer1Judgement={() => {
                    const data = props.checklist1?.[currentNavItem().domainKey];
                    if (data)
                      updateDomainJudgement(
                        currentNavItem().domainKey,
                        data.judgement,
                        finalAnswers()[currentNavItem().domainKey]?.direction,
                      );
                  }}
                  onUseReviewer2Judgement={() => {
                    const data = props.checklist2?.[currentNavItem().domainKey];
                    if (data)
                      updateDomainJudgement(
                        currentNavItem().domainKey,
                        data.judgement,
                        finalAnswers()[currentNavItem().domainKey]?.direction,
                      );
                  }}
                  onUseReviewer1Direction={() => {
                    const data = props.checklist1?.[currentNavItem().domainKey];
                    if (data)
                      updateDomainJudgement(
                        currentNavItem().domainKey,
                        finalAnswers()[currentNavItem().domainKey]?.judgement,
                        data.direction,
                      );
                  }}
                  onUseReviewer2Direction={() => {
                    const data = props.checklist2?.[currentNavItem().domainKey];
                    if (data)
                      updateDomainJudgement(
                        currentNavItem().domainKey,
                        finalAnswers()[currentNavItem().domainKey]?.judgement,
                        data.direction,
                      );
                  }}
                />
              </Match>

              {/* Overall Judgement */}
              <Match when={currentNavItem()?.type === NAV_ITEM_TYPES.OVERALL_JUDGEMENT}>
                <OverallJudgementPage
                  reviewer1Data={props.checklist1?.overall}
                  reviewer2Data={props.checklist2?.overall}
                  finalData={finalAnswers().overall}
                  reviewer1Name={props.reviewer1Name || 'Reviewer 1'}
                  reviewer2Name={props.reviewer2Name || 'Reviewer 2'}
                  judgementMatch={getCurrentItemComparison()?.judgementMatch}
                  directionMatch={getCurrentItemComparison()?.directionMatch}
                  onFinalJudgementChange={judgement =>
                    updateOverallJudgement(judgement, finalAnswers().overall?.direction)
                  }
                  onFinalDirectionChange={direction =>
                    updateOverallJudgement(finalAnswers().overall?.judgement, direction)
                  }
                  onUseReviewer1Judgement={() => {
                    const data = props.checklist1?.overall;
                    if (data)
                      updateOverallJudgement(data.judgement, finalAnswers().overall?.direction);
                  }}
                  onUseReviewer2Judgement={() => {
                    const data = props.checklist2?.overall;
                    if (data)
                      updateOverallJudgement(data.judgement, finalAnswers().overall?.direction);
                  }}
                  onUseReviewer1Direction={() => {
                    const data = props.checklist1?.overall;
                    if (data)
                      updateOverallJudgement(finalAnswers().overall?.judgement, data.direction);
                  }}
                  onUseReviewer2Direction={() => {
                    const data = props.checklist2?.overall;
                    if (data)
                      updateOverallJudgement(finalAnswers().overall?.judgement, data.direction);
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
                <AiOutlineArrowLeft class='h-4 w-4' />
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
                <AiOutlineArrowRight class='h-4 w-4' />
              </button>
            </div>
          </Show>
        </Show>

        {/* Summary View */}
        <Show when={viewMode() === 'summary'}>
          <RobinsISummaryView
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
