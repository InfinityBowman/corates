/**
 * ChecklistForm component - Inline form to add a checklist to a study
 * Includes outcome selector for ROB-2 and ROBINS-I checklist types
 */

import { createSignal, createMemo, Show } from 'solid-js';
import {
  getChecklistTypeOptions,
  getChecklistMetadata,
  DEFAULT_CHECKLIST_TYPE,
  CHECKLIST_TYPES,
} from '@/checklist-registry';
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
      if (
        checklist.type === type() &&
        checklist.assignedTo === props.currentUserId &&
        checklist.outcomeId
      ) {
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
      return outcomeId() !== null && availableOutcomes().length > 0;
    }
    return true;
  });

  // Check if there's an outcome issue
  const hasOutcomeIssue = createMemo(() => {
    if (!requiresOutcome()) return false;
    return outcomes().length === 0 || availableOutcomes().length === 0;
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
    <div class='px-4 py-3'>
      <div class='flex flex-wrap items-end gap-2'>
        {/* Checklist type select */}
        <div class='min-w-[180px] flex-1'>
          <SimpleSelect
            value={type()}
            onChange={handleTypeChange}
            items={typeOptions.map(option => ({
              label: `${option.label} - ${option.description}`,
              value: option.value,
            }))}
            placeholder='Checklist type...'
          />
        </div>

        {/* Outcome selector for ROB2 and ROBINS_I */}
        <Show when={requiresOutcome() && !hasOutcomeIssue()}>
          <div class='min-w-[180px] flex-1'>
            <SimpleSelect
              value={outcomeId()}
              onChange={value => setOutcomeId(value)}
              items={availableOutcomes().map(outcome => ({
                label: outcome.name,
                value: outcome.id,
              }))}
              placeholder='Select outcome...'
            />
          </div>
        </Show>

        {/* Add button */}
        <button
          onClick={handleSubmit}
          disabled={props.loading || !canSubmit()}
          class='bg-primary hover:bg-primary/90 focus:ring-primary shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
        >
          {props.loading ? 'Adding...' : 'Add Checklist'}
        </button>
      </div>

      {/* Warning: no outcomes defined (blocking) */}
      <Show when={requiresOutcome() && hasOutcomeIssue() && outcomes().length === 0}>
        <div class='mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3'>
          <p class='text-sm font-medium text-amber-800'>No outcomes defined</p>
          <p class='mt-1 text-xs text-amber-700'>
            {getChecklistMetadata(type())?.name || type()} requires an outcome. Add outcomes in the
            All Studies tab first.
          </p>
        </div>
      </Show>

      {/* Info: all outcomes covered (non-blocking) */}
      <Show when={requiresOutcome() && hasOutcomeIssue() && outcomes().length > 0}>
        <div class='mt-2 rounded-lg border border-blue-300 bg-blue-50 p-3'>
          <p class='text-sm font-medium text-blue-800'>All outcomes covered</p>
          <p class='mt-1 text-xs text-blue-700'>
            You already have a {getChecklistMetadata(type())?.name || type()} checklist for each
            available outcome.
          </p>
        </div>
      </Show>
    </div>
  );
}
