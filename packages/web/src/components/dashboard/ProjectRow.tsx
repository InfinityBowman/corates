/**
 * ProjectRow - one project in the Home list
 */

import { Link } from '@tanstack/react-router';
import { Trash2Icon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Project } from '@/hooks/useMyProjectsList';
import { rowClass } from './DashboardSection';
import { formatRelativeTime, getAccentColors } from './utils';

interface ProjectRowProps {
  project: Project;
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function ProjectRow({ project, onOpen, onDelete }: ProjectRowProps) {
  const isOwner = project.role === 'owner';

  function handleRowClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('a, button')) return;
    onOpen(project.id);
  }

  return (
    <div className={rowClass()} onClick={handleRowClick}>
      <span
        className={`size-2 shrink-0 rounded-[3px] ${getAccentColors(project.id).fill}`}
        aria-hidden='true'
      />
      <Link
        to={`/projects/${project.id}` as string}
        className='text-foreground min-w-0 flex-1 truncate font-medium'
      >
        {project.name}
      </Link>
      <Badge variant='outline' className='shrink-0'>
        {isOwner ? 'Lead' : 'Reviewer'}
      </Badge>
      <span className='text-muted-foreground w-20 shrink-0 text-right text-xs'>
        {project.memberCount} member{project.memberCount !== 1 ? 's' : ''}
      </span>
      <span className='text-muted-foreground w-14 shrink-0 text-right text-xs'>
        {formatRelativeTime(project.updatedAt || project.createdAt)}
      </span>
      {isOwner && onDelete ?
        <Button
          variant='ghost'
          size='icon-xs'
          onClick={() => onDelete(project.id)}
          className='text-muted-foreground hover:text-destructive'
          aria-label='Delete project'
        >
          <Trash2Icon className='size-4' />
        </Button>
      : <span className='size-6 shrink-0' />}
    </div>
  );
}
