/**
 * StudyCardHeader - Collapsed header with name, citation, reviewer avatars, actions menu
 */

import { useMemo, useCallback, useState } from 'react';
import {
  ChevronRightIcon,
  UsersIcon,
  Trash2Icon,
  MoreVerticalIcon,
  FileSpreadsheetIcon,
  FileIcon,
} from 'lucide-react';
import { InlineEdit } from '@/components/ui/inline-edit';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useProjectContext, type ProjectMember } from '@/components/project/ProjectContext';
import { MemberAvatar, memberDisplayName } from '@/components/project/MemberAvatar';
import type { StudyInfo } from '@/stores/projectStore';
import { project } from '@/project';
import { studyCitation } from '@/components/project/studyCitation';
import { StudyAppraisalChips } from './StudyAppraisalChips';

interface StudyCardHeaderProps {
  study: StudyInfo;
  onAssignReviewers?: () => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  getMember?: (userId: string) => ProjectMember | null;
}

export function StudyCardHeader({
  study,
  onAssignReviewers,
  onExportCsv,
  onExportPdf,
  getMember,
}: StudyCardHeaderProps) {
  const { isOwner, openStudySheet } = useProjectContext();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const hasChecklists = study.checklists.length > 0;

  const assignedReviewers = useMemo(() => {
    const reviewers: ProjectMember[] = [];
    if (study.reviewer1) {
      reviewers.push(getMember?.(study.reviewer1) || { userId: study.reviewer1 });
    }
    if (study.reviewer2) {
      reviewers.push(getMember?.(study.reviewer2) || { userId: study.reviewer2 });
    }
    return reviewers;
  }, [study.reviewer1, study.reviewer2, getMember]);

  const hasReviewers = !!study.reviewer1 || !!study.reviewer2;
  const studyName = study.name || 'Untitled study';

  const citationLine = studyCitation(study);

  const handleNameChange = useCallback(
    (newName: string) => {
      if (newName && newName.trim() && newName !== study.name) {
        project.study.update(study.id, { name: newName.trim() });
      }
    },
    [study.id, study.name],
  );

  const handleHeaderClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const interactive = target.closest(
        'button, [role="button"], [role="menuitem"], input, textarea, [data-editable], [data-scope="menu"], [data-scope="editable"], [data-selectable]',
      );
      // The header itself carries role=button, so only nested controls count.
      if (interactive && interactive !== e.currentTarget) return;
      openStudySheet(study.id);
    },
    [openStudySheet, study.id],
  );

  const handleHeaderKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    openStudySheet(study.id);
  };

  return (
    <>
      <div
        role='button'
        tabIndex={0}
        aria-label={`Open ${studyName}`}
        className='group focus-visible:ring-ring/50 flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 select-none focus-visible:ring-3 focus-visible:outline-none'
        onClick={handleHeaderClick}
        onKeyDown={handleHeaderKeyDown}
      >
        <div className='min-w-0 flex-1'>
          <InlineEdit
            key={studyName}
            value={studyName}
            onCommit={handleNameChange}
            showEditIcon
            ariaLabel='Rename study'
            className='text-foreground font-medium'
          />
          {citationLine && (
            <p
              className='text-muted-foreground w-fit cursor-text truncate text-xs select-text'
              data-selectable
            >
              {citationLine}
            </p>
          )}
        </div>

        <StudyAppraisalChips study={study} />

        {hasReviewers ?
          <div className='flex shrink-0 -space-x-1.5' data-selectable>
            {assignedReviewers.map(member => (
              <Tooltip key={member.userId}>
                <TooltipTrigger>
                  <MemberAvatar member={member} className='border-2 border-white' />
                </TooltipTrigger>
                <TooltipContent>{memberDisplayName(member)}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        : <span className='text-muted-foreground/70 shrink-0 text-xs italic'>
            No reviewers assigned
          </span>
        }

        <DropdownMenu>
          <DropdownMenuTrigger
            data-testid='study-card-menu'
            className='text-muted-foreground/70 hover:bg-secondary hover:text-secondary-foreground rounded-md p-1.5 transition-colors'
          >
            <MoreVerticalIcon className='size-4' />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            {isOwner ?
              <DropdownMenuItem onClick={() => onAssignReviewers?.()}>
                <UsersIcon className='mr-2 size-4' />
                Assign reviewers
              </DropdownMenuItem>
            : <DropdownMenuItem disabled className='data-disabled:pointer-events-auto'>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className='flex w-full cursor-not-allowed items-center'>
                      <UsersIcon className='mr-2 size-4' />
                      Assign reviewers
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side='left'>
                    Only the project owner can assign reviewers.
                  </TooltipContent>
                </Tooltip>
              </DropdownMenuItem>
            }
            {hasChecklists && (onExportCsv || onExportPdf) && (
              <>
                <DropdownMenuSeparator />
                {onExportCsv && (
                  <DropdownMenuItem onClick={onExportCsv}>
                    <FileSpreadsheetIcon className='mr-2 size-4' />
                    Export as CSV
                  </DropdownMenuItem>
                )}
                {onExportPdf && (
                  <DropdownMenuItem onClick={onExportPdf}>
                    <FileIcon className='mr-2 size-4' />
                    Export as PDF
                  </DropdownMenuItem>
                )}
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className='text-destructive focus:text-destructive'
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2Icon className='mr-2 size-4' />
              Delete study
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ChevronRightIcon
          aria-hidden
          className='text-muted-foreground/50 group-hover:text-muted-foreground size-4 shrink-0 transition-colors'
        />
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon variant='danger' />
            <div>
              <AlertDialogTitle>Delete this study?</AlertDialogTitle>
              <AlertDialogDescription>
                {studyName}, its PDFs, and every checklist on it are deleted for everyone on this
                project. Any appraisal work already done on it goes too. This cannot be undone.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={() => project.study.delete(study.id)}>
              Delete study
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
