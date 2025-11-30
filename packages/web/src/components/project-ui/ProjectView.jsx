import { createSignal, createEffect, createMemo, For, Show, onCleanup } from 'solid-js';
import { useParams, useNavigate, useLocation } from '@solidjs/router';
import useProject from '@primitives/useProject.js';
import projectStore from '@primitives/projectStore.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { uploadPdf, getPdfUrl } from '@api/pdf-api.js';
import { API_BASE } from '@config/api.js';
import StudyCard from './StudyCard.jsx';
import StudyForm from './StudyForm.jsx';
import AddMemberModal from './AddMemberModal.jsx';
import ChartSection from './ChartSection.jsx';

export default function ProjectView() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useBetterAuth();

  const [error, setError] = createSignal(null);

  // Study form state
  const [showStudyForm, setShowStudyForm] = createSignal(false);
  const [creatingStudy, setCreatingStudy] = createSignal(false);

  // Checklist form state
  const [showChecklistForm, setShowChecklistForm] = createSignal(null); // studyId or null
  const [creatingChecklist, setCreatingChecklist] = createSignal(false);

  // Add member modal state
  const [showAddMemberModal, setShowAddMemberModal] = createSignal(false);

  // Use Y.js hook for write operations and connection management
  const {
    createStudy,
    updateStudy,
    createChecklist,
    updateChecklist,
    deleteStudy,
    deleteChecklist,
    getChecklistData,
    connect,
    disconnect,
    error: yjsError,
  } = useProject(params.projectId);

  // Read data directly from the store for faster reactivity
  const studies = () => projectStore.getStudies(params.projectId);
  const members = () => projectStore.getMembers(params.projectId);
  const meta = () => projectStore.getMeta(params.projectId);
  const connectionState = () => projectStore.getConnectionState(params.projectId);

  // Check if we have cached data (either synced or previously loaded)
  const hasData = () => connectionState().synced || studies().length > 0;

  // Derive current user's role from the members list
  const userRole = createMemo(() => {
    const currentUser = user();
    if (!currentUser) return null;
    const member = members().find(m => m.userId === currentUser.id);
    return member?.role || null;
  });

  // Connect to Y.js on mount
  createEffect(() => {
    if (params.projectId) {
      connect();
    }
  });

  // Track if we've processed pending PDFs (to avoid re-processing on re-renders)
  let pendingPdfsProcessed = false;

  // Process pending PDFs from project creation (passed via navigation state)
  // Only process if we have navigation state with pendingPdfs - this won't persist on refresh
  createEffect(() => {
    const state = connectionState();
    // Wait for connected (not just synced) since createStudy requires connection
    if (!state.connected || !params.projectId || pendingPdfsProcessed) return;

    // Access location state - in SolidJS Router, location is reactive
    const navState = location.state;
    const pendingPdfs = navState?.pendingPdfs;

    if (!Array.isArray(pendingPdfs) || pendingPdfs.length === 0) return;

    // Mark as processed to prevent re-processing
    pendingPdfsProcessed = true;

    // Clear the navigation state to prevent any possibility of re-processing
    // by replacing the current history entry without the state
    window.history.replaceState({}, '', window.location.pathname);

    // Process each PDF - create study and upload
    for (const pdf of pendingPdfs) {
      const studyId = createStudy(pdf.title, '');
      if (studyId && pdf.data) {
        // Convert array back to ArrayBuffer for upload
        const arrayBuffer = new Uint8Array(pdf.data).buffer;
        uploadPdf(params.projectId, studyId, arrayBuffer, pdf.fileName).catch(err => {
          console.error('Error uploading PDF for new study:', err);
        });
      }
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    disconnect();
  });

  // Create a new study via Y.js
  const handleCreateStudy = async (name, description, pdfData = null, pdfFileName = null) => {
    setCreatingStudy(true);
    try {
      const studyId = createStudy(name, description);

      // If PDF data was provided, upload it to R2
      if (pdfData && studyId) {
        try {
          await uploadPdf(params.projectId, studyId, pdfData, pdfFileName);
        } catch (uploadErr) {
          console.error('Error uploading PDF:', uploadErr);
          // Study was created, but PDF upload failed - show warning but don't fail
          alert('Study created, but PDF upload failed. You can try uploading again later.');
        }
      }

      setShowStudyForm(false);
    } catch (err) {
      console.error('Error creating study:', err);
      alert('Failed to create study');
    } finally {
      setCreatingStudy(false);
    }
  };

  // Create a new checklist in a study via Y.js
  const handleCreateChecklist = async (studyId, type, assigneeId) => {
    setCreatingChecklist(true);
    try {
      createChecklist(studyId, type, assigneeId);
      setShowChecklistForm(null);
    } catch (err) {
      console.error('Error creating checklist:', err);
      alert('Failed to create checklist');
    } finally {
      setCreatingChecklist(false);
    }
  };

  // Delete a study
  const handleDeleteStudy = async studyId => {
    if (
      !confirm(
        'Are you sure you want to delete this study? This will also delete all checklists in it.',
      )
    ) {
      return;
    }
    try {
      deleteStudy(studyId);
    } catch (err) {
      console.error('Error deleting study:', err);
      alert('Failed to delete study');
    }
  };

  // Update a study name
  const handleUpdateStudy = (studyId, updates) => {
    try {
      updateStudy(studyId, updates);
    } catch (err) {
      console.error('Error updating study:', err);
      alert('Failed to update study');
    }
  };

  // Delete a checklist
  const handleDeleteChecklist = async (studyId, checklistId) => {
    if (!confirm('Are you sure you want to delete this checklist?')) {
      return;
    }
    try {
      deleteChecklist(studyId, checklistId);
    } catch (err) {
      console.error('Error deleting checklist:', err);
      alert('Failed to delete checklist');
    }
  };

  // Update a checklist (e.g., change assignee)
  const handleUpdateChecklist = (studyId, checklistId, updates) => {
    try {
      updateChecklist(studyId, checklistId, updates);
    } catch (err) {
      console.error('Error updating checklist:', err);
      alert('Failed to update checklist');
    }
  };

  // Delete the entire project
  const handleDeleteProject = async () => {
    if (
      !confirm('Are you sure you want to delete this entire project? This action cannot be undone.')
    ) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/projects/${params.projectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete project');
      }
      // Remove from the store so dashboard updates immediately
      projectStore.removeProjectFromList(params.projectId);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Error deleting project:', err);
      alert(err.message || 'Failed to delete project');
    }
  };

  // View a PDF in a new tab
  const handleViewPdf = (studyId, pdf) => {
    if (!pdf || !pdf.fileName) return;
    const url = getPdfUrl(params.projectId, studyId, pdf.fileName);
    window.open(url, '_blank');
  };

  // Upload/change a PDF for a study
  const handleUploadPdf = async (studyId, file) => {
    try {
      await uploadPdf(params.projectId, studyId, file, file.name);
    } catch (err) {
      console.error('Error uploading PDF:', err);
      throw err; // Re-throw so StudyCard can show the error
    }
  };

  // Open checklist for editing
  const openChecklist = (studyId, checklistId) => {
    navigate(`/projects/${params.projectId}/studies/${studyId}/checklists/${checklistId}`);
  };

  // Open reconciliation view for two checklists
  const openReconciliation = (studyId, checklist1Id, checklist2Id) => {
    navigate(
      `/projects/${params.projectId}/studies/${studyId}/reconcile/${checklist1Id}/${checklist2Id}`,
    );
  };

  // Get assignee name from members list
  const getAssigneeName = userId => {
    if (!userId) return 'Unassigned';
    const member = members().find(m => m.userId === userId);
    return member?.displayName || member?.name || member?.email || 'Unknown';
  };

  // Check if current user is owner
  const isOwner = () => userRole() === 'owner';

  return (
    <div class='p-6 max-w-4xl mx-auto'>
      <Show when={error() || yjsError()}>
        <div class='bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4'>
          Error: {error() || yjsError()}
        </div>
      </Show>

      {/* Project Header */}
      <div class='mb-8'>
        <div class='flex items-center gap-4 mb-2'>
          <button
            onClick={() => navigate('/dashboard')}
            class='text-gray-400 hover:text-gray-700 transition-colors'
          >
            <svg class='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M15 19l-7-7 7-7'
              />
            </svg>
          </button>
          <Show when={meta()?.name}>
            <h1 class='text-2xl font-bold text-gray-900'>{meta().name}</h1>
          </Show>
          <Show when={userRole()}>
            <span class='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize'>
              {userRole()}
            </span>
          </Show>
          <Show when={connectionState().connected}>
            <span class='flex items-center gap-1 text-green-600 text-sm'>
              <div class='w-2 h-2 bg-green-500 rounded-full' />
              Synced
            </span>
          </Show>
          <div class='flex-1' />
          <Show when={isOwner()}>
            <button
              onClick={handleDeleteProject}
              class='inline-flex items-center px-3 py-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors gap-1.5'
              title='Delete Project'
            >
              <svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                />
              </svg>
              Delete Project
            </button>
          </Show>
        </div>
        <Show when={meta()?.description}>
          <p class='text-gray-500 ml-10'>{meta().description}</p>
        </Show>
      </div>

      {/* Studies Section */}
      <div class='space-y-6'>
        <div class='flex items-center justify-between'>
          <h2 class='text-xl font-bold text-gray-900'>Studies</h2>
          <button
            onClick={() => setShowStudyForm(true)}
            class='inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg gap-2'
          >
            <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M12 4v16m8-8H4'
              />
            </svg>
            New Study
          </button>
        </div>

        {/* Create Study Form */}
        <Show when={showStudyForm()}>
          <StudyForm
            onSubmit={handleCreateStudy}
            onCancel={() => setShowStudyForm(false)}
            loading={creatingStudy()}
          />
        </Show>

        {/* Studies List */}
        <Show
          when={studies().length > 0}
          fallback={
            <Show
              when={hasData()}
              fallback={
                <div class='text-center py-12 bg-white rounded-lg border border-gray-200'>
                  <p class='text-gray-400'>Loading studies...</p>
                </div>
              }
            >
              <div class='text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300'>
                <p class='text-gray-500 mb-4'>No studies yet</p>
                <button
                  onClick={() => setShowStudyForm(true)}
                  class='text-blue-600 hover:text-blue-700 font-medium'
                >
                  Create your first study
                </button>
              </div>
            </Show>
          }
        >
          <div class='space-y-4'>
            <For each={studies()}>
              {study => (
                <StudyCard
                  study={study}
                  members={members()}
                  projectId={params.projectId}
                  showChecklistForm={showChecklistForm() === study.id}
                  onToggleChecklistForm={() =>
                    setShowChecklistForm(prev => (prev === study.id ? null : study.id))
                  }
                  onAddChecklist={(type, assigneeId) =>
                    handleCreateChecklist(study.id, type, assigneeId)
                  }
                  onOpenChecklist={checklistId => openChecklist(study.id, checklistId)}
                  onReconcile={(checklist1Id, checklist2Id) =>
                    openReconciliation(study.id, checklist1Id, checklist2Id)
                  }
                  onViewPdf={pdf => handleViewPdf(study.id, pdf)}
                  onUploadPdf={file => handleUploadPdf(study.id, file)}
                  onUpdateStudy={updates => handleUpdateStudy(study.id, updates)}
                  onDeleteStudy={() => handleDeleteStudy(study.id)}
                  onUpdateChecklist={(checklistId, updates) =>
                    handleUpdateChecklist(study.id, checklistId, updates)
                  }
                  onDeleteChecklist={checklistId => handleDeleteChecklist(study.id, checklistId)}
                  getAssigneeName={getAssigneeName}
                  creatingChecklist={creatingChecklist()}
                />
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Charts Section */}
      <div class='mt-8'>
        <h2 class='text-xl font-bold text-gray-900 mb-4'>Quality Assessment Charts</h2>
        <ChartSection studies={studies} members={members} getChecklistData={getChecklistData} />
      </div>

      {/* Members Section */}
      <div class='mt-8'>
        <div class='flex items-center justify-between mb-4'>
          <h2 class='text-xl font-bold text-gray-900'>Project Members</h2>
          <Show when={isOwner()}>
            <button
              onClick={() => setShowAddMemberModal(true)}
              class='inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors gap-1.5'
            >
              <svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M12 4v16m8-8H4'
                />
              </svg>
              Add Member
            </button>
          </Show>
        </div>
        <Show when={members().length > 0}>
          <div class='bg-white border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200'>
            <For each={members()}>
              {member => (
                <div class='p-4 flex items-center justify-between'>
                  <div class='flex items-center gap-3'>
                    <div class='w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium'>
                      {(member.displayName || member.name || member.email || '?')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div>
                      <p class='text-gray-900 font-medium'>
                        {member.displayName || member.name || 'Unknown'}
                      </p>
                      <p class='text-gray-500 text-sm'>{member.email}</p>
                    </div>
                  </div>
                  <span class='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize'>
                    {member.role}
                  </span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={showAddMemberModal()}
        onClose={() => setShowAddMemberModal(false)}
        projectId={params.projectId}
      />
    </div>
  );
}
