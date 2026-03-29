/**
 * LocalChecklistView - Wrapper for viewing/editing local checklists
 * Loads checklist from IndexedDB and saves changes back via debounced writes.
 * Shows create form when no checklistId is provided.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ChevronLeftIcon } from 'lucide-react';
import { ChecklistWithPdf } from '@/components/checklist/ChecklistWithPdf';
import { CreateLocalChecklist } from '@/components/checklist/CreateLocalChecklist';
import { useLocalChecklistsStore } from '@/stores/localChecklistsStore';
import { getChecklistTypeFromState, scoreChecklistOfType } from '@/checklist-registry/index';
import { ScoreTag } from '@/components/checklist/ScoreTag';
import { createLocalAdapterFactories } from '@/components/checklist/common/LocalTextAdapter.js';

interface LocalChecklistViewProps {
  checklistId?: string;
  searchType?: string;
}

export function LocalChecklistView({ checklistId, searchType }: LocalChecklistViewProps) {
  const navigate = useNavigate();
  // Access store methods at call sites via getState() to avoid stale references
  const getStoreActions = () => useLocalChecklistsStore.getState() as any;

  const [checklist, setChecklist] = useState<any>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounced save - reads current checklist from ref when it fires
  const checklistRef = useRef<any>(null);
  checklistRef.current = checklist;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const current = checklistRef.current;
        if (current && checklistId) {
          await getStoreActions().updateChecklist(checklistId, current);
        }
      } catch (err) {
        console.error('Error saving checklist:', err);
      }
    }, 500);
  }, [checklistId]);

  // Create adapter factories for text fields (local mode Y.Text shim)
  const { getRob2Text, getQuestionNote, getRobinsText, clearCache } = useMemo(
    () =>
      (createLocalAdapterFactories as any)(() => checklistRef.current, setChecklist, debouncedSave),
    [debouncedSave],
  );

  // Load checklist and PDF on mount
  useEffect(() => {
    if (!checklistId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const actions = getStoreActions();
        const [loaded, pdfRecord] = await Promise.all([
          actions.getChecklist(checklistId),
          actions.getPdf(checklistId),
        ]);

        if (cancelled) return;

        if (!loaded) {
          setError('Checklist not found');
          setLoading(false);
          return;
        }

        clearCache();
        setChecklist(loaded);

        if (pdfRecord) {
          setPdfData(pdfRecord.data);
          setPdfFileName(pdfRecord.fileName);
        }

        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const { handleError } = await import('@/lib/error-utils.js');
        await handleError(err, { setError, showToast: false });
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checklistId, clearCache]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      clearCache();
    };
  }, [clearCache]);

  const handleUpdate = useCallback(
    (updates: Record<string, any>) => {
      setChecklist((prev: any) => {
        if (!prev) return prev;
        const merged = { ...prev };
        for (const [key, value] of Object.entries(updates)) {
          if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value) &&
            typeof prev[key] === 'object' &&
            prev[key] !== null &&
            !Array.isArray(prev[key])
          ) {
            merged[key] = { ...prev[key], ...value };
          } else {
            merged[key] = value;
          }
        }
        return merged;
      });
      clearCache();
      debouncedSave();
    },
    [clearCache, debouncedSave],
  );

  const handlePdfChange = useCallback(
    async (data: ArrayBuffer, fileName: string) => {
      if (!checklistId) return;
      setPdfData(data);
      setPdfFileName(fileName);
      try {
        await getStoreActions().savePdf(checklistId, data, fileName);
      } catch (err) {
        console.error('Error saving PDF:', err);
      }
    },
    [checklistId],
  );

  const handlePdfClear = useCallback(async () => {
    if (!checklistId) return;
    setPdfData(null);
    setPdfFileName(null);
    try {
      await getStoreActions().deletePdf(checklistId);
    } catch (err) {
      console.error('Error deleting PDF:', err);
    }
  }, [checklistId]);

  const handleBack = useCallback(() => {
    navigate({ to: '/dashboard' });
  }, [navigate]);

  const checklistType = checklist ? getChecklistTypeFromState(checklist) : null;
  const currentScore = useMemo(
    () => (checklist && checklistType ? scoreChecklistOfType(checklistType, checklist) : null),
    [checklist, checklistType],
  );

  // Header content for the toolbar
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

  // No checklistId - show creation form
  if (!checklistId) {
    return <CreateLocalChecklist type={searchType} />;
  }

  if (loading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-blue-50'>
        <div className='text-muted-foreground'>Loading checklist...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-4 bg-blue-50'>
        <div className='text-destructive'>{error}</div>
        <button
          onClick={handleBack}
          className='rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700'
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!checklist) return null;

  return (
    <ChecklistWithPdf
      checklistType={checklistType || undefined}
      checklist={checklist}
      onUpdate={handleUpdate}
      headerContent={headerContent}
      pdfData={pdfData}
      pdfFileName={pdfFileName}
      onPdfChange={handlePdfChange}
      onPdfClear={handlePdfClear}
      allowDelete={true}
      getQuestionNote={getQuestionNote}
      getRob2Text={getRob2Text}
      getRobinsText={getRobinsText}
    />
  );
}
