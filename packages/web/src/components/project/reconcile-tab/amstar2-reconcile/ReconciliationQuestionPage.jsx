/**
 * ReconciliationQuestionPage - Full page view for a single question during reconciliation
 * Shows Reviewer 1, Reviewer 2, and Final (editable) answer panels side by side
 */
import AnswerPanel from './AnswerPanel.jsx';
import NotesCompareSection from './NotesCompareSection.jsx';
import { createSignal, createEffect, Show } from 'solid-js';
import { AMSTAR_CHECKLIST } from '@/components/checklist/AMSTAR2/checklist-map.js';
import MultiPartQuestionPage from './MultiPartQuestionPage.jsx';
/**
 * Get the final answer from the last column
 * @param {Array} answers - The answers array
 * @param {string} questionKey - The question key
 * @returns {string|null} The final answer
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

/**
 * ReconciliationQuestionPage - Full page view for a single question during reconciliation
 * Shows Reviewer 1, Reviewer 2, and Final (editable) answer panels side by side
 * @param {Object} props
 * @param {string} props.questionKey
 * @param {Object} props.reviewer1Answers
 * @param {Object} props.reviewer2Answers
 * @param {Object} props.finalAnswers
 * @param {Function} props.onFinalChange
 * @param {string} props.reviewer1Name
 * @param {string} props.reviewer2Name
 * @param {boolean} props.isAgreement
 * @param {boolean} props.isMultiPart
 * @param {string} props.reviewer1Note
 * @param {string} props.reviewer2Note
 * @param {Y.Text} props.finalNoteYText
 * @returns {JSX.Element}
 */
export default function ReconciliationQuestionPage(props) {
  // props.questionKey - e.g., 'q1', 'q9', 'q11'
  // props.reviewer1Answers - { answers: [[...], [...]], critical: bool } OR { q9a: {...}, q9b: {...} } for multi-part
  // props.reviewer2Answers - { answers: [[...], [...]], critical: bool } OR { q9a: {...}, q9b: {...} } for multi-part
  // props.finalAnswers - current final answers (can be null initially)
  // props.onFinalChange - callback when final answers change
  // props.reviewer1Name
  // props.reviewer2Name
  // props.isAgreement - whether reviewers agree on this question
  // props.isMultiPart - whether this is a multi-part question (q9 or q11)
  // props.reviewer1Note - text content of reviewer 1's note for this question
  // props.reviewer2Note - text content of reviewer 2's note for this question
  // props.finalNoteYText - Y.Text reference for the final reconciled note

  // For multi-part questions, delegate to MultiPartQuestionPage
  // Use Show for proper SolidJS reactivity
  return (
    <Show when={props.isMultiPart} fallback={<SingleQuestionPage {...props} />}>
      <MultiPartQuestionPage {...props} />
    </Show>
  );
}

function SingleQuestionPage(props) {
  const question = () => AMSTAR_CHECKLIST[props.questionKey];

  // Local state for the final/merged answer that user can edit
  const [localFinal, setLocalFinal] = createSignal(null);
  const [selectedSource, setSelectedSource] = createSignal(null); // 'reviewer1' | 'reviewer2' | 'custom'
  const [hasAutoFilled, setHasAutoFilled] = createSignal(false);

  // Reset auto-fill tracking when question changes
  createEffect(() => {
    props.questionKey;
    setHasAutoFilled(false);
  });

  const reviewersAgree = () => answersEqual(props.reviewer1Answers, props.reviewer2Answers);

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
      // Default to reviewer1 for local state
      setLocalFinal(JSON.parse(JSON.stringify(props.reviewer1Answers)));
      setSelectedSource('reviewer1');
    }
  });

  // Check if the final answer last column has at least one part as true
  function hasValidFinalAnswer(finalAnswers) {
    if (
      !finalAnswers?.answers ||
      !Array.isArray(finalAnswers.answers) ||
      finalAnswers.answers.length === 0
    )
      return false;
    const lastCol = finalAnswers.answers[finalAnswers.answers.length - 1];
    return Array.isArray(lastCol) && lastCol.some(v => v === true);
  }

  // Auto-fill when reviewers agree and no final answer exists
  createEffect(() => {
    let hasFinalAnswer = hasValidFinalAnswer(props.finalAnswers);
    // Only auto-fill if: reviewers agree, no final answer exists, we have reviewer1's answer, and we haven't auto-filled yet
    if (
      props.isAgreement &&
      !hasFinalAnswer &&
      props.reviewer1Answers &&
      !hasAutoFilled() &&
      props.onFinalChange
    ) {
      const newFinal = JSON.parse(JSON.stringify(props.reviewer1Answers));
      props.onFinalChange(newFinal);
      setHasAutoFilled(true);
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
    if (!props.reviewer1Answers) return;
    const newFinal = JSON.parse(JSON.stringify(props.reviewer1Answers));
    setLocalFinal(newFinal);
    setSelectedSource('reviewer1');
    props.onFinalChange?.(newFinal);
  }

  // Apply reviewer 2's answers as final
  function useReviewer2() {
    if (!props.reviewer2Answers) return;
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

  const reviewer1FinalAnswer = () =>
    getFinalAnswerFromAnswers(props.reviewer1Answers?.answers, props.questionKey);
  const reviewer2FinalAnswer = () =>
    getFinalAnswerFromAnswers(props.reviewer2Answers?.answers, props.questionKey);
  const finalFinalAnswer = () =>
    getFinalAnswerFromAnswers(localFinal()?.answers, props.questionKey);

  const isCritical = () => props.reviewer1Answers?.critical || props.reviewer2Answers?.critical;

  return (
    <div class='overflow-hidden rounded-lg bg-white shadow-lg'>
      {/* Question Header */}
      <div
        class={`p-4 ${props.isAgreement ? 'border-b border-green-200 bg-green-50' : 'border-b border-amber-200 bg-amber-50'}`}
      >
        <h2 class='text-md font-medium text-gray-900'>
          {question()?.text}
          <Show when={isCritical()}>
            <span class='ml-2 text-sm font-medium text-red-600'>(Critical)</span>
          </Show>
        </h2>
        <div class='mt-2 flex items-center gap-3'>
          <span
            class={`text-xs font-medium ${props.isAgreement ? 'text-green-700' : 'text-amber-700'}`}
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
          hideSelectButtons={reviewersAgree()}
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
          hideSelectButtons={reviewersAgree()}
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
          highlightColor='green'
          selectedSource={selectedSource()}
        />
      </div>

      {/* Notes Section */}
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
