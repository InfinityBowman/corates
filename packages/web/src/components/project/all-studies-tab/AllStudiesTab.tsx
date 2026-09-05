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
import { useAllStudies, useProjectMeta } from '@/project/workspace-data';
import { useAddStudies } from '@/hooks/useAddStudies';
import { useProjectExport } from '@/hooks/useProjectExport';
import { project } from '@/project';
import { useProjectContext } from '../ProjectContext';
import { saveFormState } from '@/lib/formStatePersistence.js';
import { ProjectSetupPanel } from '../setup/ProjectSetupPanel';

export function AllStudiesTab() {
  const { projectId, getMember, isOwner } = useProjectContext();

  const [showGoogleDriveModal, setShowGoogleDriveModal] = useState(false);
  const [googleDriveTargetStudyId, setGoogleDriveTargetStudyId] = useState<string | null>(null);
  const [expandedStudies, setExpandedStudies] = useState<Set<string>>(new Set());
  const [showReviewersModal, setShowReviewersModal] = useState(false);
  const [editingStudy, setEditingStudy] = useState<StudyInfo | null>(null);

  const addStudies = useAddStudies({});
  const studies = useAllStudies(projectId);
  const { exportStudyCsv, exportStudyPdf } = useProjectExport(projectId);
  const connectionState = useProjectStore(s => selectConnectionPhase(s, projectId));
  const hasData = connectionState.phase === 'synced' || studies.length > 0;
  const meta = useProjectMeta(projectId);
  const showSetup = isOwner && meta.setupStep !== null;

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
      {hasData && studies.length === 0 && showSetup && <ProjectSetupPanel />}

      {/* Empty project: the add form is the centerpiece. Once studies exist it
          moves to the Add studies sheet in the project header. */}
      {hasData && studies.length === 0 && !showSetup && (
        <>
          <div className='mb-4'>
            <h2 className='text-foreground text-lg font-semibold'>Add your first study</h2>
            <p className='text-muted-foreground mt-1 text-sm'>
              Bring in the papers you plan to appraise. Upload PDFs, import a file from your
              reference manager, look up DOIs or PubMed IDs, or pull PDFs from Google Drive. Once
              studies are here, you can assign two reviewers to each one.
            </p>
          </div>
          <AddStudiesForm
            studies={addStudies}
            projectId={projectId}
            formType='addStudies'
            onSaveState={handleSaveState}
            onAddStudies={handleAddStudies}
          />
        </>
      )}

      {!hasData && (
        <div className='bg-muted rounded-lg py-12 text-center'>
          <p className='text-muted-foreground/70'>Loading studies...</p>
        </div>
      )}

      {studies.length > 0 && (
        <div className='flex flex-col gap-2'>
          {studies.map(study => (
            <StudyCard
              key={study.id}
              study={study}
              expanded={expandedStudies.has(study.id)}
              onToggleExpanded={() => toggleStudyExpanded(study.id)}
              onExportCsv={() => exportStudyCsv(study.id)}
              onExportPdf={() => exportStudyPdf(study.id)}
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
