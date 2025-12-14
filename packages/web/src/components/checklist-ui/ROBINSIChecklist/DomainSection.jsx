import { For, Show } from 'solid-js';
import { ROBINS_I_CHECKLIST, getDomainQuestions } from '@/ROBINS-I/checklist-map.js';
import { SignallingQuestion } from './SignallingQuestion.jsx';
import { DomainJudgement } from './DomainJudgement.jsx';

/**
 * A complete domain section with questions and judgement
 * @param {Object} props
 * @param {string} props.domainKey - The domain key (e.g., 'domain1a')
 * @param {Object} props.domainState - Current domain state { answers, judgement, direction }
 * @param {Function} props.onUpdate - Callback when domain state changes
 * @param {boolean} [props.disabled] - Whether the domain is disabled
 * @param {boolean} [props.showComments] - Whether to show comment fields
 * @param {boolean} [props.collapsed] - Whether the domain is collapsed
 * @param {Function} [props.onToggleCollapse] - Callback to toggle collapse
 */
export function DomainSection(props) {
  const domain = () => ROBINS_I_CHECKLIST[props.domainKey];
  const questions = () => getDomainQuestions(props.domainKey);
  const hasSubsections = () => !!domain()?.subsections;

  function handleQuestionUpdate(questionKey, newAnswer) {
    const newAnswers = {
      ...props.domainState.answers,
      [questionKey]: newAnswer,
    };
    props.onUpdate({
      ...props.domainState,
      answers: newAnswers,
    });
  }

  function handleJudgementChange(judgement) {
    props.onUpdate({
      ...props.domainState,
      judgement,
    });
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
      k => props.domainState?.answers?.[k]?.answer !== null
    ).length;
    const total = Object.keys(qs).length;
    return { answered, total };
  };

  return (
    <div class="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Domain header */}
      <button
        type="button"
        onClick={() => props.onToggleCollapse?.()}
        class="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div class="flex flex-col items-start">
          <h3 class="font-semibold text-gray-900 text-left">
            {domain()?.name}
          </h3>
          <Show when={domain()?.subtitle}>
            <span class="text-xs text-gray-500 mt-0.5">
              {domain().subtitle}
            </span>
          </Show>
        </div>

        <div class="flex items-center gap-3">
          {/* Completion indicator */}
          <span class="text-xs text-gray-400">
            {completionStatus().answered}/{completionStatus().total}
          </span>

          {/* Judgement badge if set */}
          <Show when={props.domainState?.judgement}>
            <JudgementBadge judgement={props.domainState.judgement} />
          </Show>

          {/* Collapse indicator */}
          <svg
            class={`w-5 h-5 text-gray-400 transition-transform ${props.collapsed ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Domain content */}
      <Show when={!props.collapsed}>
        <div class="px-6 py-4">
          {/* Questions - with or without subsections */}
          <Show
            when={hasSubsections()}
            fallback={
              <div class="space-y-1">
                <For each={Object.entries(questions())}>
                  {([qKey, qDef]) => (
                    <SignallingQuestion
                      question={qDef}
                      answer={props.domainState?.answers?.[qKey]}
                      onUpdate={(newAnswer) => handleQuestionUpdate(qKey, newAnswer)}
                      disabled={props.disabled}
                      showComment={props.showComments}
                    />
                  )}
                </For>
              </div>
            }
          >
            {/* Domain 3 has subsections */}
            <For each={Object.entries(domain().subsections)}>
              {([_subKey, subsection]) => (
                <div class="mb-4">
                  <div class="text-sm font-medium text-gray-600 mb-2 border-b border-gray-100 pb-1">
                    {subsection.name}
                  </div>
                  <div class="space-y-1">
                    <For each={Object.entries(subsection.questions)}>
                      {([qKey, qDef]) => (
                        <SignallingQuestion
                          question={qDef}
                          answer={props.domainState?.answers?.[qKey]}
                          onUpdate={(newAnswer) => handleQuestionUpdate(qKey, newAnswer)}
                          disabled={props.disabled}
                          showComment={props.showComments}
                        />
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </Show>

          {/* Domain judgement */}
          <DomainJudgement
            domainId={props.domainKey}
            judgement={props.domainState?.judgement}
            direction={props.domainState?.direction}
            onJudgementChange={handleJudgementChange}
            onDirectionChange={handleDirectionChange}
            showDirection={domain()?.hasDirection}
            isDomain1={props.domainKey === 'domain1a' || props.domainKey === 'domain1b'}
            disabled={props.disabled}
          />
        </div>
      </Show>
    </div>
  );
}

// Import JudgementBadge locally
function JudgementBadge(props) {
  const getColor = () => {
    switch (props.judgement) {
      case 'Low':
        return 'bg-green-100 text-green-800';
      case 'Moderate':
        return 'bg-yellow-100 text-yellow-800';
      case 'Serious':
        return 'bg-orange-100 text-orange-800';
      case 'Critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <span class={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getColor()}`}>
      {props.judgement}
    </span>
  );
}

export default DomainSection;
