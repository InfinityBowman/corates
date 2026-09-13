/**
 * AllStudiesTab - All studies as expandable cards
 */

import { useState, useCallback, useEffect } from 'react';
import { UsersIcon, FilePlusIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AddStudiesForm, type AddStudiesFormState } from '../add-studies/AddStudiesForm';
import type { MergedStudy } from '@/hooks/useAddStudies/deduplication';
import { GoogleDrivePickerModal } from '../google-drive/GoogleDrivePickerModal';
import { StudyCard } from './study-card/StudyCard';
import { StudiesExplainer } from './StudiesExplainer';
import { useProjectStore, selectConnectionPhase } from '@/stores/projectStore';
import { useFileDragStore } from '@/stores/fileDragStore';
import { useAllStudies } from '@/project/workspace-data';
import { useAddStudies } from '@/hooks/useAddStudies';
import { useProjectExport } from '@/hooks/useProjectExport';
import { project } from '@/project';
import { useProjectContext } from '../ProjectContext';
import { saveFormState } from '@/lib/formStatePersistence.js';

export function AllStudiesTab() {
  const { projectId, getMember, isOwner, openAssignSheet, setAddStudiesSheetOpen } =
    useProjectContext();

  const [showGoogleDriveModal, setShowGoogleDriveModal] = useState(false);
  const [googleDriveTargetStudyId, setGoogleDriveTargetStudyId] = useState<string | null>(null);
  const [expandedStudies, setExpandedStudies] = useState<Set<string>>(new Set());

  const addStudies = useAddStudies({});
  const studies = useAllStudies(projectId);
  const { exportStudyCsv, exportStudyPdf } = useProjectExport(projectId);
  const connectionState = useProjectStore(s => selectConnectionPhase(s, projectId));
  const hasData = connectionState.phase === 'synced' || studies.length > 0;
  const unassignedCount = studies.filter(s => !s.reviewer1 && !s.reviewer2).length;
  const isDraggingFiles = useFileDragStore(s => s.isDraggingFiles);

  // Tells the page-wide drop hint that study cards are on screen to drop onto.
  useEffect(() => {
    const { setStudyDropTargetsMounted } = useFileDragStore.getState();
    setStudyDropTargetsMounted(true);
    return () => setStudyDropTargetsMounted(false);
  }, []);

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
      {hasData && studies.length === 0 && (
        <>
          <div className='mb-4'>
            <h2 className='text-foreground text-lg font-semibold'>Add your first study</h2>
            <p className='text-muted-foreground mt-1 text-sm'>
              Bring in the papers you plan to appraise. Upload PDFs, import a file from your
              reference manager, look up DOIs or PubMed IDs, or pull PDFs from Google Drive. Once
              studies are here, you can assign one or two reviewers to each one.
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

      {studies.length > 0 && <StudiesExplainer onAddStudies={() => setAddStudiesSheetOpen(true)} />}

      {studies.length > 0 && (
        <div className='mb-3 flex items-center justify-between'>
          <span className='text-muted-foreground text-sm'>
            {studies.length} {studies.length === 1 ? 'study' : 'studies'}
          </span>
          {isOwner && unassignedCount > 0 && (
            <Button variant='outline' size='sm' onClick={() => openAssignSheet()}>
              <UsersIcon className='size-4' />
              Assign reviewers
              <Badge variant='info' className='min-w-5 px-1.5 tabular-nums'>
                {unassignedCount}
              </Badge>
            </Button>
          )}
        </div>
      )}

      {/* Drops that miss every card reach the page-wide handler in
          AddStudiesSheet, which stages them as new studies. This zone just
          makes that target visible. */}
      {studies.length > 0 && isDraggingFiles && (
        <div className='bg-card sticky top-2 z-10 mb-2 rounded-lg'>
          <div className='rounded-lg border-2 border-dashed border-blue-500 bg-blue-500/5 px-4 py-5 text-center'>
            <p className='flex items-center justify-center gap-2 font-medium text-blue-600'>
              <FilePlusIcon className='size-5' />
              Drop here to add as new studies
            </p>
            <p className='text-muted-foreground mt-1 text-sm'>
              Or drop onto a study below to attach the PDF to it
            </p>
          </div>
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
              onAssignReviewers={s => openAssignSheet({ studyIds: [s.id], label: 'This study' })}
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
    </div>
  );
}
