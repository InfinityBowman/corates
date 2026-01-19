import { createSignal, For, Show, createMemo } from 'solid-js';
import { getActiveDomainKeys } from './checklist-map.js';
import { shouldStopAssessment } from './checklist.js';
import { PlanningSection } from './PlanningSection.jsx';
import { SectionA } from './SectionA.jsx';
import { SectionB } from './SectionB.jsx';
import { SectionC } from './SectionC.jsx';
import { SectionD } from './SectionD.jsx';
import { DomainSection } from './DomainSection.jsx';
import { OverallSection } from './OverallSection.jsx';
import { ResponseLegend } from './SignallingQuestion.jsx';
import { ScoringSummary } from './ScoringSummary.jsx';

/**
 * Main ROBINS-I V2 Checklist Component
 *
 * @param {Object} props
 * @param {Object} props.checklistState - The complete checklist state object
 * @param {Function} props.onUpdate - Callback to update checklist state (key, value)
 * @param {boolean} [props.showComments] - Whether to show comment fields for each question
 * @param {boolean} [props.showLegend] - Whether to show the response legend
 * @param {boolean} [props.readOnly] - Whether the checklist is read-only (disables all inputs)
 * @param {Function} [props.getRobinsText] - Function to get Y.Text for a ROBINS-I free-text field
 */
export function ROBINSIChecklist(props) {
  const isReadOnly = () => !!props.readOnly;

  // Track collapsed state for each domain
  const [collapsedDomains, setCollapsedDomains] = createSignal({});

  // Determine if assessment should stop based on Section B
  const stopAssessment = createMemo(() => shouldStopAssessment(props.checklistState?.sectionB));

  // Get active domains based on protocol type (ITT vs Per-Protocol)
  const isPerProtocol = createMemo(() => props.checklistState?.sectionC?.isPerProtocol || false);

  const activeDomains = createMemo(() => getActiveDomainKeys(isPerProtocol()));

  // Update handlers - use object-style API like AMSTAR2: onUpdate({ key: value })
  function handlePlanningUpdate(newPlanning) {
    props.onUpdate({ planning: newPlanning });
  }

  function handleSectionAUpdate(newSectionA) {
    props.onUpdate({ sectionA: newSectionA });
  }

  function handleSectionBUpdate(newSectionB) {
    props.onUpdate({ sectionB: newSectionB });
  }

  function handleSectionCUpdate(newSectionC) {
    props.onUpdate({ sectionC: newSectionC });
  }

  function handleSectionDUpdate(newSectionD) {
    props.onUpdate({ sectionD: newSectionD });
  }

  function handleDomainUpdate(domainKey, newDomainState) {
    props.onUpdate({ [domainKey]: newDomainState });
  }

  function handleOverallUpdate(newOverall) {
    props.onUpdate({ overall: newOverall });
  }

  function toggleDomainCollapse(domainKey) {
    setCollapsedDomains(prev => ({
      ...prev,
      [domainKey]: !prev[domainKey],
    }));
  }

  // Handle domain chip click from summary - expand and scroll to domain
  function handleDomainClick(domainKey) {
    // Expand the domain if collapsed
    setCollapsedDomains(prev => ({
      ...prev,
      [domainKey]: false,
    }));

    // Scroll to domain section after a short delay for DOM update
    setTimeout(() => {
      const element = document.getElementById(`domain-section-${domainKey}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  return (
    <div class='bg-blue-50'>
      <div class='container mx-auto max-w-5xl space-y-4 px-4 py-6'>
        <div class='text-foreground mb-6 text-left text-lg font-semibold sm:text-center'>
          {props.checklistState.name || 'ROBINS-I Checklist'}
        </div>

        {/* Scoring Summary Strip - shows overall + domain status */}
        <Show when={!stopAssessment()}>
          <div class='sticky z-40' style={{ top: '8px' }}>
            <ScoringSummary
              checklistState={props.checklistState}
              onDomainClick={handleDomainClick}
            />
          </div>
        </Show>

        {/* Response Legend */}
        <Show when={props.showLegend !== false}>
          <ResponseLegend />
        </Show>

        {/* Planning Stage: Confounding factors */}
        <PlanningSection
          planningState={props.checklistState?.planning}
          onUpdate={handlePlanningUpdate}
          disabled={isReadOnly()}
          getRobinsText={props.getRobinsText}
        />

        {/* Preliminary Considerations Header */}
        <div class='rounded-lg border border-blue-200 bg-blue-100 px-6 py-4'>
          <h2 class='text-lg font-semibold text-blue-900'>
            For Each Study Result: Preliminary Considerations (Parts A to D)
          </h2>
        </div>

        {/* Section A: Specify the result being assessed */}
        <SectionA
          sectionAState={props.checklistState?.sectionA}
          onUpdate={handleSectionAUpdate}
          disabled={isReadOnly()}
          getRobinsText={props.getRobinsText}
        />

        {/* Section B: Proceed with assessment */}
        <SectionB
          sectionBState={props.checklistState?.sectionB}
          onUpdate={handleSectionBUpdate}
          disabled={isReadOnly()}
          getRobinsText={props.getRobinsText}
        />

        {/* Section C: Target randomized trial */}
        <SectionC
          sectionCState={props.checklistState?.sectionC}
          onUpdate={handleSectionCUpdate}
          disabled={isReadOnly()}
          getRobinsText={props.getRobinsText}
        />

        {/* Section D: Information sources */}
        <SectionD
          sectionDState={props.checklistState?.sectionD}
          onUpdate={handleSectionDUpdate}
          disabled={isReadOnly()}
          getRobinsText={props.getRobinsText}
        />

        {/* Domain sections - hidden entirely if assessment should stop */}
        <Show when={!stopAssessment()}>
          <div class='space-y-4'>
            <For each={activeDomains()}>
              {domainKey => (
                <div
                  id={`domain-section-${domainKey}`}
                  style={{
                    'scroll-margin-top':
                      'calc(var(--app-navbar-height, 56px) + var(--robins-summary-height, 0px) + 8px)',
                  }}
                >
                  <DomainSection
                    domainKey={domainKey}
                    domainState={props.checklistState?.[domainKey]}
                    onUpdate={newState => handleDomainUpdate(domainKey, newState)}
                    disabled={isReadOnly()}
                    showComments={props.showComments}
                    collapsed={collapsedDomains()[domainKey]}
                    onToggleCollapse={() => toggleDomainCollapse(domainKey)}
                    getRobinsText={props.getRobinsText}
                  />
                </div>
              )}
            </For>
          </div>

          <OverallSection
            overallState={props.checklistState?.overall}
            checklistState={props.checklistState}
            onUpdate={handleOverallUpdate}
            disabled={isReadOnly()}
          />
        </Show>

        {/* Critical risk message when stopped */}
        <Show when={stopAssessment()}>
          <div class='rounded-lg border-2 border-red-200 bg-red-50 p-6 text-center'>
            <div class='mb-2 text-lg font-semibold text-red-800'>Critical Risk of Bias</div>
            <p class='text-sm text-red-600'>
              Based on Section B responses, this result has been classified as Critical risk of
              bias. Domain assessment is not required.
            </p>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default ROBINSIChecklist;
