/**
 * GenericChecklist - Dynamic checklist component loader
 *
 * This component loads the appropriate checklist UI based on the checklist type,
 * adapting props to match each component's expected interface.
 */

import { Suspense, createMemo, Show, lazy } from 'solid-js';
import {
  getChecklistTypeFromState,
  DEFAULT_CHECKLIST_TYPE,
  CHECKLIST_TYPES,
} from '@/checklist-registry';

// Lazy load the checklist components
const AMSTAR2Checklist = lazy(() => import('@checklist-ui/AMSTAR2Checklist.jsx'));
const ROBINSIChecklist = lazy(() =>
  import('@checklist-ui/ROBINSIChecklist/ROBINSIChecklist.jsx').then(m => ({
    default: m.ROBINSIChecklist,
  })),
);

/**
 * Loading fallback while checklist component is being loaded
 */
function ChecklistLoading() {
  return (
    <div class='flex items-center justify-center h-64'>
      <div class='text-center'>
        <div class='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4' />
        <p class='text-gray-500'>Loading checklist...</p>
      </div>
    </div>
  );
}

/**
 * GenericChecklist Component
 *
 * Dynamically loads and renders the appropriate checklist component based on type.
 *
 * @param {Object} props
 * @param {string} [props.checklistType] - The checklist type identifier (e.g., 'AMSTAR2', 'ROBINS_I')
 * @param {Object} props.checklist - The checklist state data
 * @param {Function} props.onUpdate - Callback for checklist updates
 * @param {boolean} [props.readOnly] - Whether the checklist is read-only
 */
export default function GenericChecklist(props) {
  // Determine the checklist type from props or state
  const checklistType = createMemo(() => {
    if (props.checklistType) {
      return props.checklistType;
    }
    if (props.checklist) {
      return getChecklistTypeFromState(props.checklist);
    }
    return DEFAULT_CHECKLIST_TYPE;
  });

  return (
    <Suspense fallback={<ChecklistLoading />}>
      <Show when={checklistType() === CHECKLIST_TYPES.AMSTAR2}>
        <AMSTAR2Checklist
          externalChecklist={props.checklist}
          onExternalUpdate={props.onUpdate}
          readOnly={props.readOnly}
        />
      </Show>
      <Show when={checklistType() === CHECKLIST_TYPES.ROBINS_I}>
        <ROBINSIChecklist
          checklistState={props.checklist}
          onUpdate={props.onUpdate}
          showComments={true}
          showLegend={true}
          readOnly={props.readOnly}
        />
      </Show>
    </Suspense>
  );
}
