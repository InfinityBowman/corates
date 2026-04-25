/**
 * Checklist tree item (leaf node in sidebar project tree)
 */

import { useNavigate } from '@tanstack/react-router';
import { FileCheck2Icon } from 'lucide-react';
import { getChecklistMetadata } from '@/checklist-registry';
import { getStatusLabel, getStatusStyle } from '@corates/shared/checklists';
import type { ChecklistEntry } from '@/stores/projectStore';

interface ChecklistTreeItemProps {
  checklist: ChecklistEntry;
  projectId: string;
  studyId: string;
  currentPath: string;
}

export function ChecklistTreeItem({
  checklist,
  projectId,
  studyId,
  currentPath,
}: ChecklistTreeItemProps) {
  const navigate = useNavigate();
  const checklistPath = `/projects/${projectId}/studies/${studyId}/checklists/${checklist.id}`;
  const isSelected = currentPath === checklistPath;

  return (
    <button
      onClick={() => navigate({ to: checklistPath as string })}
      className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left transition-colors ${
        isSelected ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      <FileCheck2Icon className='size-3 shrink-0' />
      <span className='text-2xs truncate font-medium'>
        {(getChecklistMetadata(checklist.type) as { name: string }).name}
      </span>
      {checklist.status && (
        <span className={`text-3xs rounded px-1 py-0.5 ${getStatusStyle(checklist.status)}`}>
          {getStatusLabel(checklist.status)}
        </span>
      )}
    </button>
  );
}
