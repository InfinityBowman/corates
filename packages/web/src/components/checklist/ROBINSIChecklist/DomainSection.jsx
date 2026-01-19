import { For, Show, createMemo } from 'solid-js';
import { ROBINS_I_CHECKLIST, getDomainQuestions } from './checklist-map.js';
import { SignallingQuestion } from './SignallingQuestion.jsx';
import { DomainJudgement, JudgementBadge } from './DomainJudgement.jsx';
import { scoreRobinsDomain, getEffectiveDomainJudgement } from './scoring/robins-scoring.js';

/**
 * A complete domain section with questions and judgement
 * Now with auto-first scoring: calculated judgements are primary, manual override is explicit
 *
 * @param {Object} props
 * @param {string} props.domainKey - The domain key (e.g., 'domain1a')
 * @param {Object} props.domainState - Current domain state { answers, judgement, judgementSource, direction }
 * @param {Function} props.onUpdate - Callback when domain state changes
 * @param {boolean} [props.disabled] - Whether the domain is disabled
 * @param {boolean} [props.showComments] - Whether to show comment fields
 * @param {boolean} [props.collapsed] - Whether the domain is collapsed
 * @param {Function} [props.onToggleCollapse] - Callback to toggle collapse
 * @param {Function} [props.getRobinsText] - Function to get Y.Text for a ROBINS-I free-text field
 */
export function DomainSection(props) {
  const domain = () => ROBINS_I_CHECKLIST[props.domainKey];
  const questions = () => getDomainQuestions(props.domainKey);
  const hasSubsections = () => !!domain()?.subsections;

  // Smart scoring: compute auto judgement from answers
  const autoScore = createMemo(() => {
    return scoreRobinsDomain(props.domainKey, props.domainState?.answers);
  });

  // Early completion: scoring determined before all questions answered
  const isEarlyComplete = createMemo(() => {
    return autoScore().isComplete && autoScore().judgement !== null;
  });

  // Check if a specific question can be skipped (scoring done, question unanswered)
  const isQuestionSkippable = qKey => {
    return isEarlyComplete() && !props.domainState?.answers?.[qKey]?.answer;
  };

  // Effective judgement: auto unless manually overridden
  const effectiveJudgement = createMemo(() => {
    return getEffectiveDomainJudgement(props.domainState, autoScore());
  });

  // Check if currently in manual mode (reactive)
  const isManualMode = createMemo(() => props.domainState?.judgementSource === 'manual');

  function handleQuestionUpdate(questionKey, newAnswer) {
    const newAnswers = {
      ...props.domainState.answers,
      [questionKey]: newAnswer,
    };

    // Compute what the auto judgement would be with new answers
    const newAutoScore = scoreRobinsDomain(props.domainKey, newAnswers);

    // If in auto mode, sync judgement with calculated value
    const currentSource = props.domainState?.judgementSource || 'auto';
    const newState = {
      ...props.domainState,
      answers: newAnswers,
    };

    if (currentSource === 'auto' && newAutoScore.judgement) {
      newState.judgement = newAutoScore.judgement;
    }

    props.onUpdate(newState);
  }

  function handleJudgementChange(judgement) {
    // Clicking a judgement button switches to manual mode
    props.onUpdate({
      ...props.domainState,
      judgement,
      judgementSource: 'manual',
    });
  }

  function handleDirectionChange(direction) {
    props.onUpdate({
      ...props.domainState,
      direction,
    });
  }

  function handleRevertToAuto() {
    // Reset to auto mode with calculated judgement
    const currentState = props.domainState || {};
    props.onUpdate({
      ...currentState,
      judgement: autoScore().judgement,
      judgementSource: 'auto',
    });
  }

  function handleSwitchToManual() {
    // Switch to manual mode but keep current judgement (or use current auto if no judgement set)
    const currentState = props.domainState || {};
    props.onUpdate({
      ...currentState,
      judgement: currentState.judgement || autoScore().judgement,
      judgementSource: 'manual',
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

          {/* Judgement badge with mode indicator */}
          <Show when={effectiveJudgement()}>
            <div class='flex items-center gap-1.5'>
              <Show when={isManualMode()}>
                <span class='text-xs text-amber-600'>Manual</span>
              </Show>
              <JudgementBadge judgement={effectiveJudgement()} />
            </div>
          </Show>
          <Show when={!effectiveJudgement() && autoScore().isComplete === false}>
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
          {/* Questions - with or without subsections */}
          <Show
            when={hasSubsections()}
            fallback={
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
                      getRobinsText={props.getRobinsText}
                      isSkippable={isQuestionSkippable(qKey)}
                    />
                  )}
                </For>
              </div>
            }
          >
            {/* Domain 3 has subsections */}
            <For each={Object.entries(domain().subsections)}>
              {([_subKey, subsection]) => (
                <div class='mb-4'>
                  <div class='border-border-subtle text-muted-foreground mb-2 border-b pb-1 text-sm font-medium'>
                    {subsection.name}
                  </div>
                  <div class='space-y-1'>
                    <For each={Object.entries(subsection.questions)}>
                      {([qKey, qDef]) => (
                        <SignallingQuestion
                          question={qDef}
                          answer={props.domainState?.answers?.[qKey]}
                          onUpdate={newAnswer => handleQuestionUpdate(qKey, newAnswer)}
                          disabled={props.disabled}
                          showComment={props.showComments}
                          domainKey={props.domainKey}
                          questionKey={qKey}
                          getRobinsText={props.getRobinsText}
                          isSkippable={isQuestionSkippable(qKey)}
                        />
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </Show>

          {/* Auto-first judgement section */}
          <div class='bg-muted mt-4 rounded-lg p-4'>
            {/* Calculated judgement display */}
            <div class='mb-3 flex items-center justify-between'>
              <div class='flex items-center gap-3'>
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

              {/* Mode toggle */}
              <div class='flex items-center gap-2'>
                <div class='border-border bg-card flex rounded-md border text-xs'>
                  <button
                    type='button'
                    onClick={e => {
                      e.stopPropagation();
                      handleRevertToAuto();
                    }}
                    disabled={props.disabled}
                    class={`rounded-l-md px-2.5 py-1 transition-colors ${
                      !isManualMode() ?
                        'bg-blue-100 text-blue-800'
                      : 'text-muted-foreground hover:bg-muted'
                    } ${props.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    Auto
                  </button>
                  <button
                    type='button'
                    onClick={e => {
                      e.stopPropagation();
                      handleSwitchToManual();
                    }}
                    disabled={props.disabled}
                    class={`border-border rounded-r-md border-l px-2.5 py-1 transition-colors ${
                      isManualMode() ?
                        'bg-amber-100 text-amber-800'
                      : 'text-muted-foreground hover:bg-muted'
                    } ${props.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    Manual
                  </button>
                </div>
              </div>
            </div>

            {/* Judgement selector - only fully interactive in manual mode */}
            <DomainJudgement
              domainId={props.domainKey}
              judgement={effectiveJudgement()}
              direction={props.domainState?.direction}
              onJudgementChange={handleJudgementChange}
              onDirectionChange={handleDirectionChange}
              showDirection={domain()?.hasDirection}
              isDomain1={props.domainKey === 'domain1a' || props.domainKey === 'domain1b'}
              disabled={props.disabled}
              isAutoMode={!isManualMode()}
            />
          </div>
        </div>
      </Show>
    </div>
  );
}

export default DomainSection;
