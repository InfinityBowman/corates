import { createMemo, createSignal, For, Show } from 'solid-js';
import { VsBook } from 'solid-icons/vs';
import { FiChevronRight } from 'solid-icons/fi';
import { Collapsible } from '@corates/ui';
import ChecklistTreeItem from './ChecklistTreeItem.jsx';

/**
 * Study tree item with expandable checklists
 */
export default function StudyTreeItem(props) {
  const [isExpanded, setIsExpanded] = createSignal(false);

  const assignedChecklists = createMemo(() => {
    const list = props.study.checklists || [];
    if (!props.userId) return list;
    return list.filter(checklist => checklist?.assignedTo === props.userId);
  });

  return (
    <Collapsible
      open={isExpanded()}
      onOpenChange={setIsExpanded}
      trigger={api => (
        <div class='flex items-center group rounded transition-colors text-gray-600 hover:bg-gray-50'>
          <button
            {...api.getTriggerProps()}
            class='p-1.5 hover:bg-gray-100 rounded'
            aria-label={isExpanded() ? 'Collapse' : 'Expand'}
          >
            <FiChevronRight
              class={`w-2.5 h-2.5 text-gray-400 transition-transform ${isExpanded() ? 'rotate-90' : ''}`}
            />
          </button>
          <div class='flex-1 flex items-center gap-1.5 py-1.5 pr-2 text-left'>
            <VsBook class='w-3.5 h-3.5 text-gray-400' />
            <span class='text-xs font-medium truncate'>{props.study.name}</span>
          </div>
        </div>
      )}
    >
      {/* Checklists list */}
      <div class='ml-4 pl-2 border-l border-gray-100 mt-0.5 space-y-0.5'>
        <Show
          when={assignedChecklists()?.length > 0}
          fallback={
            <div class='py-1 px-2 text-2xs text-gray-400'>
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
                currentPath={props.currentPath}
              />
            )}
          </For>
        </Show>
      </div>
    </Collapsible>
  );
}
