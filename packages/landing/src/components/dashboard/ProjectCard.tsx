/**
 * ProjectCard - Project card with accent colors, progress bar, and Yjs stats
 */

import { useMemo } from 'react';
import { UsersIcon, ChevronRightIcon, TrashIcon } from 'lucide-react';
import { useProjectStore, selectProjectStats } from '@/stores/projectStore';
import { type Project } from '@/hooks/useMyProjectsList';
import { formatRelativeTime, getAccentColors } from './utils';

/* eslint-disable no-unused-vars */
interface ProjectCardProps {
  project: Project;
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
  style?: React.CSSProperties;
}
/* eslint-enable no-unused-vars */

export function ProjectCard({ project, onOpen, onDelete, style }: ProjectCardProps) {
  const cachedStats = useProjectStore(state => selectProjectStats(state, project.id));
  const colors = useMemo(() => getAccentColors(project.id), [project.id]);

  const progress = useMemo(() => {
    const completed = cachedStats?.completedCount ?? project.completedCount ?? 0;
    const total = cachedStats?.studyCount ?? project.studyCount ?? 0;
    if (total === 0) return { completed: 0, total: 0, percentage: 0 };
    return { completed, total, percentage: Math.round((completed / total) * 100) };
  }, [cachedStats, project.completedCount, project.studyCount]);

  const relativeTime = formatRelativeTime(project.updatedAt || project.createdAt);
  const memberCount = project.memberCount || project.members?.length || 1;
  const isOwner = project.role === 'owner';

  return (
    <div
      className='group border-border/60 bg-card hover:border-border relative overflow-hidden rounded-2xl border p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:shadow-stone-200/50'
      style={style}
    >
      {/* Decorative accent blob */}
      <div
        className={`absolute -top-10 -right-10 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-40 ${colors.fill}`}
      />

      {/* Header */}
      <div className='relative mb-4 flex items-start justify-between'>
        <div className='min-w-0 flex-1 pr-4'>
          <div className='mb-2 flex items-center gap-2'>
            <span
              className={`text-2xs inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium tracking-wide uppercase ${colors.bg} ${colors.text}`}
            >
              {isOwner ? 'Lead' : 'Reviewer'}
            </span>
            <span className='text-muted-foreground/70 text-xs'>{relativeTime}</span>
          </div>
          <h3 className='text-foreground group-hover:text-primary line-clamp-2 text-lg leading-snug font-semibold transition-colors'>
            {project.name}
          </h3>
        </div>

        {isOwner && onDelete && (
          <button
            type='button'
            onClick={e => {
              e.stopPropagation();
              onDelete(project.id);
            }}
            className='text-muted-foreground/50 z-10 shrink-0 rounded-lg p-2 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500'
            title='Delete Project'
          >
            <TrashIcon className='h-4 w-4' />
          </button>
        )}
      </div>

      {/* Description */}
      <p className='text-muted-foreground mb-5 line-clamp-2 text-sm leading-relaxed'>
        {project.description || 'No description'}
      </p>

      {/* Progress bar */}
      <div className='mb-4'>
        <div className='mb-1.5 flex items-center justify-between text-xs'>
          <span className='text-secondary-foreground font-medium'>Progress</span>
          <span className='text-muted-foreground tabular-nums'>
            {progress.completed}/{progress.total} studies
          </span>
        </div>
        <div className='bg-secondary h-1.5 overflow-hidden rounded-full'>
          <div
            className={`h-full rounded-full bg-gradient-to-r ${colors.gradient} transition-all duration-500`}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className='flex items-center justify-between'>
        <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
          <UsersIcon className='h-3.5 w-3.5' />
          <span>
            {memberCount} member{memberCount !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          type='button'
          onClick={() => onOpen(project.id)}
          className='text-primary hover:bg-primary/5 hover:text-primary/80 flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all'
        >
          Open
          <ChevronRightIcon className='h-4 w-4 transition-transform group-hover:translate-x-0.5' />
        </button>
      </div>
    </div>
  );
}
