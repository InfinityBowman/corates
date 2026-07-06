/**
 * LocalChecklistView - Viewer/editor for a local (offline) appraisal.
 *
 * Answers live in the local-practice Y.Doc and are read via the reactor
 * for reactive updates. PDFs stay in the `localChecklistPdfs` Dexie table --
 * they don't benefit from CRDT storage and would bloat the Y.Doc.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ChevronLeftIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChecklistWithPdf } from '@/components/checklist/ChecklistWithPdf';
import { CreateLocalChecklist } from '@/components/checklist/CreateLocalChecklist';
import { LOCAL_PROJECT_ID } from '@/project/localProject';
import { connectionPool } from '@/project/ConnectionPool';
import { useProjectStore, selectConnectionPhase } from '@/stores/projectStore';
import { useChecklistViewModel } from '@/primitives/useProject/checklists/useChecklistViewModel';
import { useChecklistScore } from '@/primitives/useProject/reactor/hooks';
import { ProjectReactorContext } from '@/primitives/useProject/reactor/context';
import { db } from '@/primitives/db';
import { ScoreTag } from '@/components/checklist/ScoreTag';

interface LocalChecklistViewProps {
  checklistId?: string;
  searchType?: string;
}

export function LocalChecklistView({ checklistId, searchType }: LocalChecklistViewProps) {
  const phase = useProjectStore(s => selectConnectionPhase(s, LOCAL_PROJECT_ID));

  if (!checklistId) {
    return <CreateLocalChecklist type={searchType} />;
  }

  if (phase.phase !== 'synced') {
    return (
      <div className='bg-secondary flex min-h-screen items-center justify-center'>
        <div className='text-muted-foreground'>Loading checklist...</div>
      </div>
    );
  }

  const reactor = connectionPool.getReactor(LOCAL_PROJECT_ID);
  return (
    <ProjectReactorContext.Provider value={reactor}>
      <LocalChecklistEditor checklistId={checklistId} />
    </ProjectReactorContext.Provider>
  );
}

function LocalChecklistEditor({ checklistId }: { checklistId: string }) {
  const navigate = useNavigate();

  const { currentChecklist, checklistType } = useChecklistViewModel(
    LOCAL_PROJECT_ID,
    checklistId,
    checklistId,
  );
  const currentScore = useChecklistScore(checklistId, checklistId, checklistType);

  const [pdfState, setPdfState] = useState<{
    loading: boolean;
    data: ArrayBuffer | null;
    fileName: string | null;
    forChecklistId: string | null;
  }>({ loading: true, data: null, fileName: null, forChecklistId: null });

  useEffect(() => {
    let cancelled = false;
    db.localChecklistPdfs
      .get(checklistId)
      .then(record => {
        if (cancelled) return;
        setPdfState({
          loading: false,
          data: record?.data ?? null,
          fileName: record?.fileName ?? null,
          forChecklistId: checklistId,
        });
      })
      .catch(err => {
        console.error('Failed to load local PDF:', err);
        if (cancelled) return;
        setPdfState({
          loading: false,
          data: null,
          fileName: null,
          forChecklistId: checklistId,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [checklistId]);

  const pdfData = pdfState.forChecklistId === checklistId ? pdfState.data : null;
  const pdfFileName = pdfState.forChecklistId === checklistId ? pdfState.fileName : null;
  const pdfLoading = pdfState.loading || pdfState.forChecklistId !== checklistId;

  const handlePdfChange = useCallback(
    async (data: ArrayBuffer, fileName: string) => {
      setPdfState({ loading: false, data, fileName, forChecklistId: checklistId });
      window.plausible?.('LocalAppraisal:PDF', { props: { type: checklistType || 'unknown' } });
      try {
        await db.localChecklistPdfs.put({
          checklistId,
          data,
          fileName,
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.error('Error saving PDF:', err);
      }
    },
    [checklistId, checklistType],
  );

  const handlePdfClear = useCallback(async () => {
    setPdfState({ loading: false, data: null, fileName: null, forChecklistId: checklistId });
    try {
      await db.localChecklistPdfs.delete(checklistId);
    } catch (err) {
      console.error('Error deleting PDF:', err);
    }
  }, [checklistId]);

  const handleBack = useCallback(() => {
    navigate({ to: '/dashboard' });
  }, [navigate]);

  const headerContent = (
    <>
      <Button variant='ghost' onClick={handleBack} className='text-muted-foreground'>
        <ChevronLeftIcon className='size-5' />
        Back
      </Button>
      <div className='bg-border h-4 w-px' />
      <Badge variant='secondary'>Local Only</Badge>
      <ScoreTag currentScore={currentScore} checklistType={checklistType || undefined} />
    </>
  );

  if (pdfLoading) {
    return (
      <div className='bg-secondary flex min-h-screen items-center justify-center'>
        <div className='text-muted-foreground'>Loading checklist...</div>
      </div>
    );
  }

  if (!currentChecklist || !checklistType) {
    return (
      <div className='bg-secondary flex min-h-screen flex-col items-center justify-center gap-4'>
        <div className='text-destructive'>Checklist not found</div>
        <Button onClick={handleBack}>Go Back</Button>
      </div>
    );
  }

  return (
    <ChecklistWithPdf
      studyId={checklistId}
      checklistId={checklistId}
      checklistType={checklistType}
      headerContent={headerContent}
      pdfData={pdfData}
      pdfFileName={pdfFileName}
      onPdfChange={handlePdfChange}
      onPdfClear={handlePdfClear}
      allowDelete={true}
    />
  );
}
