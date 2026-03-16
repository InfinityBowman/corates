/**
 * MultiPartQuestionPage - Handles q9 and q11 which have a/b parts
 * Styled to match SingleQuestionPage in ReconciliationQuestionPage
 */

import { useState, useEffect, useMemo } from 'react';
import { AMSTAR_CHECKLIST } from '@/components/checklist/AMSTAR2Checklist/checklist-map.js';
import {
  getDataKeysForQuestion,
  getFinalAnswer,
} from '@/components/checklist/AMSTAR2Checklist/checklist-compare.js';
import { AnswerPanel } from './AnswerPanel';
import { NotesCompareSection } from './NotesCompareSection';

function singleAnswerEqual(a: any, b: any) {
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

function multiPartEqual(a: any, b: any, keys: string[]) {
  if (!a || !b) return false;
  for (const dk of keys) {
    if (!singleAnswerEqual(a[dk], b[dk])) return false;
  }
  return true;
}

interface MultiPartQuestionPageProps {
  questionKey: string;
  reviewer1Answers: any;
  reviewer2Answers: any;
  finalAnswers: any;
  onFinalChange: (_answer: any) => void;
  reviewer1Name: string;
  reviewer2Name: string;
  isAgreement: boolean;
  reviewer1Note: string;
  reviewer2Note: string;
  finalNoteYText: any;
}

export function MultiPartQuestionPage({
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
}: MultiPartQuestionPageProps) {
  const question = (AMSTAR_CHECKLIST as any)[questionKey];
  const dataKeys = useMemo(() => getDataKeysForQuestion(questionKey), [questionKey]);

  const [localFinal, setLocalFinal] = useState<any>({});
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [hasAutoFilled, setHasAutoFilled] = useState(false);

  // Reset auto-fill tracking when question changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on question change
    setHasAutoFilled(false);
  }, [questionKey]);

  const reviewersAgree = multiPartEqual(reviewer1Answers, reviewer2Answers, dataKeys);

  // Initialize from props or default to reviewer1
  useEffect(() => {
    if (!dataKeys || dataKeys.length === 0) return;

    if (finalAnswers && typeof finalAnswers === 'object') {
      const hasParts = dataKeys.some((dk: string) => finalAnswers[dk]);
      if (hasParts) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from Yjs props
        setLocalFinal(JSON.parse(JSON.stringify(finalAnswers)));
        if (multiPartEqual(finalAnswers, reviewer1Answers, dataKeys)) {
          setSelectedSource('reviewer1');
        } else if (multiPartEqual(finalAnswers, reviewer2Answers, dataKeys)) {
          setSelectedSource('reviewer2');
        } else {
          setSelectedSource('custom');
        }
        return;
      }
    }

    if (reviewer1Answers && dataKeys.some((dk: string) => reviewer1Answers[dk])) {
      setLocalFinal(JSON.parse(JSON.stringify(reviewer1Answers)));
      setSelectedSource('reviewer1');
    }
  }, [finalAnswers, reviewer1Answers, reviewer2Answers, dataKeys]);

  function hasValidFinalAnswer(fa: any, partKeys: string[]) {
    if (!fa || !Array.isArray(partKeys) || partKeys.length === 0) return false;
    return partKeys.some((dk: string) => {
      const part = fa[dk];
      if (!part?.answers || !Array.isArray(part.answers) || part.answers.length === 0) return false;
      const lastCol = part.answers[part.answers.length - 1];
      return Array.isArray(lastCol) && lastCol.some((v: boolean) => v === true);
    });
  }

  // Auto-fill when reviewers agree and no final answer exists
  useEffect(() => {
    if (!dataKeys || dataKeys.length === 0) return;

    if (
      isAgreement &&
      !hasValidFinalAnswer(finalAnswers, dataKeys) &&
      reviewer1Answers &&
      dataKeys.some((dk: string) => reviewer1Answers[dk]) &&
      !hasAutoFilled &&
      onFinalChange
    ) {
      const newFinal = JSON.parse(JSON.stringify(reviewer1Answers));
      onFinalChange(newFinal);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-fill guard
      setHasAutoFilled(true);
    }
  }, [isAgreement, finalAnswers, reviewer1Answers, dataKeys, hasAutoFilled, onFinalChange]);

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

  function handlePartCheckboxChange(partKey: string, colIdx: number, optIdx: number) {
    const current = localFinal;
    if (!current || !current[partKey]) return;
    const newAnswers = current[partKey].answers.map((arr: boolean[]) => [...arr]);
    newAnswers[colIdx][optIdx] = !newAnswers[colIdx][optIdx];
    const newFinal = { ...current, [partKey]: { ...current[partKey], answers: newAnswers } };
    setLocalFinal(newFinal);
    setSelectedSource('custom');
    onFinalChange?.(newFinal);
  }

  function handlePartRadioChange(partKey: string, colIdx: number, optIdx: number) {
    const current = localFinal;
    if (!current || !current[partKey]) return;
    const newAnswers = current[partKey].answers.map((arr: boolean[]) => [...arr]);
    newAnswers[colIdx] = newAnswers[colIdx].map(() => false);
    newAnswers[colIdx][optIdx] = true;
    const newFinal = { ...current, [partKey]: { ...current[partKey], answers: newAnswers } };
    setLocalFinal(newFinal);
    setSelectedSource('custom');
    onFinalChange?.(newFinal);
  }

  const getColumnsForPart = (partKey: string) => {
    if (questionKey === 'q9') return partKey === 'q9a' ? question?.columns : question?.columns2;
    if (questionKey === 'q11') return partKey === 'q11a' ? question?.columns : question?.columns2;
    return question?.columns;
  };

  const getSubtitleForPart = (partKey: string) => {
    if (questionKey === 'q9') return partKey === 'q9a' ? question?.subtitle : question?.subtitle2;
    if (questionKey === 'q11') return partKey === 'q11a' ? question?.subtitle : question?.subtitle2;
    return null;
  };

  const getFinalAnswerForPart = (answers: any, partKey: string) => {
    if (!answers?.[partKey]?.answers) return null;
    return getFinalAnswer(answers[partKey].answers, partKey);
  };

  const isCritical =
    reviewer1Answers?.[dataKeys[0]]?.critical || reviewer2Answers?.[dataKeys[0]]?.critical;

  return (
    <div className='bg-card overflow-hidden rounded-lg shadow-lg'>
      {/* Question Header */}
      <div
        className={`p-4 ${isAgreement ? 'border-b border-green-200 bg-green-50' : 'border-b border-amber-200 bg-amber-50'}`}
      >
        <h2 className='text-foreground text-lg font-semibold'>
          {question?.text}
          {isCritical && <span className='ml-2 text-sm font-medium text-red-600'>(Critical)</span>}
        </h2>
        <div className='mt-2 flex items-center gap-3'>
          <span
            className={`text-sm font-medium ${isAgreement ? 'text-green-700' : 'text-amber-700'}`}
          >
            {isAgreement ? 'Reviewers Agree' : 'Requires Reconciliation'}
          </span>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className='divide-border grid grid-cols-3 divide-x'>
        {/* Reviewer 1 Panel */}
        <div className='p-4'>
          <div className='mb-4 flex items-center justify-between'>
            <h3 className='text-foreground font-semibold'>{reviewer1Name || 'Reviewer 1'}</h3>
            {!reviewersAgree && (
              <button
                onClick={useReviewer1}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedSource === 'reviewer1' ? 'bg-blue-600 text-white' : (
                    'bg-secondary text-secondary-foreground hover:bg-blue-100 hover:text-blue-700'
                  )
                }`}
              >
                {selectedSource === 'reviewer1' ? 'Selected' : 'Use This'}
              </button>
            )}
          </div>
          {dataKeys.map((partKey: string) => (
            <div key={partKey} className='mb-6 last:mb-0'>
              <div className='mb-2 flex flex-wrap items-center gap-2'>
                <span className='text-secondary-foreground text-xs font-semibold'>
                  {getSubtitleForPart(partKey)}
                </span>
                <span className='text-muted-foreground text-xs'>Result:</span>
                <span className='border-border bg-secondary text-muted-foreground inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium'>
                  {getFinalAnswerForPart(reviewer1Answers, partKey) || 'Not selected'}
                </span>
              </div>
              <AnswerPanel
                answers={reviewer1Answers?.[partKey]}
                questionKey={partKey}
                columns={getColumnsForPart(partKey)}
                readOnly={true}
                compact={true}
                panelId='reviewer1'
                title='Reviewer 1'
              />
            </div>
          ))}
        </div>

        {/* Reviewer 2 Panel */}
        <div className='p-4'>
          <div className='mb-4 flex items-center justify-between'>
            <h3 className='text-foreground font-semibold'>{reviewer2Name || 'Reviewer 2'}</h3>
            {!reviewersAgree && (
              <button
                onClick={useReviewer2}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedSource === 'reviewer2' ? 'bg-blue-600 text-white' : (
                    'bg-secondary text-secondary-foreground hover:bg-blue-100 hover:text-blue-700'
                  )
                }`}
              >
                {selectedSource === 'reviewer2' ? 'Selected' : 'Use This'}
              </button>
            )}
          </div>
          {dataKeys.map((partKey: string) => (
            <div key={partKey} className='mb-6 last:mb-0'>
              <div className='mb-2 flex flex-wrap items-center gap-2'>
                <span className='text-secondary-foreground text-xs font-semibold'>
                  {getSubtitleForPart(partKey)}
                </span>
                <span className='text-muted-foreground text-xs'>Result:</span>
                <span className='border-border bg-secondary text-muted-foreground inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium'>
                  {getFinalAnswerForPart(reviewer2Answers, partKey) || 'Not selected'}
                </span>
              </div>
              <AnswerPanel
                answers={reviewer2Answers?.[partKey]}
                questionKey={partKey}
                columns={getColumnsForPart(partKey)}
                readOnly={true}
                compact={true}
                panelId='reviewer2'
                title='Reviewer 2'
              />
            </div>
          ))}
        </div>

        {/* Final/Merged Panel */}
        <div className='bg-green-50/30 p-4'>
          <div className='mb-4 flex items-center justify-between'>
            <div>
              <h3 className='text-foreground font-semibold'>Final Answer</h3>
              {selectedSource && (
                <span className='text-muted-foreground text-xs'>
                  {selectedSource === 'custom' ?
                    'Custom selection'
                  : `Based on ${selectedSource === 'reviewer1' ? 'Reviewer 1' : 'Reviewer 2'}`}
                </span>
              )}
            </div>
          </div>
          {dataKeys.map((partKey: string) => (
            <div key={partKey} className='mb-6 last:mb-0'>
              <div className='mb-2 flex flex-wrap items-center gap-2'>
                <span className='text-secondary-foreground text-xs font-semibold'>
                  {getSubtitleForPart(partKey)}
                </span>
                <span className='text-muted-foreground text-xs'>Result:</span>
                <span className='inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2 py-1 text-xs font-medium text-green-800'>
                  {getFinalAnswerForPart(localFinal, partKey) || 'Not selected'}
                </span>
              </div>
              <AnswerPanel
                answers={localFinal?.[partKey]}
                questionKey={partKey}
                columns={getColumnsForPart(partKey)}
                readOnly={false}
                compact={true}
                panelId='final'
                title='Final'
                onCheckboxChange={(colIdx, optIdx) =>
                  handlePartCheckboxChange(partKey, colIdx, optIdx)
                }
                onRadioChange={(colIdx, optIdx) => handlePartRadioChange(partKey, colIdx, optIdx)}
              />
            </div>
          ))}
        </div>
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
