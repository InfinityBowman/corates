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
import { Avatar, AvatarImage, AvatarFallback, getInitials } from '@/components/ui/avatar';
import { useProjectContext, type ProjectMember } from '@/components/project/ProjectContext';
import type { StudyInfo } from '@/stores/projectStore';
import { project } from '@/project';
import { API_BASE } from '@/config/api';

const AVATAR_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-pink-100', text: 'text-pink-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
];

function getAvatarColorClasses(name: string) {
  const index = name ? name.charCodeAt(0) % AVATAR_COLORS.length : 0;
  return AVATAR_COLORS[index];
}

interface StudyCardHeaderProps {
  study: StudyInfo;
  expanded: boolean;
  onToggle: () => void;
  onAssignReviewers?: () => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  getMember?: (userId: string) => ProjectMember | null;
}

export function StudyCardHeader({
  study,
  expanded,
  onToggle,
  onAssignReviewers,
  onExportCsv,
  onExportPdf,
  getMember,
}: StudyCardHeaderProps) {
  const { isOwner } = useProjectContext();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const hasChecklists = study.checklists.length > 0;
  const primaryPdf = useMemo(() => {
    const pdfs = study.pdfs || [];
    return pdfs.find(p => p.tag === 'primary') || pdfs[0];
  }, [study.pdfs]);

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

  const citationLine = useMemo(() => {
    const parts: string[] = [];
    const author = primaryPdf?.firstAuthor || study.firstAuthor;
    const year = primaryPdf?.publicationYear || study.publicationYear;
    const journal = primaryPdf?.journal || study.journal;
    if (author) parts.push(author);
    if (year) parts.push(`(${year})`);
    if (journal) parts.push(`- ${journal}`);
    return parts.join(' ');
  }, [primaryPdf, study]);

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
      if (interactive) return;
      onToggle();
    },
    [onToggle],
  );

  return (
    <>
      <div
        className='flex cursor-pointer items-center gap-3 px-4 py-3 select-none'
        onClick={handleHeaderClick}
      >
        <div className='-ml-1 shrink-0 p-1'>
          <ChevronRightIcon
            className={`text-muted-foreground/70 size-5 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          />
        </div>

        <div className='min-w-0 flex-1'>
          <InlineEdit
            key={studyName}
            value={studyName}
            onCommit={handleNameChange}
            showEditIcon
            ariaLabel='Rename study'
            className='text-foreground -ml-2 font-medium'
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

        {hasReviewers ?
          <div className='flex shrink-0 -space-x-1.5' data-selectable>
            {assignedReviewers.map(member => {
              const displayName = member?.name || member?.email || 'Unknown';
              const colorClasses = getAvatarColorClasses(displayName);
              const avatarSrc =
                member?.image ?
                  member.image.startsWith('/') ?
                    `${API_BASE}${member.image}`
                  : member.image
                : undefined;
              return (
                <Tooltip key={member.userId}>
                  <TooltipTrigger>
                    <Avatar className='size-7 border-2 border-white text-xs'>
                      <AvatarImage src={avatarSrc} alt={displayName} />
                      <AvatarFallback className={`${colorClasses.bg} ${colorClasses.text}`}>
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>{displayName}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        : <span className='text-muted-foreground/70 shrink-0 text-xs italic'>
            No reviewers assigned
          </span>
        }

        <DropdownMenu>
          <DropdownMenuTrigger className='text-muted-foreground/70 hover:bg-secondary hover:text-secondary-foreground rounded-md p-1.5 transition-colors'>
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
