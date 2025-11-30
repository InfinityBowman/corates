import { createSignal, createEffect, For } from 'solid-js';
import { AMSTAR_CHECKLIST } from '@/AMSTAR2/checklist-map.js';
import { getDataKeysForQuestion } from '@/AMSTAR2/checklist-compare.js';
import AnswerPanel from './AnswerPanel.jsx';

/**
 * MultiPartQuestionPage - Handles q9 and q11 which have a/b parts
 */
export default function MultiPartQuestionPage(props) {
  const question = () => AMSTAR_CHECKLIST[props.questionKey];
  const dataKeys = getDataKeysForQuestion(props.questionKey);

  // Local state for each part
  const [localFinal, setLocalFinal] = createSignal({});
  const [selectedSource, setSelectedSource] = createSignal(null);

  // Initialize from props
  createEffect(() => {
    if (props.finalAnswers && typeof props.finalAnswers === 'object') {
      // Check if it has the expected part keys
      const hasParts = dataKeys.every(dk => props.finalAnswers[dk]);
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
    // Default to reviewer1
    if (props.reviewer1Answers && dataKeys.every(dk => props.reviewer1Answers[dk])) {
      setLocalFinal(JSON.parse(JSON.stringify(props.reviewer1Answers)));
      setSelectedSource('reviewer1');
    }
  });

  function multiPartAnswersEqual(a, b) {
    if (!a || !b) return false;
    for (const dk of dataKeys) {
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

  function handleCriticalChange(critical) {
    const current = localFinal();
    if (!current) return;

    // Update critical for all parts
    const newFinal = { ...current };
    for (const dk of dataKeys) {
      if (newFinal[dk]) {
        newFinal[dk] = { ...newFinal[dk], critical };
      }
    }
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

  return (
    <div class='bg-white rounded-lg shadow-lg overflow-hidden'>
      {/* Question Header */}
      <div
        class={`p-4 ${props.isAgreement ? 'bg-green-50 border-b border-green-200' : 'bg-amber-50 border-b border-amber-200'}`}
      >
        <h2 class='text-lg font-semibold text-gray-900'>{question()?.text}</h2>
        <div class='mt-2 flex items-center gap-3'>
          <span
            class={`text-sm font-medium ${props.isAgreement ? 'text-green-700' : 'text-amber-700'}`}
          >
            {props.isAgreement ? 'Reviewers Agree' : 'Requires Reconciliation'}
          </span>
        </div>
      </div>

      {/* Three Column Layout with Parts */}
      <div class='grid grid-cols-3 divide-x divide-gray-200'>
        {/* Reviewer 1 Panel */}
        <div class='p-4 bg-blue-50/30'>
          <div class='flex items-center justify-between mb-3'>
            <h3 class='font-medium text-blue-800'>{props.reviewer1Name || 'Reviewer 1'}</h3>
            <button
              onClick={useReviewer1}
              class={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                selectedSource() === 'reviewer1' ? 'bg-blue-600 text-white' : (
                  'bg-blue-100 text-blue-700 hover:bg-blue-200'
                )
              }`}
            >
              {selectedSource() === 'reviewer1' ? 'Selected' : 'Use This'}
            </button>
          </div>
          <For each={dataKeys}>
            {partKey => (
              <div class='mb-4'>
                <div class='text-xs font-medium text-gray-600 mb-2'>
                  {getSubtitleForPart(partKey)}
                </div>
                <AnswerPanel
                  answers={props.reviewer1Answers?.[partKey]}
                  questionKey={partKey}
                  columns={getColumnsForPart(partKey)}
                  readOnly={true}
                  compact={true}
                />
              </div>
            )}
          </For>
        </div>

        {/* Reviewer 2 Panel */}
        <div class='p-4 bg-purple-50/30'>
          <div class='flex items-center justify-between mb-3'>
            <h3 class='font-medium text-purple-800'>{props.reviewer2Name || 'Reviewer 2'}</h3>
            <button
              onClick={useReviewer2}
              class={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                selectedSource() === 'reviewer2' ?
                  'bg-purple-600 text-white'
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
            >
              {selectedSource() === 'reviewer2' ? 'Selected' : 'Use This'}
            </button>
          </div>
          <For each={dataKeys}>
            {partKey => (
              <div class='mb-4'>
                <div class='text-xs font-medium text-gray-600 mb-2'>
                  {getSubtitleForPart(partKey)}
                </div>
                <AnswerPanel
                  answers={props.reviewer2Answers?.[partKey]}
                  questionKey={partKey}
                  columns={getColumnsForPart(partKey)}
                  readOnly={true}
                  compact={true}
                />
              </div>
            )}
          </For>
        </div>

        {/* Final Panel */}
        <div class='p-4 bg-green-50/30'>
          <div class='flex items-center justify-between mb-3'>
            <h3 class='font-medium text-green-800'>Final Answer</h3>
            <button
              onClick={() => handleCriticalChange(!localFinal()?.[dataKeys[0]]?.critical)}
              class={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                localFinal()?.[dataKeys[0]]?.critical ?
                  'bg-red-100 text-red-700 border border-red-300'
                : 'bg-gray-100 text-gray-700 border border-gray-300'
              }`}
            >
              {localFinal()?.[dataKeys[0]]?.critical ? 'Critical' : 'Not Critical'}
            </button>
          </div>
          <For each={dataKeys}>
            {partKey => (
              <div class='mb-4'>
                <div class='text-xs font-medium text-gray-600 mb-2'>
                  {getSubtitleForPart(partKey)}
                </div>
                <AnswerPanel
                  answers={localFinal()?.[partKey]}
                  questionKey={partKey}
                  columns={getColumnsForPart(partKey)}
                  readOnly={false}
                  compact={true}
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
    </div>
  );
}
