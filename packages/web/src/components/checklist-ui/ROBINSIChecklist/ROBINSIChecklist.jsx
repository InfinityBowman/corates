import { createSignal, For, Show, createMemo } from 'solid-js';
import { getActiveDomainKeys } from '@/ROBINS-I/checklist-map.js';
import { shouldStopAssessment } from '@/ROBINS-I/checklist.js';
import { SectionB } from './SectionB.jsx';
import { DomainSection } from './DomainSection.jsx';
import { OverallSection } from './OverallSection.jsx';
import { ResponseLegend } from './SignallingQuestion.jsx';

/**
 * Main ROBINS-I V2 Checklist Component
 *
 * @param {Object} props
 * @param {Object} props.checklistState - The complete checklist state object
 * @param {Function} props.onUpdate - Callback to update checklist state (key, value)
 * @param {boolean} [props.showComments] - Whether to show comment fields for each question
 * @param {boolean} [props.showLegend] - Whether to show the response legend
 */
export function ROBINSIChecklist(props) {
  // Track collapsed state for each domain
  const [collapsedDomains, setCollapsedDomains] = createSignal({});

  // Determine if assessment should stop based on Section B
  const stopAssessment = createMemo(() =>
    shouldStopAssessment(props.checklistState?.sectionB)
  );

  // Get active domains based on protocol type (ITT vs Per-Protocol)
  const isPerProtocol = createMemo(() =>
    props.checklistState?.sectionC?.isPerProtocol || false
  );

  const activeDomains = createMemo(() =>
    getActiveDomainKeys(isPerProtocol())
  );

  // Update handlers
  function handleSectionBUpdate(newSectionB) {
    props.onUpdate('sectionB', newSectionB);
  }

  function handleSectionCToggle() {
    props.onUpdate('sectionC', {
      ...props.checklistState.sectionC,
      isPerProtocol: !isPerProtocol(),
    });
  }

  function handleDomainUpdate(domainKey, newDomainState) {
    props.onUpdate(domainKey, newDomainState);
  }

  function handleOverallUpdate(newOverall) {
    props.onUpdate('overall', newOverall);
  }

  function toggleDomainCollapse(domainKey) {
    setCollapsedDomains(prev => ({
      ...prev,
      [domainKey]: !prev[domainKey],
    }));
  }

  return (
    <div class="space-y-6">
      {/* Response Legend */}
      <Show when={props.showLegend !== false}>
        <ResponseLegend />
      </Show>

      {/* Protocol Type Toggle (C4) */}
      <div class="bg-white rounded-lg shadow-md p-4">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-medium text-gray-900">Target Trial Effect Type</h4>
            <p class="text-sm text-gray-500 mt-1">
              Did the analysis account for switches or deviations during follow-up?
            </p>
          </div>
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="protocol-type"
                checked={!isPerProtocol()}
                onChange={() => isPerProtocol() && handleSectionCToggle()}
                class="text-blue-600"
              />
              <span class="text-sm">
                No (ITT effect)
              </span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="protocol-type"
                checked={isPerProtocol()}
                onChange={() => !isPerProtocol() && handleSectionCToggle()}
                class="text-blue-600"
              />
              <span class="text-sm">
                Yes (Per-protocol effect)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Section B: Proceed with assessment */}
      <SectionB
        sectionBState={props.checklistState?.sectionB}
        onUpdate={handleSectionBUpdate}
      />

      {/* Domain sections - disabled if assessment should stop */}
      <Show when={!stopAssessment()}>
        <div class="space-y-4">
          <For each={activeDomains()}>
            {(domainKey) => (
              <DomainSection
                domainKey={domainKey}
                domainState={props.checklistState?.[domainKey]}
                onUpdate={(newState) => handleDomainUpdate(domainKey, newState)}
                disabled={stopAssessment()}
                showComments={props.showComments}
                collapsed={collapsedDomains()[domainKey]}
                onToggleCollapse={() => toggleDomainCollapse(domainKey)}
              />
            )}
          </For>
        </div>

        {/* Overall Section */}
        <OverallSection
          overallState={props.checklistState?.overall}
          checklistState={props.checklistState}
          onUpdate={handleOverallUpdate}
          disabled={stopAssessment()}
        />
      </Show>

      {/* Critical risk message when stopped */}
      <Show when={stopAssessment()}>
        <div class="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
          <div class="text-red-800 font-semibold text-lg mb-2">
            Critical Risk of Bias
          </div>
          <p class="text-red-600 text-sm">
            Based on Section B responses, this result has been classified as Critical risk of bias.
            Domain assessment is not required.
          </p>
        </div>
      </Show>
    </div>
  );
}

export default ROBINSIChecklist;
