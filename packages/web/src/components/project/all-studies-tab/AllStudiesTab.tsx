/**
 * AllStudiesTab - All studies as expandable cards with add studies form
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { BookOpenIcon } from 'lucide-react';
import { AddStudiesForm, type AddStudiesFormState } from '../add-studies/AddStudiesForm';
import type { MergedStudy } from '@/hooks/useAddStudies/deduplication';
import { GoogleDrivePickerModal } from '../google-drive/GoogleDrivePickerModal';
import { StudyCard } from './study-card/StudyCard';
import { AssignReviewersModal } from './AssignReviewersModal';
import { ReviewerAssignment } from '../overview-tab/ReviewerAssignment';
import { OutcomeManager } from '../outcomes/OutcomeManager';
import { useProjectStore, selectConnectionPhase } from '@/stores/projectStore';
import type { StudyInfo } from '@/stores/projectStore';
import { useStudyIds, useAllStudies, useProjectMembers } from '@/stores/projectAtoms';
import { project } from '@/project';
import { useProjectContext } from '../ProjectContext';
import {
  saveFormState,
  getFormState,
  clearFormState,
  getRestoreParamsFromUrl,
  clearRestoreParamsFromUrl,
} from '@/lib/formStatePersistence.js';

export function AllStudiesTab() {
  const { projectId, getMember, isOwner } = useProjectContext();

  const [showGoogleDriveModal, setShowGoogleDriveModal] = useState(false);
  const [googleDriveTargetStudyId, setGoogleDriveTargetStudyId] = useState<string | null>(null);
  const [restoredState, setRestoredState] = useState<AddStudiesFormState | null>(null);
  const [expandedStudies, setExpandedStudies] = useState<Set<string>>(new Set());
  const [showReviewersModal, setShowReviewersModal] = useState(false);
  const [editingStudy, setEditingStudy] = useState<StudyInfo | null>(null);

  const studyIds = useStudyIds(projectId);
  const members = useProjectMembers(projectId);
  const studies = useAllStudies(projectId);
  const connectionState = useProjectStore(s => selectConnectionPhase(s, projectId));
  const hasData = connectionState.phase === 'synced' || studyIds.length > 0;

  // Restore state after OAuth redirect
  useEffect(() => {
    let cancelled = false;
    const restoreParams = getRestoreParamsFromUrl();
    if (restoreParams?.type === 'addStudies' && restoreParams.projectId === projectId) {
      (async () => {
        try {
          const savedState = await getFormState('addStudies', projectId);
          if (!cancelled && savedState) {
            setRestoredState(savedState as AddStudiesFormState);
            await clearFormState('addStudies', projectId);
            // Clear after next render so AddStudiesForm can consume it once
            setTimeout(() => setRestoredState(null), 0);
          }
        } catch (err) {
          const { handleError } = await import('@/lib/error-utils');
          await handleError(err, { toastTitle: 'Restore Failed' });
        }
        if (!cancelled) clearRestoreParamsFromUrl();
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleSaveState = useCallback(
    async (state: AddStudiesFormState) => {
      await saveFormState('addStudies', state, projectId);
    },
    [projectId],
  );

  const unassignedStudies = useMemo(
    () => studies.filter(s => !s.reviewer1 && !s.reviewer2),
    [studies],
  );

  const shouldShowReviewerAssignment =
    isOwner && studyIds.length > 0 && unassignedStudies.length > 0;

  const handleAssignReviewers = useCallback((studyId: string, updates: Record<string, unknown>) => {
    project.study.update(studyId, updates);
  }, []);

  const handleAddStudies = useCallback(async (studiesToAdd: MergedStudy[]) => {
    await project.study.addBatch(studiesToAdd as unknown as Record<string, unknown>[]);
  }, []);

  const handleOpenGoogleDrive = useCallback((studyId: string) => {
    setGoogleDriveTargetStudyId(studyId);
    setShowGoogleDriveModal(true);
  }, []);

  const handleGoogleDriveImportSuccess = useCallback(
    (file: { key: string; fileName: string; size: number }, studyId: string) => {
      const targetStudyId = studyId || googleDriveTargetStudyId;
      if (!targetStudyId) return;
      project.pdf.handleGoogleDriveImport(targetStudyId, file);
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
          {studyIds.length} {studyIds.length === 1 ? 'study' : 'studies'} in this project
        </p>
      </div>

      {studyIds.length > 0 ?
        <div className='flex flex-col gap-3'>
          {studyIds.map(studyId => (
            <StudyCard
              key={studyId}
              projectId={projectId}
              studyId={studyId}
              expanded={expandedStudies.has(studyId)}
              onToggleExpanded={() => toggleStudyExpanded(studyId)}
              getMember={getMember}
              onAssignReviewers={s => {
                setEditingStudy(s);
                setShowReviewersModal(true);
              }}
              onOpenGoogleDrive={handleOpenGoogleDrive}
            />
          ))}
        </div>
      : hasData && (
          <div className='bg-muted rounded-lg py-12 text-center'>
            <BookOpenIcon className='text-muted-foreground mx-auto mb-4 size-12 opacity-50' />
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
        onSave={(
          studyId: string,
          updates: { reviewer1: string | null; reviewer2: string | null },
        ) => {
          project.study.update(studyId, updates);
        }}
      />
    </div>
  );
}
