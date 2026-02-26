import { Show, createMemo } from 'solid-js';
import { FiCheck, FiX, FiInfo } from 'solid-icons/fi';
import {
  ROB2_CHECKLIST,
  RESPONSE_TYPES,
  getDomainQuestions,
} from '@corates/shared/checklists/rob2';
import ROB2AnswerPanel from '../panels/ROB2AnswerPanel.jsx';

/**
 * Page for reconciling a ROB-2 signalling question
 *
 * @param {Object} props
 * @param {string} props.domainKey - The domain key (domain1, domain2a, etc.)
 * @param {string} props.questionKey - The question key (d1_1, d2a_1, etc.)
 * @param {Object} props.reviewer1Data - Reviewer 1's answer data { answer, comment }
 * @param {Object} props.reviewer2Data - Reviewer 2's answer data { answer, comment }
 * @param {Object} props.finalData - The final reconciled data { answer, comment }
 * @param {Y.Text} props.finalCommentYText - Y.Text for final comment
 * @param {string} props.reviewer1Name - Display name for reviewer 1
 * @param {string} props.reviewer2Name - Display name for reviewer 2
 * @param {boolean} props.isAgreement - Whether reviewers agree
 * @param {boolean} props.isSkipped - Whether this question was auto-skipped (NA) by flow diagram
 * @param {Function} props.onFinalAnswerChange - Callback when final answer changes
 * @param {Function} props.onUseReviewer1 - Callback to use reviewer 1's answer
 * @param {Function} props.onUseReviewer2 - Callback to use reviewer 2's answer
 * @returns {JSX.Element}
 */
export default function SignallingQuestionPage(props) {
  // Get domain and question definitions
  const domain = createMemo(() => ROB2_CHECKLIST[props.domainKey]);
  const questions = createMemo(() => getDomainQuestions(props.domainKey));
  const question = createMemo(() => questions()[props.questionKey]);

  // Get response options based on question's response type
  const responseOptions = createMemo(() => {
    const responseType = question()?.responseType || 'STANDARD';
    return [...RESPONSE_TYPES[responseType]];
  });

  return (
    <div class='bg-card rounded-xl shadow-lg'>
      {/* Header */}
      <div
        class={`rounded-t-xl border-b p-4 ${
          props.isAgreement ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
        }`}
      >
        <div class='flex items-start gap-3'>
          <Show
            when={props.isAgreement}
            fallback={
              <div class='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500'>
                <FiX class='h-4 w-4 text-white' />
              </div>
            }
          >
            <div class='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500'>
              <FiCheck class='h-4 w-4 text-white' />
            </div>
          </Show>
          <div class='flex-1'>
            <h2 class='text-foreground font-semibold'>
              <Show when={question()?.number}>
                <span class='mr-2'>{question().number}:</span>
              </Show>
              {question()?.text || props.questionKey}
            </h2>
            <p class='text-muted-foreground mt-1 text-sm'>{domain()?.name}</p>
          </div>
        </div>

        {/* Info text if available */}
        <Show when={question()?.info}>
          <div class='mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3'>
            <FiInfo class='h-4 w-4 shrink-0 text-blue-600' />
            <p class='text-xs text-blue-800'>{question().info}</p>
          </div>
        </Show>
      </div>

      {/* Skipped banner */}
      <Show when={props.isSkipped}>
        <div class='border-b border-slate-200 bg-slate-50 px-4 py-3'>
          <div class='flex items-center gap-2'>
            <FiInfo class='h-4 w-4 shrink-0 text-slate-500' />
            <p class='text-sm text-slate-600'>
              This question was auto-set to NA because the domain judgement is already determined by
              earlier answers. You can still change it if needed.
            </p>
          </div>
        </div>
      </Show>

      {/* Three-column comparison */}
      <div class={`grid grid-cols-3 divide-x ${props.isSkipped ? 'opacity-60' : ''}`}>
        {/* Reviewer 1 */}
        <ROB2AnswerPanel
          title={props.reviewer1Name || 'Reviewer 1'}
          panelType='reviewer1'
          answer={props.reviewer1Data?.answer}
          comment={props.reviewer1Data?.comment}
          responseOptions={responseOptions()}
          readOnly={true}
          onUseThis={props.onUseReviewer1}
        />

        {/* Reviewer 2 */}
        <ROB2AnswerPanel
          title={props.reviewer2Name || 'Reviewer 2'}
          panelType='reviewer2'
          answer={props.reviewer2Data?.answer}
          comment={props.reviewer2Data?.comment}
          responseOptions={responseOptions()}
          readOnly={true}
          onUseThis={props.onUseReviewer2}
        />

        {/* Final Answer */}
        <ROB2AnswerPanel
          title='Final Answer'
          panelType='final'
          answer={props.finalData?.answer}
          commentYText={props.finalCommentYText}
          responseOptions={responseOptions()}
          readOnly={false}
          onAnswerChange={props.onFinalAnswerChange}
          hideUseThis={true}
        />
      </div>
    </div>
  );
}
