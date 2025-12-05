import { For, Show } from 'solid-js';
import StudyCard from '../StudyCard.jsx';
import StudyForm from '../StudyForm.jsx';

export default function InProgressTab(props) {
  return (
    <div class='space-y-6'>
      {/* Always-visible Study Form / Drop Zone */}
      <Show
        when={props.hasData()}
        fallback={
          <div class='text-center py-12 bg-gray-50 rounded-lg'>
            <p class='text-gray-400'>Loading studies...</p>
          </div>
        }
      >
        <StudyForm
          onSubmit={props.onCreateStudy}
          onCancel={() => props.onSetShowStudyForm(false)}
          onExpand={() => props.onSetShowStudyForm(true)}
          expanded={props.showStudyForm()}
          loading={props.creatingStudy()}
          hasExistingStudies={props.studies().length > 0}
        />
      </Show>

      {/* Studies List */}
      <Show
        when={props.studies().length > 0}
        fallback={
          <Show when={props.hasData()}>
            <div class='text-center py-12 bg-gray-50 rounded-lg'>
              <p class='text-gray-500'>No studies yet. Add your first study above.</p>
            </div>
          </Show>
        }
      >
        <div class='space-y-4'>
          <For each={props.studies()}>
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
                onUploadPdf={file => props.onUploadPdf(study.id, file)}
                onUpdateStudy={updates => props.onUpdateStudy(study.id, updates)}
                onDeleteStudy={() => props.onDeleteStudy(study.id)}
                onUpdateChecklist={(checklistId, updates) =>
                  props.onUpdateChecklist(study.id, checklistId, updates)
                }
                onDeleteChecklist={checklistId => props.onDeleteChecklist(study.id, checklistId)}
                getAssigneeName={props.getAssigneeName}
                creatingChecklist={props.creatingChecklist()}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
