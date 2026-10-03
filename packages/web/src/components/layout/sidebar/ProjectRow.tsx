/**
 * ProjectRow - flat sidebar link to a project, keyed by its accent dot
 */

import { Link } from '@tanstack/react-router';
import type { Project } from '@/hooks/useMyProjectsList';
import { getAccentColors } from '@/components/dashboard/utils';
import { navRowClass } from '../navStyles';
import { MarqueeLabel } from './MarqueeLabel';

interface ProjectRowProps {
  project: Pick<Project, 'id' | 'name'>;
  currentPath: string;
}

export function ProjectRow({ project, currentPath }: ProjectRowProps) {
  const projectPath = `/projects/${project.id}`;
  const isActive = currentPath === projectPath || currentPath.startsWith(`${projectPath}/`);

  return (
    <Link to={projectPath as string} className={`group ${navRowClass(isActive)}`}>
      <span
        className={`ml-1 size-2 shrink-0 rounded-[3px] ${getAccentColors(project.id).fill}`}
        aria-hidden='true'
      />
      <MarqueeLabel text={project.name} className='flex-1' />
    </Link>
  );
}
