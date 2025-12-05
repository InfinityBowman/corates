import { createSignal, createEffect, createMemo, For, Show, onCleanup, batch } from 'solid-js';
import { useParams, useNavigate, useLocation } from '@solidjs/router';
import useProject from '@primitives/useProject.js';
import projectStore from '@primitives/projectStore.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { uploadPdf, deletePdf, getPdfUrl } from '@api/pdf-api.js';
import { cachePdf, removeCachedPdf, getCachedPdf } from '@primitives/pdfCache.js';
import { API_BASE } from '@config/api.js';
import StudyCard from './StudyCard.jsx';
import StudyForm from './StudyForm.jsx';
import AddMemberModal from './AddMemberModal.jsx';
import ChartSection from './ChartSection.jsx';
import { useConfirmDialog } from '@components/zag/Dialog.jsx';
import { showToast } from '@components/zag/Toast.jsx';

export default function ProjectView() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useBetterAuth();

  // Confirm dialog for destructive actions
  const confirmDialog = useConfirmDialog();

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
    addPdfToStudy,
    removePdfFromStudy,
    getChecklistData,
    connect,
    disconnect,
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

  // Store pending PDFs from navigation state in a signal (captured on mount)
  const [pendingPdfs, setPendingPdfs] = createSignal(location.state?.pendingPdfs || null);

  // Process pending PDFs from project creation (passed via navigation state)
  createEffect(() => {
    const state = connectionState();
    const pdfs = pendingPdfs();

    // Wait for synced (not just connected) since createStudy requires Y.js to be synced
    if (!state.synced || !params.projectId) return;
    if (!Array.isArray(pdfs) || pdfs.length === 0) return;

    // Clear state immediately and atomically to prevent re-processing
    // Use batch to prevent the setter from triggering another effect run
    batch(() => {
      setPendingPdfs(null);
      window.history.replaceState({}, '', window.location.pathname);
    });

    // Process each PDF - create study and upload
    for (const pdf of pdfs) {
      const studyId = createStudy(pdf.title, '');
      if (studyId && pdf.data) {
        // Convert array back to ArrayBuffer for upload
        const arrayBuffer = new Uint8Array(pdf.data).buffer;
        uploadPdf(params.projectId, studyId, arrayBuffer, pdf.fileName)
          .then(result => {
            // Cache the PDF locally for faster access
            cachePdf(params.projectId, studyId, result.fileName, arrayBuffer).catch(err =>
              console.warn('Failed to cache PDF:', err),
            );
            // After successful upload, add PDF metadata to Y.js (syncs to other clients)
            addPdfToStudy(studyId, {
              key: result.key,
              fileName: result.fileName,
              size: result.size,
              uploadedBy: user()?.id,
              uploadedAt: Date.now(),
            });
          })
          .catch(err => {
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
          showToast.error(
            'PDF Upload Failed',
            'Study created, but PDF upload failed. You can try uploading again later.',
          );
        }
      }

      setShowStudyForm(false);
    } catch (err) {
      console.error('Error creating study:', err);
      showToast.error('Addition Failed', 'Failed to add study');
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
      console.error('Error adding checklist:', err);
      showToast.error('Addition Failed', 'Failed to add checklist');
    } finally {
      setCreatingChecklist(false);
    }
  };

  // Delete a study
  const handleDeleteStudy = async studyId => {
    const confirmed = await confirmDialog.open({
      title: 'Delete Study',
      description:
        'Are you sure you want to delete this study? This will also delete all checklists in it.',
      confirmText: 'Delete Study',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      deleteStudy(studyId);
    } catch (err) {
      console.error('Error deleting study:', err);
      showToast.error('Delete Failed', 'Failed to delete study');
    }
  };

  // Update a study name
  const handleUpdateStudy = (studyId, updates) => {
    try {
      updateStudy(studyId, updates);
    } catch (err) {
      console.error('Error updating study:', err);
      showToast.error('Update Failed', 'Failed to update study');
    }
  };

  // Delete a checklist
  const handleDeleteChecklist = async (studyId, checklistId) => {
    const confirmed = await confirmDialog.open({
      title: 'Delete Checklist',
      description: 'Are you sure you want to delete this checklist?',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      deleteChecklist(studyId, checklistId);
    } catch (err) {
      console.error('Error deleting checklist:', err);
      showToast.error('Delete Failed', 'Failed to delete checklist');
    }
  };

  // Update a checklist (e.g., change assignee)
  const handleUpdateChecklist = (studyId, checklistId, updates) => {
    try {
      updateChecklist(studyId, checklistId, updates);
    } catch (err) {
      console.error('Error updating checklist:', err);
      showToast.error('Update Failed', 'Failed to update checklist');
    }
  };

  // Delete the entire project
  const handleDeleteProject = async () => {
    const confirmed = await confirmDialog.open({
      title: 'Delete Project',
      description:
        'Are you sure you want to delete this entire project? This action cannot be undone.',
      confirmText: 'Delete Project',
      variant: 'danger',
    });
    if (!confirmed) return;

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
      showToast.error('Delete Failed', err.message || 'Failed to delete project');
    }
  };

  // Remove a member from the project
  const handleRemoveMember = async (memberId, memberName) => {
    const currentUser = user();
    const isSelf = currentUser?.id === memberId;

    const confirmed = await confirmDialog.open({
      title: isSelf ? 'Leave Project' : 'Remove Member',
      description:
        isSelf ?
          'Are you sure you want to leave this project? You will need to be re-invited to rejoin.'
        : `Are you sure you want to remove ${memberName} from this project?`,
      confirmText: isSelf ? 'Leave Project' : 'Remove',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${params.projectId}/members/${memberId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      if (isSelf) {
        // If user removed themselves, navigate away
        projectStore.removeProjectFromList(params.projectId);
        navigate('/dashboard', { replace: true });
        showToast.success('Left Project', 'You have left the project');
      } else {
        showToast.success('Member Removed', `${memberName} has been removed from the project`);
      }
    } catch (err) {
      console.error('Error removing member:', err);
      showToast.error('Remove Failed', err.message || 'Failed to remove member');
    }
  };

  // View a PDF - try cache first for offline support, fall back to URL
  const handleViewPdf = async (studyId, pdf) => {
    if (!pdf || !pdf.fileName) return;

    // Try to get from cache first (works offline)
    const cachedData = await getCachedPdf(params.projectId, studyId, pdf.fileName);
    if (cachedData) {
      // Create a blob URL from cached data and open it
      const blob = new Blob([cachedData], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      // Clean up blob URL after a delay (browser needs time to load it)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }

    // Fall back to direct URL (requires network)
    const url = getPdfUrl(params.projectId, studyId, pdf.fileName);
    window.open(url, '_blank');
  };

  // Upload/change a PDF for a study
  const handleUploadPdf = async (studyId, file) => {
    try {
      // Find the study and remove any existing PDFs first
      const study = studies().find(s => s.id === studyId);
      if (study?.pdfs?.length > 0) {
        // Remove all existing PDFs (both from R2, Y.js, and local cache)
        for (const existingPdf of study.pdfs) {
          try {
            await deletePdf(params.projectId, studyId, existingPdf.fileName);
            removePdfFromStudy(studyId, existingPdf.fileName);
            // Also remove from local cache
            removeCachedPdf(params.projectId, studyId, existingPdf.fileName).catch(err =>
              console.warn('Failed to remove PDF from cache:', err),
            );
          } catch (deleteErr) {
            console.warn('Failed to delete old PDF:', deleteErr);
            // Continue anyway - the new PDF will still be uploaded
          }
        }
      }

      const result = await uploadPdf(params.projectId, studyId, file, file.name);

      // Cache the uploaded PDF locally for faster access
      const arrayBuffer = await file.arrayBuffer();
      cachePdf(params.projectId, studyId, result.fileName, arrayBuffer).catch(err =>
        console.warn('Failed to cache PDF:', err),
      );

      // After successful upload, add PDF metadata to Y.js
      addPdfToStudy(studyId, {
        key: result.key,
        fileName: result.fileName,
        size: result.size,
        uploadedBy: user()?.id,
        uploadedAt: Date.now(),
      });
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
        <h2 class='text-xl font-bold text-gray-900'>Studies</h2>

        {/* Always-visible Study Form / Drop Zone */}
        <Show
          when={hasData()}
          fallback={
            <div class='text-center py-12 bg-white rounded-lg border border-gray-200'>
              <p class='text-gray-400'>Loading studies...</p>
            </div>
          }
        >
          <StudyForm
            onSubmit={handleCreateStudy}
            onCancel={() => setShowStudyForm(false)}
            onExpand={() => setShowStudyForm(true)}
            expanded={showStudyForm()}
            loading={creatingStudy()}
            hasExistingStudies={studies().length > 0}
          />
        </Show>

        {/* Studies List */}
        <Show when={studies().length > 0}>
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
              {member => {
                const currentUser = user();
                const isSelf = currentUser?.id === member.userId;
                const canRemove = isOwner() || isSelf;
                // Check if this member is the last owner (can't remove)
                const isLastOwner =
                  member.role === 'owner' && members().filter(m => m.role === 'owner').length <= 1;

                return (
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
                          {isSelf && <span class='text-gray-400 ml-1'>(you)</span>}
                        </p>
                        <p class='text-gray-500 text-sm'>{member.email}</p>
                      </div>
                    </div>
                    <div class='flex items-center gap-2'>
                      <span class='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize'>
                        {member.role}
                      </span>
                      <Show when={canRemove && !isLastOwner}>
                        <button
                          onClick={() =>
                            handleRemoveMember(
                              member.userId,
                              member.displayName || member.name || member.email,
                            )
                          }
                          class='p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors'
                          title={isSelf ? 'Leave project' : 'Remove member'}
                        >
                          <svg
                            class='w-4 h-4'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              stroke-linecap='round'
                              stroke-linejoin='round'
                              stroke-width='2'
                              d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                            />
                          </svg>
                        </button>
                      </Show>
                    </div>
                  </div>
                );
              }}
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

      <confirmDialog.ConfirmDialogComponent />
    </div>
  );
}
