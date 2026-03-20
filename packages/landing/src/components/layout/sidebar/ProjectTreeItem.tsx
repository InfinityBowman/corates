/**
 * Project tree item with expandable studies
 * Auto-connects to Yjs via useProjectData to show live study list
 */

import { useNavigate } from '@tanstack/react-router';
import { ChevronRightIcon, FolderIcon, FolderOpenIcon } from 'lucide-react';
import { useProjectData } from '@/hooks/useProjectData';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { StudyTreeItem } from './StudyTreeItem';

interface ProjectTreeItemProps {
  project: { id: string; name: string };
  isExpanded: boolean;
  onToggle: () => void;
  userId?: string;
  currentPath: string;
  /* eslint-disable no-unused-vars */
  isStudyExpanded: (studyId: string) => boolean;
  onToggleStudy: (studyId: string) => void;
  /* eslint-enable no-unused-vars */
}

export function ProjectTreeItem({
  project,
  isExpanded,
  onToggle,
  userId,
  currentPath,
  isStudyExpanded,
  onToggleStudy,
}: ProjectTreeItemProps) {
  const navigate = useNavigate();
  const projectPath = `/projects/${project.id}`;
  const isInProject = currentPath.startsWith(projectPath);
  const isSelected = currentPath === projectPath;

  // Only connect to Yjs when inside this project to avoid unnecessary WebSocket connections
  const projectData = useProjectData(isInProject ? project.id : undefined);
  const canExpand = isInProject;

  function handleRowClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('button, [role="button"]')) return;
    if (canExpand) onToggle();
    else navigate({ to: projectPath as string });
  }

  return (
    <Collapsible open={canExpand && isExpanded}>
      <div
        className={`group flex cursor-pointer items-center rounded-lg px-2 py-1.5 transition-colors ${
          isSelected ? 'bg-primary/10 text-primary' : 'text-secondary-foreground hover:bg-muted'
        }`}
        onClick={handleRowClick}
      >
        {canExpand && (
          <ChevronRightIcon
            className={`text-muted-foreground mr-1 size-3 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        )}
        <button
          onClick={e => {
            e.stopPropagation();
            navigate({ to: projectPath as string });
          }}
          className='flex flex-1 items-center gap-2 text-left'
        >
          {canExpand && isExpanded ?
            <FolderOpenIcon className='text-primary size-4' />
          : <FolderIcon
              className={`size-4 ${isInProject ? 'text-primary' : 'text-muted-foreground'}`}
            />
          }
          <span className='truncate text-sm font-medium'>{project.name}</span>
        </button>
      </div>
      <CollapsibleContent>
        <div className='border-border mt-0.5 ml-6 flex flex-col gap-0.5 border-l pl-2'>
          {projectData.studies?.length > 0 ?
            projectData.studies.map(study => (
              <StudyTreeItem
                key={study.id}
                study={study}
                projectId={project.id}
                userId={userId}
                currentPath={currentPath}
                isExpanded={isStudyExpanded(study.id)}
                onToggle={() => onToggleStudy(study.id)}
              />
            ))
          : projectData.connecting || !projectData.synced ?
            <div className='text-muted-foreground/70 px-2 py-2 text-xs'>Loading...</div>
          : <div className='text-muted-foreground px-2 py-2 text-xs'>No studies yet</div>}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
