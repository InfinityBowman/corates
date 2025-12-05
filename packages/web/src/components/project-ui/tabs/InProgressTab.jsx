import { For, Show, createMemo } from 'solid-js';
import StudyCard from '../StudyCard.jsx';

export default function InProgressTab(props) {
  // Filter studies to only show ones assigned to the current user
  const myStudies = createMemo(() => {
    const userId = props.currentUserId;
    if (!userId) return [];
    return props
      .studies()
      .filter(study => study.reviewer1 === userId || study.reviewer2 === userId);
  });

  return (
    <div class='space-y-6'>
      {/* Studies List */}
      <Show
        when={myStudies().length > 0}
        fallback={
          <Show when={props.hasData()}>
            <div class='text-center py-12 bg-gray-50 rounded-lg'>
              <p class='text-gray-500'>No studies assigned to you yet.</p>
            </div>
          </Show>
        }
      >
        <div class='space-y-4'>
          <For each={myStudies()}>
            {study => (
              <StudyCard
                study={study}
                members={props.members()}
                projectId={props.projectId}
                showChecklistForm={props.showChecklistForm() === study.id}
                onToggleChecklistForm={() =>
                  props.onSetShowChecklistForm(prev => (prev === study.id ? null : study.id))
                }
                onAddChecklist={(type, assigneeId) =>
                  props.onCreateChecklist(study.id, type, assigneeId)
                }
                onOpenChecklist={checklistId => props.onOpenChecklist(study.id, checklistId)}
                onReconcile={(checklist1Id, checklist2Id) =>
                  props.onOpenReconciliation(study.id, checklist1Id, checklist2Id)
                }
                onViewPdf={pdf => props.onViewPdf(study.id, pdf)}
                onUpdateChecklist={(checklistId, updates) =>
                  props.onUpdateChecklist(study.id, checklistId, updates)
                }
                onDeleteChecklist={checklistId => props.onDeleteChecklist(study.id, checklistId)}
                getAssigneeName={props.getAssigneeName}
                creatingChecklist={props.creatingChecklist()}
                hideManagementActions={true}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
