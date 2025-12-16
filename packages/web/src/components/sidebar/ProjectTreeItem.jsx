import { Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useProjectData } from '@primitives/useProjectData.js';
import { Collapsible } from '@corates/ui';
import { AiOutlineFolder, AiOutlineFolderOpen } from 'solid-icons/ai';
import { FiChevronRight } from 'solid-icons/fi';
import StudyTreeItem from './StudyTreeItem.jsx';

/**
 * Project tree item with expandable studies using Zag collapsible
 */
export default function ProjectTreeItem(props) {
  const navigate = useNavigate();

  return (
    <Show when={props.project}>
      {project => {
        const projectId = project().id;
        const projectPath = `/projects/${projectId}`;
        const isSelected = () => props.currentPath === projectPath;

        // Use lightweight hook to read project data from store
        const projectData = useProjectData(projectId);

        return (
          <Collapsible
            open={props.isExpanded}
            onOpenChange={open => {
              if (open !== props.isExpanded) {
                props.onToggle();
              }
            }}
            trigger={api => (
              <div
                class={`
                  flex items-center group rounded-lg transition-colors cursor-pointer
                  ${isSelected() ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}
                `}
              >
                <button
                  {...api.getTriggerProps()}
                  class='p-2 hover:bg-gray-100 rounded-l-lg'
                  aria-label={props.isExpanded ? 'Collapse' : 'Expand'}
                >
                  <FiChevronRight
                    class={`w-3 h-3 text-gray-500 transition-transform ${props.isExpanded ? 'rotate-90' : ''}`}
                  />
                </button>
                <button
                  onClick={() => navigate(projectPath)}
                  class='flex-1 flex items-center gap-2 py-2 pr-2 text-left'
                >
                  <Show
                    when={props.isExpanded}
                    fallback={<AiOutlineFolder class='w-4 h-4 text-gray-500' />}
                  >
                    <AiOutlineFolderOpen class='w-4 h-4 text-blue-500' />
                  </Show>
                  <span class='text-sm font-medium truncate'>{project().name}</span>
                </button>
              </div>
            )}
          >
            {/* Studies list */}
            <div class='ml-6 pl-2 border-l border-gray-200 mt-0.5 space-y-0.5'>
              <Show
                when={projectData.studies()?.length > 0}
                fallback={
                  <Show
                    when={projectData.connecting() || !projectData.synced()}
                    fallback={<div class='py-2 px-2 text-xs text-gray-500'>No studies yet</div>}
                  >
                    <div class='py-2 px-2 text-xs text-gray-400'>Loading...</div>
                  </Show>
                }
              >
                <For each={projectData.studies()}>
                  {study => (
                    <StudyTreeItem
                      study={study}
                      projectId={projectId}
                      userId={props.userId}
                      currentPath={props.currentPath}
                      isExpanded={props.isStudyExpanded?.(study.id)}
                      onToggle={() => props.onToggleStudy?.(study.id)}
                    />
                  )}
                </For>
              </Show>
            </div>
          </Collapsible>
        );
      }}
    </Show>
  );
}
