import {
  OVERALL_ROB_JUDGEMENTS,
  BIAS_DIRECTIONS,
} from '@/components/checklist/ROBINSIChecklist/checklist-map.js';
import JudgementPanel from '../panels/JudgementPanel.jsx';
import DirectionPanel from '../panels/DirectionPanel.jsx';

/**
 * Page for reconciling overall risk of bias judgement and direction
 *
 * @param {Object} props
 * @param {Object} props.reviewer1Data - { judgement, direction } from reviewer 1
 * @param {Object} props.reviewer2Data - { judgement, direction } from reviewer 2
 * @param {Object} props.finalData - { judgement, direction } current final selection
 * @param {string} props.reviewer1Name - Display name for reviewer 1
 * @param {string} props.reviewer2Name - Display name for reviewer 2
 * @param {boolean} props.judgementMatch - Whether reviewers agree on judgement
 * @param {boolean} props.directionMatch - Whether reviewers agree on direction
 * @param {Function} props.onFinalJudgementChange - (judgement) => void
 * @param {Function} props.onFinalDirectionChange - (direction) => void
 * @param {Function} props.onUseReviewer1Judgement - Copy reviewer 1's judgement to final
 * @param {Function} props.onUseReviewer2Judgement - Copy reviewer 2's judgement to final
 * @param {Function} props.onUseReviewer1Direction - Copy reviewer 1's direction to final
 * @param {Function} props.onUseReviewer2Direction - Copy reviewer 2's direction to final
 * @param {string} props.selectedJudgementSource - 'reviewer1', 'reviewer2', or null
 * @param {string} props.selectedDirectionSource - 'reviewer1', 'reviewer2', or null
 * @returns {JSX.Element}
 */
export default function OverallJudgementPage(props) {
  return (
    <div class='space-y-4'>
      {/* Overall Header */}
      <div class='overflow-hidden rounded-lg bg-white shadow-lg'>
        <div class='border-b border-gray-200 bg-gray-100 px-4 py-3'>
          <h2 class='text-lg font-semibold text-gray-900'>Overall Risk of Bias</h2>
          <p class='text-sm text-gray-600'>
            Final assessment based on judgements across all domains
          </p>
        </div>
      </div>

      {/* Judgement Row */}
      <div class='overflow-hidden rounded-lg bg-white shadow-lg'>
        <div
          class={`p-3 ${
            props.judgementMatch
              ? 'border-b border-green-200 bg-green-50'
              : 'border-b border-amber-200 bg-amber-50'
          }`}
        >
          <h3 class='font-medium text-gray-900'>Overall Risk of Bias Judgement</h3>
          <span
            class={`text-xs font-medium ${
              props.judgementMatch ? 'text-green-700' : 'text-amber-700'
            }`}
          >
            {props.judgementMatch ? 'Reviewers Agree' : 'Requires Reconciliation'}
          </span>
        </div>

        <div class='grid grid-cols-3 divide-x divide-gray-200'>
          <JudgementPanel
            title={props.reviewer1Name || 'Reviewer 1'}
            panelType='reviewer1'
            judgement={props.reviewer1Data?.judgement}
            judgementOptions={OVERALL_ROB_JUDGEMENTS}
            readOnly={true}
            hideUseThis={props.judgementMatch}
            isSelected={props.selectedJudgementSource === 'reviewer1'}
            onUseThis={props.onUseReviewer1Judgement}
          />

          <JudgementPanel
            title={props.reviewer2Name || 'Reviewer 2'}
            panelType='reviewer2'
            judgement={props.reviewer2Data?.judgement}
            judgementOptions={OVERALL_ROB_JUDGEMENTS}
            readOnly={true}
            hideUseThis={props.judgementMatch}
            isSelected={props.selectedJudgementSource === 'reviewer2'}
            onUseThis={props.onUseReviewer2Judgement}
          />

          <JudgementPanel
            title='Final Judgement'
            panelType='final'
            judgement={props.finalData?.judgement}
            judgementOptions={OVERALL_ROB_JUDGEMENTS}
            readOnly={false}
            hideUseThis={true}
            onJudgementChange={props.onFinalJudgementChange}
          />
        </div>
      </div>

      {/* Direction Row */}
      <div class='overflow-hidden rounded-lg bg-white shadow-lg'>
        <div
          class={`p-3 ${
            props.directionMatch
              ? 'border-b border-green-200 bg-green-50'
              : 'border-b border-amber-200 bg-amber-50'
          }`}
        >
          <h3 class='font-medium text-gray-900'>Predicted Direction of Bias (Overall)</h3>
          <span
            class={`text-xs font-medium ${
              props.directionMatch ? 'text-green-700' : 'text-amber-700'
            }`}
          >
            {props.directionMatch ? 'Reviewers Agree' : 'Requires Reconciliation'}
          </span>
        </div>

        <div class='grid grid-cols-3 divide-x divide-gray-200'>
          <DirectionPanel
            title={props.reviewer1Name || 'Reviewer 1'}
            panelType='reviewer1'
            direction={props.reviewer1Data?.direction}
            directionOptions={BIAS_DIRECTIONS}
            readOnly={true}
            hideUseThis={props.directionMatch}
            isSelected={props.selectedDirectionSource === 'reviewer1'}
            onUseThis={props.onUseReviewer1Direction}
          />

          <DirectionPanel
            title={props.reviewer2Name || 'Reviewer 2'}
            panelType='reviewer2'
            direction={props.reviewer2Data?.direction}
            directionOptions={BIAS_DIRECTIONS}
            readOnly={true}
            hideUseThis={props.directionMatch}
            isSelected={props.selectedDirectionSource === 'reviewer2'}
            onUseThis={props.onUseReviewer2Direction}
          />

          <DirectionPanel
            title='Final Direction'
            panelType='final'
            direction={props.finalData?.direction}
            directionOptions={BIAS_DIRECTIONS}
            readOnly={false}
            hideUseThis={true}
            onDirectionChange={props.onFinalDirectionChange}
          />
        </div>
      </div>
    </div>
  );
}
