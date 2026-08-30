import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { ChevronLeftIcon } from 'lucide-react';
import { ChecklistWithPdf } from '@/components/checklist/ChecklistWithPdf';
import { useProjectContext } from '@/components/project/ProjectContext';
import { connectionPool } from '@/project/ConnectionPool';
import { useChecklistViewModel } from '@/primitives/useProject/useChecklistViewModel';
import { useChecklistScore, useAnswerWriters, getAnswerValue } from '@/project/workspace-data';
import { getCompletionNaStamps } from '@/components/checklist/completion-na';
import type { ChecklistAnswerInput } from '@corates/shared/sync';
import { useProjectStore, selectConnectionPhase } from '@/stores/projectStore';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { useStudyAnnotations } from '@/primitives/useProject/useStudyAnnotations';
import { ACCESS_DENIED_ERRORS } from '@/constants/errors.js';
import {
  CHECKLIST_STATUS,
  isEditable,
  getNextStatusForCompletion,
  type ChecklistStatus,
} from '@corates/shared/checklists';
import { downloadPdf, uploadPdf, deletePdf, getPdfUrl } from '@/api/pdf-api';
import type { PdfUploadResponse } from '@/api/pdf-api';
import { getCachedPdf, cachePdf } from '@/primitives/pdfCache.js';
import { showToast } from '@/lib/toast';
import { clientLogger } from '@/lib/clientLogger';
import { parseError } from '@/lib/error-utils';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { ScoreTag } from '@/components/checklist/ScoreTag';

interface ChecklistYjsWrapperProps {
  projectId: string;
  studyId: string;
  checklistId: string;
}

/** The EmbedPDF payload shape the viewer hands back for annotation writes. */
interface AnnotationData {
  id?: string;
  type?: string;
  pageIndex?: number;
  pdfId?: string;
  embedPdfData?: string;
  [key: string]: unknown;
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

  // Fire-and-forget mutations: optimistic apply is immediate, and rejections
  // surface through the pool's global onMutationRejected toast.
  const client = connectionPool.getClient(projectId);

  const connectionState = useProjectStore(s => selectConnectionPhase(s, projectId));

  // Access denied redirect
  useEffect(() => {
    if (connectionState.error && ACCESS_DENIED_ERRORS.includes(connectionState.error)) {
      showToast.error('Access Denied', connectionState.error);
      navigate({ to: '/dashboard', replace: true });
    }
  }, [connectionState.error, navigate]);

  const { currentStudy, currentChecklist, checklistType } = useChecklistViewModel(
    projectId,
    studyId,
    checklistId,
  );
  const currentScore = useChecklistScore(projectId, checklistId, checklistType);
  const writers = useAnswerWriters(projectId, studyId, checklistId);

  const isReadOnly = currentChecklist?.status ? !isEditable(currentChecklist.status) : false;

  const isDualReviewerStudy = Boolean(currentStudy?.reviewer1 && currentStudy?.reviewer2);

  const studyPdfs = useMemo(() => currentStudy?.pdfs || [], [currentStudy]);

  const defaultPdf = useMemo(() => {
    if (!studyPdfs.length) return null;
    return studyPdfs.find(p => p.tag === 'primary') || studyPdfs[0];
  }, [studyPdfs]);

  const currentPdf = useMemo(() => {
    if (selectedPdfId) {
      return studyPdfs.find(p => p.id === selectedPdfId) || defaultPdf;
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
      .then(cachedData => {
        if (cachedData) {
          setPdfData(cachedData);
          setPdfFileName(fileName);
          setPdfLoading(false);
          return null;
        }
        return downloadPdf(orgId, projectId, studyId, fileName);
      })
      .then(cloudData => {
        if (cloudData) {
          setPdfData(cloudData);
          setPdfFileName(fileName);
          cachePdf(projectId, studyId, fileName, cloudData);
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to load PDF:', err);
        clientLogger.warn('client.pdf.load_failed', {
          projectId,
          studyId,
          fileName,
          code: parseError(err).code,
        });
      })
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

      let uploadResult: PdfUploadResponse | null = null;
      try {
        const tag = studyPdfs.length > 0 ? 'secondary' : 'primary';
        uploadResult = await uploadPdf(orgId, projectId, studyId, data, fileName);
        const pdfId = crypto.randomUUID();
        void client?.mutate.pdf.attach({
          studyId,
          pdf: {
            id: pdfId,
            key: uploadResult.key,
            fileName: uploadResult.fileName,
            size: uploadResult.size,
            uploadedBy: user?.id ?? '',
            uploadedAt: Date.now(),
          },
          tag,
          now: Date.now(),
        });

        setPdfData(data);
        setPdfFileName(fileName);
        setSelectedPdfId(pdfId);
        cachePdf(projectId, studyId, fileName, data);
      } catch (err) {
        console.error('Failed to upload PDF:', err);
        clientLogger.warn('client.pdf.upload_failed', {
          projectId,
          studyId,
          fileName,
          code: parseError(err).code,
        });
        if (uploadResult?.fileName) {
          deletePdf(orgId, projectId, studyId, uploadResult.fileName).catch((e: unknown) =>
            console.warn('Failed to clean up orphaned PDF:', e),
          );
        }
        const { handleError } = await import('@/lib/error-utils.js');
        await handleError(err, { toastTitle: 'Upload Failed' });
      }
    },
    [orgId, projectId, studyId, studyPdfs, user?.id, client],
  );

  const isChecklistValid = currentScore !== null && currentScore !== 'Incomplete';

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
    // Off-path conditional questions get their official 'NA' response stamped
    // into the record before it locks, matching what the Cochrane tools store.
    const stamps = getCompletionNaStamps(checklistType, key =>
      getAnswerValue(projectId, checklistId, key),
    );
    for (const stamp of stamps) {
      writers.updateAnswer({
        type: checklistType,
        key: stamp.domainKey,
        data: { answers: { [stamp.questionKey]: { answer: 'NA' } } },
      } as ChecklistAnswerInput);
    }

    const nextStatus = getNextStatusForCompletion(currentStudy);
    void client?.mutate.checklist.update({
      checklistId,
      updates: { status: nextStatus as ChecklistStatus },
      now: Date.now(),
    });
    if (nextStatus === CHECKLIST_STATUS.FINALIZED) {
      showToast.success('Appraisal Completed', 'This appraisal has been marked as completed.');
    } else {
      showToast.success(
        'Appraisal Completed',
        'This appraisal is awaiting reconciliation. Send it back to To-Do from the Reconcile tab if you need to edit your answers.',
      );
    }
    setCompleteDialogOpen(false);
  }, [currentStudy, client, checklistId, checklistType, projectId, writers]);

  const pdfUrl = useMemo(() => {
    if (!pdfFileName || !orgId) return null;
    return getPdfUrl(orgId, projectId, studyId, pdfFileName);
  }, [pdfFileName, orgId, projectId, studyId]);

  const initialAnnotations = useStudyAnnotations(projectId, studyId, checklistId, selectedPdfId);

  const handleAnnotationAdd = useCallback(
    (annotation: AnnotationData) => {
      if (isReadOnly || !selectedPdfId) return;
      const id = annotation.id || crypto.randomUUID();
      void client?.mutate.annotation.add({
        id,
        studyId,
        checklistId,
        pdfId: selectedPdfId,
        type: annotation.type ?? '',
        pageIndex: annotation.pageIndex ?? 0,
        // The serialized EmbedPDF payload must carry the row's id.
        embedPdfData: JSON.stringify({ ...annotation, id }),
        createdBy: user?.id,
        now: Date.now(),
      });
    },
    [isReadOnly, selectedPdfId, client, studyId, checklistId, user?.id],
  );

  const handleAnnotationUpdate = useCallback(
    (annotation: AnnotationData & { id: string }) => {
      if (isReadOnly) return;
      void client?.mutate.annotation.update({
        id: annotation.id,
        updates: {
          type: annotation.type,
          pageIndex: annotation.pageIndex,
          embedPdfData: JSON.stringify(annotation),
        },
        now: Date.now(),
      });
    },
    [isReadOnly, client],
  );

  const handleAnnotationDelete = useCallback(
    (annotationId: string) => {
      if (isReadOnly) return;
      void client?.mutate.annotation.delete({ id: annotationId });
    },
    [isReadOnly, client],
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
              {isDualReviewerStudy ?
                'Your answers will be read-only here while awaiting reconciliation. You can send this appraisal back to To-Do from the Reconcile tab if you need to make changes. Are you sure you want to proceed?'
              : 'Once marked complete, this appraisal will be finalized and cannot be edited. Are you sure you want to proceed?'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant='outline' onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <AlertDialogAction onClick={confirmMarkComplete}>Mark Complete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        variant='ghost'
        size='icon-sm'
        onClick={() => navigate({ to: getBackPath() as string })}
        className='text-muted-foreground'
        aria-label='Back to project'
      >
        <ChevronLeftIcon className='size-5' />
      </Button>
      <div className='text-muted-foreground truncate text-sm'>
        <span className='text-foreground font-medium'>
          {currentChecklist?.type || 'AMSTAR2'} Checklist
        </span>
      </div>
      <div className='ml-auto flex items-center gap-3'>
        <ScoreTag currentScore={currentScore} checklistType={checklistType ?? undefined} />
        {!isReadOnly ?
          <Button
            onClick={handleToggleComplete}
            disabled={!isChecklistValid}
            title={
              !isChecklistValid ?
                checklistType === 'ROBINS_I' ?
                  'Overall risk of bias must be set before marking complete'
                : 'All questions must have a final answer before marking complete'
              : undefined
            }
            className={
              currentChecklist?.status === CHECKLIST_STATUS.FINALIZED ?
                'bg-success-bg text-success hover:bg-success-bg'
              : undefined
            }
          >
            {currentChecklist?.status === CHECKLIST_STATUS.FINALIZED ?
              'Completed'
            : 'Mark Complete'}
          </Button>
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

  if (!checklistType) {
    return (
      <div className='bg-secondary flex min-h-screen items-center justify-center'>
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
      studyId={studyId}
      checklistId={checklistId}
      checklistType={checklistType}
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
      onAnnotationAdd={handleAnnotationAdd}
      onAnnotationUpdate={handleAnnotationUpdate}
      onAnnotationDelete={handleAnnotationDelete}
      initialAnnotations={initialAnnotations}
    />
  );
}
