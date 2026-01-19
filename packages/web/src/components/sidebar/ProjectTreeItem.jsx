import { Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useProjectData } from '@primitives/useProjectData.js';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
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

        // Build project-scoped path
        const projectPath = () => `/projects/${projectId}`;

        const isSelected = () => props.currentPath === projectPath();

        // Use lightweight hook to read project data from store
        const projectData = useProjectData(projectId);

        // Handle row click - toggle unless clicking on the project name button
        const handleRowClick = e => {
          const target = e.target;
          const interactive = target.closest('button, [role="button"]');
          if (interactive) return;
          props.onToggle();
        };

        return (
          <Collapsible open={props.isExpanded}>
            <div
              class={`group flex cursor-pointer items-center rounded-lg transition-colors ${isSelected() ? 'bg-blue-100 text-blue-700' : 'text-secondary-foreground hover:bg-muted'} `}
              onClick={handleRowClick}
            >
              <div class='hover:bg-secondary rounded-l-lg p-2'>
                <FiChevronRight
                  class={`text-muted-foreground h-3 w-3 transition-transform ${props.isExpanded ? 'rotate-90' : ''}`}
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
                  fallback={<AiOutlineFolder class='text-muted-foreground h-4 w-4' />}
                >
                  <AiOutlineFolderOpen class='h-4 w-4 text-blue-500' />
                </Show>
                <span class='truncate text-sm font-medium'>{project().name}</span>
              </button>
            </div>
            <CollapsibleContent>
              {/* Studies list */}
              <div class='border-border mt-0.5 ml-6 space-y-0.5 border-l pl-2'>
                <Show
                  when={projectData.studies()?.length > 0}
                  fallback={
                    <Show
                      when={projectData.connecting() || !projectData.synced()}
                      fallback={
                        <div class='text-muted-foreground px-2 py-2 text-xs'>No studies yet</div>
                      }
                    >
                      <div class='text-muted-foreground/70 px-2 py-2 text-xs'>Loading...</div>
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
            </CollapsibleContent>
          </Collapsible>
        );
      }}
    </Show>
  );
}
