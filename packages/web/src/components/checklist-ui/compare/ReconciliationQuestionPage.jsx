/**
 * ReconciliationQuestionPage - Full page view for a single question during reconciliation
 * Shows Reviewer 1, Reviewer 2, and Final (editable) answer panels side by side
 */
import AnswerPanel from './AnswerPanel.jsx';
import { createSignal, createEffect, For, Show } from 'solid-js';
import { AMSTAR_CHECKLIST } from '@/AMSTAR2/checklist-map.js';

/**
 * Get the final answer from the last column
 */
function getFinalAnswerFromAnswers(answers, questionKey) {
  if (!Array.isArray(answers) || answers.length === 0) return null;
  const lastCol = answers[answers.length - 1];
  if (!Array.isArray(lastCol)) return null;
  const idx = lastCol.findIndex(v => v === true);
  if (idx === -1) return null;

  const question = AMSTAR_CHECKLIST[questionKey];
  const lastColumn = question?.columns?.[question.columns.length - 1];
  return lastColumn?.options?.[idx] || null;
}

export default function ReconciliationQuestionPage(props) {
  // props.questionKey - e.g., 'q1'
  // props.reviewer1Answers - { answers: [[...], [...]], critical: bool }
  // props.reviewer2Answers - { answers: [[...], [...]], critical: bool }
  // props.finalAnswers - current final answers (can be null initially)
  // props.onFinalChange - callback when final answers change
  // props.reviewer1Name
  // props.reviewer2Name
  // props.isAgreement - whether reviewers agree on this question

  const question = () => AMSTAR_CHECKLIST[props.questionKey];

  // Local state for the final/merged answer that user can edit
  const [localFinal, setLocalFinal] = createSignal(null);
  const [selectedSource, setSelectedSource] = createSignal(null); // 'reviewer1' | 'reviewer2' | 'custom'

  // Initialize local final from props or default to reviewer1
  createEffect(() => {
    if (props.finalAnswers) {
      setLocalFinal(JSON.parse(JSON.stringify(props.finalAnswers)));
      // Determine which source it matches
      if (answersEqual(props.finalAnswers, props.reviewer1Answers)) {
        setSelectedSource('reviewer1');
      } else if (answersEqual(props.finalAnswers, props.reviewer2Answers)) {
        setSelectedSource('reviewer2');
      } else {
        setSelectedSource('custom');
      }
    } else if (props.reviewer1Answers) {
      // Default to reviewer1
      setLocalFinal(JSON.parse(JSON.stringify(props.reviewer1Answers)));
      setSelectedSource('reviewer1');
    }
  });

  // Check if two answer objects are equal
  function answersEqual(a, b) {
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

  // Apply reviewer 1's answers as final
  function useReviewer1() {
    const newFinal = JSON.parse(JSON.stringify(props.reviewer1Answers));
    setLocalFinal(newFinal);
    setSelectedSource('reviewer1');
    props.onFinalChange?.(newFinal);
  }

  // Apply reviewer 2's answers as final
  function useReviewer2() {
    const newFinal = JSON.parse(JSON.stringify(props.reviewer2Answers));
    setLocalFinal(newFinal);
    setSelectedSource('reviewer2');
    props.onFinalChange?.(newFinal);
  }

  // Handle checkbox change in final panel
  function handleFinalCheckboxChange(colIdx, optIdx) {
    const current = localFinal();
    if (!current) return;

    const newAnswers = current.answers.map(arr => [...arr]);
    newAnswers[colIdx][optIdx] = !newAnswers[colIdx][optIdx];

    const newFinal = { ...current, answers: newAnswers };
    setLocalFinal(newFinal);
    setSelectedSource('custom');
    props.onFinalChange?.(newFinal);
  }

  // Handle radio change in final panel (last column)
  function handleFinalRadioChange(colIdx, optIdx) {
    const current = localFinal();
    if (!current) return;

    const newAnswers = current.answers.map(arr => [...arr]);
    // Set all options in this column to false, then set selected to true
    newAnswers[colIdx] = newAnswers[colIdx].map(() => false);
    newAnswers[colIdx][optIdx] = true;

    const newFinal = { ...current, answers: newAnswers };
    setLocalFinal(newFinal);
    setSelectedSource('custom');
    props.onFinalChange?.(newFinal);
  }

  // Handle critical toggle in final panel
  function handleFinalCriticalChange(critical) {
    const current = localFinal();
    if (!current) return;

    const newFinal = { ...current, critical };
    setLocalFinal(newFinal);
    setSelectedSource('custom');
    props.onFinalChange?.(newFinal);
  }

  const reviewer1FinalAnswer = () =>
    getFinalAnswerFromAnswers(props.reviewer1Answers?.answers, props.questionKey);
  const reviewer2FinalAnswer = () =>
    getFinalAnswerFromAnswers(props.reviewer2Answers?.answers, props.questionKey);
  const finalFinalAnswer = () =>
    getFinalAnswerFromAnswers(localFinal()?.answers, props.questionKey);

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
          <Show when={question()?.subtitle}>
            <span class='text-sm text-gray-500'>({question().subtitle})</span>
          </Show>
        </div>
      </div>

      {/* Three Column Layout */}
      <div class='grid grid-cols-3 divide-x divide-gray-200'>
        {/* Reviewer 1 Panel */}
        <AnswerPanel
          title={props.reviewer1Name || 'Reviewer 1'}
          answers={props.reviewer1Answers}
          questionKey={props.questionKey}
          finalAnswer={reviewer1FinalAnswer()}
          isSelected={selectedSource() === 'reviewer1'}
          onUseThis={useReviewer1}
          readOnly={true}
          highlightColor='blue'
        />

        {/* Reviewer 2 Panel */}
        <AnswerPanel
          title={props.reviewer2Name || 'Reviewer 2'}
          answers={props.reviewer2Answers}
          questionKey={props.questionKey}
          finalAnswer={reviewer2FinalAnswer()}
          isSelected={selectedSource() === 'reviewer2'}
          onUseThis={useReviewer2}
          readOnly={true}
          highlightColor='purple'
        />

        {/* Final/Merged Panel */}
        <AnswerPanel
          title='Final Answer'
          answers={localFinal()}
          questionKey={props.questionKey}
          finalAnswer={finalFinalAnswer()}
          isSelected={true}
          isFinal={true}
          readOnly={false}
          onCheckboxChange={handleFinalCheckboxChange}
          onRadioChange={handleFinalRadioChange}
          onCriticalChange={handleFinalCriticalChange}
          highlightColor='green'
          selectedSource={selectedSource()}
        />
      </div>
    </div>
  );
}

/**
 * Panel showing one version of answers (reviewer or final)
 */
function AnswerPanel1(props) {
  const question = () => AMSTAR_CHECKLIST[() => props.questionKey];
  const columns = () => question()?.columns || [];
  const answers = () => props.answers?.answers || [];
  const critical = () => props.answers?.critical ?? false;

  return (
    <div class={`p-4 ${props.isFinal ? 'bg-green-50/30' : ''}`}>
      {/* Panel Header */}
      <div class='flex items-center justify-between mb-4'>
        <div>
          <h3 class='font-semibold text-gray-900'>{props.title}</h3>
          <Show when={props.isFinal && props.selectedSource}>
            <span class='text-xs text-gray-500'>
              {props.selectedSource === 'custom' ?
                'Custom selection'
              : `Based on ${props.selectedSource === 'reviewer1' ? 'Reviewer 1' : 'Reviewer 2'}`}
            </span>
          </Show>
        </div>
        <Show when={!props.isFinal}>
          <button
            onClick={() => props.onUseThis?.()}
            class={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              props.isSelected ? 'bg-blue-600 text-white' : (
                'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
              )
            }`}
          >
            {props.isSelected ? 'Selected' : 'Use This'}
          </button>
        </Show>
      </div>

      {/* Final Answer Badge */}
      <div class='mb-4'>
        <span class='text-xs text-gray-500 block mb-1'>Result:</span>
        <span
          class={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${getAnswerBadgeStyle(props.finalAnswer)}`}
        >
          {props.finalAnswer || 'Not selected'}
        </span>
      </div>

      {/* Critical Toggle */}
      <div class='mb-4'>
        <Show
          when={!props.readOnly}
          fallback={
            <div class='flex items-center gap-2'>
              <span class='text-xs text-gray-500'>Critical:</span>
              <span class={`text-xs font-medium ${critical() ? 'text-red-600' : 'text-gray-600'}`}>
                {critical() ? 'Yes' : 'No'}
              </span>
            </div>
          }
        >
          <label class='flex items-center gap-2 cursor-pointer'>
            <input
              type='checkbox'
              checked={critical()}
              onChange={e => props.onCriticalChange?.(e.target.checked)}
              class='w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500'
            />
            <span class='text-xs font-medium text-gray-700'>Mark as Critical</span>
          </label>
        </Show>
      </div>

      {/* Answer Columns */}
      <div class='space-y-4'>
        <For each={columns()}>
          {(col, colIdx) => {
            const isLastColumn = () => colIdx() === columns().length - 1;
            const colAnswers = () => answers()[colIdx()] || [];

            return (
              <div class='border-t border-gray-200 pt-3'>
                <Show when={col.label}>
                  <div class='text-xs font-semibold text-gray-700 mb-2'>{col.label}</div>
                </Show>
                <Show when={col.description}>
                  <div class='text-xs text-gray-500 mb-2'>{col.description}</div>
                </Show>

                <div class='space-y-2'>
                  <For each={col.options}>
                    {(option, optIdx) => {
                      const isChecked = () => colAnswers()[optIdx()] === true;

                      return (
                        <label
                          class={`flex items-start gap-2 text-xs ${props.readOnly ? '' : 'cursor-pointer hover:bg-gray-50 p-1 rounded -m-1'}`}
                        >
                          <Show
                            when={isLastColumn()}
                            fallback={
                              <input
                                type='checkbox'
                                checked={isChecked()}
                                disabled={props.readOnly}
                                onChange={() =>
                                  !props.readOnly && props.onCheckboxChange?.(colIdx(), optIdx())
                                }
                                class='w-3.5 h-3.5 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 shrink-0'
                              />
                            }
                          >
                            <input
                              type='radio'
                              name={`${props.title}-${props.questionKey}-final`}
                              checked={isChecked()}
                              disabled={props.readOnly}
                              onChange={() =>
                                !props.readOnly && props.onRadioChange?.(colIdx(), optIdx())
                              }
                              class='w-3.5 h-3.5 mt-0.5 text-blue-600 border-gray-300 focus:ring-blue-500 shrink-0'
                            />
                          </Show>
                          <span
                            class={`${isChecked() ? 'text-gray-900 font-medium' : 'text-gray-600'}`}
                          >
                            {option}
                          </span>
                        </label>
                      );
                    }}
                  </For>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
