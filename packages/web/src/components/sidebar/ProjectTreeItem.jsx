import { Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useProjectData } from '@primitives/useProjectData.js';
import { Collapsible } from '@corates/ui';
import { AiOutlineFolder, AiOutlineFolderOpen } from 'solid-icons/ai';
import { FiChevronRight } from 'solid-icons/fi';
import StudyTreeItem from './StudyTreeItem.jsx';

/**
 * Project tree item with expandable studies using collapsible component
 */
export default function ProjectTreeItem(props) {
  const navigate = useNavigate();

  return (
    <Show when={props.project}>
      {project => {
        const projectId = project().id;

        // Build org-scoped project path
        const projectPath = () => {
          const slug = props.orgSlug;
          if (slug) {
            return `/orgs/${slug}/projects/${projectId}`;
          }
          return `/projects/${projectId}`;
        };

        const isSelected = () => props.currentPath === projectPath();

        // Use lightweight hook to read project data from store
        const projectData = useProjectData(projectId);

        return (
          <Collapsible
            open={props.isExpanded}
            onOpenChange={({ open }) => {
              if (open !== props.isExpanded) {
                props.onToggle();
              }
            }}
            trigger={
              <div
                class={`group flex cursor-pointer items-center rounded-lg transition-colors ${isSelected() ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'} `}
              >
                <div class='pointer-events-none rounded-l-lg p-2 hover:bg-gray-100'>
                  <FiChevronRight
                    class={`h-3 w-3 text-gray-500 transition-transform ${props.isExpanded ? 'rotate-90' : ''}`}
                  />
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    navigate(projectPath());
                  }}
                  class='flex flex-1 items-center gap-2 py-2 pr-2 text-left'
                >
                  <Show
                    when={props.isExpanded}
                    fallback={<AiOutlineFolder class='h-4 w-4 text-gray-500' />}
                  >
                    <AiOutlineFolderOpen class='h-4 w-4 text-blue-500' />
                  </Show>
                  <span class='truncate text-sm font-medium'>{project().name}</span>
                </button>
              </div>
            }
          >
            {/* Studies list */}
            <div class='mt-0.5 ml-6 space-y-0.5 border-l border-gray-200 pl-2'>
              <Show
                when={projectData.studies()?.length > 0}
                fallback={
                  <Show
                    when={projectData.connecting() || !projectData.synced()}
                    fallback={<div class='px-2 py-2 text-xs text-gray-500'>No studies yet</div>}
                  >
                    <div class='px-2 py-2 text-xs text-gray-400'>Loading...</div>
                  </Show>
                }
              >
                <For each={projectData.studies()}>
                  {study => (
                    <StudyTreeItem
                      study={study}
                      projectId={projectId}
                      orgSlug={props.orgSlug}
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
