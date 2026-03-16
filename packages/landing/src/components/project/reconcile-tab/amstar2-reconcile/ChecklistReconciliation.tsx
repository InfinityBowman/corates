/**
 * ChecklistReconciliation - Main view for comparing and reconciling two AMSTAR2 checklists
 * Shows one question per page with navigation, allowing fine-grained merging of answers.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
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
  getReconciliationSummary,
  getQuestionKeys,
  getDataKeysForQuestion,
  isMultiPartQuestion,
} from '@/components/checklist/AMSTAR2Checklist/checklist-compare.js';
import { ReconciliationQuestionPage } from './ReconciliationQuestionPage';
import { SummaryView } from './SummaryView';
import { createChecklist } from '@/components/checklist/AMSTAR2Checklist/checklist.js';

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

interface ChecklistReconciliationProps {
  checklist1: any;
  checklist2: any;
  reconciledChecklist: any;
  reconciledChecklistId: string | null;
  onSaveReconciled: (_name?: string) => void;
  onCancel: () => void;
  reviewer1Name: string;
  reviewer2Name: string;
  setNavbarStore: (_state: NavbarState) => void;
  getQuestionNote: (_questionKey: string) => any;
  updateChecklistAnswer: (_questionKey: string, _questionData: any) => void;
}

export function ChecklistReconciliation({
  checklist1,
  checklist2,
  reconciledChecklist,
  onSaveReconciled,
  onCancel: _onCancel,
  reviewer1Name,
  reviewer2Name,
  setNavbarStore,
  getQuestionNote,
  updateChecklistAnswer,
}: ChecklistReconciliationProps) {
  const [reconciledName, setReconciledName] = useState('Reconciled Checklist');
  const [saving, setSaving] = useState(false);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);

  // Navigation state in localStorage
  const getStorageKey = useCallback(() => {
    if (!checklist1?.id || !checklist2?.id) return null;
    return `reconciliation-nav-${checklist1.id}-${checklist2.id}`;
  }, [checklist1?.id, checklist2?.id]);

  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState('questions');

  // Load navigation state from localStorage on mount
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

  // All question keys in order
  const questionKeys = useMemo(() => getQuestionKeys(), []);
  const totalPages = questionKeys.length;

  // Compare the two checklists
  const comparison = useMemo(() => {
    if (!checklist1 || !checklist2) return null;
    return compareChecklists(checklist1, checklist2);
  }, [checklist1, checklist2]);

  // Get reconciliation summary
  const summary = useMemo(() => {
    if (!comparison) return null;
    return getReconciliationSummary(comparison);
  }, [comparison]);

  // Build a map of question key to comparison data
  const comparisonByQuestion = useMemo(() => {
    if (!comparison) return {};
    const map: Record<string, any> = {};
    for (const item of [...comparison.agreements, ...comparison.disagreements]) {
      map[item.key] = item;
    }
    return map;
  }, [comparison]);

  // Get finalAnswers from reconciled checklist (reactive to Yjs changes)
  const finalAnswers = useMemo(() => {
    if (!reconciledChecklist) return {};
    const answers: Record<string, any> = {};
    for (const key of questionKeys) {
      if (isMultiPartQuestion(key)) {
        const dataKeys = getDataKeysForQuestion(key);
        const parts: Record<string, any> = {};
        let hasAnyPart = false;
        for (const dk of dataKeys) {
          if (reconciledChecklist[dk]) {
            parts[dk] = reconciledChecklist[dk];
            hasAnyPart = true;
          }
        }
        if (hasAnyPart) answers[key] = parts;
      } else {
        if (reconciledChecklist[key]) answers[key] = reconciledChecklist[key];
      }
    }
    return answers;
  }, [reconciledChecklist, questionKeys]);

  // Helper to check if a question has a valid final answer
  function hasValidFinalAnswer(key: string, finals: Record<string, any>) {
    if (!finals[key]) return false;
    if (isMultiPartQuestion(key)) {
      const dataKeys = getDataKeysForQuestion(key);
      for (const dk of dataKeys) {
        if (!finals[key][dk]) return false;
        const lastCol = finals[key][dk].answers?.[finals[key][dk].answers.length - 1];
        if (!lastCol || !lastCol.some((v: boolean) => v === true)) return false;
      }
      return true;
    }
    const lastCol = finals[key].answers?.[finals[key].answers.length - 1];
    return lastCol && lastCol.some((v: boolean) => v === true);
  }

  const allAnswered = useMemo(() => {
    return questionKeys.every(key => hasValidFinalAnswer(key, finalAnswers));
  }, [questionKeys, finalAnswers]);

  const reviewedCount = useMemo(() => {
    return questionKeys.filter(key => hasValidFinalAnswer(key, finalAnswers)).length;
  }, [questionKeys, finalAnswers]);

  // Navigation functions
  const goToQuestion = useCallback((index: number) => {
    setCurrentPage(index);
    setViewMode('questions');
  }, []);

  // Reset all reconciliation answers
  const handleReset = useCallback(() => {
    if (!updateChecklistAnswer) return;

    const defaultChecklist = createChecklist({ name: 'temp', id: 'temp' });

    for (const key of questionKeys) {
      if (isMultiPartQuestion(key)) {
        const dataKeys = getDataKeysForQuestion(key);
        for (const dk of dataKeys) {
          if ((defaultChecklist as Record<string, any>)[dk])
            updateChecklistAnswer(dk, (defaultChecklist as Record<string, any>)[dk]);
        }
      } else {
        if ((defaultChecklist as Record<string, any>)[key])
          updateChecklistAnswer(key, (defaultChecklist as Record<string, any>)[key]);
      }
    }

    setCurrentPage(0);
    setViewMode('questions');
    showToast.info('Reconciliation Reset', 'All reconciliations have been cleared.');
  }, [updateChecklistAnswer, questionKeys]);

  // Expose navbar props for external rendering
  useEffect(() => {
    setNavbarStore({
      questionKeys,
      viewMode,
      currentPage,
      comparisonByQuestion,
      finalAnswers,
      summary,
      reviewedCount,
      totalPages,
      setViewMode,
      goToQuestion,
      onReset: handleReset,
    });
  }, [
    questionKeys,
    viewMode,
    currentPage,
    comparisonByQuestion,
    finalAnswers,
    summary,
    reviewedCount,
    totalPages,
    goToQuestion,
    setNavbarStore,
    handleReset,
  ]);

  const currentQuestionKey = questionKeys[currentPage];
  const currentComparison = comparisonByQuestion[currentQuestionKey];

  // Get reviewer answers for the current question
  const getReviewerAnswers = (checklist: any, questionKey: string) => {
    if (!checklist) return null;
    if (isMultiPartQuestion(questionKey)) {
      const dataKeys = getDataKeysForQuestion(questionKey);
      const parts: Record<string, any> = {};
      for (const dk of dataKeys) {
        parts[dk] = checklist[dk];
      }
      return parts;
    }
    return checklist[questionKey];
  };

  // Get reviewer note for a question
  const getReviewerNote = (checklist: any, questionKey: string) => {
    if (!checklist) return '';
    const noteData = checklist[questionKey];
    if (noteData?.note !== undefined) {
      return typeof noteData.note === 'string' ? noteData.note : noteData.note?.toString?.() || '';
    }
    return '';
  };

  // Get current question's final answer from reconciled checklist
  const currentFinalAnswer = useMemo(() => {
    if (!reconciledChecklist) return null;
    const key = currentQuestionKey;
    if (isMultiPartQuestion(key)) {
      const dataKeys = getDataKeysForQuestion(key);
      const parts: Record<string, any> = {};
      let hasAnyPart = false;
      for (const dk of dataKeys) {
        if (reconciledChecklist[dk]) {
          parts[dk] = reconciledChecklist[dk];
          hasAnyPart = true;
        }
      }
      return hasAnyPart ? parts : null;
    }
    return reconciledChecklist[key] || null;
  }, [reconciledChecklist, currentQuestionKey]);

  // Update final answer - write directly to Yjs
  function handleFinalChange(newAnswer: any) {
    if (!updateChecklistAnswer) return;
    const key = currentQuestionKey;
    if (isMultiPartQuestion(key)) {
      const dataKeys = getDataKeysForQuestion(key);
      for (const dk of dataKeys) {
        if (newAnswer[dk]) updateChecklistAnswer(dk, newAnswer[dk]);
      }
    } else {
      updateChecklistAnswer(key, newAnswer);
    }
  }

  // Navigation
  function goToNext() {
    const key = currentQuestionKey;
    const currentFinal = finalAnswers[key];

    // Auto-fill from reviewer1 if no final answer set yet
    if (!currentFinal && checklist1) {
      const defaultAnswer = getReviewerAnswers(checklist1, key);
      if (defaultAnswer) {
        handleFinalChange(JSON.parse(JSON.stringify(defaultAnswer)));
      }
    }

    if (currentPage < totalPages - 1) {
      setCurrentPage(p => p + 1);
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
      setCurrentPage(p => p - 1);
    }
  }

  function handleSave() {
    if (!allAnswered) {
      showToast.error('Incomplete Review', 'Please review all questions before saving.');
      return;
    }
    setFinishDialogOpen(true);
  }

  async function confirmSave() {
    setSaving(true);
    try {
      await onSaveReconciled?.(reconciledName);
      setFinishDialogOpen(false);
    } catch (err) {
      console.error('Error saving reconciled checklist:', err);
      showToast.error('Save Failed', 'Failed to save reconciled checklist. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className='bg-blue-50'>
      <div className='mx-auto max-w-7xl px-4 py-4'>
        {/* Finish confirmation dialog */}
        <AlertDialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finish reconciliation?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the reconciled checklist as completed and end this reconciliation.
                You will no longer be able to edit these reconciliation answers afterwards.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button
                variant='outline'
                onClick={() => setFinishDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <AlertDialogAction disabled={saving} onClick={confirmSave}>
                {saving ? 'Saving...' : 'Finish'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Main Content */}
        {viewMode === 'questions' && (
          <>
            {comparison && currentQuestionKey ?
              <>
                <ReconciliationQuestionPage
                  questionKey={currentQuestionKey}
                  reviewer1Answers={getReviewerAnswers(checklist1, currentQuestionKey)}
                  reviewer2Answers={getReviewerAnswers(checklist2, currentQuestionKey)}
                  finalAnswers={currentFinalAnswer}
                  onFinalChange={handleFinalChange}
                  reviewer1Name={reviewer1Name || checklist1?.reviewerName || 'Reviewer 1'}
                  reviewer2Name={reviewer2Name || checklist2?.reviewerName || 'Reviewer 2'}
                  isAgreement={currentComparison?.isAgreement ?? true}
                  isMultiPart={isMultiPartQuestion(currentQuestionKey)}
                  reviewer1Note={getReviewerNote(checklist1, currentQuestionKey)}
                  reviewer2Note={getReviewerNote(checklist2, currentQuestionKey)}
                  finalNoteYText={getQuestionNote?.(currentQuestionKey)}
                />

                {/* Navigation Buttons */}
                <div className='mt-4 flex items-center justify-between'>
                  <button
                    onClick={goToPrevious}
                    disabled={currentPage === 0}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
                      currentPage === 0 ?
                        'bg-secondary text-muted-foreground/70 cursor-not-allowed'
                      : 'bg-card text-secondary-foreground hover:bg-secondary shadow'
                    }`}
                  >
                    <ArrowLeftIcon className='h-4 w-4' />
                    Previous
                  </button>

                  <div className='text-muted-foreground text-sm'>
                    Question {currentPage + 1} of {totalPages}
                  </div>

                  <button
                    onClick={goToNext}
                    className='flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow transition-colors hover:bg-blue-700'
                  >
                    {currentPage === totalPages - 1 ? 'Review Summary' : 'Next'}
                    <ArrowRightIcon className='h-4 w-4' />
                  </button>
                </div>
              </>
            : <div className='py-12 text-center'>Loading...</div>}
          </>
        )}

        {/* Summary View */}
        {viewMode === 'summary' && (
          <SummaryView
            questionKeys={questionKeys}
            finalAnswers={finalAnswers}
            comparisonByQuestion={comparisonByQuestion}
            reconciledName={reconciledName}
            onReconciledNameChange={setReconciledName}
            onGoToQuestion={goToQuestion}
            onSave={handleSave}
            onBack={goToPrevious}
            allAnswered={allAnswered}
            saving={saving}
            summary={summary}
            reviewer1Name={reviewer1Name}
            reviewer2Name={reviewer2Name}
          />
        )}
      </div>
    </div>
  );
}
