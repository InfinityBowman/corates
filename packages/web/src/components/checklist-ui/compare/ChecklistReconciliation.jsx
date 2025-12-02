/**
 * ChecklistReconciliation - Main view for comparing and reconciling two checklists
 * Shows one question per page with navigation, allowing fine-grained merging of answers
 */

import { createSignal, createMemo, createEffect, Show } from 'solid-js';
import { AiOutlineArrowLeft, AiOutlineArrowRight } from 'solid-icons/ai';
import { showToast } from '@components/zag/Toast.jsx';
import {
  compareChecklists,
  getReconciliationSummary,
  getQuestionKeys,
  getDataKeysForQuestion,
  isMultiPartQuestion,
} from '@/AMSTAR2/checklist-compare.js';
import ReconciliationQuestionPage from './ReconciliationQuestionPage.jsx';
import SummaryView from './SummaryView.jsx';
import Navbar from './Navbar.jsx';

export default function ChecklistReconciliation(props) {
  // props.checklist1 - First reviewer's checklist data
  // props.checklist2 - Second reviewer's checklist data
  // props.onSaveReconciled - Callback when reconciled checklist is saved
  // props.onSaveProgress - Callback to save progress for resuming later
  // props.savedProgress - Previously saved progress (if resuming)
  // props.onCancel - Callback to cancel and go back
  // props.reviewer1Name - Display name for first reviewer
  // props.reviewer2Name - Display name for second reviewer

  // Track if we've initialized from saved progress
  const [initialized, setInitialized] = createSignal(false);

  // Current page index
  const [currentPage, setCurrentPage] = createSignal(0);

  // Final answers for each question (the reconciled/merged answers)
  const [finalAnswers, setFinalAnswers] = createSignal({});

  // Reconciled checklist metadata
  const [reconciledName, setReconciledName] = createSignal('Reconciled Checklist');
  const [saving, setSaving] = createSignal(false);

  // View mode: 'questions' or 'summary'
  const [viewMode, setViewMode] = createSignal('questions');

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

  // Initialize final answers from saved progress or reviewer1 by default
  createEffect(() => {
    if (!props.checklist1 || initialized()) return;

    // If we have saved progress with actual answers, use it
    if (
      props.savedProgress?.finalAnswers &&
      Object.keys(props.savedProgress.finalAnswers).length > 0
    ) {
      setFinalAnswers(props.savedProgress.finalAnswers);
      setCurrentPage(props.savedProgress.currentPage || 0);
      setViewMode(props.savedProgress.viewMode || 'questions');
      setInitialized(true);
      return;
    }

    // Otherwise initialize from reviewer1's answers
    const initial = {};
    for (const key of questionKeys) {
      if (isMultiPartQuestion(key)) {
        // For multi-part questions, store each part separately
        const dataKeys = getDataKeysForQuestion(key);
        const parts = {};
        let hasAllParts = true;
        for (const dk of dataKeys) {
          if (props.checklist1[dk]) {
            parts[dk] = JSON.parse(JSON.stringify(props.checklist1[dk]));
          } else {
            hasAllParts = false;
          }
        }
        if (hasAllParts) {
          initial[key] = parts;
        }
      } else if (props.checklist1[key]) {
        initial[key] = JSON.parse(JSON.stringify(props.checklist1[key]));
      }
    }
    setFinalAnswers(initial);
    setInitialized(true);
  });

  // Save progress whenever state changes (debounced via effect)
  createEffect(() => {
    // Skip if not initialized or no save function
    if (!initialized() || !props.onSaveProgress) return;

    // Capture current state
    const progress = {
      currentPage: currentPage(),
      viewMode: viewMode(),
      finalAnswers: finalAnswers(),
    };

    // Save progress
    props.onSaveProgress(progress);
  });

  // Get current question's final answer
  const currentFinalAnswer = () => finalAnswers()[currentQuestionKey()];

  // Update final answer for current question
  function handleFinalChange(newAnswer) {
    setFinalAnswers(prev => ({
      ...prev,
      [currentQuestionKey()]: newAnswer,
    }));
  }

  // Navigation
  function goToNext() {
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

  // Handle save
  async function handleSave() {
    if (!allAnswered()) {
      showToast.error('Incomplete Review', 'Please review all questions before saving.');
      return;
    }

    setSaving(true);
    try {
      // Build the reconciled checklist object - flatten multi-part questions
      const finals = finalAnswers();
      const flattenedAnswers = {};
      for (const key of questionKeys) {
        if (isMultiPartQuestion(key)) {
          // Flatten q9 -> q9a, q9b or q11 -> q11a, q11b
          const dataKeys = getDataKeysForQuestion(key);
          for (const dk of dataKeys) {
            if (finals[key]?.[dk]) {
              flattenedAnswers[dk] = finals[key][dk];
            }
          }
        } else {
          if (finals[key]) {
            flattenedAnswers[key] = finals[key];
          }
        }
      }

      const reconciled = {
        name: reconciledName(),
        reviewerName: 'Consensus',
        createdAt: new Date().toISOString().split('T')[0],
        id: `reconciled-${Date.now()}`,
        isReconciled: true,
        sourceChecklists: [props.checklist1?.id, props.checklist2?.id],
        ...flattenedAnswers,
      };

      await props.onSaveReconciled?.(reconciled);
    } catch (err) {
      console.error('Error saving reconciled checklist:', err);
      showToast.error('Save Failed', 'Failed to save reconciled checklist. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class='min-h-screen bg-blue-50'>
      <div class='container mx-auto px-4 py-6 max-w-7xl'>
        {/* Header */}
        <div class='bg-white rounded-lg shadow-lg p-4 mb-4'>
          <div class='flex items-center justify-between'>
            <div class='flex items-center gap-4'>
              <button
                onClick={() => props.onCancel?.()}
                class='p-2 hover:bg-gray-100 rounded-lg transition-colors'
                title='Go back'
              >
                <AiOutlineArrowLeft class='w-5 h-5 text-gray-600' />
              </button>
              <div>
                <h1 class='text-xl font-bold text-gray-900'>Checklist Reconciliation</h1>
                <p class='text-gray-500 text-sm'>
                  {props.reviewer1Name || 'Reviewer 1'} vs {props.reviewer2Name || 'Reviewer 2'}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div class='flex items-center gap-4'>
              <div class='text-sm text-gray-600'>
                <span class='font-medium'>{reviewedCount()}</span> of{' '}
                <span class='font-medium'>{totalPages}</span> reviewed
              </div>
              <Show when={summary()}>
                <div class='flex items-center gap-2'>
                  <span class='px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded'>
                    {summary().agreementCount} agree
                  </span>
                  <span class='px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded'>
                    {summary().disagreementCount} differ
                  </span>
                </div>
              </Show>
            </div>
          </div>

          {/* Question Navigation Pills */}
          <Navbar
            questionKeys={questionKeys}
            viewMode={viewMode()}
            setViewMode={setViewMode}
            currentPage={currentPage()}
            goToQuestion={goToQuestion}
            comparisonByQuestion={comparisonByQuestion()}
            finalAnswers={finalAnswers()}
          />
        </div>

        {/* Main Content */}
        <Show when={viewMode() === 'questions'}>
          <Show
            when={comparison() && currentQuestionKey()}
            fallback={<div class='text-center py-12'>Loading...</div>}
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
            />

            {/* Navigation Buttons */}
            <div class='mt-4 flex items-center justify-between'>
              <button
                onClick={goToPrevious}
                disabled={currentPage() === 0}
                class={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
                  ${
                    currentPage() === 0 ?
                      'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-100 shadow'
                  }
                `}
              >
                <AiOutlineArrowLeft class='w-4 h-4' />
                Previous
              </button>

              <div class='text-sm text-gray-600'>
                Question {currentPage() + 1} of {totalPages}
              </div>

              <button
                onClick={goToNext}
                class='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow'
              >
                {currentPage() === totalPages - 1 ? 'Review Summary' : 'Next'}
                <AiOutlineArrowRight class='w-4 h-4' />
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
