/**
 * ProjectCard - Project card with accent colors, progress bar, and Yjs stats
 */

import { useMemo } from 'react';
import { UsersIcon, ChevronRightIcon, TrashIcon } from 'lucide-react';
import { useProjectStore, selectProjectStats } from '@/stores/projectStore';
import { formatRelativeTime, getAccentColors } from './utils';

interface Project {
  id: string;
  name: string;
  description?: string;
  role?: string;
  studyCount?: number;
  completedCount?: number;
  memberCount?: number;
  members?: unknown[];
  updatedAt?: string | number;
  createdAt?: string | number;
}

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
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all duration-300 hover:border-border hover:shadow-lg hover:shadow-stone-200/50"
      style={style}
    >
      {/* Decorative accent blob */}
      <div className={`absolute -right-10 -top-10 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-40 ${colors.fill}`} />

      {/* Header */}
      <div className="relative mb-4 flex items-start justify-between">
        <div className="min-w-0 flex-1 pr-4">
          <div className="mb-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium uppercase tracking-wide ${colors.bg} ${colors.text}`}>
              {isOwner ? 'Lead' : 'Reviewer'}
            </span>
            <span className="text-xs text-muted-foreground/70">{relativeTime}</span>
          </div>
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
            {project.name}
          </h3>
        </div>

        {isOwner && onDelete && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete(project.id); }}
            className="z-10 shrink-0 rounded-lg p-2 text-muted-foreground/50 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
            title="Delete Project"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Description */}
      <p className="mb-5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {project.description || 'No description'}
      </p>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-secondary-foreground">Progress</span>
          <span className="tabular-nums text-muted-foreground">
            {progress.completed}/{progress.total} studies
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${colors.gradient} transition-all duration-500`}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UsersIcon className="h-3.5 w-3.5" />
          <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
        </div>
        <button
          type="button"
          onClick={() => onOpen(project.id)}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-primary transition-all hover:bg-primary/5 hover:text-primary/80"
        >
          Open
          <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
