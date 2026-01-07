import { Show } from 'solid-js';
import {
  getDomainQuestions,
  RESPONSE_TYPES,
  ROBINS_I_CHECKLIST,
} from '@/components/checklist/ROBINSIChecklist/checklist-map.js';
import RobinsAnswerPanel from '../panels/RobinsAnswerPanel.jsx';

/**
 * Page for reconciling a single domain signalling question
 * Three-column layout: Reviewer 1 | Reviewer 2 | Final Answer
 *
 * @param {Object} props
 * @param {string} props.domainKey - The domain key (domain1a, domain2, etc.)
 * @param {string} props.questionKey - The question key (d1a_1, d2_1, etc.)
 * @param {Object} props.reviewer1Data - { answer, comment } from reviewer 1
 * @param {Object} props.reviewer2Data - { answer, comment } from reviewer 2
 * @param {Object} props.finalData - { answer } current final selection (comment is in Y.Text)
 * @param {Y.Text} props.finalCommentYText - Y.Text instance for the final comment
 * @param {string} props.reviewer1Name - Display name for reviewer 1
 * @param {string} props.reviewer2Name - Display name for reviewer 2
 * @param {boolean} props.isAgreement - Whether reviewers agree on this question
 * @param {Function} props.onFinalAnswerChange - (answer) => void
 * @param {Function} props.onUseReviewer1 - Copy reviewer 1's answer to final
 * @param {Function} props.onUseReviewer2 - Copy reviewer 2's answer to final
 * @param {string} props.selectedSource - 'reviewer1', 'reviewer2', or null
 * @returns {JSX.Element}
 */
export default function DomainQuestionPage(props) {
  const domain = () => ROBINS_I_CHECKLIST[props.domainKey];
  const questions = () => getDomainQuestions(props.domainKey);
  const question = () => questions()[props.questionKey];
  const responseOptions = () => RESPONSE_TYPES[question()?.responseType] || RESPONSE_TYPES.WITH_NI;

  return (
    <div class='overflow-hidden rounded-lg bg-white shadow-lg'>
      {/* Domain Header */}
      <div class='border-b border-gray-200 bg-gray-50 px-4 py-2'>
        <h3 class='text-sm font-medium text-gray-700'>{domain()?.name}</h3>
        <Show when={domain()?.subtitle}>
          <p class='text-xs text-gray-500'>{domain().subtitle}</p>
        </Show>
      </div>

      {/* Question Header */}
      <div
        class={`p-4 ${
          props.isAgreement ?
            'border-b border-green-200 bg-green-50'
          : 'border-b border-amber-200 bg-amber-50'
        }`}
      >
        <h2 class='text-md font-medium text-gray-900'>
          <span class='font-semibold'>{question()?.number}.</span> {question()?.text}
        </h2>
        <Show when={question()?.note}>
          <p class='mt-2 text-sm text-gray-600'>{question().note}</p>
        </Show>
        <div class='mt-2 flex items-center gap-3'>
          <span
            class={`text-xs font-medium ${props.isAgreement ? 'text-green-700' : 'text-amber-700'}`}
          >
            {props.isAgreement ? 'Reviewers Agree' : 'Requires Reconciliation'}
          </span>
        </div>
      </div>

      {/* Three Column Layout */}
      <div class='grid grid-cols-3 divide-x divide-gray-200'>
        {/* Reviewer 1 Panel */}
        <RobinsAnswerPanel
          title={props.reviewer1Name || 'Reviewer 1'}
          panelType='reviewer1'
          answer={props.reviewer1Data?.answer}
          comment={props.reviewer1Data?.comment}
          responseOptions={responseOptions()}
          readOnly={true}
          hideUseThis={props.isAgreement}
          isSelected={props.selectedSource === 'reviewer1'}
          onUseThis={props.onUseReviewer1}
        />

        {/* Reviewer 2 Panel */}
        <RobinsAnswerPanel
          title={props.reviewer2Name || 'Reviewer 2'}
          panelType='reviewer2'
          answer={props.reviewer2Data?.answer}
          comment={props.reviewer2Data?.comment}
          responseOptions={responseOptions()}
          readOnly={true}
          hideUseThis={props.isAgreement}
          isSelected={props.selectedSource === 'reviewer2'}
          onUseThis={props.onUseReviewer2}
        />

        {/* Final Answer Panel */}
        <RobinsAnswerPanel
          title='Final Answer'
          panelType='final'
          answer={props.finalData?.answer}
          commentYText={props.finalCommentYText}
          responseOptions={responseOptions()}
          readOnly={false}
          hideUseThis={true}
          onAnswerChange={props.onFinalAnswerChange}
        />
      </div>
    </div>
  );
}
