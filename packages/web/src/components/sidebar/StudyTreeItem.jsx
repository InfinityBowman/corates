import { createSignal, For, Show } from 'solid-js';
import { VsBook } from 'solid-icons/vs';
import Collapsible from '@components/zag/Collapsible.jsx';
import ChecklistTreeItem from './ChecklistTreeItem.jsx';

/**
 * Study tree item with expandable checklists
 */
export default function StudyTreeItem(props) {
  const [isExpanded, setIsExpanded] = createSignal(false);

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
            <svg
              class={`w-2.5 h-2.5 text-gray-400 transition-transform ${isExpanded() ? 'rotate-90' : ''}`}
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M9 5l7 7-7 7' />
            </svg>
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
          when={props.study.checklists?.length > 0}
          fallback={<div class='py-1 px-2 text-2xs text-gray-400'>No checklists</div>}
        >
          <For each={props.study.checklists}>
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
