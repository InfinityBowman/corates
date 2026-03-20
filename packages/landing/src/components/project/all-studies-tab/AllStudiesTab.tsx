/**
 * AllStudiesTab - All studies as expandable cards with add studies form
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { BookOpenIcon } from 'lucide-react';
import { AddStudiesForm } from '../add-studies/AddStudiesForm';
import { GoogleDrivePickerModal } from '../google-drive/GoogleDrivePickerModal';
import { StudyCard } from './study-card/StudyCard';
import { AssignReviewersModal } from './AssignReviewersModal';
import { ReviewerAssignment } from '../overview-tab/ReviewerAssignment';
import { OutcomeManager } from '../outcomes/OutcomeManager';
import {
  useProjectStore,
  selectStudies,
  selectMembers,
  selectConnectionState,
} from '@/stores/projectStore';
import _projectActionsStore from '@/stores/projectActionsStore/index.js';
import { useProjectContext } from '../ProjectContext';
import {
  saveFormState,
  getFormState,
  clearFormState,
  getRestoreParamsFromUrl,
  clearRestoreParamsFromUrl,
} from '@/lib/formStatePersistence.js';

const projectActionsStore = _projectActionsStore as any;

export function AllStudiesTab() {
  const { projectId, getMember, isOwner } = useProjectContext();

  const [showGoogleDriveModal, setShowGoogleDriveModal] = useState(false);
  const [googleDriveTargetStudyId, setGoogleDriveTargetStudyId] = useState<string | null>(null);
  const [restoredState, setRestoredState] = useState<any>(null);
  const [expandedStudies, setExpandedStudies] = useState<Set<string>>(new Set());
  const [showReviewersModal, setShowReviewersModal] = useState(false);
  const [editingStudy, setEditingStudy] = useState<any>(null);

  const studies = useProjectStore(s => selectStudies(s, projectId));
  const members = useProjectStore(s => selectMembers(s, projectId));
  const connectionState = useProjectStore(s => selectConnectionState(s, projectId));
  const hasData = connectionState.synced || studies.length > 0;

  // Restore state after OAuth redirect
  useEffect(() => {
    let cancelled = false;
    const restoreParams = getRestoreParamsFromUrl();
    if (restoreParams?.type === 'addStudies' && restoreParams.projectId === projectId) {
      (async () => {
        try {
          const savedState = await getFormState('addStudies', projectId);
          if (!cancelled && savedState) {
            setRestoredState(savedState);
            await clearFormState('addStudies', projectId);
            // Clear after next render so AddStudiesForm can consume it once
            setTimeout(() => setRestoredState(null), 0);
          }
        } catch (err) {
          console.error('Failed to restore form state:', err);
        }
        if (!cancelled) clearRestoreParamsFromUrl();
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleSaveState = useCallback(
    async (state: any) => {
      await saveFormState('addStudies', state, projectId);
    },
    [projectId],
  );

  const unassignedStudies = useMemo(
    () => studies.filter((s: any) => !s.reviewer1 && !s.reviewer2),
    [studies],
  );

  const shouldShowReviewerAssignment =
    isOwner && studies.length > 0 && unassignedStudies.length > 0;

  const handleAssignReviewers = useCallback((studyId: string, updates: any) => {
    projectActionsStore.study.update(studyId, updates);
  }, []);

  const handleAddStudies = useCallback(async (studiesToAdd: any[]) => {
    await projectActionsStore.study.addBatch(studiesToAdd);
  }, []);

  const handleOpenGoogleDrive = useCallback((studyId: string) => {
    setGoogleDriveTargetStudyId(studyId);
    setShowGoogleDriveModal(true);
  }, []);

  const handleGoogleDriveImportSuccess = useCallback(
    (file: any, studyId: string) => {
      const targetStudyId = studyId || googleDriveTargetStudyId;
      if (!targetStudyId) return;
      projectActionsStore.pdf.handleGoogleDriveImport(targetStudyId, file);
    },
    [googleDriveTargetStudyId],
  );

  const toggleStudyExpanded = useCallback((studyId: string) => {
    setExpandedStudies(prev => {
      const next = new Set(prev);
      if (next.has(studyId)) next.delete(studyId);
      else next.add(studyId);
      return next;
    });
  }, []);

  return (
    <div>
      {hasData && (
        <AddStudiesForm
          projectId={projectId}
          formType='addStudies'
          initialState={restoredState}
          onSaveState={handleSaveState}
          onAddStudies={handleAddStudies}
        />
      )}

      {hasData && (
        <div className='mt-5'>
          <OutcomeManager />
        </div>
      )}

      {shouldShowReviewerAssignment && (
        <div className='mt-5'>
          <ReviewerAssignment
            studies={studies}
            members={members}
            onAssignReviewers={handleAssignReviewers}
          />
        </div>
      )}

      {!hasData && (
        <div className='bg-muted rounded-lg py-12 text-center'>
          <p className='text-muted-foreground/70'>Loading studies...</p>
        </div>
      )}

      <div className='mt-6 mb-3 flex items-center justify-between'>
        <p className='text-muted-foreground text-sm'>
          {studies.length} {studies.length === 1 ? 'study' : 'studies'} in this project
        </p>
      </div>

      {studies.length > 0 ?
        <div className='space-y-3'>
          {studies.map((study: any) => (
            <StudyCard
              key={study.id}
              study={study}
              expanded={expandedStudies.has(study.id)}
              onToggleExpanded={() => toggleStudyExpanded(study.id)}
              getMember={getMember}
              onAssignReviewers={(s: any) => {
                setEditingStudy(s);
                setShowReviewersModal(true);
              }}
              onOpenGoogleDrive={handleOpenGoogleDrive}
            />
          ))}
        </div>
      : hasData && (
          <div className='bg-muted rounded-lg py-12 text-center'>
            <BookOpenIcon className='text-muted-foreground/50 mx-auto mb-4 size-12' />
            <p className='text-muted-foreground'>
              No studies added yet. Add your first study above.
            </p>
          </div>
        )
      }

      <GoogleDrivePickerModal
        open={showGoogleDriveModal}
        onClose={() => {
          setShowGoogleDriveModal(false);
          setGoogleDriveTargetStudyId(null);
        }}
        projectId={projectId}
        studyId={googleDriveTargetStudyId}
        onImportSuccess={handleGoogleDriveImportSuccess}
      />

      <AssignReviewersModal
        open={showReviewersModal}
        onOpenChange={open => {
          if (!open) {
            setShowReviewersModal(false);
            setEditingStudy(null);
          }
        }}
        study={editingStudy}
        projectId={projectId}
        onSave={(studyId: string, updates: any) => {
          projectActionsStore.study.update(studyId, updates);
        }}
      />
    </div>
  );
}
