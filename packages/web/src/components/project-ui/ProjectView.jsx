import { createSignal, createEffect, createMemo, Show, onCleanup, batch } from 'solid-js';
import { useParams, useNavigate, useLocation } from '@solidjs/router';
import useProject from '@primitives/useProject.js';
import projectStore from '@primitives/projectStore.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { uploadPdf, deletePdf, getPdfUrl } from '@api/pdf-api.js';
import { cachePdf, removeCachedPdf, getCachedPdf } from '@primitives/pdfCache.js';
import { API_BASE } from '@config/api.js';
import AddMemberModal from './AddMemberModal.jsx';
import ProjectHeader from './ProjectHeader.jsx';
import { useConfirmDialog } from '@components/zag/Dialog.jsx';
import { showToast } from '@components/zag/Toast.jsx';
import { Tabs } from '@components/zag/Tabs.jsx';
import { BiRegularHome } from 'solid-icons/bi';
import { BsListTask } from 'solid-icons/bs';
import { CgArrowsExchange } from 'solid-icons/cg';
import { AiFillCheckCircle, AiOutlineBook } from 'solid-icons/ai';

// Tab components
import OverviewTab from './tabs/OverviewTab.jsx';
import IncludedStudiesTab from './tabs/IncludedStudiesTab.jsx';
import InProgressTab from './tabs/InProgressTab.jsx';
import ReadyToReconcileTab from './tabs/ReadyToReconcileTab.jsx';
import CompletedTab from './tabs/CompletedTab.jsx';
import ReferenceImportModal from './ReferenceImportModal.jsx';

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
  const [showChecklistForm, setShowChecklistForm] = createSignal(null);
  const [creatingChecklist, setCreatingChecklist] = createSignal(false);

  // Add member modal state
  const [showAddMemberModal, setShowAddMemberModal] = createSignal(false);

  // Reference import modal state
  const [showReferenceImportModal, setShowReferenceImportModal] = createSignal(false);

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

  // Check if current user is owner
  const isOwner = () => userRole() === 'owner';

  // Connect to Y.js on mount
  createEffect(() => {
    if (params.projectId) {
      connect();
    }
  });

  // Store pending PDFs from navigation state in a signal (captured on mount)
  const [pendingPdfs, setPendingPdfs] = createSignal(location.state?.pendingPdfs || null);
  const [pendingRefs, setPendingRefs] = createSignal(location.state?.pendingRefs || null);

  // Process pending PDFs from project creation (passed via navigation state)
  createEffect(() => {
    const state = connectionState();
    const pdfs = pendingPdfs();

    if (!state.synced || !params.projectId) return;
    if (!Array.isArray(pdfs) || pdfs.length === 0) return;

    batch(() => {
      setPendingPdfs(null);
      window.history.replaceState({}, '', window.location.pathname);
    });

    for (const pdf of pdfs) {
      const studyId = createStudy(pdf.title, '');
      if (studyId && pdf.data) {
        const arrayBuffer = new Uint8Array(pdf.data).buffer;
        uploadPdf(params.projectId, studyId, arrayBuffer, pdf.fileName)
          .then(result => {
            cachePdf(params.projectId, studyId, result.fileName, arrayBuffer).catch(err =>
              console.warn('Failed to cache PDF:', err),
            );
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

  // Process pending references from project creation (passed via navigation state)
  createEffect(() => {
    const state = connectionState();
    const refs = pendingRefs();

    if (!state.synced || !params.projectId) return;
    if (!Array.isArray(refs) || refs.length === 0) return;

    batch(() => {
      setPendingRefs(null);
      window.history.replaceState({}, '', window.location.pathname);
    });

    for (const ref of refs) {
      createStudy(ref.title, ref.metadata?.abstract || '', ref.metadata || {});
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    disconnect();
  });

  // Get assignee name from members list
  const getAssigneeName = userId => {
    if (!userId) return 'Unassigned';
    const member = members().find(m => m.userId === userId);
    return member?.displayName || member?.name || member?.email || 'Unknown';
  };

  // ============ Handlers ============

  const handleCreateStudy = async (
    name,
    description,
    pdfData = null,
    pdfFileName = null,
    metadata = {},
  ) => {
    setCreatingStudy(true);
    try {
      const studyId = createStudy(name, description, metadata);
      if (pdfData && studyId) {
        try {
          const result = await uploadPdf(params.projectId, studyId, pdfData, pdfFileName);
          // Cache the PDF locally
          cachePdf(params.projectId, studyId, result.fileName, pdfData).catch(err =>
            console.warn('Failed to cache PDF:', err),
          );
          // Store PDF metadata in Y.js document
          addPdfToStudy(studyId, {
            key: result.key,
            fileName: result.fileName,
            size: result.size,
            uploadedBy: user()?.id,
            uploadedAt: Date.now(),
          });
        } catch (uploadErr) {
          console.error('Error uploading PDF:', uploadErr);
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

  // Handle importing references from Zotero/EndNote files
  const handleImportReferences = references => {
    let successCount = 0;
    for (const ref of references) {
      try {
        createStudy(ref.title, ref.abstract || '', {
          firstAuthor: ref.firstAuthor,
          publicationYear: ref.publicationYear,
          authors: ref.authors,
          journal: ref.journal,
          doi: ref.doi,
          abstract: ref.abstract,
          importSource: 'reference-file',
        });
        successCount++;
      } catch (err) {
        console.error('Error importing reference:', err);
      }
    }
    if (successCount > 0) {
      showToast.success(
        'Import Complete',
        `Successfully imported ${successCount} ${successCount === 1 ? 'study' : 'studies'}.`,
      );
    }
    setShowReferenceImportModal(false);
  };

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

  const handleUpdateStudy = (studyId, updates) => {
    try {
      updateStudy(studyId, updates);
    } catch (err) {
      console.error('Error updating study:', err);
      showToast.error('Update Failed', 'Failed to update study');
    }
  };

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

  const handleUpdateChecklist = (studyId, checklistId, updates) => {
    try {
      updateChecklist(studyId, checklistId, updates);
    } catch (err) {
      console.error('Error updating checklist:', err);
      showToast.error('Update Failed', 'Failed to update checklist');
    }
  };

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
      projectStore.removeProjectFromList(params.projectId);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Error deleting project:', err);
      showToast.error('Delete Failed', err.message || 'Failed to delete project');
    }
  };

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

  const handleViewPdf = async (studyId, pdf) => {
    if (!pdf || !pdf.fileName) return;

    const cachedData = await getCachedPdf(params.projectId, studyId, pdf.fileName);
    if (cachedData) {
      const blob = new Blob([cachedData], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }

    const url = getPdfUrl(params.projectId, studyId, pdf.fileName);
    window.open(url, '_blank');
  };

  const handleUploadPdf = async (studyId, file) => {
    try {
      const study = studies().find(s => s.id === studyId);
      if (study?.pdfs?.length > 0) {
        for (const existingPdf of study.pdfs) {
          try {
            await deletePdf(params.projectId, studyId, existingPdf.fileName);
            removePdfFromStudy(studyId, existingPdf.fileName);
            removeCachedPdf(params.projectId, studyId, existingPdf.fileName).catch(err =>
              console.warn('Failed to remove PDF from cache:', err),
            );
          } catch (deleteErr) {
            console.warn('Failed to delete old PDF:', deleteErr);
          }
        }
      }

      const result = await uploadPdf(params.projectId, studyId, file, file.name);

      const arrayBuffer = await file.arrayBuffer();
      cachePdf(params.projectId, studyId, result.fileName, arrayBuffer).catch(err =>
        console.warn('Failed to cache PDF:', err),
      );

      addPdfToStudy(studyId, {
        key: result.key,
        fileName: result.fileName,
        size: result.size,
        uploadedBy: user()?.id,
        uploadedAt: Date.now(),
      });
    } catch (err) {
      console.error('Error uploading PDF:', err);
      throw err;
    }
  };

  const openChecklist = (studyId, checklistId) => {
    navigate(`/projects/${params.projectId}/studies/${studyId}/checklists/${checklistId}`);
  };

  const openReconciliation = (studyId, checklist1Id, checklist2Id) => {
    navigate(
      `/projects/${params.projectId}/studies/${studyId}/reconcile/${checklist1Id}/${checklist2Id}`,
    );
  };

  // Tab definitions with icons
  const tabDefinitions = createMemo(() => [
    {
      value: 'overview',
      label: 'Overview',
      icon: <BiRegularHome class='w-4 h-4' />,
    },
    {
      value: 'included-studies',
      label: 'Included Studies',
      icon: <AiOutlineBook class='w-4 h-4' />,
      count: studies().length,
    },
    {
      value: 'in-progress',
      label: 'In Progress',
      icon: <BsListTask class='w-4 h-4' />,
    },
    {
      value: 'ready-to-reconcile',
      label: 'Ready to Reconcile',
      icon: <CgArrowsExchange class='w-4 h-4' />,
    },
    {
      value: 'completed',
      label: 'Completed',
      icon: <AiFillCheckCircle class='w-4 h-4' />,
    },
  ]);

  return (
    <div class='p-6 max-w-4xl mx-auto'>
      <ProjectHeader
        name={meta()?.name}
        description={meta()?.description}
        userRole={userRole()}
        isConnected={connectionState().connected}
        isOwner={isOwner()}
        onBack={() => navigate('/dashboard')}
        onDeleteProject={handleDeleteProject}
      />

      <Tabs tabs={tabDefinitions()} defaultValue='overview'>
        {tabValue => (
          <>
            <Show when={tabValue === 'overview'}>
              <OverviewTab
                studies={studies}
                members={members}
                isOwner={isOwner}
                currentUserId={user()?.id}
                getChecklistData={getChecklistData}
                onAddMember={() => setShowAddMemberModal(true)}
                onRemoveMember={handleRemoveMember}
                onAssignReviewers={handleUpdateStudy}
              />
            </Show>

            <Show when={tabValue === 'included-studies'}>
              <IncludedStudiesTab
                studies={studies}
                getAssigneeName={getAssigneeName}
                hasData={hasData}
                showStudyForm={showStudyForm}
                creatingStudy={creatingStudy}
                onSetShowStudyForm={setShowStudyForm}
                onCreateStudy={handleCreateStudy}
                onOpenImportModal={() => setShowReferenceImportModal(true)}
              />
            </Show>

            <Show when={tabValue === 'in-progress'}>
              <InProgressTab
                studies={studies}
                members={members}
                projectId={params.projectId}
                currentUserId={user()?.id}
                hasData={hasData}
                showStudyForm={showStudyForm}
                creatingStudy={creatingStudy}
                showChecklistForm={showChecklistForm}
                creatingChecklist={creatingChecklist}
                getAssigneeName={getAssigneeName}
                onSetShowStudyForm={setShowStudyForm}
                onSetShowChecklistForm={setShowChecklistForm}
                onCreateStudy={handleCreateStudy}
                onCreateChecklist={handleCreateChecklist}
                onUpdateStudy={handleUpdateStudy}
                onDeleteStudy={handleDeleteStudy}
                onUpdateChecklist={handleUpdateChecklist}
                onDeleteChecklist={handleDeleteChecklist}
                onOpenChecklist={openChecklist}
                onOpenReconciliation={openReconciliation}
                onViewPdf={handleViewPdf}
                onUploadPdf={handleUploadPdf}
                onOpenImportModal={() => setShowReferenceImportModal(true)}
              />
            </Show>

            <Show when={tabValue === 'ready-to-reconcile'}>
              <ReadyToReconcileTab />
            </Show>

            <Show when={tabValue === 'completed'}>
              <CompletedTab />
            </Show>
          </>
        )}
      </Tabs>

      <AddMemberModal
        isOpen={showAddMemberModal()}
        onClose={() => setShowAddMemberModal(false)}
        projectId={params.projectId}
      />

      <ReferenceImportModal
        open={showReferenceImportModal()}
        onClose={() => setShowReferenceImportModal(false)}
        onImport={handleImportReferences}
      />

      <confirmDialog.ConfirmDialogComponent />
    </div>
  );
}
