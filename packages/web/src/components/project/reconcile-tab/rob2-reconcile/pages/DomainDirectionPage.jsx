import { Show, createMemo } from 'solid-js';
import { FiCheck, FiX, FiInfo } from 'solid-icons/fi';
import { ROB2_CHECKLIST, scoreRob2Domain } from '@corates/shared/checklists/rob2';
import JudgementPanel from '../panels/JudgementPanel.jsx';
import DirectionPanel from '../panels/DirectionPanel.jsx';

/**
 * Page for reconciling domain direction and viewing auto-calculated judgement
 *
 * @param {Object} props
 * @param {string} props.domainKey - The domain key (domain1, domain2a, etc.)
 * @param {Object} props.reviewer1Answers - Reviewer 1's domain answers (for auto-calculation)
 * @param {Object} props.reviewer2Answers - Reviewer 2's domain answers (for auto-calculation)
 * @param {Object} props.finalAnswers - The final reconciled domain answers (for auto-calculation)
 * @param {string} props.reviewer1Direction - Reviewer 1's direction selection
 * @param {string} props.reviewer2Direction - Reviewer 2's direction selection
 * @param {string} props.finalDirection - The final reconciled direction
 * @param {string} props.reviewer1Name - Display name for reviewer 1
 * @param {string} props.reviewer2Name - Display name for reviewer 2
 * @param {boolean} props.directionMatch - Whether reviewers agree on direction
 * @param {Function} props.onFinalDirectionChange - Callback when final direction changes
 * @param {Function} props.onUseReviewer1 - Callback to use reviewer 1's direction
 * @param {Function} props.onUseReviewer2 - Callback to use reviewer 2's direction
 * @returns {JSX.Element}
 */
export default function DomainDirectionPage(props) {
  // Get domain definition
  const domain = createMemo(() => ROB2_CHECKLIST[props.domainKey]);

  // Calculate auto-judgements
  const reviewer1Scoring = createMemo(() =>
    scoreRob2Domain(props.domainKey, props.reviewer1Answers),
  );
  const reviewer2Scoring = createMemo(() =>
    scoreRob2Domain(props.domainKey, props.reviewer2Answers),
  );
  const finalScoring = createMemo(() => scoreRob2Domain(props.domainKey, props.finalAnswers));

  // Check if judgements match
  const judgementMatch = createMemo(
    () => reviewer1Scoring().judgement === reviewer2Scoring().judgement,
  );

  return (
    <div class='bg-card rounded-xl shadow-lg'>
      {/* Header */}
      <div
        class={`rounded-t-xl border-b p-4 ${
          props.directionMatch && judgementMatch() ?
            'border-green-200 bg-green-50'
          : 'border-amber-200 bg-amber-50'
        }`}
      >
        <div class='flex items-start gap-3'>
          <Show
            when={props.directionMatch && judgementMatch()}
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
          <div>
            <h2 class='text-foreground font-semibold'>
              {domain()?.name} - Judgement &amp; Direction
            </h2>
            <p class='text-muted-foreground mt-1 text-sm'>
              Review the calculated judgement and select the bias direction
            </p>
          </div>
        </div>
      </div>

      {/* Auto-calculated Judgement Section */}
      <div class='border-b p-4'>
        <div class='mb-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3'>
          <FiInfo class='h-4 w-4 shrink-0 text-blue-600' />
          <p class='text-xs text-blue-800'>
            The risk of bias judgement is automatically calculated from the signalling question
            answers. To change it, reconcile the signalling questions above.
          </p>
        </div>

        <h3 class='text-secondary-foreground mb-3 text-sm font-semibold'>
          Auto-calculated Judgement
        </h3>

        <div class='grid grid-cols-3 divide-x rounded-lg border'>
          <JudgementPanel
            title={props.reviewer1Name || 'Reviewer 1'}
            panelType='reviewer1'
            judgement={reviewer1Scoring().judgement}
            ruleId={reviewer1Scoring().ruleId}
            isComplete={reviewer1Scoring().isComplete}
          />
          <JudgementPanel
            title={props.reviewer2Name || 'Reviewer 2'}
            panelType='reviewer2'
            judgement={reviewer2Scoring().judgement}
            ruleId={reviewer2Scoring().ruleId}
            isComplete={reviewer2Scoring().isComplete}
          />
          <JudgementPanel
            title='Final (Reconciled)'
            panelType='final'
            judgement={finalScoring().judgement}
            ruleId={finalScoring().ruleId}
            isComplete={finalScoring().isComplete}
          />
        </div>
      </div>

      {/* Direction Section */}
      <div class='p-4'>
        <div class='mb-3 flex items-center gap-2'>
          <h3 class='text-secondary-foreground text-sm font-semibold'>
            Predicted Direction of Bias
          </h3>
          <Show
            when={props.directionMatch}
            fallback={
              <span class='rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700'>
                Disagree
              </span>
            }
          >
            <span class='rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700'>
              Agree
            </span>
          </Show>
        </div>

        <div class='grid grid-cols-3 divide-x rounded-lg border'>
          <DirectionPanel
            title={props.reviewer1Name || 'Reviewer 1'}
            panelType='reviewer1'
            direction={props.reviewer1Direction}
            readOnly={true}
            onUseThis={props.onUseReviewer1}
          />
          <DirectionPanel
            title={props.reviewer2Name || 'Reviewer 2'}
            panelType='reviewer2'
            direction={props.reviewer2Direction}
            readOnly={true}
            onUseThis={props.onUseReviewer2}
          />
          <DirectionPanel
            title='Final Direction'
            panelType='final'
            direction={props.finalDirection}
            readOnly={false}
            onDirectionChange={props.onFinalDirectionChange}
            hideUseThis={true}
          />
        </div>
      </div>
    </div>
  );
}
