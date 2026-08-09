/**
 * AllStudiesTab - All studies as expandable cards
 */

import { useState, useCallback } from 'react';
import { AddStudiesForm, type AddStudiesFormState } from '../add-studies/AddStudiesForm';
import type { MergedStudy } from '@/hooks/useAddStudies/deduplication';
import { GoogleDrivePickerModal } from '../google-drive/GoogleDrivePickerModal';
import { StudyCard } from './study-card/StudyCard';
import { AssignReviewersModal } from './AssignReviewersModal';
import { useProjectStore, selectConnectionPhase } from '@/stores/projectStore';
import type { StudyInfo } from '@/stores/projectStore';
import { useSortedStudyIds } from '@/project/workspace-data';
import { useAddStudies } from '@/hooks/useAddStudies';
import { project } from '@/project';
import { useProjectContext } from '../ProjectContext';
import { saveFormState } from '@/lib/formStatePersistence.js';

export function AllStudiesTab() {
  const { projectId, getMember } = useProjectContext();

  const [showGoogleDriveModal, setShowGoogleDriveModal] = useState(false);
  const [googleDriveTargetStudyId, setGoogleDriveTargetStudyId] = useState<string | null>(null);
  const [expandedStudies, setExpandedStudies] = useState<Set<string>>(new Set());
  const [showReviewersModal, setShowReviewersModal] = useState(false);
  const [editingStudy, setEditingStudy] = useState<StudyInfo | null>(null);

  const addStudies = useAddStudies({});
  const studyIds = useSortedStudyIds(projectId);
  const connectionState = useProjectStore(s => selectConnectionPhase(s, projectId));
  const hasData = connectionState.phase === 'synced' || studyIds.length > 0;

  const handleSaveState = useCallback(
    async (state: AddStudiesFormState) => {
      await saveFormState('addStudies', state, projectId);
    },
    [projectId],
  );

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
      {/* Empty project: the add form is the centerpiece. Once studies exist it
          moves to the Add studies sheet in the project header. */}
      {hasData && studyIds.length === 0 && (
        <AddStudiesForm
          studies={addStudies}
          projectId={projectId}
          formType='addStudies'
          onSaveState={handleSaveState}
          onAddStudies={handleAddStudies}
        />
      )}

      {!hasData && (
        <div className='bg-muted rounded-lg py-12 text-center'>
          <p className='text-muted-foreground/70'>Loading studies...</p>
        </div>
      )}

      {studyIds.length > 0 && (
        <div className='flex flex-col gap-2'>
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
      )}

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
