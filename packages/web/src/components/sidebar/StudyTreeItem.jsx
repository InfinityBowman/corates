import { createMemo, For, Show } from 'solid-js';
import { VsBook } from 'solid-icons/vs';
import { FiChevronRight } from 'solid-icons/fi';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import ChecklistTreeItem from './ChecklistTreeItem.jsx';

/**
 * Study tree item with expandable checklists
 * @param {Object} props
 * @param {Object} props.study - The study data
 * @param {string} props.projectId - The project ID
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
      onOpenChange={open => {
        if (open !== isExpanded()) {
          props.onToggle?.();
        }
      }}
    >
      <CollapsibleTrigger class='group text-muted-foreground hover:bg-muted flex w-full items-center rounded px-2 py-1.5 transition-colors'>
        <FiChevronRight
          class={`text-muted-foreground/70 mr-1 h-2.5 w-2.5 shrink-0 transition-transform ${isExpanded() ? 'rotate-90' : ''}`}
        />
        <div class='flex flex-1 items-center gap-1.5 text-left'>
          <VsBook class='text-muted-foreground/70 h-3.5 w-3.5' />
          <span class='truncate text-xs font-medium'>{props.study.name}</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Checklists list */}
        <div class='border-border-subtle mt-0.5 ml-4 space-y-0.5 border-l pl-2'>
          <Show
            when={assignedChecklists()?.length > 0}
            fallback={
              <div class='text-2xs text-muted-foreground/70 px-2 py-1'>
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
      </CollapsibleContent>
    </Collapsible>
  );
}
