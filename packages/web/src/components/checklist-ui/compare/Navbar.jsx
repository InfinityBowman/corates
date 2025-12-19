import { For, createMemo } from 'solid-js';
import { FaSolidArrowRotateLeft } from 'solid-icons/fa';
import { Tooltip } from '@corates/ui';
import { hasQuestionAnswer, getQuestionPillStyle, getQuestionTooltip } from './navbar-utils.js';

/**
 * Navigation bar for checklist reconciliation
 * Displays question pills with visual indicators for agreement/disagreement status
 *
 * Expects a store object with deep reactivity for automatic updates.
 * Props:
 * - store: reconciliation navbar store with:
 *   - questionKeys: array of question keys
 *   - viewMode: 'questions' or 'summary'
 *   - currentPage: current question page index
 *   - comparisonByQuestion: object mapping question keys to comparison data
 *   - finalAnswers: object mapping question keys to final answers
 *   - setViewMode: function to change view mode
 *   - goToQuestion: function to go to a specific question
 *   - onReset: function to reset all reconciliation answers
 */
export default function Navbar(props) {
  return (
    <nav class='flex flex-wrap gap-1 py-1 pl-1' aria-label='Question navigation'>
      <For each={props.store.questionKeys}>
        {(key, index) => <QuestionPill key={key} questionIndex={index()} store={props.store} />}
      </For>
      <SummaryButton store={props.store} />
      <ResetButton onClick={() => props.store.onReset?.()} />
    </nav>
  );
}

/**
 * Individual question pill button
 */
function QuestionPill(props) {
  const key = () => props.store.questionKeys[props.questionIndex];

  const isCurrentPage = () =>
    props.store.viewMode === 'questions' && props.store.currentPage === props.questionIndex;

  const isAgreement = () => props.store.comparisonByQuestion[key()]?.isAgreement ?? true;

  const hasAnswer = () => hasQuestionAnswer(key(), props.store.finalAnswers);

  const pillStyle = createMemo(() =>
    getQuestionPillStyle(isCurrentPage(), hasAnswer(), isAgreement()),
  );

  const tooltip = createMemo(() =>
    getQuestionTooltip(props.questionIndex + 1, hasAnswer(), isAgreement()),
  );

  return (
    <Tooltip content={tooltip()} placement='bottom' openDelay={200}>
      <button
        onClick={() => props.store.goToQuestion?.(props.questionIndex)}
        class={`h-8 w-8 rounded-full text-xs font-medium transition-all ${pillStyle()}`}
        aria-label={tooltip()}
        aria-current={isCurrentPage() ? 'page' : undefined}
      >
        {props.questionIndex + 1}
      </button>
    </Tooltip>
  );
}

/**
 * Summary view button
 */
function SummaryButton(props) {
  const isActive = () => props.store.viewMode === 'summary';

  const buttonStyle = createMemo(() =>
    isActive() ?
      'bg-blue-600 text-white ring-2 ring-blue-300'
    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
  );

  return (
    <Tooltip content='View summary of all questions' placement='bottom' openDelay={200}>
      <button
        onClick={() => props.store.setViewMode?.('summary')}
        class={`h-8 rounded-full px-3 text-xs font-medium transition-all ${buttonStyle()}`}
        aria-label='View summary'
        aria-current={isActive() ? 'page' : undefined}
      >
        Summary
      </button>
    </Tooltip>
  );
}

/**
 * Reset button to clear all reconciliation answers
 */
function ResetButton(props) {
  return (
    <Tooltip content='Reset all answers to unresolved' placement='bottom' openDelay={200}>
      <button
        onClick={() => props.onClick?.()}
        class='flex h-8 items-center gap-1 rounded-full bg-red-100 px-3 text-xs font-medium text-red-700 transition-all hover:bg-red-200'
        aria-label='Reset reconciliation'
      >
        <FaSolidArrowRotateLeft size={12} />
        Reset
      </button>
    </Tooltip>
  );
}
