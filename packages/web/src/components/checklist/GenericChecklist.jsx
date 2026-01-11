/**
 * GenericChecklist - Dynamic checklist component loader
 *
 * This component renders the appropriate checklist UI based on the checklist type,
 * adapting props to match each component's expected interface.
 */

import { createMemo, Show } from 'solid-js';
import {
  getChecklistTypeFromState,
  DEFAULT_CHECKLIST_TYPE,
  CHECKLIST_TYPES,
} from '@/checklist-registry';
import AMSTAR2Checklist from '@/components/checklist/AMSTAR2Checklist/AMSTAR2Checklist.jsx';
import { ROBINSIChecklist } from '@/components/checklist/ROBINSIChecklist/index.js';
import { ROB2Checklist } from '@/components/checklist/ROB2Checklist/ROB2Checklist.jsx';

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
 * @param {Function} [props.getQuestionNote] - Function to get Y.Text for a question note
 * @param {Function} [props.getRobinsText] - Function to get Y.Text for a ROBINS-I free-text field
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
    <div class='h-full'>
      <Show when={checklistType() === CHECKLIST_TYPES.AMSTAR2}>
        <AMSTAR2Checklist
          externalChecklist={props.checklist}
          onExternalUpdate={props.onUpdate}
          readOnly={props.readOnly}
          getQuestionNote={props.getQuestionNote}
        />
      </Show>
      <Show when={checklistType() === CHECKLIST_TYPES.ROBINS_I}>
        <ROBINSIChecklist
          checklistState={props.checklist}
          onUpdate={props.onUpdate}
          showComments={true}
          showLegend={true}
          readOnly={props.readOnly}
          getRobinsText={props.getRobinsText}
        />
      </Show>
      <Show when={checklistType() === CHECKLIST_TYPES.ROB2}>
        <ROB2Checklist
          checklistState={props.checklist}
          onUpdate={props.onUpdate}
          showComments={true}
          showLegend={true}
          readOnly={props.readOnly}
          getRob2Text={props.getRob2Text}
        />
      </Show>
    </div>
  );
}
