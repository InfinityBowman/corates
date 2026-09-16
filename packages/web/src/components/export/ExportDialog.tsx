/**
 * ExportDialog - one screen: configure on the left, live preview on the
 * right, download in the footer. Opened through exportDialogStore from the
 * project header, a study's row menu, or the dashboard's local appraisals.
 */

import { useRef, useState } from 'react';
import { DownloadIcon, SquareIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { clientLogger } from '@/lib/clientLogger';
import { showToast } from '@/lib/toast';
import { enrichStudiesForExport } from '@/lib/enrich-studies-for-export';
import {
  buildExportFiles,
  downloadBytes,
  EXPORT_MIME,
  planExportFilenames,
  planZipFilename,
  zipExportFiles,
  type ExportInput,
  type ExportProgress,
} from '@/lib/export/buildExportFiles';
import {
  EXPORT_WARN_CHECKLISTS,
  loadExportOptions,
  saveExportOptions,
  type ExportOptions,
} from '@/lib/export/exportOptions';
import {
  countChecklists,
  filterStudiesForExport,
  pickStudies,
} from '@/lib/export/selectStudiesForExport';
import { LOCAL_PROJECT_ID } from '@/project/localProject';
import {
  useAllStudies,
  useProjectMembers,
  useProjectMeta,
  useProjectOutcomes,
} from '@/project/workspace-data';
import { useExportDialogStore } from '@/stores/exportDialogStore';
import type { ProjectMeta } from '@/stores/projectStore';
import { ExportConfigure } from './ExportConfigure';
import { ExportPreview } from './ExportPreview';

export function ExportDialog() {
  const { isOpen, projectId, studyIds, close } = useExportDialogStore();
  if (!projectId) return null;
  return (
    <Dialog open={isOpen} onOpenChange={open => !open && close()}>
      <DialogContent className='flex h-[min(90vh,60rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-7xl'>
        <ExportDialogBody projectId={projectId} initialStudyIds={studyIds} onClose={close} />
      </DialogContent>
    </Dialog>
  );
}

interface BodyProps {
  projectId: string;
  initialStudyIds: string[] | null;
  onClose: () => void;
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function ExportDialogBody({ projectId, initialStudyIds, onClose }: BodyProps) {
  const isLocal = projectId === LOCAL_PROJECT_ID;
  const studies = useAllStudies(projectId);
  const members = useProjectMembers(projectId);
  const outcomes = useProjectOutcomes(projectId);
  // The local project is not in the D1 projects list, so asking would only 401 for guests
  const projectMeta = useProjectMeta(isLocal ? '' : projectId);
  const projectName = isLocal ? 'Local appraisals' : projectMeta.name || 'Project';
  const meta: ProjectMeta = { name: projectName, outcomes };

  const [stored, setStored] = useState(() => loadExportOptions(projectId));
  const [studyIds, setStudyIds] = useState<string[] | null>(initialStudyIds);
  const [activeFile, setActiveFile] = useState(0);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const update = (patch: Partial<ExportOptions>) => {
    const next = { ...stored, ...patch };
    setStored(next);
    saveExportOptions(projectId, next);
    setActiveFile(0);
  };

  const tools = [...new Set(studies.flatMap(s => s.checklists.map(cl => cl.type)))];
  const reviewerIds = new Set(studies.flatMap(s => s.checklists.map(cl => cl.assignedTo)));
  const reviewers = members.filter(m => reviewerIds.has(m.userId));
  const hasConsensus = studies.some(s => s.checklists.some(cl => cl.kind === 'consensus'));

  // Remembered filters can name an outcome or member the project no longer has
  const options: ExportOptions = {
    ...stored,
    outcomeId: outcomes.some(o => o.id === stored.outcomeId) ? stored.outcomeId : null,
    tool: tools.includes(stored.tool ?? '') ? stored.tool : null,
    reviewerId: reviewers.some(m => m.userId === stored.reviewerId) ? stored.reviewerId : null,
  };

  const eligible = filterStudiesForExport(studies, options);
  const selected = pickStudies(eligible, studyIds);
  const selectedIds = new Set(selected.map(s => s.id));
  const checklistCount = countChecklists(selected);
  const inProgressCount =
    countChecklists(filterStudiesForExport(studies, { ...options, status: 'any' })) -
    countChecklists(eligible);

  const input: Omit<ExportInput, 'studies'> = { members, meta, projectName, options };
  const filenames = planExportFilenames({ ...input, studies: selected });
  const fileCount = filenames.length;
  const formatLabel = options.format.toUpperCase();

  const primaryLabel =
    options.delivery === 'zip' ? 'Download ZIP'
    : options.delivery === 'perAppraisal' ? `Download ${count(fileCount, 'file')}`
    : `Download ${formatLabel}`;
  const output =
    options.delivery === 'single' ? `one ${formatLabel}`
    : options.delivery === 'zip' ? `${count(fileCount, formatLabel)} in one ZIP`
    : count(fileCount, formatLabel);
  const summary =
    selected.length === 0 ?
      'Nothing selected'
    : `${count(selected.length, 'study', 'studies')} with ${count(checklistCount, 'appraisal')} to ${output}`;

  const handleExport = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    const started = performance.now();
    let latest: ExportProgress = { done: 0, total: fileCount, current: '' };
    setProgress(latest);
    const event = (action: string) => `client.${isLocal ? 'local_appraisal' : 'project'}.${action}`;
    const fields = {
      format: options.format,
      scope: 'dialog',
      delivery: options.delivery,
      status: options.status,
      studies: selected.length,
      checklists: checklistCount,
    };
    try {
      const plan: ExportInput = {
        ...input,
        studies: enrichStudiesForExport(projectId, selected),
      };
      const files = await buildExportFiles(plan, {
        onProgress: next => {
          latest = next;
          setProgress(next);
        },
        signal: controller.signal,
      });
      let bytes = 0;
      if (options.delivery === 'zip') {
        const zip = zipExportFiles(files);
        bytes = zip.byteLength;
        downloadBytes(zip, planZipFilename(plan), 'application/zip');
      } else {
        for (const file of files) {
          bytes += file.data.byteLength;
          downloadBytes(file.data, file.name, EXPORT_MIME[options.format]);
          // Browsers refuse a burst of downloads fired in the same tick
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }
      clientLogger.info(event('exported'), {
        ...fields,
        bytes,
        durationMs: Math.round(performance.now() - started),
      });
      onClose();
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') {
        clientLogger.info(event('export_stopped'), { ...fields, done: latest.done });
      } else {
        const message = err instanceof Error ? err.message : String(err);
        clientLogger.error(event('export_failed'), { ...fields, error: message });
        showToast.error('Export Failed', message);
      }
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };

  return (
    <>
      <div className='border-border border-b px-5 py-3'>
        <DialogTitle>Export appraisals</DialogTitle>
      </div>

      <div className='grid min-h-0 flex-1 grid-rows-[auto_1fr] md:grid-cols-[22rem_minmax(0,1fr)] md:grid-rows-1'>
        <ExportConfigure
          className='border-border max-h-72 overflow-y-auto border-b p-5 md:max-h-none md:border-r md:border-b-0'
          options={options}
          update={update}
          eligible={eligible}
          selectedIds={selectedIds}
          setStudyIds={ids => {
            setStudyIds(ids);
            setActiveFile(0);
          }}
          outcomes={outcomes}
          tools={tools}
          reviewers={isLocal ? [] : reviewers}
          hasConsensus={hasConsensus}
        />
        <ExportPreview
          projectId={projectId}
          selected={selected}
          input={input}
          filenames={filenames}
          activeFile={Math.min(activeFile, Math.max(0, fileCount - 1))}
          setActiveFile={setActiveFile}
          emptyState={
            <div className='flex max-w-sm flex-col items-center gap-3 text-center'>
              <p className='font-medium'>
                {options.status === 'finalized' && inProgressCount > 0 ?
                  'No finalized appraisals match'
                : 'Nothing to export'}
              </p>
              <p className='text-muted-foreground text-sm'>
                {options.status === 'finalized' && inProgressCount > 0 ?
                  `${count(inProgressCount, 'appraisal')} ${inProgressCount === 1 ? 'is' : 'are'} still in progress. You can export ${inProgressCount === 1 ? 'it' : 'them'} as a work-in-progress snapshot.`
                : 'Widen the filters or select a study on the left.'}
              </p>
              {options.status === 'finalized' && inProgressCount > 0 && (
                <Button variant='outline' size='sm' onClick={() => update({ status: 'any' })}>
                  Include in-progress work
                </Button>
              )}
            </div>
          }
        />
      </div>

      <div className='border-border bg-muted/50 flex flex-col gap-3 border-t px-5 py-3'>
        {checklistCount > EXPORT_WARN_CHECKLISTS && !progress && (
          <p className='text-warning-foreground flex items-start gap-2 text-xs'>
            <TriangleAlertIcon className='mt-0.5 size-3.5 shrink-0' />
            <span>
              {checklistCount} appraisals is past what a browser tab builds comfortably. The tab may
              stall for a while. Narrow the selection, or export the CSV now and the PDFs one
              outcome at a time.
            </span>
          </p>
        )}
        {progress ?
          <div className='flex items-center gap-3'>
            <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
              <p className='truncate text-sm'>
                Building your export
                {progress.total > 1 && `, ${progress.done} of ${progress.total}`}
                {progress.current && (
                  <span className='text-muted-foreground'> {progress.current}</span>
                )}
              </p>
              <Progress value={(progress.done / Math.max(1, progress.total)) * 100} />
            </div>
            {progress.total > 1 && (
              <Button variant='outline' size='sm' onClick={() => abortRef.current?.abort()}>
                <SquareIcon data-icon='inline-start' />
                Stop
              </Button>
            )}
          </div>
        : <div className='flex items-center gap-3'>
            <p className='text-muted-foreground min-w-0 flex-1 truncate text-sm'>{summary}</p>
            <Button variant='outline' size='sm' onClick={onClose}>
              Cancel
            </Button>
            <Button size='sm' onClick={handleExport} disabled={selected.length === 0}>
              <DownloadIcon data-icon='inline-start' />
              {primaryLabel}
            </Button>
          </div>
        }
      </div>
    </>
  );
}
