import { createMemo, For, Show } from 'solid-js';
import { VsBook } from 'solid-icons/vs';
import { FiChevronRight } from 'solid-icons/fi';
import { Collapsible } from '@corates/ui';
import ChecklistTreeItem from './ChecklistTreeItem.jsx';

/**
 * Study tree item with expandable checklists
 * @param {Object} props
 * @param {Object} props.study - The study data
 * @param {string} props.projectId - The project ID
 * @param {string} props.orgSlug - The organization slug (for org-scoped paths)
 * @param {string} props.userId - Current user ID for filtering
 * @param {string} props.currentPath - Current route path
 * @param {boolean} props.isExpanded - Whether the study is expanded (controlled)
 * @param {Function} props.onToggle - Callback to toggle expanded state
 */
export default function StudyTreeItem(props) {
  const isExpanded = () => props.isExpanded || false;

  const assignedChecklists = createMemo(() => {
    const list = props.study.checklists || [];
    if (!props.userId) return list;
    return list.filter(checklist => checklist?.assignedTo === props.userId);
  });

  return (
    <Collapsible
      open={isExpanded()}
      onOpenChange={({ open }) => {
        if (open !== isExpanded()) {
          props.onToggle?.();
        }
      }}
      trigger={
        <div class='group flex items-center rounded text-gray-600 transition-colors hover:bg-gray-50'>
          <div class='pointer-events-none rounded p-1.5'>
            <FiChevronRight
              class={`h-2.5 w-2.5 text-gray-400 transition-transform ${isExpanded() ? 'rotate-90' : ''}`}
            />
          </div>
          <div class='flex flex-1 items-center gap-1.5 py-1.5 pr-2 text-left'>
            <VsBook class='h-3.5 w-3.5 text-gray-400' />
            <span class='truncate text-xs font-medium'>{props.study.name}</span>
          </div>
        </div>
      }
    >
      {/* Checklists list */}
      <div class='mt-0.5 ml-4 space-y-0.5 border-l border-gray-100 pl-2'>
        <Show
          when={assignedChecklists()?.length > 0}
          fallback={
            <div class='text-2xs px-2 py-1 text-gray-400'>
              {props.userId ? 'No checklists assigned to you' : 'No checklists'}
            </div>
          }
        >
          <For each={assignedChecklists()}>
            {checklist => (
              <ChecklistTreeItem
                checklist={checklist}
                projectId={props.projectId}
                studyId={props.study.id}
                orgSlug={props.orgSlug}
                currentPath={props.currentPath}
              />
            )}
          </For>
        </Show>
      </div>
    </Collapsible>
  );
}
