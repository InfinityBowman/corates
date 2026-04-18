/**
 * GenericChecklist - Dynamic checklist component loader
 *
 * Renders the appropriate checklist UI based on the checklist type,
 * adapting props to match each component's expected interface.
 */

import { useMemo } from 'react';
import type * as Y from 'yjs';
import {
  getChecklistTypeFromState,
  DEFAULT_CHECKLIST_TYPE,
  CHECKLIST_TYPES,
} from '@/checklist-registry/index';
import { AMSTAR2Checklist } from '@/components/checklist/AMSTAR2Checklist/AMSTAR2Checklist';
import { ROBINSIChecklist } from '@/components/checklist/ROBINSIChecklist/ROBINSIChecklist';
import { ROB2Checklist } from '@/components/checklist/ROB2Checklist/ROB2Checklist';
import type { TextRef } from '@/primitives/useProject/checklists';

interface GenericChecklistProps {
  checklistType?: string;
  checklist: any;
  onUpdate: (_patch: Record<string, any>) => void;
  readOnly?: boolean;
  getTextRef: (_ref: TextRef) => Y.Text | null;
}

export function GenericChecklist({
  checklistType: checklistTypeProp,
  checklist,
  onUpdate,
  readOnly,
  getTextRef,
}: GenericChecklistProps) {
  const checklistType = useMemo(() => {
    if (checklistTypeProp) return checklistTypeProp;
    if (checklist) return getChecklistTypeFromState(checklist);
    return DEFAULT_CHECKLIST_TYPE;
  }, [checklistTypeProp, checklist]);

  return (
    <div className='h-full'>
      {checklistType === CHECKLIST_TYPES.AMSTAR2 && (
        <AMSTAR2Checklist
          externalChecklist={checklist}
          onExternalUpdate={onUpdate}
          readOnly={readOnly}
          getTextRef={getTextRef}
        />
      )}
      {checklistType === CHECKLIST_TYPES.ROBINS_I && (
        <ROBINSIChecklist
          checklistState={checklist}
          onUpdate={onUpdate}
          showComments={true}
          showLegend={true}
          readOnly={readOnly}
          getTextRef={getTextRef}
        />
      )}
      {checklistType === CHECKLIST_TYPES.ROB2 && (
        <ROB2Checklist
          checklistState={checklist}
          onUpdate={onUpdate}
          showComments={true}
          showLegend={true}
          readOnly={readOnly}
          getTextRef={getTextRef}
        />
      )}
    </div>
  );
}
