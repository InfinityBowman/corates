/**
 * ChecklistReconciliation - Main view for comparing and reconciling two checklists
 * Shows one question per page with navigation, allowing fine-grained merging of answers
 */

import { createSignal, createMemo, createEffect, Show } from 'solid-js';
import { FiArrowLeft, FiArrowRight } from 'solid-icons/fi';
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
  getReconciliationSummary,
  getQuestionKeys,
  getDataKeysForQuestion,
  isMultiPartQuestion,
} from '@/components/checklist/AMSTAR2Checklist/checklist-compare.js';
import ReconciliationQuestionPage from './ReconciliationQuestionPage.jsx';
import SummaryView from './SummaryView.jsx';
import { createChecklist } from '@/components/checklist/AMSTAR2Checklist/checklist.js';

/**
 * ChecklistReconciliation - Main view for comparing and reconciling two checklists
 * Shows one question per page with navigation, allowing fine-grained merging of answers
 * @param {Object} props
 * @param {Object} props.checklist1 - First reviewer's checklist data
 * @param {Object} props.checklist2 - Second reviewer's checklist data
 * @param {Object} props.reconciledChecklist - The reconciled checklist data (read from Yjs, reactive)
 * @param {string} props.reconciledChecklistId - ID of the reconciled checklist
 * @param {Function} props.onSaveReconciled - Callback when reconciled checklist is saved (receives reconciledName)
 * @param {Function} props.onCancel - Callback to cancel and go back
 * @param {string} props.reviewer1Name - Display name for first reviewer
 * @param {string} props.reviewer2Name - Display name for second reviewer
 * @param {Function} props.setNavbarStore - Store setter for navbar state (deep reactivity)
 * @param {Function} props.getQuestionNote - Function to get Y.Text for a question note (questionKey => Y.Text)
 * @param {Function} props.updateChecklistAnswer - Function to update a question answer in the reconciled checklist
 * @returns {JSX.Element}
 */
export default function ChecklistReconciliation(props) {
  // Reconciled checklist metadata
  const [reconciledName, setReconciledName] = createSignal('Reconciled Checklist');
  const [saving, setSaving] = createSignal(false);

  // Finish confirmation dialog state
  const [finishDialogOpen, setFinishDialogOpen] = createSignal(false);

  // Navigation state in localStorage (not synced across clients)
  const getStorageKey = () => {
    if (!props.checklist1?.id || !props.checklist2?.id) return null;
    return `reconciliation-nav-${props.checklist1.id}-${props.checklist2.id}`;
  };

  // Save navigation state to localStorage
  const saveNavigationState = (page, mode) => {
    const key = getStorageKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify({ currentPage: page, viewMode: mode }));
    } catch (e) {
      console.error('Failed to save navigation state:', e);
    }
  };

  // Load initial navigation state from localStorage (in tracked scope)
  const [currentPage, setCurrentPage] = createSignal(0);
  const [viewMode, setViewMode] = createSignal('questions');

  // Initialize navigation state from localStorage
  createEffect(() => {
    // Only run once when checklists are available
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
    const page = currentPage();
    const mode = viewMode();
    saveNavigationState(page, mode);
  });

  // All question keys in order
  const questionKeys = getQuestionKeys();
  const totalPages = questionKeys.length;

  // Compare the two checklists
  const comparison = createMemo(() => {
    if (!props.checklist1 || !props.checklist2) return null;
    return compareChecklists(props.checklist1, props.checklist2);
  });

  // Get reconciliation summary
  const summary = createMemo(() => {
    const comp = comparison();
    if (!comp) return null;
    return getReconciliationSummary(comp);
  });

  // Build a map of question key to comparison data
  const comparisonByQuestion = createMemo(() => {
    const comp = comparison();
    if (!comp) return {};

    const map = {};
    for (const item of [...comp.agreements, ...comp.disagreements]) {
      map[item.key] = item;
    }
    return map;
  });

  // Get finalAnswers from reconciled checklist (reactive to Yjs changes)
  const finalAnswers = createMemo(() => {
    const reconciled = props.reconciledChecklist;
    if (!reconciled) return {};
    // Extract question answers (q1, q2, etc.) from reconciled checklist
    // Handle multi-part questions (q9, q11) by nesting q9a/q9b under q9
    const answers = {};
    for (const key of questionKeys) {
      if (isMultiPartQuestion(key)) {
        // For multi-part questions, nest the parts under the parent key
        const dataKeys = getDataKeysForQuestion(key);
        const parts = {};
        let hasAnyPart = false;
        for (const dk of dataKeys) {
          if (reconciled[dk]) {
            parts[dk] = reconciled[dk];
            hasAnyPart = true;
          }
        }
        if (hasAnyPart) {
          answers[key] = parts;
        }
      } else {
        // Regular question
        if (reconciled[key]) {
          answers[key] = reconciled[key];
        }
      }
    }
    return answers;
  });

  // Expose navbar props for external rendering via store
  createEffect(() => {
    if (props.setNavbarStore) {
      props.setNavbarStore({
        questionKeys,
        viewMode: viewMode(),
        currentPage: currentPage(),
        comparisonByQuestion: comparisonByQuestion(),
        finalAnswers: finalAnswers(),
        summary: summary(),
        reviewedCount: reviewedCount(),
        totalPages,
        setViewMode,
        goToQuestion,
        onReset: handleReset,
      });
    }
  });

  // Current question key
  const currentQuestionKey = () => questionKeys[currentPage()];

  // Current question comparison
  const currentComparison = () => comparisonByQuestion()[currentQuestionKey()];

  // Get reviewer answers for the current question (handles multi-part questions)
  const getReviewerAnswers = (checklist, questionKey) => {
    if (!checklist) return null;
    if (isMultiPartQuestion(questionKey)) {
      const dataKeys = getDataKeysForQuestion(questionKey);
      const parts = {};
      for (const dk of dataKeys) {
        parts[dk] = checklist[dk];
      }
      return parts;
    }
    return checklist[questionKey];
  };

  // Get reviewer note for a question
  // For multi-part questions (q9, q11), notes are stored at the parent level
  const getReviewerNote = (checklist, questionKey) => {
    if (!checklist) return '';
    // For multi-part questions, the note is at the parent level (q9 or q11)
    const noteData = checklist[questionKey];
    if (noteData?.note !== undefined) {
      return typeof noteData.note === 'string' ? noteData.note : noteData.note?.toString?.() || '';
    }
    return '';
  };

  // No initialization needed - finalAnswers come from reconciled checklist (reactive to Yjs)

  // Get current question's final answer from reconciled checklist
  const currentFinalAnswer = () => {
    const reconciled = props.reconciledChecklist;
    if (!reconciled) return null;
    const key = currentQuestionKey();

    // Handle multi-part questions (q9, q11) - data is stored as q9a/q9b
    if (isMultiPartQuestion(key)) {
      const dataKeys = getDataKeysForQuestion(key);
      const parts = {};
      let hasAnyPart = false;
      for (const dk of dataKeys) {
        if (reconciled[dk]) {
          parts[dk] = reconciled[dk];
          hasAnyPart = true;
        }
      }
      return hasAnyPart ? parts : null;
    }

    // Regular question
    return reconciled[key] || null;
  };

  // Update final answer for current question - write directly to Yjs via updateChecklistAnswer
  function handleFinalChange(newAnswer) {
    if (!props.updateChecklistAnswer) return;
    const key = currentQuestionKey();

    // Handle multi-part questions (q9, q11) - newAnswer is { q9a: {...}, q9b: {...} }
    if (isMultiPartQuestion(key)) {
      const dataKeys = getDataKeysForQuestion(key);
      for (const dk of dataKeys) {
        if (newAnswer[dk]) {
          props.updateChecklistAnswer(dk, newAnswer[dk]);
        }
      }
    } else {
      // Regular question - newAnswer is the question data directly
      props.updateChecklistAnswer(key, newAnswer);
    }
    // Note: No need to update local state - Yjs will sync and reconciledChecklist will update reactively
  }

  // Navigation
  function goToNext() {
    // Auto-confirm current question's answer when clicking Next
    const key = currentQuestionKey();
    const currentFinal = finalAnswers()[key];

    // If no final answer set yet, use reviewer1's answer as default
    if (!currentFinal && props.checklist1 && props.updateChecklistAnswer) {
      const defaultAnswer = getReviewerAnswers(props.checklist1, key);
      if (defaultAnswer) {
        // Write directly to Yjs via updateChecklistAnswer
        // handleFinalChange will handle multi-part questions correctly
        handleFinalChange(JSON.parse(JSON.stringify(defaultAnswer)));
      }
    }

    if (currentPage() < totalPages - 1) {
      setCurrentPage(p => p + 1);
    } else {
      // Last page - go to summary
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

  function goToQuestion(index) {
    setCurrentPage(index);
    setViewMode('questions');
  }

  // Reset all reconciliation answers
  async function handleReset() {
    if (!props.updateChecklistAnswer) return;

    // Get default empty structure from createChecklist
    const defaultChecklist = createChecklist({
      name: 'temp',
      id: 'temp',
    });

    // Clear all answers in the reconciled checklist by setting to default empty structure
    for (const key of questionKeys) {
      if (isMultiPartQuestion(key)) {
        // For multi-part questions, reset each part
        const dataKeys = getDataKeysForQuestion(key);
        for (const dk of dataKeys) {
          if (defaultChecklist[dk]) {
            props.updateChecklistAnswer(dk, defaultChecklist[dk]);
          }
        }
      } else {
        if (defaultChecklist[key]) {
          props.updateChecklistAnswer(key, defaultChecklist[key]);
        }
      }
    }

    setCurrentPage(0);
    setViewMode('questions');
    showToast.info('Reconciliation Reset', 'All reconciliations have been cleared.');
  }

  // Helper to check if a question has a valid final answer
  function hasValidFinalAnswer(key, finals) {
    if (!finals[key]) return false;

    if (isMultiPartQuestion(key)) {
      // For multi-part questions, check each part
      const dataKeys = getDataKeysForQuestion(key);
      for (const dk of dataKeys) {
        if (!finals[key][dk]) return false;
        const lastCol = finals[key][dk].answers?.[finals[key][dk].answers.length - 1];
        if (!lastCol || !lastCol.some(v => v === true)) return false;
      }
      return true;
    } else {
      // Regular question
      const lastCol = finals[key].answers?.[finals[key].answers.length - 1];
      return lastCol && lastCol.some(v => v === true);
    }
  }

  // Check if all questions have been answered
  const allAnswered = createMemo(() => {
    const finals = finalAnswers();
    for (const key of questionKeys) {
      if (!hasValidFinalAnswer(key, finals)) return false;
    }
    return true;
  });

  // Count how many questions have been reviewed (have a selection in final column)
  const reviewedCount = createMemo(() => {
    const finals = finalAnswers();
    let count = 0;
    for (const key of questionKeys) {
      if (hasValidFinalAnswer(key, finals)) count++;
    }
    return count;
  });

  // Handle save - opens confirmation dialog
  function handleSave() {
    if (!allAnswered()) {
      showToast.error('Incomplete Review', 'Please review all questions before saving.');
      return;
    }
    setFinishDialogOpen(true);
  }

  // Execute save after confirmation
  async function confirmSave() {
    setSaving(true);
    try {
      // Just pass the name - the checklist already exists and has all the answers
      await props.onSaveReconciled?.(reconciledName());
      setFinishDialogOpen(false);
    } catch (err) {
      console.error('Error saving reconciled checklist:', err);
      showToast.error('Save Failed', 'Failed to save reconciled checklist. Please try again.');
    } finally {
      setSaving(false);
    }
  }

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
                    This will mark the reconciled checklist as completed and end this
                    reconciliation. You will no longer be able to edit these reconciliation answers
                    afterwards.
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
        {/* Main Content */}
        <Show when={viewMode() === 'questions'}>
          <Show
            when={comparison() && currentQuestionKey()}
            fallback={<div class='py-12 text-center'>Loading...</div>}
          >
            <ReconciliationQuestionPage
              questionKey={currentQuestionKey()}
              reviewer1Answers={getReviewerAnswers(props.checklist1, currentQuestionKey())}
              reviewer2Answers={getReviewerAnswers(props.checklist2, currentQuestionKey())}
              finalAnswers={currentFinalAnswer()}
              onFinalChange={handleFinalChange}
              reviewer1Name={props.reviewer1Name || props.checklist1?.reviewerName || 'Reviewer 1'}
              reviewer2Name={props.reviewer2Name || props.checklist2?.reviewerName || 'Reviewer 2'}
              isAgreement={currentComparison()?.isAgreement ?? true}
              isMultiPart={isMultiPartQuestion(currentQuestionKey())}
              reviewer1Note={getReviewerNote(props.checklist1, currentQuestionKey())}
              reviewer2Note={getReviewerNote(props.checklist2, currentQuestionKey())}
              finalNoteYText={props.getQuestionNote?.(currentQuestionKey())}
            />

            {/* Navigation Buttons */}
            <div class='mt-4 flex items-center justify-between'>
              <button
                onClick={goToPrevious}
                disabled={currentPage() === 0}
                class={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
                  currentPage() === 0 ?
                    'bg-secondary text-muted-foreground/70 cursor-not-allowed'
                  : 'bg-card text-secondary-foreground hover:bg-secondary shadow'
                } `}
              >
                <FiArrowLeft class='h-4 w-4' />
                Previous
              </button>

              <div class='text-muted-foreground text-sm'>
                Question {currentPage() + 1} of {totalPages}
              </div>

              <button
                onClick={goToNext}
                class='flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow transition-colors hover:bg-blue-700'
              >
                {currentPage() === totalPages - 1 ? 'Review Summary' : 'Next'}
                <FiArrowRight class='h-4 w-4' />
              </button>
            </div>
          </Show>
        </Show>

        {/* Summary View */}
        <Show when={viewMode() === 'summary'}>
          <SummaryView
            questionKeys={questionKeys}
            finalAnswers={finalAnswers()}
            comparison={comparison()}
            comparisonByQuestion={comparisonByQuestion()}
            reconciledName={reconciledName()}
            onReconciledNameChange={setReconciledName}
            onGoToQuestion={goToQuestion}
            onSave={handleSave}
            onBack={goToPrevious}
            allAnswered={allAnswered()}
            saving={saving()}
            summary={summary()}
            reviewer1Name={props.reviewer1Name}
            reviewer2Name={props.reviewer2Name}
          />
        </Show>
      </div>
    </div>
  );
}
