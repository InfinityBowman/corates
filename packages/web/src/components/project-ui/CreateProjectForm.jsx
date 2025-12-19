import { createSignal, Show, onMount } from 'solid-js';
import { showToast } from '@corates/ui';
import AddStudiesForm from './AddStudiesForm.jsx';
import {
  saveFormState,
  getFormState,
  clearFormState,
  getRestoreParamsFromUrl,
  clearRestoreParamsFromUrl,
} from '@lib/formStatePersistence.js';

/**
 * Form for creating a new project with optional study imports
 * Uses AddStudiesForm in collect mode to avoid duplicate code
 *
 * @param {Object} props
 * @param {string} props.apiBase - API base URL
 * @param {Function} props.onProjectCreated - Called with (project, pendingPdfs, allRefs)
 * @param {Function} props.onCancel - Called when form is cancelled
 */
export default function CreateProjectForm(props) {
  const [projectName, setProjectName] = createSignal('');
  const [projectDescription, setProjectDescription] = createSignal('');
  const [isCreating, setIsCreating] = createSignal(false);
  const [restoredState, setRestoredState] = createSignal(null);

  // Collected studies from AddStudiesForm (via collect mode)
  const [collectedStudies, setCollectedStudies] = createSignal({
    pdfs: [],
    refs: [],
    lookups: [],
    driveFiles: [],
  });

  // Check for and restore state on mount (after OAuth redirect)
  onMount(async () => {
    const restoreParams = getRestoreParamsFromUrl();
    if (restoreParams?.type === 'createProject') {
      try {
        const savedState = await getFormState('createProject');
        if (savedState) {
          // Restore project name and description
          if (savedState.projectName) setProjectName(savedState.projectName);
          if (savedState.projectDescription) setProjectDescription(savedState.projectDescription);

          // Pass studies state to AddStudiesForm via restoredState
          setRestoredState(savedState);

          // Clean up
          await clearFormState('createProject');
        }
      } catch (err) {
        console.error('Failed to restore form state:', err);
      }

      // Clear the URL params
      clearRestoreParamsFromUrl();
    }
  });

  // Handler to save state before OAuth redirect
  const handleSaveState = async state => {
    await saveFormState('createProject', {
      projectName: projectName(),
      projectDescription: projectDescription(),
      ...state,
    });
  };

  // Get external state for AddStudiesForm to include when saving
  const getExternalState = () => ({
    projectName: projectName(),
    projectDescription: projectDescription(),
  });

  const totalStudyCount = () => {
    const studies = collectedStudies();
    return (
      studies.pdfs.length +
      studies.refs.length +
      studies.lookups.length +
      (studies.driveFiles?.length || 0)
    );
  };

  const handleStudiesChange = data => {
    setCollectedStudies(data);
  };

  const handleSubmit = async () => {
    if (!projectName().trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch(`${props.apiBase}/api/projects`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName().trim(),
          description: projectDescription().trim(),
        }),
      });

      if (!response.ok) throw new Error('Failed to create project');

      const newProject = await response.json();
      const studies = collectedStudies();

      // Pass PDFs with their binary data
      const pendingPdfs = studies.pdfs;

      // Combine refs and lookups
      const allRefsToImport = [...studies.refs, ...studies.lookups];

      // Pass Google Drive files
      const driveFiles = studies.driveFiles || [];

      props.onProjectCreated?.(newProject, pendingPdfs, allRefsToImport, driveFiles);
    } catch (error) {
      console.error('Error creating project:', error);
      showToast.error('Creation Failed', 'Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setProjectName('');
    setProjectDescription('');
    setCollectedStudies({ pdfs: [], refs: [], lookups: [], driveFiles: [] });
    props.onCancel?.();
  };

  return (
    <div class='rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
      <h3 class='mb-4 text-lg font-semibold text-gray-900'>Create New Project</h3>

      <div class='space-y-4'>
        <div>
          <label class='mb-2 block text-sm font-semibold text-gray-700'>Project Name</label>
          <input
            type='text'
            placeholder='e.g., Sleep Study Meta-Analysis'
            value={projectName()}
            onInput={e => setProjectName(e.target.value)}
            class='w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none'
          />
        </div>

        <div>
          <label class='mb-2 block text-sm font-semibold text-gray-700'>
            Description (Optional)
          </label>
          <textarea
            placeholder='Brief description of your research project...'
            value={projectDescription()}
            onInput={e => setProjectDescription(e.target.value)}
            rows='3'
            class='w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none'
          />
        </div>

        {/* Add Studies Section */}
        <div>
          <label class='mb-2 block text-sm font-semibold text-gray-700'>
            Add Studies (Optional)
          </label>
          <AddStudiesForm
            collectMode
            alwaysExpanded
            hideTitle
            formType='createProject'
            initialState={restoredState()}
            getExternalState={getExternalState}
            onSaveState={handleSaveState}
            onStudiesChange={handleStudiesChange}
          />
        </div>

        {/* Study count summary */}
        <Show when={totalStudyCount() > 0}>
          <div class='rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700'>
            <span class='font-medium'>{totalStudyCount()}</span>{' '}
            {totalStudyCount() === 1 ? 'study' : 'studies'} will be added to this project
          </div>
        </Show>
      </div>

      <div class='mt-6 flex gap-3'>
        <button
          onClick={handleSubmit}
          disabled={isCreating() || !projectName().trim()}
          class='inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-md transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400'
        >
          {isCreating() ? 'Creating...' : 'Create Project'}
        </button>
        <button
          onClick={handleCancel}
          class='rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:border-blue-300 hover:text-blue-600'
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
