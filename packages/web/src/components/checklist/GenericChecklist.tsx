import { CHECKLIST_TYPES } from '@/checklist-registry/index';
import { AMSTAR2Checklist } from '@/components/checklist/AMSTAR2Checklist/AMSTAR2Checklist';
import { ROBINSIChecklist } from '@/components/checklist/ROBINSIChecklist/ROBINSIChecklist';
import { ROB2Checklist } from '@/components/checklist/ROB2Checklist/ROB2Checklist';

interface GenericChecklistProps {
  studyId: string;
  checklistId: string;
  checklistType: string;
  readOnly?: boolean;
}

export function GenericChecklist({
  studyId,
  checklistId,
  checklistType,
  readOnly,
}: GenericChecklistProps) {
  return (
    <div className='h-full'>
      {checklistType === CHECKLIST_TYPES.AMSTAR2 && (
        <AMSTAR2Checklist
          studyId={studyId}
          checklistId={checklistId}
          readOnly={readOnly}
        />
      )}
      {checklistType === CHECKLIST_TYPES.ROBINS_I && (
        <ROBINSIChecklist
          studyId={studyId}
          checklistId={checklistId}
          showComments={true}
          showLegend={true}
          readOnly={readOnly}
        />
      )}
      {checklistType === CHECKLIST_TYPES.ROB2 && (
        <ROB2Checklist
          studyId={studyId}
          checklistId={checklistId}
          showComments={true}
          showLegend={true}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
