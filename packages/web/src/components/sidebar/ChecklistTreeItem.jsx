import { HiOutlineDocumentCheck } from 'solid-icons/hi';
import { useNavigate } from '@solidjs/router';
import { Show } from 'solid-js';
import { getChecklistMetadata } from '@/checklist-registry';
import { getStatusLabel, getStatusStyle } from '@/constants/checklist-status.js';

/**
 * Checklist tree item (leaf node)
 */
export default function ChecklistTreeItem(props) {
  const navigate = useNavigate();
  const checklistPath = () =>
    `/projects/${props.projectId}/studies/${props.studyId}/checklists/${props.checklist.id}`;
  const isSelected = () => props.currentPath === checklistPath();

  return (
    <button
      onClick={() => navigate(checklistPath())}
      class={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left transition-colors ${isSelected() ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'} `}
    >
      <HiOutlineDocumentCheck class='h-3 w-3 shrink-0' />
      <span class='text-2xs truncate font-medium'>
        {getChecklistMetadata(props.checklist.type).name}
      </span>
      <Show when={props.checklist.status}>
        <span class={`text-3xs rounded px-1 py-0.5 ${getStatusStyle(props.checklist.status)}`}>
          {getStatusLabel(props.checklist.status)}
        </span>
      </Show>
    </button>
  );
}
