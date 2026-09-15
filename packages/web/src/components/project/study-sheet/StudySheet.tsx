/**
 * StudySheet - one study's side sheet: reviewers, tool, appraisals, and PDFs.
 * Opens for the study the project context names. Owners edit appraisals;
 * everyone else reads them. The whole sheet is a drop target for PDFs.
 */

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { DEFAULT_CHECKLIST_TYPE } from '@/checklist-registry';
import { InlineEdit } from '@/components/ui/inline-edit';
import { useAllStudies, useProjectOutcomes } from '@/project/workspace-data';
import { project } from '@/project';
import type { StudyInfo } from '@/stores/projectStore';
import { usePdfPreviewStore } from '@/stores/pdfPreviewStore';
import { cn } from '@/lib/utils';
import { useProjectContext } from '../ProjectContext';
import { studyCitation } from '../studyCitation';
import { StudyAppraisals } from './StudyAppraisals';
import { StudyPdfs } from './StudyPdfs';
import { useStudyPdfDrop } from './useStudyPdfDrop';

interface StudySheetProps {
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

export function StudySheet({ studyId, onClose }: StudySheetProps) {
  const { projectId, isOwner, getMember, openAssignSheet, setOutcomesSheetOpen } =
    useProjectContext();
  const studies = useAllStudies(projectId);
  const outcomes = useProjectOutcomes(projectId);
  const study = studyId ? studies.find(s => s.id === studyId) : undefined;
  // The PDF preview panel is wider than this sheet and a modal sheet would
  // block it, so the sheet steps aside while a preview is open and comes back
  // when it closes.
  const previewOpen = usePdfPreviewStore(s => s.isOpen);

  return (
    <Sheet open={studyId !== null && !previewOpen} onOpenChange={open => !open && onClose()}>
      <SheetContent side='right' className='w-full gap-0 sm:max-w-lg' data-testid='study-sheet'>
        {study ?
          <StudySheetBody
            study={study}
            defaultTool={mostUsedTool(studies) ?? DEFAULT_CHECKLIST_TYPE}
            readOnly={!isOwner}
            getMember={getMember}
            outcomes={outcomes}
            onAssignReviewers={() => openAssignSheet({ studyIds: [study.id], label: 'This study' })}
            onManageOutcomes={() => setOutcomesSheetOpen(true)}
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

interface StudySheetBodyProps {
  study: StudyInfo;
  defaultTool: string;
  readOnly: boolean;
  getMember: React.ComponentProps<typeof StudyAppraisals>['getMember'];
  outcomes: React.ComponentProps<typeof StudyAppraisals>['outcomes'];
  onAssignReviewers: () => void;
  onManageOutcomes: () => void;
}

function StudySheetBody({ study, ...appraisalProps }: StudySheetBodyProps) {
  const { isOver, dropProps } = useStudyPdfDrop(study.id);
  const citation = studyCitation(study);

  return (
    <div
      className={cn('relative flex min-h-0 flex-1 flex-col', isOver && 'bg-primary/5')}
      data-drop-over={isOver || undefined}
      {...dropProps}
    >
      <SheetHeader>
        <SheetTitle className='min-w-0'>
          <InlineEdit
            key={study.name}
            value={study.name || 'Untitled study'}
            onCommit={name => {
              if (name.trim() && name !== study.name) {
                project.study.update(study.id, { name: name.trim() });
              }
            }}
            showEditIcon
            truncate
            ariaLabel='Rename study'
            className='leading-tight'
          />
        </SheetTitle>
        <SheetDescription>
          {citation || 'Choose the tool and the outcomes this study is appraised on.'}
        </SheetDescription>
      </SheetHeader>

      <div className='flex min-h-0 flex-1 flex-col overflow-y-auto'>
        <StudyAppraisals
          study={study}
          {...appraisalProps}
          onCreate={cells => project.appraisal.create(cells)}
          onDelete={(cells, force) => project.appraisal.delete(cells, force)}
          cellHasAnswers={cell => project.appraisal.hasAnswers(cell)}
        />
        <StudyPdfs study={study} />
      </div>

      {isOver && (
        <div className='bg-background/80 pointer-events-none absolute inset-0 flex items-center justify-center'>
          <p className='text-primary text-sm font-medium'>
            Drop to add PDF to {study.name || 'this study'}
          </p>
        </div>
      )}
    </div>
  );
}
