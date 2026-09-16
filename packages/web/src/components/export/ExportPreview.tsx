/**
 * ExportPreview - the right column of the export dialog: the file rail when
 * the export is more than one file, and the actual output rendered by the
 * same exporters that produce the download.
 */

import { lazy, Suspense } from 'react';
import { FileIcon, FileSpreadsheetIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { exportUnits, type ExportInput } from '@/lib/export/buildExportFiles';
import type { StudyInfo } from '@/stores/projectStore';
import { useExportPreview } from './useExportPreview';

const EmbedPdfViewer = lazy(() => import('@/components/pdf/EmbedPdfViewer'));

/** A combined preview past this many appraisals stops feeling live. */
export const PREVIEW_MAX_CHECKLISTS = 25;
const PREVIEW_MAX_ROWS = 100;

interface ExportPreviewProps {
  projectId: string;
  selected: StudyInfo[];
  input: Omit<ExportInput, 'studies'>;
  filenames: string[];
  activeFile: number;
  setActiveFile: (index: number) => void;
  emptyState: React.ReactNode;
  className?: string;
}

/** The studies a combined preview shows, cut off once it would be too slow to be live. */
function capForPreview(studies: StudyInfo[]): { subject: StudyInfo[]; capped: number } {
  const subject: StudyInfo[] = [];
  let count = 0;
  for (const study of studies) {
    if (count >= PREVIEW_MAX_CHECKLISTS) break;
    subject.push(study);
    count += study.checklists.length;
  }
  return { subject, capped: studies.length - subject.length };
}

function CsvGrid({ rows }: { rows: string[][] }) {
  const [header, ...body] = rows;
  const shown = body.slice(0, PREVIEW_MAX_ROWS);
  return (
    <div className='flex h-full flex-col'>
      <div className='min-h-0 flex-1 overflow-auto'>
        <table className='w-max min-w-full border-collapse text-xs'>
          <thead className='bg-muted sticky top-0'>
            <tr>
              <th className='text-muted-foreground border-border border-r border-b px-2 py-1 text-right font-normal' />
              {header.map((cell, i) => (
                <th
                  key={i}
                  className='border-border border-r border-b px-2 py-1 text-left font-medium whitespace-nowrap'
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, r) => (
              <tr key={r} className='even:bg-muted/30'>
                <td className='text-muted-foreground border-border border-r border-b px-2 py-1 text-right'>
                  {r + 1}
                </td>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className='border-border max-w-64 truncate border-r border-b px-2 py-1 whitespace-nowrap'
                    title={cell}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className='text-muted-foreground border-border border-t px-3 py-1.5 text-xs'>
        {body.length} rows, {header.length} columns
        {body.length > shown.length && `. Showing the first ${shown.length}.`}
      </p>
    </div>
  );
}

function Building() {
  return (
    <div className='text-muted-foreground flex flex-1 items-center justify-center text-sm'>
      <Spinner className='mr-2 size-4' />
      Building preview
    </div>
  );
}

export function ExportPreview({
  projectId,
  selected,
  input,
  filenames,
  activeFile,
  setActiveFile,
  emptyState,
  className,
}: ExportPreviewProps) {
  const isSingle = input.options.delivery === 'single';
  const { subject, capped } =
    isSingle ?
      capForPreview(selected)
    : {
        subject: exportUnits(selected, input.options.delivery).slice(activeFile, activeFile + 1),
        capped: 0,
      };
  const { preview, updating } = useExportPreview(projectId, subject, input);
  const Icon = input.options.format === 'pdf' ? FileIcon : FileSpreadsheetIcon;

  return (
    <div className={cn('bg-muted/40 flex min-h-0 flex-col', className)}>
      <div className='border-border flex items-center justify-between gap-3 border-b px-4 py-2'>
        <div className='flex items-center gap-2 text-sm'>
          <span className='font-medium'>Preview</span>
          <span className='text-muted-foreground text-xs'>updates as you change options</span>
        </div>
        <span className='text-muted-foreground flex items-center gap-1.5 text-xs'>
          {updating && <Spinner className='size-3' />}
          {preview?.kind === 'pdf' && `${preview.pages} ${preview.pages === 1 ? 'page' : 'pages'}`}
        </span>
      </div>

      {selected.length === 0 ?
        <div className='flex flex-1 items-center justify-center p-6'>{emptyState}</div>
      : <div className='flex min-h-0 flex-1'>
          {!isSingle && (
            <div className='border-border bg-background flex w-52 shrink-0 flex-col border-r'>
              <ul className='min-h-0 flex-1 overflow-y-auto py-1'>
                {filenames.map((name, i) => (
                  <li key={name}>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => setActiveFile(i)}
                      aria-current={i === activeFile}
                      className={cn(
                        'w-full justify-start rounded-none px-3 font-normal',
                        i === activeFile && 'bg-muted text-foreground',
                      )}
                    >
                      <Icon className='text-muted-foreground size-3.5 shrink-0' />
                      <span className='truncate'>{name}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
            {capped > 0 && (
              <p className='text-muted-foreground border-border border-b px-3 py-1.5 text-xs'>
                Preview shows the first {subject.length} of {selected.length} studies. The download
                has all of them.
              </p>
            )}
            {preview?.kind === 'pdf' && (
              <Suspense fallback={<Building />}>
                <EmbedPdfViewer
                  pdfData={preview.data}
                  pdfFileName={filenames[isSingle ? 0 : activeFile]}
                  selectedPdfId={`export-${preview.version}`}
                  initialZoom={1}
                  readOnly
                />
              </Suspense>
            )}
            {preview?.kind === 'csv' && <CsvGrid rows={preview.rows} />}
            {preview?.kind === 'error' && (
              <div className='flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center text-sm'>
                <p className='font-medium'>The preview could not be built</p>
                <p className='text-muted-foreground'>{preview.message}</p>
              </div>
            )}
            {!preview && <Building />}
          </div>
        </div>
      }
    </div>
  );
}
