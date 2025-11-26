import { createSignal, createEffect } from 'solid-js';
import { useParams } from '@solidjs/router';
import AMSTAR2Checklist from './AMSTAR2Checklist.jsx';
import { createChecklist } from '../checklist/AMSTAR2Checklist.js';
import { useUserProjects } from './UserYjsProvider.jsx';

export default function ChecklistYjsWrapper() {
  const params = useParams();
  const projectId = params.projectId || 'demo-project';
  const checklistId = params.checklistId || 'demo-checklist';

  const [currentChecklist, setCurrentChecklist] = createSignal(null);

  const userProjects = useUserProjects();

  createEffect(() => {
    if (!userProjects) return;

    // Get checklist from user's projects
    let checklist = userProjects.getChecklist(projectId, checklistId);

    if (!checklist) {
      // Create default checklist if it doesn't exist
      const initial = createChecklist({ name: 'Synced Checklist', id: checklistId });
      userProjects.updateChecklist(projectId, checklistId, initial);
      setCurrentChecklist(initial);
    } else {
      setCurrentChecklist(checklist);
    }
  });

  // Watch for changes in the user's project data
  createEffect(() => {
    if (!userProjects?.projectData) return;

    const checklist = userProjects.getChecklist(projectId, checklistId);
    if (checklist && JSON.stringify(checklist) !== JSON.stringify(currentChecklist())) {
      setCurrentChecklist(checklist);
    }
  });

  function handlePartialUpdate(patch) {
    if (!userProjects) return;
    userProjects.updateChecklist(projectId, checklistId, patch);
  }

  return (
    <div>
      <div class='mb-4 text-sm text-gray-300'>
        Project: <code class='text-blue-300'>{projectId}</code> • Checklist:{' '}
        <code class='text-blue-300'>{checklistId}</code>
        {userProjects?.isProjectConnected(projectId) && (
          <span class='ml-2 text-green-400'>• Connected</span>
        )}
      </div>

      {currentChecklist() ?
        <AMSTAR2Checklist
          externalChecklist={currentChecklist()}
          onExternalUpdate={handlePartialUpdate}
        />
      : <div class='text-sm text-gray-400'>Loading checklist…</div>}
    </div>
  );
}
