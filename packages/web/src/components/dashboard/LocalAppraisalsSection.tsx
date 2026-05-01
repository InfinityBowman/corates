/**
 * LocalAppraisalsSection - Device-local appraisals with delete/rename
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type * as Y from 'yjs';
import {
  PlusIcon,
  FileTextIcon,
  LogInIcon,
  TriangleAlertIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buildProjectCsv, downloadCsv } from '@/lib/export-csv';
import { buildProjectPdf, downloadPdf } from '@/lib/export-pdf';
import { useAllStudies } from '@/stores/projectAtoms';
import type { StudyInfo } from '@/stores/projectStore';
import { scoreChecklistOfType } from '@/checklist-registry';
import { extractAnswersFromYMap } from '@/primitives/useProject/sync';
import { amstar2 } from '@corates/shared';
import type { AMSTAR2Checklist } from '@corates/shared/checklists';
import { connectionPool } from '@/project/ConnectionPool';
import { LOCAL_PROJECT_ID } from '@/project/localProject';
import { db } from '@/primitives/db';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAnimation } from './useInitialAnimation';
import { LocalAppraisalCard } from './LocalAppraisalCard';

interface LocalAppraisalsSectionProps {
  showHeader?: boolean;
  showSignInPrompt?: boolean;
}

interface AppraisalCardData {
  id: string;
  name: string;
  type?: string;
  updatedAt?: number;
  createdAt?: number;
}

export function LocalAppraisalsSection({
  showHeader = true,
  showSignInPrompt,
}: LocalAppraisalsSectionProps) {
  const navigate = useNavigate();
  const animation = useAnimation();
  const studies = useAllStudies(LOCAL_PROJECT_ID);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const appraisals: AppraisalCardData[] = [];
  for (const study of studies) {
    const checklist = (study.checklists || [])[0];
    if (!checklist) continue;
    appraisals.push({
      id: study.id,
      name: study.name || 'Untitled Checklist',
      type: checklist.type,
      updatedAt: (checklist.updatedAt ?? study.updatedAt) as number | undefined,
      createdAt: (checklist.createdAt ?? study.createdAt) as number | undefined,
    });
  }
  appraisals.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  const handleOpen = (checklistId: string) => {
    navigate({ to: `/checklist/${checklistId}` as string });
  };

  const handleDelete = (checklistId: string) => {
    setPendingDeleteId(checklistId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) {
      setDeleteDialogOpen(false);
      return;
    }
    try {
      const ops = connectionPool.getOps(LOCAL_PROJECT_ID);
      ops?.study.deleteStudy(pendingDeleteId);
      await db.localChecklistPdfs.delete(pendingDeleteId);
    } finally {
      setDeleteDialogOpen(false);
      setPendingDeleteId(null);
    }
  };

  const handleRename = async (studyId: string, newName: string) => {
    const ops = connectionPool.getOps(LOCAL_PROJECT_ID);
    ops?.study.updateStudy(studyId, { name: newName });
    ops?.checklist.updateChecklist(studyId, studyId, { title: newName });
  };

  const handleCreate = () => {
    navigate({ to: '/checklist' as string });
  };

  const enrichStudiesForExport = (toExport: StudyInfo[]): StudyInfo[] => {
    const entry = connectionPool.getEntry(LOCAL_PROJECT_ID);
    if (!entry) return toExport;

    const reviewsMap = entry.ydoc.getMap('reviews');
    return toExport.map(study => {
      const studyYMap = reviewsMap.get(study.id) as Y.Map<unknown> | undefined;
      if (!studyYMap) return study;

      const checklistsMap = (studyYMap as Y.Map<unknown>).get('checklists') as
        | Y.Map<unknown>
        | undefined;
      if (!checklistsMap) return study;

      const enrichedChecklists = study.checklists.map(cl => {
        if (cl.answers) return cl;

        const clYMap = checklistsMap.get(cl.id) as Y.Map<unknown> | undefined;
        if (!clYMap) return cl;

        const answersYMap = (clYMap as Y.Map<unknown>).get('answers') as Y.Map<unknown> | undefined;
        if (!answersYMap) return cl;

        const answers = extractAnswersFromYMap(answersYMap, cl.type);
        const score = scoreChecklistOfType(cl.type, answers);
        const enriched = { ...cl, answers, score: score !== 'Error' ? score : null };

        if (cl.type === 'AMSTAR2') {
          enriched.consolidatedAnswers = amstar2.getAnswers(answers as unknown as AMSTAR2Checklist);
        }

        return enriched;
      });

      return { ...study, checklists: enrichedChecklists };
    });
  };

  const handleExportAllCsv = () => {
    const csv = buildProjectCsv({ studies: enrichStudiesForExport(studies) });
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `corates-local-appraisals-${date}.csv`);
  };

  const handleExportAllPdf = () => {
    const enriched = enrichStudiesForExport(studies);
    const doc = buildProjectPdf({ studies: enriched });
    const date = new Date().toISOString().slice(0, 10);
    downloadPdf(doc, `corates-local-appraisals-${date}.pdf`);
  };

  const handleExportOneCsv = (studyId: string) => {
    const study = studies.find(s => s.id === studyId);
    if (!study) return;
    const csv = buildProjectCsv({ studies: enrichStudiesForExport([study]) });
    const safeName = (study.name || 'appraisal').replace(/[^a-zA-Z0-9-_ ]/g, '').trim();
    downloadCsv(csv, `${safeName}.csv`);
  };

  const handleExportOnePdf = (studyId: string) => {
    const study = studies.find(s => s.id === studyId);
    if (!study) return;
    const enriched = enrichStudiesForExport([study]);
    const name = study.name || 'appraisal';
    const doc = buildProjectPdf({ studies: enriched, projectName: name });
    const safeName = name.replace(/[^a-zA-Z0-9-_ ]/g, '').trim();
    downloadPdf(doc, `${safeName}.pdf`);
  };

  const hasChecklists = appraisals.length > 0;

  return (
    <section style={animation.fadeUp(300)}>
      {showHeader && (
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
            Local Appraisals
          </h2>
          {hasChecklists && (
            <div className='flex items-center gap-2'>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline'>
                    <DownloadIcon data-icon='inline-start' />
                    Export All
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-auto'>
                  <DropdownMenuItem onClick={handleExportAllCsv}>
                    <FileSpreadsheetIcon />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportAllPdf}>
                    <FileIcon />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={handleCreate}>
                <PlusIcon data-icon='inline-start' />
                New Appraisal
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Sign-in prompt */}
      {showSignInPrompt && (
        <div className='border-primary/20 bg-primary/5 mb-4 flex items-center justify-between rounded-xl border p-4'>
          <div className='flex items-center gap-3'>
            <div className='bg-primary/10 flex size-10 items-center justify-center rounded-lg'>
              <LogInIcon className='text-primary size-5' />
            </div>
            <div>
              <p className='text-primary text-sm font-medium'>Want to collaborate?</p>
              <p className='text-primary/70 text-xs'>
                Sign in to create projects and sync across devices
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={() => navigate({ to: '/signin' })}
            className='bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors'
          >
            Sign In
          </button>
        </div>
      )}

      {/* Appraisals list */}
      <div className='flex flex-col gap-3'>
        {!hasChecklists && (
          <div className='border-border bg-muted/50 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10'>
            <div className='bg-secondary mb-3 flex size-12 items-center justify-center rounded-xl'>
              <FileTextIcon className='text-muted-foreground size-6 opacity-70' />
            </div>
            <h3 className='text-secondary-foreground mb-1 text-sm font-medium'>
              No local appraisals
            </h3>
            <p className='text-muted-foreground mb-4 text-center text-xs'>
              Create appraisals that stay on this device
            </p>
            <button
              type='button'
              onClick={handleCreate}
              className='bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors'
            >
              <PlusIcon className='size-4' />
              Create Appraisal
            </button>
          </div>
        )}

        {appraisals.map((appraisal, index) => (
          <LocalAppraisalCard
            key={appraisal.id}
            checklist={appraisal}
            onOpen={handleOpen}
            onDelete={handleDelete}
            onRename={newName => handleRename(appraisal.id, newName)}
            onExportCsv={handleExportOneCsv}
            onExportPdf={handleExportOnePdf}
            style={animation.statRise(index * 50)}
          />
        ))}
      </div>

      {/* Delete dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon variant='danger'>
              <TriangleAlertIcon />
            </AlertDialogIcon>
            <div>
              <AlertDialogTitle>Delete Appraisal</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this appraisal? This cannot be undone.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
