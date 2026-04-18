/**
 * LocalChecklistView - Viewer/editor for a local (offline) appraisal.
 *
 * Answers live in the local-practice Y.Doc and are read via useChecklistAnswers
 * for reactive updates. PDFs stay in the `localChecklistPdfs` Dexie table —
 * they don't benefit from CRDT storage and would bloat the Y.Doc.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ChevronLeftIcon } from 'lucide-react';
import * as Y from 'yjs';
import { ChecklistWithPdf } from '@/components/checklist/ChecklistWithPdf';
import { CreateLocalChecklist } from '@/components/checklist/CreateLocalChecklist';
import { connectionPool } from '@/project/ConnectionPool';
import { LOCAL_PROJECT_ID } from '@/project/localProject';
import { useProjectStore, selectConnectionPhase, selectStudies } from '@/stores/projectStore';
import { useChecklistAnswers } from '@/primitives/useProject/checklists/useChecklistAnswers';
import { db } from '@/primitives/db';
import { getChecklistTypeFromState, scoreChecklistOfType } from '@/checklist-registry/index';
import { ScoreTag } from '@/components/checklist/ScoreTag';

interface LocalChecklistViewProps {
  checklistId?: string;
  searchType?: string;
}

export function LocalChecklistView({ checklistId, searchType }: LocalChecklistViewProps) {
  if (!checklistId) {
    return <CreateLocalChecklist type={searchType} />;
  }
  return <LocalChecklistEditor checklistId={checklistId} />;
}

function LocalChecklistEditor({ checklistId }: { checklistId: string }) {
  const navigate = useNavigate();

  const phase = useProjectStore(s => selectConnectionPhase(s, LOCAL_PROJECT_ID));
  const studies = useProjectStore(s => selectStudies(s, LOCAL_PROJECT_ID));

  const currentStudy = useMemo(
    () => studies.find(st => st.id === checklistId) || null,
    [studies, checklistId],
  );
  const currentChecklist = useMemo(
    () => (currentStudy?.checklists || []).find(c => c.id === checklistId) || null,
    [currentStudy, checklistId],
  );

  const answers = useChecklistAnswers(LOCAL_PROJECT_ID, checklistId, checklistId);

  const [pdfState, setPdfState] = useState<{
    loading: boolean;
    data: ArrayBuffer | null;
    fileName: string | null;
    forChecklistId: string | null;
  }>({ loading: true, data: null, fileName: null, forChecklistId: null });

  // When checklistId changes we'd prefer to flip `loading` synchronously here,
  // but that violates react-hooks/set-state-in-effect. Instead the load effect
  // keys off checklistId and we render "Loading..." while forChecklistId !==
  // current checklistId OR the record hasn't resolved yet.
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
    [checklistId],
  );

  const handlePdfClear = useCallback(async () => {
    setPdfState({ loading: false, data: null, fileName: null, forChecklistId: checklistId });
    try {
      await db.localChecklistPdfs.delete(checklistId);
    } catch (err) {
      console.error('Error deleting PDF:', err);
    }
  }, [checklistId]);

  const handlePartialUpdate = useCallback(
    (patch: Record<string, any>) => {
      const ops = connectionPool.getOps(LOCAL_PROJECT_ID);
      if (!ops) return;
      Object.entries(patch).forEach(([key, value]) => {
        ops.checklist.updateChecklistAnswer(
          checklistId,
          checklistId,
          key,
          value as Record<string, unknown>,
        );
      });
    },
    [checklistId],
  );

  const getQuestionNote = useCallback(
    (questionKey: string): Y.Text | null => {
      const ops = connectionPool.getOps(LOCAL_PROJECT_ID);
      return ops?.checklist.getQuestionNote(checklistId, checklistId, questionKey) ?? null;
    },
    [checklistId],
  );

  const getRobinsText = useCallback(
    (sectionKey: string, fieldKey: string, questionKey?: string): Y.Text | null => {
      const ops = connectionPool.getOps(LOCAL_PROJECT_ID);
      return (
        ops?.checklist.getRobinsText(
          checklistId,
          checklistId,
          sectionKey,
          fieldKey,
          questionKey ?? null,
        ) ?? null
      );
    },
    [checklistId],
  );

  const getRob2Text = useCallback(
    (sectionKey: string, fieldKey: string, questionKey?: string): Y.Text | null => {
      const ops = connectionPool.getOps(LOCAL_PROJECT_ID);
      return (
        ops?.checklist.getRob2Text(
          checklistId,
          checklistId,
          sectionKey,
          fieldKey,
          questionKey ?? null,
        ) ?? null
      );
    },
    [checklistId],
  );

  const checklistForUI = useMemo(() => {
    if (!currentChecklist || !answers) return null;
    return {
      id: checklistId,
      name: currentStudy?.name || 'Checklist',
      reviewerName: '',
      createdAt: currentChecklist.createdAt as number | undefined,
      ...answers,
    };
  }, [currentChecklist, answers, checklistId, currentStudy?.name]);

  const checklistType = useMemo(() => {
    if (currentChecklist?.type) return currentChecklist.type;
    if (checklistForUI) return getChecklistTypeFromState(checklistForUI);
    return null;
  }, [currentChecklist, checklistForUI]);

  const currentScore = useMemo(() => {
    if (!checklistForUI || !checklistType) return null;
    return scoreChecklistOfType(checklistType, checklistForUI);
  }, [checklistForUI, checklistType]);

  const handleBack = useCallback(() => {
    navigate({ to: '/dashboard' });
  }, [navigate]);

  const headerContent = (
    <>
      <button
        onClick={handleBack}
        className='text-muted-foreground hover:text-foreground inline-flex items-center gap-2 transition-colors'
      >
        <ChevronLeftIcon className='size-5' />
        Back
      </button>
      <div className='bg-border h-4 w-px' />
      <span className='bg-secondary text-muted-foreground inline-flex items-center rounded px-2 py-0.5 text-xs font-medium'>
        Local Only
      </span>
      <ScoreTag currentScore={currentScore} checklistType={checklistType || undefined} />
    </>
  );

  if (phase.phase !== 'synced' || pdfLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-blue-50'>
        <div className='text-muted-foreground'>Loading checklist...</div>
      </div>
    );
  }

  if (!currentChecklist || !checklistForUI) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-4 bg-blue-50'>
        <div className='text-destructive'>Checklist not found</div>
        <button
          onClick={handleBack}
          className='rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700'
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <ChecklistWithPdf
      checklistType={checklistType || undefined}
      checklist={checklistForUI}
      onUpdate={handlePartialUpdate}
      headerContent={headerContent}
      pdfData={pdfData}
      pdfFileName={pdfFileName}
      onPdfChange={handlePdfChange}
      onPdfClear={handlePdfClear}
      allowDelete={true}
      getQuestionNote={getQuestionNote}
      getRobinsText={getRobinsText}
      getRob2Text={getRob2Text}
    />
  );
}
