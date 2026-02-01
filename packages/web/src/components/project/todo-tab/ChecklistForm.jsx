/**
 * ChecklistForm component - Form to add a checklist to a study
 * Includes outcome selector for ROB-2 and ROBINS-I checklist types
 */

import { createSignal, createMemo, Show } from 'solid-js';
import { getChecklistTypeOptions, DEFAULT_CHECKLIST_TYPE, CHECKLIST_TYPES } from '@/checklist-registry';
import { SimpleSelect } from '@/components/ui/select';
import projectStore from '@/stores/projectStore.js';
import { useProjectContext } from '../ProjectContext.jsx';

export default function ChecklistForm(props) {
  const { projectId } = useProjectContext();

  const [type, setType] = createSignal(DEFAULT_CHECKLIST_TYPE);
  const [outcomeId, setOutcomeId] = createSignal(null);

  const typeOptions = getChecklistTypeOptions();

  // Get outcomes from project meta
  const meta = () => projectStore.getMeta(projectId);
  const outcomes = createMemo(() => meta()?.outcomes || []);

  // Check if selected type requires an outcome
  const requiresOutcome = createMemo(() => {
    const t = type();
    return t === CHECKLIST_TYPES.ROB2 || t === CHECKLIST_TYPES.ROBINS_I;
  });

  // Get outcomes already used by this user for this study and type
  const usedOutcomeIds = createMemo(() => {
    if (!props.studyChecklists || !requiresOutcome()) return new Set();

    const used = new Set();
    for (const checklist of props.studyChecklists) {
      if (checklist.type === type() && checklist.assignedTo === props.currentUserId && checklist.outcomeId) {
        used.add(checklist.outcomeId);
      }
    }
    return used;
  });

  // Filter outcomes to only show available ones (not already used by this user for this type)
  const availableOutcomes = createMemo(() => {
    const used = usedOutcomeIds();
    return outcomes().filter(o => !used.has(o.id));
  });

  // Check if form can be submitted
  const canSubmit = createMemo(() => {
    if (requiresOutcome()) {
      return outcomeId() !== null;
    }
    return true;
  });

  // Handle type change - reset outcome if type changes
  const handleTypeChange = value => {
    setType(value);
    setOutcomeId(null);
  };

  const handleSubmit = () => {
    if (!canSubmit()) return;

    const selectedOutcomeId = requiresOutcome() ? outcomeId() : null;
    props.onSubmit(type(), props.currentUserId, selectedOutcomeId);
    setType(DEFAULT_CHECKLIST_TYPE);
    setOutcomeId(null);
  };

  return (
    <div class='m-4 rounded-lg border border-blue-200 bg-blue-50 p-4'>
      <div class='space-y-3'>
        <div>
          <SimpleSelect
            label='Checklist Type'
            value={type()}
            onChange={handleTypeChange}
            items={typeOptions.map(option => ({
              label: `${option.label} - ${option.description}`,
              value: option.value,
            }))}
          />
        </div>

        {/* Outcome selector for ROB2 and ROBINS_I */}
        <Show when={requiresOutcome()}>
          <div>
            <Show
              when={outcomes().length > 0}
              fallback={
                <div class='rounded-lg border border-amber-300 bg-amber-50 p-3'>
                  <p class='text-sm font-medium text-amber-800'>No outcomes defined</p>
                  <p class='mt-1 text-xs text-amber-700'>
                    {type()} requires an outcome to be selected. Please add outcomes in the All
                    Studies tab first.
                  </p>
                </div>
              }
            >
              <Show
                when={availableOutcomes().length > 0}
                fallback={
                  <div class='rounded-lg border border-amber-300 bg-amber-50 p-3'>
                    <p class='text-sm font-medium text-amber-800'>All outcomes already used</p>
                    <p class='mt-1 text-xs text-amber-700'>
                      You already have a {type()} checklist for each available outcome. Add more
                      outcomes in the All Studies tab to create additional checklists.
                    </p>
                  </div>
                }
              >
                <SimpleSelect
                  label='Select Outcome'
                  value={outcomeId()}
                  onChange={value => setOutcomeId(value)}
                  items={availableOutcomes().map(outcome => ({
                    label: outcome.name,
                    value: outcome.id,
                  }))}
                  placeholder='Choose an outcome...'
                />
              </Show>
            </Show>
          </div>
        </Show>
      </div>
      <div class='mt-4 flex gap-2'>
        <button
          onClick={handleSubmit}
          disabled={props.loading || !canSubmit()}
          class='bg-primary hover:bg-primary/90 focus:ring-primary rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
        >
          {props.loading ? 'Adding...' : 'Add Checklist'}
        </button>
        <button
          onClick={() => props.onCancel()}
          class='border-border bg-card text-secondary-foreground hover:border-primary/50 hover:text-primary rounded-lg border px-4 py-2 text-sm font-medium transition-colors'
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
