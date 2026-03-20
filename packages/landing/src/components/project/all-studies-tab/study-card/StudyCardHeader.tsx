/**
 * StudyCardHeader - Collapsed header with name, citation, reviewer avatars, actions menu
 */

import { useMemo, useCallback } from 'react';
import { ChevronRightIcon, UsersIcon, Trash2Icon, MoreVerticalIcon } from 'lucide-react';
import { SimpleEditable } from '@/components/ui/editable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Avatar, AvatarImage, AvatarFallback, getInitials } from '@/components/ui/avatar';
import { type ProjectMember } from '@/components/project/ProjectContext';
import _projectActionsStore from '@/stores/projectActionsStore/index.js';
import { API_BASE } from '@/config/api';

const projectActionsStore = _projectActionsStore as any;

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

/* eslint-disable no-unused-vars */
interface StudyCardHeaderProps {
  study: any;
  expanded: boolean;
  onToggle: () => void;
  onAssignReviewers?: () => void;
  getMember?: (userId: string) => ProjectMember | null;
}

export function StudyCardHeader({
  study,
  expanded,
  onToggle,
  onAssignReviewers,
  getMember,
}: StudyCardHeaderProps) {
  const primaryPdf = useMemo(() => {
    const pdfs = study.pdfs || [];
    return pdfs.find((p: any) => p.tag === 'primary') || pdfs[0];
  }, [study.pdfs]);

  const assignedReviewers = useMemo(() => {
    const reviewers: any[] = [];
    if (study.reviewer1) {
      reviewers.push(getMember?.(study.reviewer1) || { userId: study.reviewer1 });
    }
    if (study.reviewer2) {
      reviewers.push(getMember?.(study.reviewer2) || { userId: study.reviewer2 });
    }
    return reviewers;
  }, [study.reviewer1, study.reviewer2, getMember]);

  const hasReviewers = !!study.reviewer1 || !!study.reviewer2;
  const studyName = study.name || 'Untitled Study';

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
        projectActionsStore.study.update(study.id, { name: newName.trim() });
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
        <SimpleEditable
          key={studyName}
          activationMode='click'
          value={studyName}
          onSubmit={handleNameChange}
          showEditIcon
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
          {assignedReviewers.map((member: any) => {
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
      : <span className='text-muted-foreground/70 shrink-0 text-xs italic'>No reviewers</span>}

      <DropdownMenu>
        <DropdownMenuTrigger className='text-muted-foreground/70 hover:bg-secondary hover:text-secondary-foreground rounded-md p-1.5 transition-colors'>
          <MoreVerticalIcon className='size-4' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem onClick={() => onAssignReviewers?.()}>
            <UsersIcon className='mr-2 size-4' />
            Assign Reviewers
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className='text-destructive focus:text-destructive'
            onClick={() => projectActionsStore.study.delete(study.id)}
          >
            <Trash2Icon className='mr-2 size-4' />
            Delete Study
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
