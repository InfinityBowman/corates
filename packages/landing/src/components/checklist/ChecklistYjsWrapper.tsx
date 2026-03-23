/**
 * ChecklistYjsWrapper - Project-scoped checklist editing view
 * Rendered as a child route of ProjectView, shares its YDoc connection.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { ChevronLeftIcon } from 'lucide-react';
import { ChecklistWithPdf } from '@/components/checklist/ChecklistWithPdf';
import { useProjectContext } from '@/components/project/ProjectContext';
import { connectionPool } from '@/project/ConnectionPool';
import { useProjectStore, selectConnectionPhase } from '@/stores/projectStore';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { ACCESS_DENIED_ERRORS } from '@/constants/errors.js';
import { CHECKLIST_STATUS, isEditable } from '@/constants/checklist-status.js';
import { getNextStatusForCompletion } from '@/lib/checklist-domain.js';
import { downloadPdf, uploadPdf, deletePdf, getPdfUrl } from '@/api/pdf-api';
import { getCachedPdf, cachePdf } from '@/primitives/pdfCache.js';
import { showToast } from '@/components/ui/toast';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { getChecklistTypeFromState, scoreChecklistOfType } from '@/checklist-registry/index';
import { ScoreTag } from '@/components/checklist/ScoreTag';
import { isAMSTAR2Complete } from '@/components/checklist/AMSTAR2Checklist/checklist.js';
import { isROBINSIComplete } from '@/components/checklist/ROBINSIChecklist/checklist';
import { isROB2Complete } from '@/components/checklist/ROB2Checklist/checklist';

// Valid answer keys for each checklist type (module-level for stable references)
const AMSTAR2_KEY_PATTERN = /^q\d+[a-z]*$/i;
const ROBINS_I_KEYS = new Set([
  'planning',
  'sectionA',
  'sectionB',
  'sectionC',
  'sectionD',
  'confoundingEvaluation',
  'domain1a',
  'domain1b',
  'domain2',
  'domain3',
  'domain4',
  'domain5',
  'domain6',
  'overall',
]);
const ROB2_KEYS = new Set([
  'preliminary',
  'domain1',
  'domain2a',
  'domain2b',
  'domain3',
  'domain4',
  'domain5',
  'overall',
]);

interface ChecklistYjsWrapperProps {
  projectId: string;
  studyId: string;
  checklistId: string;
}

export function ChecklistYjsWrapper({ projectId, studyId, checklistId }: ChecklistYjsWrapperProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore(selectUser);
  const { orgId } = useProjectContext();

  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);
  const [attemptedPdfFile, setAttemptedPdfFile] = useState<string | null>(null);

  const ops = connectionPool.get(projectId);
  if (!ops) throw new Error(`No connection for project ${projectId}`);
  const {
    updateChecklistAnswer,
    updateChecklist,
    getChecklistData,
    addPdfToStudy,
    getQuestionNote,
    getRobinsText,
    getRob2Text,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
  } = ops;

  const connectionState = useProjectStore(s => selectConnectionPhase(s, projectId));

  // Access denied redirect
  useEffect(() => {
    if (connectionState.error && ACCESS_DENIED_ERRORS.includes(connectionState.error)) {
      showToast.error('Access Denied', connectionState.error);
      navigate({ to: '/dashboard', replace: true });
    }
  }, [connectionState.error, navigate]);

  const currentStudy = useProjectStore(s => {
    const studies = s.projects[projectId]?.studies || [];
    return studies.find((st: any) => st.id === studyId) || null;
  });

  const currentChecklist = useMemo(() => {
    if (!currentStudy) return null;
    return currentStudy.checklists?.find((c: any) => c.id === checklistId) || null;
  }, [currentStudy, checklistId]);

  const isReadOnly = currentChecklist?.status ? !isEditable(currentChecklist.status) : false;

  const studyPdfs = useMemo(() => currentStudy?.pdfs || [], [currentStudy]);

  const defaultPdf = useMemo(() => {
    if (!studyPdfs.length) return null;
    return studyPdfs.find((p: any) => p.tag === 'primary') || studyPdfs[0];
  }, [studyPdfs]);

  const currentPdf = useMemo(() => {
    if (selectedPdfId) {
      return studyPdfs.find((p: any) => p.id === selectedPdfId) || defaultPdf;
    }
    return defaultPdf;
  }, [studyPdfs, selectedPdfId, defaultPdf]);

  // Auto-select primary PDF
  useEffect(() => {
    if (defaultPdf && !selectedPdfId) {
      setSelectedPdfId(defaultPdf.id);
    }
  }, [defaultPdf, selectedPdfId]);

  // Load PDF when selection changes
  useEffect(() => {
    const fileName = currentPdf?.fileName;
    if (!fileName || !orgId || attemptedPdfFile === fileName || pdfLoading) return;

    setAttemptedPdfFile(fileName);
    setPdfLoading(true);
    setPdfData(null);

    getCachedPdf(projectId, studyId, fileName)
      .then((cachedData: any) => {
        if (cachedData) {
          setPdfData(cachedData);
          setPdfFileName(fileName);
          setPdfLoading(false);
          return null;
        }
        return downloadPdf(orgId, projectId, studyId, fileName);
      })
      .then((cloudData: any) => {
        if (cloudData) {
          setPdfData(cloudData);
          setPdfFileName(fileName);
          cachePdf(projectId, studyId, fileName, cloudData);
        }
      })
      .catch((err: any) => console.error('Failed to load PDF:', err))
      .finally(() => setPdfLoading(false));
  }, [
    currentPdf?.fileName,
    orgId,
    attemptedPdfFile,
    pdfLoading,
    projectId,
    studyId,
    selectedPdfId,
  ]);

  const handlePdfSelect = useCallback((pdfId: string) => {
    setSelectedPdfId(pdfId);
    setAttemptedPdfFile(null);
  }, []);

  const handlePdfChange = useCallback(
    async (data: ArrayBuffer, fileName: string) => {
      if (!orgId) {
        showToast.error('Error', 'No organization context');
        return;
      }

      let uploadResult: any = null;
      try {
        const tag = studyPdfs.length > 0 ? 'secondary' : 'primary';
        uploadResult = await uploadPdf(orgId, projectId, studyId, data, fileName);
        const pdfId = addPdfToStudy(
          studyId,
          {
            key: uploadResult.key,
            fileName: uploadResult.fileName,
            size: uploadResult.size,
            uploadedBy: user?.id,
            uploadedAt: Date.now(),
          },
          tag,
        );

        setPdfData(data);
        setPdfFileName(fileName);
        setSelectedPdfId(pdfId);
        cachePdf(projectId, studyId, fileName, data);
      } catch (err) {
        console.error('Failed to upload PDF:', err);
        if (uploadResult?.fileName) {
          deletePdf(orgId, projectId, studyId, uploadResult.fileName).catch((e: any) =>
            console.warn('Failed to clean up orphaned PDF:', e),
          );
        }
        const { handleError } = await import('@/lib/error-utils.js');
        await handleError(err, { toastTitle: 'Upload Failed' });
      }
    },
    [orgId, projectId, studyId, studyPdfs, user?.id, addPdfToStudy],
  );

  // Build checklist data for UI
  const checklistForUI = useMemo(() => {
    if (!currentChecklist) return null;
    const data = getChecklistData(studyId, checklistId);
    if (!data) return null;
    return {
      id: currentChecklist.id,
      name: currentStudy?.name || 'Checklist',
      reviewerName: '',
      createdAt: currentChecklist.createdAt,
      ...data.answers,
    };
  }, [currentChecklist, currentStudy, getChecklistData, studyId, checklistId]);

  const checklistType = useMemo(() => {
    if (currentChecklist?.type) return currentChecklist.type;
    if (checklistForUI) return getChecklistTypeFromState(checklistForUI);
    return 'AMSTAR2';
  }, [currentChecklist, checklistForUI]);

  const currentScore = useMemo(() => {
    if (!checklistForUI || !checklistType) return null;
    return scoreChecklistOfType(checklistType, checklistForUI);
  }, [checklistForUI, checklistType]);

  const isChecklistValid = useMemo(() => {
    if (!checklistForUI) return false;
    if (checklistType === 'AMSTAR2') return isAMSTAR2Complete(checklistForUI);
    if (checklistType === 'ROBINS_I') return isROBINSIComplete(checklistForUI);
    if (checklistType === 'ROB2') return isROB2Complete(checklistForUI);
    return true;
  }, [checklistForUI, checklistType]);

  const handlePartialUpdate = useCallback(
    (patch: Record<string, any>) => {
      if (isReadOnly) return;
      Object.entries(patch).forEach(([key, value]) => {
        const isValidKey =
          (checklistType === 'AMSTAR2' && AMSTAR2_KEY_PATTERN.test(key)) ||
          (checklistType === 'ROBINS_I' && ROBINS_I_KEYS.has(key)) ||
          (checklistType === 'ROB2' && ROB2_KEYS.has(key));
        if (isValidKey) {
          updateChecklistAnswer(studyId, checklistId, key, value);
        }
      });
    },
    [isReadOnly, checklistType, updateChecklistAnswer, studyId, checklistId],
  );

  const handleToggleComplete = useCallback(() => {
    if (isReadOnly) return;
    if (currentChecklist?.status === CHECKLIST_STATUS.FINALIZED) {
      showToast.info('Checklist Locked', 'Completed checklists cannot be edited.');
      return;
    }
    if (!isChecklistValid) {
      const message =
        checklistType === 'ROBINS_I' || checklistType === 'ROB2' ?
          'All domains must be scored before marking the checklist as complete.'
        : 'All questions must have a final answer before marking the checklist as complete.';
      showToast.error('Incomplete Checklist', message);
      return;
    }
    setCompleteDialogOpen(true);
  }, [isReadOnly, currentChecklist, isChecklistValid, checklistType]);

  const confirmMarkComplete = useCallback(() => {
    const nextStatus = getNextStatusForCompletion(currentStudy as any);
    updateChecklist(studyId, checklistId, { status: nextStatus });
    const statusLabel =
      nextStatus === CHECKLIST_STATUS.FINALIZED ? 'completed' : 'awaiting reconciliation';
    showToast.success(
      'Appraisal Completed',
      `This appraisal has been marked as ${statusLabel} and is now locked.`,
    );
    setCompleteDialogOpen(false);
  }, [currentStudy, updateChecklist, studyId, checklistId]);

  const pdfUrl = useMemo(() => {
    if (!pdfFileName || !orgId) return null;
    return getPdfUrl(orgId, projectId, studyId, pdfFileName);
  }, [pdfFileName, orgId, projectId, studyId]);

  const initialAnnotations = useMemo(() => {
    if (!currentStudy?.annotations || !selectedPdfId || !checklistId) return [];
    const checklistAnnotations =
      (currentStudy.annotations as Record<string, any[]>)?.[checklistId] || [];
    return checklistAnnotations.filter((a: any) => a.pdfId === selectedPdfId);
  }, [currentStudy, selectedPdfId, checklistId]);

  const handleAnnotationAdd = useCallback(
    (annotation: any) => {
      if (isReadOnly || !selectedPdfId) return;
      addAnnotation(studyId, selectedPdfId, checklistId, annotation, user?.id);
    },
    [isReadOnly, selectedPdfId, addAnnotation, studyId, checklistId, user?.id],
  );

  const handleAnnotationUpdate = useCallback(
    (annotation: any) => {
      if (isReadOnly) return;
      updateAnnotation(studyId, checklistId, annotation.id, annotation);
    },
    [isReadOnly, updateAnnotation, studyId, checklistId],
  );

  const handleAnnotationDelete = useCallback(
    (annotationId: string) => {
      if (isReadOnly) return;
      deleteAnnotation(studyId, checklistId, annotationId);
    },
    [isReadOnly, deleteAnnotation, studyId, checklistId],
  );

  const getBackTab = () => {
    const tab = new URLSearchParams(location.search).get('tab');
    return tab || 'overview';
  };

  const getBackPath = () => {
    const tab = getBackTab();
    return `/projects/${projectId}?tab=${tab}`;
  };

  const headerContent = (
    <>
      {/* Complete confirmation dialog */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Appraisal as Complete?</AlertDialogTitle>
            <AlertDialogDescription>
              Once marked complete, this appraisal will be locked and cannot be edited. Are you sure
              you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <button
              type='button'
              onClick={() => setCompleteDialogOpen(false)}
              className='border-border text-secondary-foreground hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium'
            >
              Cancel
            </button>
            <AlertDialogAction onClick={confirmMarkComplete}>Mark Complete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <button
        onClick={() => navigate({ to: getBackPath() as string })}
        className='text-muted-foreground/70 hover:text-secondary-foreground transition-colors'
      >
        <ChevronLeftIcon className='size-5' />
      </button>
      <div className='text-muted-foreground truncate text-sm'>
        <span className='text-foreground font-medium'>
          {currentChecklist?.type || 'AMSTAR2'} Checklist
        </span>
      </div>
      <div className='ml-auto flex items-center gap-3'>
        <ScoreTag currentScore={currentScore} checklistType={checklistType} />
        {!isReadOnly ?
          <button
            onClick={handleToggleComplete}
            disabled={!isChecklistValid}
            title={
              !isChecklistValid ?
                checklistType === 'ROBINS_I' ?
                  'Overall risk of bias must be set before marking complete'
                : 'All questions must have a final answer before marking complete'
              : undefined
            }
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              currentChecklist?.status === CHECKLIST_STATUS.FINALIZED ?
                'bg-success-bg text-success hover:bg-success-bg'
              : !isChecklistValid ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {currentChecklist?.status === CHECKLIST_STATUS.FINALIZED ?
              'Completed'
            : 'Mark Complete'}
          </button>
        : <span
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              currentChecklist?.status === CHECKLIST_STATUS.FINALIZED ?
                'bg-success-bg text-success'
              : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {currentChecklist?.status === CHECKLIST_STATUS.FINALIZED ? 'Completed' : 'Read-only'}
          </span>
        }
      </div>
    </>
  );

  if (!checklistForUI) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-blue-50'>
        <div className='text-muted-foreground'>
          {connectionState.phase === 'connecting' || pdfLoading ?
            'Loading...'
          : 'Checklist not found'}
        </div>
      </div>
    );
  }

  return (
    <ChecklistWithPdf
      checklistType={checklistType}
      checklist={checklistForUI}
      onUpdate={handlePartialUpdate}
      headerContent={headerContent}
      pdfData={pdfData}
      pdfFileName={pdfFileName}
      pdfUrl={pdfUrl}
      onPdfChange={handlePdfChange}
      readOnly={isReadOnly}
      allowDelete={false}
      pdfs={studyPdfs}
      selectedPdfId={selectedPdfId}
      onPdfSelect={handlePdfSelect}
      getQuestionNote={(questionKey: string) => getQuestionNote(studyId, checklistId, questionKey)}
      getRobinsText={(sectionKey: string, fieldKey: string, questionKey?: string) =>
        getRobinsText(studyId, checklistId, sectionKey, fieldKey, questionKey)
      }
      getRob2Text={(sectionKey: string, fieldKey: string, questionKey?: string) =>
        getRob2Text(studyId, checklistId, sectionKey, fieldKey, questionKey)
      }
      onAnnotationAdd={handleAnnotationAdd}
      onAnnotationUpdate={handleAnnotationUpdate}
      onAnnotationDelete={handleAnnotationDelete}
      initialAnnotations={initialAnnotations}
    />
  );
}
