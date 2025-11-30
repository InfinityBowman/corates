/**
 * ReconciliationQuestion - Displays a single question comparison for reconciliation
 * Shows both reviewer answers side-by-side and allows selection of the final answer
 */

import { For, Show, createMemo } from 'solid-js';
import { AMSTAR_CHECKLIST } from '../../AMSTAR2/checklist-map.js';
import { AiOutlineCheck } from 'solid-icons/ai';
import { BsFileDiff } from 'solid-icons/bs';

/**
 * Get answer label from index for a given question's last column
 */
function getAnswerLabel(questionKey, answerIndex, columnLength) {
  const customPatternQuestions = ['q11a', 'q11b', 'q12', 'q15'];
  const customLabels = ['Yes', 'No', 'No MA'];
  const defaultLabels = ['Yes', 'Partial Yes', 'No', 'No MA'];
  
  if (customPatternQuestions.includes(questionKey)) {
    return customLabels[answerIndex] || 'Unknown';
  }
  if (columnLength === 2) {
    return answerIndex === 0 ? 'Yes' : 'No';
  }
  return defaultLabels[answerIndex] || 'Unknown';
}

/**
 * Get badge color for answer type
 */
function getAnswerBadgeStyle(answer) {
  switch (answer) {
    case 'Yes':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Partial Yes':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'No':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'No MA':
      return 'bg-gray-100 text-gray-600 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

export default function ReconciliationQuestion(props) {
  // props.questionKey - e.g., 'q1'
  // props.comparison - comparison data for this question
  // props.selection - current selection ('reviewer1' | 'reviewer2' | null)
  // props.onSelect - callback when user selects an answer
  // props.reviewer1Name - name of first reviewer
  // props.reviewer2Name - name of second reviewer
  
  const question = () => AMSTAR_CHECKLIST[props.questionKey];
  const isAgreement = () => props.comparison?.isAgreement ?? true;
  
  const reviewer1Answer = () => props.comparison?.reviewer1?.finalAnswer || 'Not answered';
  const reviewer2Answer = () => props.comparison?.reviewer2?.finalAnswer || 'Not answered';
  
  const reviewer1Critical = () => props.comparison?.reviewer1?.critical ?? false;
  const reviewer2Critical = () => props.comparison?.reviewer2?.critical ?? false;
  
  // Determine if this is a critical question (either reviewer marked it critical)
  const isCritical = () => reviewer1Critical() || reviewer2Critical();

  return (
    <div class={`bg-white rounded-lg shadow-sm border ${isAgreement() ? 'border-green-200' : 'border-amber-300'} overflow-hidden`}>
      {/* Question Header */}
      <div class={`p-4 ${isAgreement() ? 'bg-green-50' : 'bg-amber-50'} border-b ${isAgreement() ? 'border-green-200' : 'border-amber-200'}`}>
        <div class='flex items-start justify-between gap-4'>
          <div class='flex-1'>
            <div class='flex items-center gap-2'>
              <Show when={isAgreement()} fallback={<BsFileDiff class='w-5 h-5 text-amber-600 shrink-0' />}>
                <AiOutlineCheck class='w-5 h-5 text-green-600 shrink-0' />
              </Show>
              <h3 class='font-semibold text-sm text-gray-900'>{question()?.text}</h3>
            </div>
          </div>
          <Show when={isCritical()}>
            <span class='px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200 shrink-0'>
              Critical
            </span>
          </Show>
        </div>
        <div class='mt-2 flex items-center gap-2'>
          <span class={`text-xs font-medium ${isAgreement() ? 'text-green-700' : 'text-amber-700'}`}>
            {isAgreement() ? 'Reviewers Agree' : 'Requires Reconciliation'}
          </span>
        </div>
      </div>

      {/* Answer Comparison */}
      <div class='p-4'>
        <div class='grid grid-cols-2 gap-4'>
          {/* Reviewer 1 */}
          <ReviewerAnswerCard
            reviewerName={props.reviewer1Name || 'Reviewer 1'}
            answer={reviewer1Answer()}
            critical={reviewer1Critical()}
            isSelected={props.selection === 'reviewer1'}
            onSelect={() => props.onSelect?.('reviewer1')}
            questionKey={props.questionKey}
            answers={props.comparison?.reviewer1?.answers}
            disabled={isAgreement()}
          />
          
          {/* Reviewer 2 */}
          <ReviewerAnswerCard
            reviewerName={props.reviewer2Name || 'Reviewer 2'}
            answer={reviewer2Answer()}
            critical={reviewer2Critical()}
            isSelected={props.selection === 'reviewer2'}
            onSelect={() => props.onSelect?.('reviewer2')}
            questionKey={props.questionKey}
            answers={props.comparison?.reviewer2?.answers}
            disabled={isAgreement()}
          />
        </div>
        
        {/* Selected Answer Indicator for disagreements */}
        <Show when={!isAgreement()}>
          <div class='mt-4 pt-4 border-t border-gray-200'>
            <div class='flex items-center justify-between'>
              <span class='text-sm text-gray-600'>
                Final selection:
              </span>
              <Show 
                when={props.selection} 
                fallback={
                  <span class='text-sm text-amber-600 font-medium'>
                    Please select an answer
                  </span>
                }
              >
                <span class='text-sm font-medium text-green-700'>
                  {props.selection === 'reviewer1' ? props.reviewer1Name : props.reviewer2Name}'s answer selected
                </span>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}

/**
 * Card showing a single reviewer's answer
 */
function ReviewerAnswerCard(props) {
  const question = () => AMSTAR_CHECKLIST[props.questionKey];
  
  return (
    <button
      type='button'
      onClick={() => !props.disabled && props.onSelect?.()}
      disabled={props.disabled}
      class={`
        p-4 rounded-lg border-2 transition-all text-left w-full
        ${props.disabled 
          ? 'border-gray-200 bg-gray-50 cursor-default' 
          : props.isSelected 
            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer'
        }
      `}
    >
      {/* Reviewer Name */}
      <div class='flex items-center justify-between mb-3'>
        <span class='text-sm font-medium text-gray-700'>{props.reviewerName}</span>
        <Show when={props.isSelected && !props.disabled}>
          <span class='px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700'>
            Selected
          </span>
        </Show>
      </div>
      
      {/* Final Answer Badge */}
      <div class='mb-3'>
        <span class={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getAnswerBadgeStyle(props.answer)}`}>
          {props.answer}
        </span>
      </div>
      
      {/* Critical Assessment */}
      <div class='text-xs text-gray-500'>
        Marked as: <span class={props.critical ? 'text-red-600 font-medium' : 'text-gray-600'}>
          {props.critical ? 'Critical' : 'Not Critical'}
        </span>
      </div>
      
      {/* Detailed Answers Toggle - could expand in future */}
      <Show when={props.answers && question()}>
        <details class='mt-3'>
          <summary class='text-xs text-gray-500 cursor-pointer hover:text-gray-700'>
            View detailed selections
          </summary>
          <div class='mt-2 space-y-2'>
            <For each={question()?.columns}>
              {(col, colIdx) => (
                <Show when={colIdx() < (props.answers?.length ?? 0) - 1}>
                  <div class='text-xs'>
                    <div class='font-medium text-gray-600'>{col.label}</div>
                    <ul class='ml-3 mt-1 space-y-0.5'>
                      <For each={col.options}>
                        {(option, optIdx) => (
                          <li class={`flex items-center gap-1 ${props.answers?.[colIdx()]?.[optIdx()] ? 'text-gray-900' : 'text-gray-400'}`}>
                            <span class={`w-3 h-3 rounded border flex items-center justify-center ${props.answers?.[colIdx()]?.[optIdx()] ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                              <Show when={props.answers?.[colIdx()]?.[optIdx()]}>
                                <AiOutlineCheck class='w-2 h-2 text-white' />
                              </Show>
                            </span>
                            <span class='truncate'>{option}</span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                </Show>
              )}
            </For>
          </div>
        </details>
      </Show>
    </button>
  );
}
