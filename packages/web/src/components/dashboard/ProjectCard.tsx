/**
 * ProjectCard - Project card with accent colors, progress bar, and Yjs stats
 */

import { useMemo } from 'react';
import { UsersIcon, ChevronRightIcon, Trash2Icon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { type Project } from '@/hooks/useMyProjectsList';
import { formatRelativeTime, getAccentColors } from './utils';

interface ProjectCardProps {
  project: Project;
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
  style?: React.CSSProperties;
}

export function ProjectCard({ project, onOpen, onDelete, style }: ProjectCardProps) {
  const colors = useMemo(() => getAccentColors(project.id), [project.id]);

  const relativeTime = formatRelativeTime(project.updatedAt || project.createdAt);
  const memberCount = project.memberCount || project.members?.length || 1;
  const isOwner = project.role === 'owner';

  return (
    <Card
      className='group border-border/60 hover:border-border relative rounded-2xl p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:shadow-stone-200/50'
      style={style}
    >
      <CardContent className='flex flex-1 flex-col p-0'>
        {/* Header */}
        <div className='relative mb-4 flex items-start justify-between'>
          <div className='min-w-0 flex-1 pr-4'>
            <div className='mb-2 flex items-center gap-2'>
              <Badge
                variant='secondary'
                className={`text-2xs tracking-wide uppercase ${colors.bg} ${colors.text}`}
              >
                {isOwner ? 'Lead' : 'Reviewer'}
              </Badge>
              <span className='text-muted-foreground/70 text-xs'>{relativeTime}</span>
            </div>
            <h3 className='text-foreground group-hover:text-primary line-clamp-2 text-lg leading-snug font-semibold transition-colors'>
              {project.name}
            </h3>
          </div>

          {isOwner && onDelete && (
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={e => {
                e.stopPropagation();
                onDelete(project.id);
              }}
              className='text-muted-foreground/50 z-10 opacity-0 group-hover:opacity-100 hover:text-red-600'
              title='Delete Project'
              aria-label='Delete Project'
            >
              <Trash2Icon className='size-4' />
            </Button>
          )}
        </div>

        {/* Description */}
        <p className='text-muted-foreground mb-5 line-clamp-2 text-sm leading-relaxed'>
          {project.description || 'No description'}
        </p>

        {/* Footer */}
        <div className='mt-auto flex items-center justify-between'>
          <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
            <UsersIcon className='size-3.5' />
            <span>
              {memberCount} member{memberCount !== 1 ? 's' : ''}
            </span>
          </div>
          <Button
            variant='ghost'
            onClick={() => onOpen(project.id)}
            className='text-primary hover:bg-primary/5 hover:text-primary/80'
          >
            Open
            <ChevronRightIcon className='size-4 transition-transform group-hover:translate-x-0.5' />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
