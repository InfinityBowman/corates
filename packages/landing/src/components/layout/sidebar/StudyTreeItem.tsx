/**
 * Study tree item with expandable checklists
 */

import { useMemo } from 'react';
import { ChevronRightIcon, BookOpenIcon } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChecklistTreeItem } from './ChecklistTreeItem';

interface StudyData {
  id: string;
  name: string;
  checklists?: Array<{ id: string; type: string; status?: string; assignedTo?: string; [key: string]: unknown }>;
}

interface StudyTreeItemProps {
  study: StudyData;
  projectId: string;
  userId?: string;
  currentPath: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export function StudyTreeItem({ study, projectId, userId, currentPath, isExpanded, onToggle }: StudyTreeItemProps) {
  const assignedChecklists = useMemo(() => {
    const list = study.checklists || [];
    if (!userId) return list;
    return list.filter(checklist => checklist?.assignedTo === userId);
  }, [study.checklists, userId]);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={(open) => {
        if (open !== isExpanded) onToggle();
      }}
    >
      <CollapsibleTrigger className="group flex w-full items-center rounded px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted">
        <ChevronRightIcon
          className={`mr-1 h-2.5 w-2.5 shrink-0 text-muted-foreground/70 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
        <div className="flex flex-1 items-center gap-1.5 text-left">
          <BookOpenIcon className="h-3.5 w-3.5 text-muted-foreground/70" />
          <span className="truncate text-xs font-medium">{study.name}</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
          {assignedChecklists.length > 0 ? (
            assignedChecklists.map(checklist => (
              <ChecklistTreeItem
                key={checklist.id}
                checklist={checklist}
                projectId={projectId}
                studyId={study.id}
                currentPath={currentPath}
              />
            ))
          ) : (
            <div className="px-2 py-1 text-2xs text-muted-foreground/70">
              {userId ? 'No checklists assigned to you' : 'No checklists'}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
