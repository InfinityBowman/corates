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
  const isSelected = currentPath === projectPath;
  const projectData = useProjectData(project.id);

  function handleRowClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('button, [role="button"]')) return;
    onToggle();
  }

  return (
    <Collapsible open={isExpanded}>
      <div
        className={`group flex cursor-pointer items-center rounded-lg px-2 py-1.5 transition-colors ${
          isSelected ? 'bg-primary/10 text-primary' : 'text-secondary-foreground hover:bg-muted'
        }`}
        onClick={handleRowClick}
      >
        <ChevronRightIcon
          className={`mr-1 h-3 w-3 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
        <button
          onClick={e => {
            e.stopPropagation();
            navigate({ to: projectPath as string });
          }}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {isExpanded ? (
            <FolderOpenIcon className="h-4 w-4 text-primary" />
          ) : (
            <FolderIcon className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="truncate text-sm font-medium">{project.name}</span>
        </button>
      </div>
      <CollapsibleContent>
        <div className="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-2">
          {(projectData.studies as unknown[])?.length > 0 ? (
            (projectData.studies as Array<{ id: string; name: string; checklists?: unknown[] }>).map(study => (
              <StudyTreeItem
                key={study.id}
                study={study as any}
                projectId={project.id}
                userId={userId}
                currentPath={currentPath}
                isExpanded={isStudyExpanded(study.id)}
                onToggle={() => onToggleStudy(study.id)}
              />
            ))
          ) : projectData.connecting || !projectData.synced ? (
            <div className="px-2 py-2 text-xs text-muted-foreground/70">Loading...</div>
          ) : (
            <div className="px-2 py-2 text-xs text-muted-foreground">No studies yet</div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
