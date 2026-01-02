import { createSignal, createEffect, createMemo, For, Show } from 'solid-js';
import { AMSTAR_CHECKLIST } from '@/components/checklist/AMSTAR2Checklist/checklist-map.js';
import {
  getDataKeysForQuestion,
  getFinalAnswer,
} from '@/components/checklist/AMSTAR2Checklist/checklist-compare.js';
import AnswerPanel from './AnswerPanel.jsx';
import NotesCompareSection from './NotesCompareSection.jsx';

/**
 * MultiPartQuestionPage - Handles q9 and q11 which have a/b parts
 * Styled to match SingleQuestionPage in ReconciliationQuestionPage
 * @param {Object} props
 * @param {string} props.questionKey
 * @returns {JSX.Element}
 */
export default function MultiPartQuestionPage(props) {
  const questionKey = () => props.questionKey;
  const question = () => AMSTAR_CHECKLIST[questionKey()];

  const dataKeys = createMemo(() => getDataKeysForQuestion(questionKey()));

  // Local state for each part
  const [localFinal, setLocalFinal] = createSignal({});
  const [selectedSource, setSelectedSource] = createSignal(null);
  const [hasAutoFilled, setHasAutoFilled] = createSignal(false);

  // Reset auto-fill tracking when question changes
  createEffect(() => {
    props.questionKey;
    setHasAutoFilled(false);
  });

  const reviewersAgree = () =>
    multiPartAnswersEqual(props.reviewer1Answers, props.reviewer2Answers);

  // Initialize from props or default to reviewer1
  createEffect(() => {
    const keys = dataKeys();
    if (!keys || keys.length === 0) return;

    // If we have valid finalAnswers, use them
    if (props.finalAnswers && typeof props.finalAnswers === 'object') {
      const hasParts = keys.some(dk => props.finalAnswers[dk]);
      if (hasParts) {
        setLocalFinal(JSON.parse(JSON.stringify(props.finalAnswers)));
        // Determine source
        if (multiPartAnswersEqual(props.finalAnswers, props.reviewer1Answers)) {
          setSelectedSource('reviewer1');
        } else if (multiPartAnswersEqual(props.finalAnswers, props.reviewer2Answers)) {
          setSelectedSource('reviewer2');
        } else {
          setSelectedSource('custom');
        }
        return;
      }
    }

    // Default to reviewer1 if available
    if (props.reviewer1Answers && keys.some(dk => props.reviewer1Answers[dk])) {
      setLocalFinal(JSON.parse(JSON.stringify(props.reviewer1Answers)));
      setSelectedSource('reviewer1');
    }
  });

  // Check if the final answer last column has at least one part as true
  function hasValidFinalAnswer(finalAnswers, partKeys) {
    if (!finalAnswers || !Array.isArray(partKeys) || partKeys.length === 0) return false;
    return partKeys.some(dk => {
      const part = finalAnswers[dk];
      if (!part?.answers || !Array.isArray(part.answers) || part.answers.length === 0) return false;
      const lastCol = part.answers[part.answers.length - 1];
      return Array.isArray(lastCol) && lastCol.some(v => v === true);
    });
  }

  // Auto-fill when reviewers agree and no final answer exists
  createEffect(() => {
    const keys = dataKeys();
    if (!keys || keys.length === 0) return;

    // Check if we have a valid final answer (has at least one part)
    let hasFinalAnswer = hasValidFinalAnswer(props.finalAnswers, keys);

    // Only auto-fill if: reviewers agree, no final answer exists, we have reviewer1's answer, and we haven't auto-filled yet
    if (
      props.isAgreement &&
      !hasFinalAnswer &&
      props.reviewer1Answers &&
      keys.some(dk => props.reviewer1Answers[dk]) &&
      !hasAutoFilled() &&
      props.onFinalChange
    ) {
      const newFinal = JSON.parse(JSON.stringify(props.reviewer1Answers));
      props.onFinalChange(newFinal);
      setHasAutoFilled(true);
    }
  });

  function multiPartAnswersEqual(a, b) {
    if (!a || !b) return false;
    for (const dk of dataKeys()) {
      if (!singleAnswerEqual(a[dk], b[dk])) return false;
    }
    return true;
  }

  function singleAnswerEqual(a, b) {
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

  function useReviewer1() {
    if (!props.reviewer1Answers) return;
    const newFinal = JSON.parse(JSON.stringify(props.reviewer1Answers));
    setLocalFinal(newFinal);
    setSelectedSource('reviewer1');
    props.onFinalChange?.(newFinal);
  }

  function useReviewer2() {
    if (!props.reviewer2Answers) return;
    const newFinal = JSON.parse(JSON.stringify(props.reviewer2Answers));
    setLocalFinal(newFinal);
    setSelectedSource('reviewer2');
    props.onFinalChange?.(newFinal);
  }

  // Handle changes to a specific part
  function handlePartCheckboxChange(partKey, colIdx, optIdx) {
    const current = localFinal();
    if (!current || !current[partKey]) return;

    const newAnswers = current[partKey].answers.map(arr => [...arr]);
    newAnswers[colIdx][optIdx] = !newAnswers[colIdx][optIdx];

    const newFinal = {
      ...current,
      [partKey]: { ...current[partKey], answers: newAnswers },
    };
    setLocalFinal(newFinal);
    setSelectedSource('custom');
    props.onFinalChange?.(newFinal);
  }

  function handlePartRadioChange(partKey, colIdx, optIdx) {
    const current = localFinal();
    if (!current || !current[partKey]) return;

    const newAnswers = current[partKey].answers.map(arr => [...arr]);
    newAnswers[colIdx] = newAnswers[colIdx].map(() => false);
    newAnswers[colIdx][optIdx] = true;

    const newFinal = {
      ...current,
      [partKey]: { ...current[partKey], answers: newAnswers },
    };
    setLocalFinal(newFinal);
    setSelectedSource('custom');
    props.onFinalChange?.(newFinal);
  }

  // Get columns for each part
  const getColumnsForPart = partKey => {
    if (props.questionKey === 'q9') {
      return partKey === 'q9a' ? question()?.columns : question()?.columns2;
    }
    if (props.questionKey === 'q11') {
      return partKey === 'q11a' ? question()?.columns : question()?.columns2;
    }
    return question()?.columns;
  };

  const getSubtitleForPart = partKey => {
    if (props.questionKey === 'q9') {
      return partKey === 'q9a' ? question()?.subtitle : question()?.subtitle2;
    }
    if (props.questionKey === 'q11') {
      return partKey === 'q11a' ? question()?.subtitle : question()?.subtitle2;
    }
    return null;
  };

  // Get final answer for a part
  const getFinalAnswerForPart = (answers, partKey) => {
    if (!answers?.[partKey]?.answers) return null;
    return getFinalAnswer(answers[partKey].answers, partKey);
  };

  const isCritical = () => {
    const firstPartKey = dataKeys()[0];
    return (
      props.reviewer1Answers?.[firstPartKey]?.critical ||
      props.reviewer2Answers?.[firstPartKey]?.critical
    );
  };

  return (
    <div class='overflow-hidden rounded-lg bg-white shadow-lg'>
      {/* Question Header */}
      <div
        class={`p-4 ${props.isAgreement ? 'border-b border-green-200 bg-green-50' : 'border-b border-amber-200 bg-amber-50'}`}
      >
        <h2 class='text-lg font-semibold text-gray-900'>
          {question()?.text}
          <Show when={isCritical()}>
            <span class='ml-2 text-sm font-medium text-red-600'>(Critical)</span>
          </Show>
        </h2>
        <div class='mt-2 flex items-center gap-3'>
          <span
            class={`text-sm font-medium ${props.isAgreement ? 'text-green-700' : 'text-amber-700'}`}
          >
            {props.isAgreement ? 'Reviewers Agree' : 'Requires Reconciliation'}
          </span>
        </div>
      </div>

      {/* Three Column Layout - matches SingleQuestionPage */}
      <div class='grid grid-cols-3 divide-x divide-gray-200'>
        {/* Reviewer 1 Panel */}
        <div class='p-4'>
          {/* Panel Header */}
          <div class='mb-4 flex items-center justify-between'>
            <h3 class='font-semibold text-gray-900'>{props.reviewer1Name || 'Reviewer 1'}</h3>
            <Show when={!reviewersAgree()}>
              <button
                onClick={useReviewer1}
                class={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedSource() === 'reviewer1' ? 'bg-blue-600 text-white' : (
                    'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                  )
                }`}
              >
                {selectedSource() === 'reviewer1' ? 'Selected' : 'Use This'}
              </button>
            </Show>
          </div>

          {/* Parts */}
          <For each={dataKeys()}>
            {partKey => (
              <div class='mb-6 last:mb-0'>
                <div class='mb-2 flex flex-wrap items-center gap-2'>
                  <span class='text-xs font-semibold text-gray-700'>
                    {getSubtitleForPart(partKey)}
                  </span>
                  <span class='text-xs text-gray-500'>Result:</span>
                  <span class='inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600'>
                    {getFinalAnswerForPart(props.reviewer1Answers, partKey) || 'Not selected'}
                  </span>
                </div>
                <AnswerPanel
                  answers={props.reviewer1Answers?.[partKey]}
                  questionKey={partKey}
                  columns={getColumnsForPart(partKey)}
                  readOnly={true}
                  compact={true}
                  panelId='reviewer1'
                />
              </div>
            )}
          </For>
        </div>

        {/* Reviewer 2 Panel */}
        <div class='p-4'>
          {/* Panel Header */}
          <div class='mb-4 flex items-center justify-between'>
            <h3 class='font-semibold text-gray-900'>{props.reviewer2Name || 'Reviewer 2'}</h3>
            <Show when={!reviewersAgree()}>
              <button
                onClick={useReviewer2}
                class={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedSource() === 'reviewer2' ? 'bg-blue-600 text-white' : (
                    'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                  )
                }`}
              >
                {selectedSource() === 'reviewer2' ? 'Selected' : 'Use This'}
              </button>
            </Show>
          </div>

          {/* Parts */}
          <For each={dataKeys()}>
            {partKey => (
              <div class='mb-6 last:mb-0'>
                <div class='mb-2 flex flex-wrap items-center gap-2'>
                  <span class='text-xs font-semibold text-gray-700'>
                    {getSubtitleForPart(partKey)}
                  </span>
                  <span class='text-xs text-gray-500'>Result:</span>
                  <span class='inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600'>
                    {getFinalAnswerForPart(props.reviewer2Answers, partKey) || 'Not selected'}
                  </span>
                </div>
                <AnswerPanel
                  answers={props.reviewer2Answers?.[partKey]}
                  questionKey={partKey}
                  columns={getColumnsForPart(partKey)}
                  readOnly={true}
                  compact={true}
                  panelId='reviewer2'
                />
              </div>
            )}
          </For>
        </div>

        {/* Final/Merged Panel */}
        <div class='bg-green-50/30 p-4'>
          {/* Panel Header */}
          <div class='mb-4 flex items-center justify-between'>
            <div>
              <h3 class='font-semibold text-gray-900'>Final Answer</h3>
              <Show when={selectedSource()}>
                <span class='text-xs text-gray-500'>
                  {selectedSource() === 'custom' ?
                    'Custom selection'
                  : `Based on ${selectedSource() === 'reviewer1' ? 'Reviewer 1' : 'Reviewer 2'}`}
                </span>
              </Show>
            </div>
          </div>

          {/* Parts */}
          <For each={dataKeys()}>
            {partKey => (
              <div class='mb-6 last:mb-0'>
                <div class='mb-2 flex flex-wrap items-center gap-2'>
                  <span class='text-xs font-semibold text-gray-700'>
                    {getSubtitleForPart(partKey)}
                  </span>
                  <span class='text-xs text-gray-500'>Result:</span>
                  <span class='inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2 py-1 text-xs font-medium text-green-800'>
                    {getFinalAnswerForPart(localFinal(), partKey) || 'Not selected'}
                  </span>
                </div>
                <AnswerPanel
                  answers={localFinal()?.[partKey]}
                  questionKey={partKey}
                  columns={getColumnsForPart(partKey)}
                  readOnly={false}
                  compact={true}
                  panelId='final'
                  onCheckboxChange={(colIdx, optIdx) =>
                    handlePartCheckboxChange(partKey, colIdx, optIdx)
                  }
                  onRadioChange={(colIdx, optIdx) => handlePartRadioChange(partKey, colIdx, optIdx)}
                />
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Notes Section - One note for the entire multi-part question */}
      <div class='px-4 pb-4'>
        <NotesCompareSection
          reviewer1Note={props.reviewer1Note}
          reviewer2Note={props.reviewer2Note}
          finalNoteYText={props.finalNoteYText}
          reviewer1Name={props.reviewer1Name}
          reviewer2Name={props.reviewer2Name}
          collapsed={true}
        />
      </div>
    </div>
  );
}
