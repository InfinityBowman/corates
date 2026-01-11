import { For, Show, createMemo } from 'solid-js';
import { ROB2_CHECKLIST, getDomainQuestions } from './checklist-map.js';
import { SignallingQuestion } from './SignallingQuestion.jsx';
import { DomainJudgement, JudgementBadge } from './DomainJudgement.jsx';
import { scoreRob2Domain } from './checklist.js';

/**
 * A complete domain section with questions and judgement
 * Uses auto-scoring: calculated judgements from the decision algorithm
 *
 * @param {Object} props
 * @param {string} props.domainKey - The domain key (e.g., 'domain1')
 * @param {Object} props.domainState - Current domain state { answers, judgement, direction }
 * @param {Function} props.onUpdate - Callback when domain state changes
 * @param {boolean} [props.disabled] - Whether the domain is disabled
 * @param {boolean} [props.showComments] - Whether to show comment fields
 * @param {boolean} [props.collapsed] - Whether the domain is collapsed
 * @param {Function} [props.onToggleCollapse] - Callback to toggle collapse
 * @param {Function} [props.getRob2Text] - Function to get Y.Text for a ROB-2 free-text field
 */
export function DomainSection(props) {
  const domain = () => ROB2_CHECKLIST[props.domainKey];
  const questions = () => getDomainQuestions(props.domainKey);

  // Smart scoring: compute auto judgement from answers
  const autoScore = createMemo(() => {
    return scoreRob2Domain(props.domainKey, props.domainState?.answers);
  });

  // Early completion: scoring determined before all questions answered
  const isEarlyComplete = createMemo(() => {
    return autoScore().isComplete && autoScore().judgement !== null;
  });

  // Check if a specific question can be skipped (scoring done, question unanswered)
  const isQuestionSkippable = qKey => {
    return isEarlyComplete() && !props.domainState?.answers?.[qKey]?.answer;
  };

  // Effective judgement: use auto-calculated value
  const effectiveJudgement = createMemo(() => {
    return autoScore().judgement;
  });

  function handleQuestionUpdate(questionKey, newAnswer) {
    const newAnswers = {
      ...props.domainState?.answers,
      [questionKey]: newAnswer,
    };

    // Compute what the auto judgement would be with new answers
    const newAutoScore = scoreRob2Domain(props.domainKey, newAnswers);

    const newState = {
      ...props.domainState,
      answers: newAnswers,
      judgement: newAutoScore.judgement,
    };

    props.onUpdate(newState);
  }

  function handleDirectionChange(direction) {
    props.onUpdate({
      ...props.domainState,
      direction,
    });
  }

  // Get completion status
  const completionStatus = () => {
    const qs = questions();
    const answered = Object.keys(qs).filter(
      k => props.domainState?.answers?.[k]?.answer !== null,
    ).length;
    const total = Object.keys(qs).length;
    return { answered, total };
  };

  return (
    <div class='overflow-hidden rounded-lg bg-white shadow-md'>
      {/* Domain header */}
      <button
        type='button'
        onClick={() => props.onToggleCollapse?.()}
        class='flex w-full items-center justify-between bg-gray-50 px-6 py-4 transition-colors hover:bg-gray-100'
      >
        <div class='flex flex-col items-start'>
          <h3 class='text-left font-semibold text-gray-900'>{domain()?.name}</h3>
          <Show when={domain()?.subtitle}>
            <span class='mt-0.5 text-xs text-gray-500'>{domain().subtitle}</span>
          </Show>
        </div>

        <div class='flex items-center gap-3'>
          {/* Completion indicator */}
          <span class='text-xs text-gray-400'>
            {completionStatus().answered}/{completionStatus().total}
          </span>

          {/* Judgement badge */}
          <Show when={effectiveJudgement()}>
            <JudgementBadge judgement={effectiveJudgement()} />
          </Show>
          <Show when={!effectiveJudgement() && !autoScore().isComplete}>
            <span class='text-xs text-gray-400'>Incomplete</span>
          </Show>

          {/* Collapse indicator */}
          <svg
            class={`h-5 w-5 text-gray-400 transition-transform ${props.collapsed ? '' : 'rotate-180'}`}
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              stroke-linecap='round'
              stroke-linejoin='round'
              stroke-width='2'
              d='M19 9l-7 7-7-7'
            />
          </svg>
        </div>
      </button>

      {/* Domain content */}
      <Show when={!props.collapsed}>
        <div class='px-6 py-4'>
          {/* Questions */}
          <div class='space-y-1'>
            <For each={Object.entries(questions())}>
              {([qKey, qDef]) => (
                <SignallingQuestion
                  question={qDef}
                  answer={props.domainState?.answers?.[qKey]}
                  onUpdate={newAnswer => handleQuestionUpdate(qKey, newAnswer)}
                  disabled={props.disabled}
                  showComment={props.showComments}
                  domainKey={props.domainKey}
                  questionKey={qKey}
                  getRob2Text={props.getRob2Text}
                  isSkippable={isQuestionSkippable(qKey)}
                />
              )}
            </For>
          </div>

          {/* Auto judgement section */}
          <div class='mt-4 rounded-lg bg-gray-50 p-4'>
            {/* Calculated judgement display */}
            <div class='mb-3 flex items-center gap-3'>
              <span class='text-sm font-medium text-gray-700'>Risk of bias judgement</span>
              <Show when={autoScore().judgement}>
                <div class='flex items-center gap-2 rounded-md bg-white px-2.5 py-1 text-xs shadow-sm'>
                  <span class='text-gray-500'>Calculated:</span>
                  <JudgementBadge judgement={autoScore().judgement} />
                </div>
              </Show>
              <Show when={!autoScore().judgement && !autoScore().isComplete}>
                <span class='text-xs text-gray-400'>(answer more questions)</span>
              </Show>
            </div>

            {/* Direction selector */}
            <Show when={domain()?.hasDirection}>
              <DomainJudgement
                domainId={props.domainKey}
                judgement={effectiveJudgement()}
                direction={props.domainState?.direction}
                onJudgementChange={() => {}}
                onDirectionChange={handleDirectionChange}
                showDirection={true}
                disabled={props.disabled}
                isAutoMode={true}
              />
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default DomainSection;
