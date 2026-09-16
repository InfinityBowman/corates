import { strToU8, zipSync } from 'fflate';
import { buildProjectCsv } from '@/lib/export-csv';
import { buildProjectPdf } from '@/lib/export-pdf';
import type { MemberEntry, ProjectMeta, StudyInfo } from '@/stores/projectStore';
import type { ExportDelivery, ExportOptions } from './exportOptions';
import {
  appraisalFilename,
  combinedFilename,
  isoDate,
  uniqueFilenames,
  zipFilename,
  type FilenameContext,
} from './exportFilenames';

export interface ExportInput {
  /** Already enriched and narrowed to exactly the checklists being exported. */
  studies: StudyInfo[];
  members: MemberEntry[];
  meta: ProjectMeta;
  projectName: string;
  options: ExportOptions;
  date?: string;
}

export interface ExportFile {
  name: string;
  data: Uint8Array;
}

export interface ExportProgress {
  done: number;
  total: number;
  current: string;
}

export const EXPORT_MIME: Record<ExportOptions['format'], string> = {
  pdf: 'application/pdf',
  csv: 'text/csv;charset=utf-8;',
};

function filenameContext(input: ExportInput): FilenameContext {
  const tools = new Set<string>();
  const outcomes = new Set<string | null>();
  for (const study of input.studies) {
    for (const cl of study.checklists) {
      tools.add(cl.type);
      outcomes.add(cl.outcomeId);
    }
  }
  const [tool] = tools.size === 1 ? tools : [null];
  const [outcomeId] = outcomes.size === 1 ? outcomes : [null];
  const outcome =
    outcomeId ? (input.meta.outcomes.find(o => o.id === outcomeId)?.name ?? null) : null;
  return { projectName: input.projectName, tool, outcome, date: input.date ?? isoDate() };
}

/**
 * What the export splits into, in file order: the whole selection for one
 * file, otherwise one study-with-a-single-checklist per appraisal.
 */
export function exportUnits(studies: StudyInfo[], delivery: ExportDelivery): StudyInfo[] {
  if (delivery === 'single') return studies;
  return studies.flatMap(study => study.checklists.map(cl => ({ ...study, checklists: [cl] })));
}

/** The filenames the export will produce, in order, before anything is built. */
export function planExportFilenames(input: ExportInput): string[] {
  const ctx = filenameContext(input);
  const ext = input.options.format;
  if (input.options.delivery === 'single') return [combinedFilename(ctx, ext)];
  const names = exportUnits(input.studies, input.options.delivery).map(unit => {
    const [cl] = unit.checklists;
    const outcome = input.meta.outcomes.find(o => o.id === cl.outcomeId)?.name ?? null;
    const who =
      cl.kind === 'consensus' ?
        'consensus'
      : (input.members.find(m => m.userId === cl.assignedTo)?.name ?? null);
    return appraisalFilename(unit, { tool: cl.type, outcome, who }, ctx, ext);
  });
  return uniqueFilenames(names);
}

export function planZipFilename(input: ExportInput): string {
  return zipFilename(filenameContext(input));
}

export function buildExportBytes(studies: StudyInfo[], input: ExportInput): Uint8Array {
  const { options, members, meta, projectName } = input;
  if (options.format === 'csv') {
    return strToU8(buildProjectCsv({ studies, members, meta, includeNotes: options.includeNotes }));
  }
  const doc = buildProjectPdf({
    studies,
    projectName:
      studies.length === 1 && options.delivery !== 'single' ? studies[0].name : projectName,
    members,
    meta,
    includeSignallingQuestions: options.includeSignallingQuestions,
    includeNotes: options.includeNotes,
    pageSize: options.pageSize,
    orientation: options.orientation,
  });
  return new Uint8Array(doc.output('arraybuffer'));
}

const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/**
 * Builds every file of the export. Per-appraisal builds yield between files so
 * the progress state can paint and a Stop click can land.
 */
export async function buildExportFiles(
  input: ExportInput,
  { onProgress, signal }: { onProgress?: (p: ExportProgress) => void; signal?: AbortSignal } = {},
): Promise<ExportFile[]> {
  const names = planExportFilenames(input);

  if (input.options.delivery === 'single') {
    onProgress?.({ done: 0, total: 1, current: names[0] });
    await yieldToBrowser();
    return [{ name: names[0], data: buildExportBytes(input.studies, input) }];
  }

  const files: ExportFile[] = [];
  const units = exportUnits(input.studies, input.options.delivery);
  for (const [i, unit] of units.entries()) {
    if (signal?.aborted) throw new DOMException('Export stopped', 'AbortError');
    onProgress?.({ done: i, total: names.length, current: names[i] });
    await yieldToBrowser();
    files.push({ name: names[i], data: buildExportBytes([unit], input) });
  }
  onProgress?.({ done: names.length, total: names.length, current: '' });
  return files;
}

export function zipExportFiles(files: ExportFile[]): Uint8Array {
  // PDFs are already compressed; deflating them again just burns time.
  return zipSync(Object.fromEntries(files.map(f => [f.name, f.data])), { level: 0 });
}

export function downloadBytes(data: Uint8Array, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
