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
  checklists?: Array<{
    id: string;
    type: string;
    status?: string;
    assignedTo?: string;
    [key: string]: unknown;
  }>;
}

interface StudyTreeItemProps {
  study: StudyData;
  projectId: string;
  userId?: string;
  currentPath: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export function StudyTreeItem({
  study,
  projectId,
  userId,
  currentPath,
  isExpanded,
  onToggle,
}: StudyTreeItemProps) {
  const assignedChecklists = useMemo(() => {
    const list = study.checklists || [];
    if (!userId) return list;
    return list.filter(checklist => checklist?.assignedTo === userId);
  }, [study.checklists, userId]);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={open => {
        if (open !== isExpanded) onToggle();
      }}
    >
      <CollapsibleTrigger className='group text-muted-foreground hover:bg-muted flex w-full items-center rounded px-2 py-1.5 transition-colors'>
        <ChevronRightIcon
          className={`text-muted-foreground/70 mr-1 size-2.5 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
        <div className='flex flex-1 items-center gap-1.5 text-left'>
          <BookOpenIcon className='text-muted-foreground/70 size-3.5' />
          <span className='truncate text-xs font-medium'>{study.name}</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className='border-border mt-0.5 ml-4 flex flex-col gap-0.5 border-l pl-2'>
          {assignedChecklists.length > 0 ?
            assignedChecklists.map(checklist => (
              <ChecklistTreeItem
                key={checklist.id}
                checklist={checklist}
                projectId={projectId}
                studyId={study.id}
                currentPath={currentPath}
              />
            ))
          : <div className='text-2xs text-muted-foreground/70 px-2 py-1'>
              {userId ? 'No checklists assigned to you' : 'No checklists'}
            </div>
          }
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
