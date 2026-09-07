/**
 * LocalAppraisalsSection - device-local appraisals as rows, with rename,
 * delete and export
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  PlusIcon,
  FileCheck2Icon,
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
import { clientLogger } from '@/lib/clientLogger';
import { buildProjectCsv, downloadCsv } from '@/lib/export-csv';
import { buildProjectPdf, downloadPdf } from '@/lib/export-pdf';
import { enrichStudiesForExport } from '@/lib/enrich-studies-for-export';
import { useAllStudies } from '@/project/workspace-data';
import type { StudyInfo } from '@/stores/projectStore';
import { applyLocalMutation } from '@/project/localWrites';
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
import { DashboardSection, EmptyState } from './DashboardSection';
import { LocalAppraisalRow } from './LocalAppraisalRow';

interface LocalAppraisalsSectionProps {
  showSignInPrompt?: boolean;
}

export function LocalAppraisalsSection({ showSignInPrompt }: LocalAppraisalsSectionProps) {
  const navigate = useNavigate();
  const animation = useAnimation();
  const studies = useAllStudies(LOCAL_PROJECT_ID);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const appraisals = studies
    .flatMap(study => {
      const checklist = study.checklists?.[0];
      if (!checklist) return [];
      return [
        {
          id: study.id,
          name: study.name || 'Untitled Checklist',
          type: checklist.type,
          updatedAt: (checklist.updatedAt ?? study.updatedAt) as number | undefined,
          createdAt: (checklist.createdAt ?? study.createdAt) as number | undefined,
        },
      ];
    })
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  const handleOpen = (checklistId: string) => {
    navigate({ to: `/checklist/${checklistId}` as string });
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      // Cascades the checklist + answers rows.
      applyLocalMutation(LOCAL_PROJECT_ID, 'study.delete', { id: pendingDeleteId });
      await db.localChecklistPdfs.delete(pendingDeleteId);
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleRename = (studyId: string, newName: string) => {
    const now = Date.now();
    applyLocalMutation(LOCAL_PROJECT_ID, 'study.update', {
      id: studyId,
      updates: { name: newName },
      now,
    });
    // Local convention: study id === checklist id.
    applyLocalMutation(LOCAL_PROJECT_ID, 'checklist.update', {
      checklistId: studyId,
      updates: { title: newName },
      now,
    });
  };

  const handleCreate = () => {
    navigate({ to: '/checklist' as string });
  };

  const enrichStudies = (toExport: StudyInfo[]) =>
    enrichStudiesForExport(LOCAL_PROJECT_ID, toExport);

  const handleExportAllCsv = () => {
    const csv = buildProjectCsv({ studies: enrichStudies(studies) });
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `corates-local-appraisals-${date}.csv`);
    clientLogger.info('client.local_appraisal.exported', { format: 'csv', scope: 'all' });
  };

  const handleExportAllPdf = () => {
    const enriched = enrichStudies(studies);
    const doc = buildProjectPdf({ studies: enriched });
    const date = new Date().toISOString().slice(0, 10);
    downloadPdf(doc, `corates-local-appraisals-${date}.pdf`);
    clientLogger.info('client.local_appraisal.exported', { format: 'pdf', scope: 'all' });
  };

  const handleExportOneCsv = (studyId: string) => {
    const study = studies.find(s => s.id === studyId);
    if (!study) return;
    const csv = buildProjectCsv({ studies: enrichStudies([study]) });
    const safeName = (study.name || 'appraisal').replace(/[^a-zA-Z0-9-_ ]/g, '').trim();
    downloadCsv(csv, `${safeName}.csv`);
    clientLogger.info('client.local_appraisal.exported', { format: 'csv', scope: 'single' });
  };

  const handleExportOnePdf = (studyId: string) => {
    const study = studies.find(s => s.id === studyId);
    if (!study) return;
    const enriched = enrichStudies([study]);
    const name = study.name || 'appraisal';
    const doc = buildProjectPdf({ studies: enriched, projectName: name });
    const safeName = name.replace(/[^a-zA-Z0-9-_ ]/g, '').trim();
    downloadPdf(doc, `${safeName}.pdf`);
    clientLogger.info('client.local_appraisal.exported', { format: 'pdf', scope: 'single' });
  };

  const hasChecklists = appraisals.length > 0;

  return (
    <>
      {showSignInPrompt && (
        <div
          className='border-primary/20 bg-primary/5 flex items-center justify-between gap-4 rounded-lg border px-4 py-3'
          style={animation.fadeUp(100)}
        >
          <div className='flex items-center gap-3'>
            <LogInIcon className='text-primary size-4 shrink-0' />
            <p className='text-sm'>
              <span className='text-primary font-medium'>Want to collaborate?</span>{' '}
              <span className='text-primary/70'>
                Sign in to create projects and sync across devices.
              </span>
            </p>
          </div>
          <Button size='sm' onClick={() => navigate({ to: '/signin' })}>
            Sign in
          </Button>
        </div>
      )}

      <DashboardSection
        title='Local appraisals'
        count={appraisals.length}
        style={animation.fadeUp(300)}
        aside={
          <>
            <span className='text-muted-foreground text-xs'>On this device</span>
            {hasChecklists && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='ghost' size='xs' className='text-muted-foreground'>
                    <DownloadIcon data-icon='inline-start' />
                    Export all
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
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
            )}
          </>
        }
      >
        {hasChecklists ?
          appraisals.map(appraisal => (
            <LocalAppraisalRow
              key={appraisal.id}
              checklist={appraisal}
              onOpen={handleOpen}
              onDelete={setPendingDeleteId}
              onRename={newName => handleRename(appraisal.id, newName)}
              onExportCsv={handleExportOneCsv}
              onExportPdf={handleExportOnePdf}
            />
          ))
        : <EmptyState
            icon={FileCheck2Icon}
            title='No local appraisals'
            description='Appraise a study with AMSTAR 2, RoB 2 or ROBINS-I. Stays on this device, with optional PDF annotation.'
            action={
              <Button onClick={handleCreate}>
                <PlusIcon data-icon='inline-start' />
                New appraisal
              </Button>
            }
          />
        }
      </DashboardSection>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={open => {
          if (!open) setPendingDeleteId(null);
        }}
      >
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
    </>
  );
}
