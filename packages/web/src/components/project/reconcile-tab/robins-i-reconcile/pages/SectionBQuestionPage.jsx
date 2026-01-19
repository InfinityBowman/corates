import { Show } from 'solid-js';
import {
  SECTION_B,
  RESPONSE_TYPES,
} from '@/components/checklist/ROBINSIChecklist/checklist-map.js';
import RobinsAnswerPanel from '../panels/RobinsAnswerPanel.jsx';

/**
 * Page for reconciling a single Section B question
 * Three-column layout: Reviewer 1 | Reviewer 2 | Final Answer
 *
 * @param {Object} props
 * @param {string} props.questionKey - The question key (b1, b2, b3)
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
export default function SectionBQuestionPage(props) {
  const question = () => SECTION_B[props.questionKey];
  const responseOptions = () => RESPONSE_TYPES[question()?.responseType] || RESPONSE_TYPES.STANDARD;

  return (
    <div class='bg-card overflow-hidden rounded-lg shadow-lg'>
      {/* Question Header */}
      <div
        class={`p-4 ${
          props.isAgreement ?
            'border-b border-green-200 bg-green-50'
          : 'border-b border-amber-200 bg-amber-50'
        }`}
      >
        <h2 class='text-md text-foreground font-medium'>
          <span class='font-semibold'>{props.questionKey.toUpperCase()}.</span> {question()?.text}
        </h2>
        <Show when={question()?.info}>
          <p class='text-muted-foreground mt-2 text-sm'>{question().info}</p>
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
      <div class='divide-border grid grid-cols-3 divide-x'>
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
