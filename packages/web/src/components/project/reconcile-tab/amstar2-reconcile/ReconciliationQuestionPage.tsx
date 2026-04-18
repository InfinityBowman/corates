/**
 * ReconciliationQuestionPage - Full page view for a single question during reconciliation
 * Shows Reviewer 1, Reviewer 2, and Final (editable) answer panels side by side.
 * Dispatches to MultiPartQuestionPage for q9/q11.
 */

import { useState, useEffect } from 'react';
import { AMSTAR_CHECKLIST } from '@/components/checklist/AMSTAR2Checklist/checklist-map.js';
import { AnswerPanel } from './AnswerPanel';
import { NotesCompareSection } from './NotesCompareSection';
import { MultiPartQuestionPage } from './MultiPartQuestionPage';

function getFinalAnswerFromAnswers(answers: any, questionKey: string): string | null {
  if (!Array.isArray(answers) || answers.length === 0) return null;
  const lastCol = answers[answers.length - 1];
  if (!Array.isArray(lastCol)) return null;
  const idx = lastCol.findIndex((v: boolean) => v === true);
  if (idx === -1) return null;

  const question = (AMSTAR_CHECKLIST as any)[questionKey];
  const lastColumn = question?.columns?.[question.columns.length - 1];
  return lastColumn?.options?.[idx] || null;
}

interface ReconciliationQuestionPageProps {
  questionKey: string;
  reviewer1Answers: any;
  reviewer2Answers: any;
  finalAnswers: any;
  onFinalChange: (_answer: any) => void;
  reviewer1Name: string;
  reviewer2Name: string;
  isAgreement: boolean;
  isMultiPart: boolean;
  reviewer1Note: string;
  reviewer2Note: string;
  finalNoteYText: any;
}

export function ReconciliationQuestionPage(props: ReconciliationQuestionPageProps) {
  if (props.isMultiPart) {
    return <MultiPartQuestionPage {...props} />;
  }
  return <SingleQuestionPage {...props} />;
}

function answersEqual(a: any, b: any) {
  if (!a || !b) return false;
  if (a.critical !== b.critical) return false;
  if (!Array.isArray(a.answers) || !Array.isArray(b.answers)) return false;
  if (a.answers.length !== b.answers.length) return false;
  for (let i = 0; i < a.answers.length; i++) {
    if (a.answers[i].length !== b.answers[i].length) return false;
    for (let j = 0; j < a.answers[i].length; j++) {
      if (a.answers[i][j] !== b.answers[i][j]) return false;
    }
  }
  return true;
}

function SingleQuestionPage({
  questionKey,
  reviewer1Answers,
  reviewer2Answers,
  finalAnswers,
  onFinalChange,
  reviewer1Name,
  reviewer2Name,
  isAgreement,
  reviewer1Note,
  reviewer2Note,
  finalNoteYText,
}: ReconciliationQuestionPageProps) {
  const question = (AMSTAR_CHECKLIST as any)[questionKey];

  const [localFinal, setLocalFinal] = useState<any>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [hasAutoFilled, setHasAutoFilled] = useState(false);

  // Reset auto-fill tracking when question changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on question change
    setHasAutoFilled(false);
  }, [questionKey]);

  const reviewersAgree = answersEqual(reviewer1Answers, reviewer2Answers);

  // Initialize local final from props or default to reviewer1
  useEffect(() => {
    if (finalAnswers) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from Yjs props
      setLocalFinal(JSON.parse(JSON.stringify(finalAnswers)));
      if (answersEqual(finalAnswers, reviewer1Answers)) {
        setSelectedSource('reviewer1');
      } else if (answersEqual(finalAnswers, reviewer2Answers)) {
        setSelectedSource('reviewer2');
      } else {
        setSelectedSource('custom');
      }
    } else if (reviewer1Answers) {
      setLocalFinal(JSON.parse(JSON.stringify(reviewer1Answers)));
      setSelectedSource('reviewer1');
    }
  }, [finalAnswers, reviewer1Answers, reviewer2Answers]);

  function hasValidFinalAnswer(fa: any) {
    if (!fa?.answers || !Array.isArray(fa.answers) || fa.answers.length === 0) return false;
    const lastCol = fa.answers[fa.answers.length - 1];
    return Array.isArray(lastCol) && lastCol.some((v: boolean) => v === true);
  }

  // Auto-fill when reviewers agree and no final answer exists
  useEffect(() => {
    if (
      isAgreement &&
      !hasValidFinalAnswer(finalAnswers) &&
      reviewer1Answers &&
      !hasAutoFilled &&
      onFinalChange
    ) {
      const newFinal = JSON.parse(JSON.stringify(reviewer1Answers));
      onFinalChange(newFinal);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-fill guard
      setHasAutoFilled(true);
    }
  }, [isAgreement, finalAnswers, reviewer1Answers, hasAutoFilled, onFinalChange]);

  function useReviewer1() {
    if (!reviewer1Answers) return;
    const newFinal = JSON.parse(JSON.stringify(reviewer1Answers));
    setLocalFinal(newFinal);
    setSelectedSource('reviewer1');
    onFinalChange?.(newFinal);
  }

  function useReviewer2() {
    if (!reviewer2Answers) return;
    const newFinal = JSON.parse(JSON.stringify(reviewer2Answers));
    setLocalFinal(newFinal);
    setSelectedSource('reviewer2');
    onFinalChange?.(newFinal);
  }

  function handleFinalCheckboxChange(colIdx: number, optIdx: number) {
    const current = localFinal;
    if (!current) return;
    const newAnswers = current.answers.map((arr: boolean[]) => [...arr]);
    newAnswers[colIdx][optIdx] = !newAnswers[colIdx][optIdx];
    const newFinal = { ...current, answers: newAnswers };
    setLocalFinal(newFinal);
    setSelectedSource('custom');
    onFinalChange?.(newFinal);
  }

  function handleFinalRadioChange(colIdx: number, optIdx: number) {
    const current = localFinal;
    if (!current) return;
    const newAnswers = current.answers.map((arr: boolean[]) => [...arr]);
    newAnswers[colIdx] = newAnswers[colIdx].map(() => false);
    newAnswers[colIdx][optIdx] = true;
    const newFinal = { ...current, answers: newAnswers };
    setLocalFinal(newFinal);
    setSelectedSource('custom');
    onFinalChange?.(newFinal);
  }

  const reviewer1FinalAnswer = getFinalAnswerFromAnswers(reviewer1Answers?.answers, questionKey);
  const reviewer2FinalAnswer = getFinalAnswerFromAnswers(reviewer2Answers?.answers, questionKey);
  const finalFinalAnswer = getFinalAnswerFromAnswers(localFinal?.answers, questionKey);
  const isCritical = reviewer1Answers?.critical || reviewer2Answers?.critical;

  return (
    <div className='bg-card overflow-hidden rounded-lg shadow-lg'>
      {/* Question Header */}
      <div
        className={`p-4 ${isAgreement ? 'border-b border-green-200 bg-green-50' : 'border-b border-amber-200 bg-amber-50'}`}
      >
        <h2 className='text-md text-foreground font-medium'>
          {question?.text}
          {isCritical && <span className='ml-2 text-sm font-medium text-red-600'>(Critical)</span>}
        </h2>
        <div className='mt-2 flex items-center gap-3'>
          <span
            className={`text-xs font-medium ${isAgreement ? 'text-green-700' : 'text-amber-700'}`}
          >
            {isAgreement ? 'Reviewers Agree' : 'Requires Reconciliation'}
          </span>
          {question?.subtitle && (
            <span className='text-muted-foreground text-sm'>({question.subtitle})</span>
          )}
        </div>
      </div>

      {/* Three Column Layout */}
      <div className='divide-border grid grid-cols-3 divide-x'>
        <AnswerPanel
          title={reviewer1Name}
          answers={reviewer1Answers}
          questionKey={questionKey}
          finalAnswer={reviewer1FinalAnswer}
          isSelected={selectedSource === 'reviewer1'}
          onUseThis={useReviewer1}
          readOnly={true}
          highlightColor='blue'
          hideSelectButtons={reviewersAgree}
        />
        <AnswerPanel
          title={reviewer2Name}
          answers={reviewer2Answers}
          questionKey={questionKey}
          finalAnswer={reviewer2FinalAnswer}
          isSelected={selectedSource === 'reviewer2'}
          onUseThis={useReviewer2}
          readOnly={true}
          highlightColor='purple'
          hideSelectButtons={reviewersAgree}
        />
        <AnswerPanel
          title='Final Answer'
          answers={localFinal}
          questionKey={questionKey}
          finalAnswer={finalFinalAnswer}
          isSelected={true}
          isFinal={true}
          readOnly={false}
          onCheckboxChange={handleFinalCheckboxChange}
          onRadioChange={handleFinalRadioChange}
          highlightColor='green'
          selectedSource={selectedSource}
        />
      </div>

      {/* Notes Section */}
      <div className='px-4 pb-4'>
        <NotesCompareSection
          reviewer1Note={reviewer1Note}
          reviewer2Note={reviewer2Note}
          finalNoteYText={finalNoteYText}
          reviewer1Name={reviewer1Name}
          reviewer2Name={reviewer2Name}
          collapsed={true}
        />
      </div>
    </div>
  );
}
