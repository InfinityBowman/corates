import { createSignal, For, Show, createMemo } from 'solid-js';
import { getActiveDomainKeys } from './checklist-map.js';
import { PreliminarySection } from './PreliminarySection.jsx';
import { DomainSection } from './DomainSection.jsx';
import { OverallSection } from './OverallSection.jsx';
import { ResponseLegend } from './SignallingQuestion.jsx';
import { ScoringSummary } from './ScoringSummary.jsx';

/**
 * Main ROB-2 Checklist Component
 *
 * @param {Object} props
 * @param {Object} props.checklistState - The complete checklist state object
 * @param {Function} props.onUpdate - Callback to update checklist state (key, value)
 * @param {boolean} [props.showComments] - Whether to show comment fields for each question
 * @param {boolean} [props.showLegend] - Whether to show the response legend
 * @param {boolean} [props.readOnly] - Whether the checklist is read-only (disables all inputs)
 * @param {Function} [props.getRob2Text] - Function to get Y.Text for a ROB-2 free-text field
 */
export function ROB2Checklist(props) {
  const isReadOnly = () => !!props.readOnly;

  // Track collapsed state for each domain
  const [collapsedDomains, setCollapsedDomains] = createSignal({});

  // Get active domains based on aim selection (assignment vs. adhering)
  const isAdhering = createMemo(() => props.checklistState?.preliminary?.aim === 'ADHERING');

  const activeDomains = createMemo(() => getActiveDomainKeys(isAdhering()));

  // Check if aim is selected (determines which Domain 2 variant to show)
  const hasAimSelected = createMemo(() => !!props.checklistState?.preliminary?.aim);

  // Update handlers - use object-style API
  function handlePreliminaryUpdate(newPreliminary) {
    props.onUpdate({ preliminary: newPreliminary });
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
        <div class='mb-6 text-left text-lg font-semibold text-gray-900 sm:text-center'>
          {props.checklistState?.name || 'RoB 2 Checklist'}
        </div>

        {/* Scoring Summary Strip - shows overall + domain status */}
        <Show when={hasAimSelected()}>
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

        {/* Preliminary Considerations */}
        <PreliminarySection
          preliminaryState={props.checklistState?.preliminary}
          onUpdate={handlePreliminaryUpdate}
          disabled={isReadOnly()}
          getRob2Text={props.getRob2Text}
        />

        {/* Message when aim not selected */}
        <Show when={!hasAimSelected()}>
          <div class='rounded-lg border-2 border-blue-200 bg-blue-50 p-6 text-center'>
            <div class='mb-2 text-lg font-semibold text-blue-800'>Select Assessment Aim</div>
            <p class='text-sm text-blue-600'>
              Please select the review team's aim in the Preliminary Considerations section above to
              proceed with the domain assessment.
            </p>
          </div>
        </Show>

        {/* Domain sections - only show when aim is selected */}
        <Show when={hasAimSelected()}>
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
                    getRob2Text={props.getRob2Text}
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
      </div>
    </div>
  );
}

export default ROB2Checklist;
