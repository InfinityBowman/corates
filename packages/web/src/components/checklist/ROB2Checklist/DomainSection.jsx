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
    <div class='bg-card overflow-hidden rounded-lg shadow-md'>
      {/* Domain header */}
      <button
        type='button'
        onClick={() => props.onToggleCollapse?.()}
        class='bg-muted hover:bg-secondary flex w-full items-center justify-between px-6 py-4 transition-colors'
      >
        <div class='flex flex-col items-start'>
          <h3 class='text-foreground text-left font-semibold'>{domain()?.name}</h3>
          <Show when={domain()?.subtitle}>
            <span class='text-muted-foreground mt-0.5 text-xs'>{domain().subtitle}</span>
          </Show>
        </div>

        <div class='flex items-center gap-3'>
          {/* Completion indicator */}
          <span class='text-muted-foreground/70 text-xs'>
            {completionStatus().answered}/{completionStatus().total}
          </span>

          {/* Judgement badge */}
          <Show when={effectiveJudgement()}>
            <JudgementBadge judgement={effectiveJudgement()} />
          </Show>
          <Show when={!effectiveJudgement() && !autoScore().isComplete}>
            <span class='text-muted-foreground/70 text-xs'>Incomplete</span>
          </Show>

          {/* Collapse indicator */}
          <svg
            class={`text-muted-foreground/70 h-5 w-5 transition-transform ${props.collapsed ? '' : 'rotate-180'}`}
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
          <div class='bg-muted mt-4 rounded-lg p-4'>
            {/* Calculated judgement display */}
            <div class='mb-3 flex items-center gap-3'>
              <span class='text-secondary-foreground text-sm font-medium'>
                Risk of bias judgement
              </span>
              <Show when={autoScore().judgement}>
                <div class='bg-card flex items-center gap-2 rounded-md px-2.5 py-1 text-xs shadow-sm'>
                  <span class='text-muted-foreground'>Calculated:</span>
                  <JudgementBadge judgement={autoScore().judgement} />
                </div>
              </Show>
              <Show when={!autoScore().judgement && !autoScore().isComplete}>
                <span class='text-muted-foreground/70 text-xs'>(answer more questions)</span>
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
