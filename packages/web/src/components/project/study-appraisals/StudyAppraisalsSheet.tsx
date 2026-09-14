/**
 * StudyAppraisalsSheet - Hosts StudyAppraisals in a side sheet for the study
 * the project context names. Owners edit; everyone else reads.
 */

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { DEFAULT_CHECKLIST_TYPE } from '@/checklist-registry';
import { useAllStudies, useProjectOutcomes } from '@/project/workspace-data';
import { project } from '@/project';
import type { StudyInfo } from '@/stores/projectStore';
import { useProjectContext } from '../ProjectContext';
import { StudyAppraisals } from './StudyAppraisals';

interface StudyAppraisalsSheetProps {
  studyId: string | null;
  onClose: () => void;
}

/** The tool most studies already use, so a new study starts on the same one. */
function mostUsedTool(studies: StudyInfo[]): string | null {
  const counts = new Map<string, number>();
  for (const study of studies) {
    for (const cell of [...study.appraisals, ...study.checklists]) {
      counts.set(cell.type, (counts.get(cell.type) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  for (const [type, count] of counts) {
    if (best === null || count > (counts.get(best) ?? 0)) best = type;
  }
  return best;
}

export function StudyAppraisalsSheet({ studyId, onClose }: StudyAppraisalsSheetProps) {
  const { projectId, isOwner, getMember, openAssignSheet, setOutcomesSheetOpen } =
    useProjectContext();
  const studies = useAllStudies(projectId);
  const outcomes = useProjectOutcomes(projectId);
  const study = studyId ? studies.find(s => s.id === studyId) : undefined;

  return (
    <Sheet open={studyId !== null} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side='right'
        className='w-full gap-0 sm:max-w-md'
        data-testid='study-appraisals-sheet'
      >
        {study ?
          <StudyAppraisals
            study={study}
            outcomes={outcomes}
            defaultTool={mostUsedTool(studies) ?? DEFAULT_CHECKLIST_TYPE}
            readOnly={!isOwner}
            getMember={getMember}
            onAssignReviewers={() => openAssignSheet({ studyIds: [study.id], label: 'This study' })}
            onManageOutcomes={() => setOutcomesSheetOpen(true)}
            onCreate={cells => project.appraisal.create(cells)}
            onDelete={(cells, force) => project.appraisal.delete(cells, force)}
            cellHasAnswers={cell => project.appraisal.hasAnswers(cell)}
          />
        : <SheetHeader>
            <SheetTitle>Study</SheetTitle>
            <SheetDescription>This study no longer exists.</SheetDescription>
          </SheetHeader>
        }
      </SheetContent>
    </Sheet>
  );
}
