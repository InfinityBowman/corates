import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { clientLogger } from '@/lib/clientLogger';
import { enrichStudiesForExport } from '@/lib/enrich-studies-for-export';
import { buildProjectCsvRows } from '@/lib/export-csv';
import { buildProjectPdf } from '@/lib/export-pdf';
import type { ExportInput } from '@/lib/export/buildExportFiles';
import type { StudyInfo } from '@/stores/projectStore';

export type ExportPreviewState =
  | { kind: 'pdf'; data: ArrayBuffer; pages: number; version: number }
  | { kind: 'csv'; rows: string[][] }
  | { kind: 'error'; message: string }
  | null;

/**
 * Renders the preview subject with the real exporters, debounced so a burst
 * of toggles builds once. The PDF bytes go to the app's own PDF viewer; the
 * CSV stays as rows for the grid.
 */
export function useExportPreview(
  projectId: string,
  subject: StudyInfo[],
  input: Omit<ExportInput, 'studies'>,
): { preview: ExportPreviewState; updating: boolean } {
  const [preview, setPreview] = useState<ExportPreviewState>(null);
  const [updating, setUpdating] = useState(false);
  const versionRef = useRef(0);

  // The subject array is derived on every render; rebuild only when what it holds changes
  const subjectKey = subject.map(s => `${s.id}:${s.checklists.map(c => c.id).join('+')}`).join('|');
  const optionsKey = JSON.stringify(input.options);
  const isEmpty = subject.length === 0;

  const build = useEffectEvent(() => {
    const { options, members, meta, projectName } = input;
    try {
      // Workspace studies carry no answers until hydrated, same as the download path
      const studies = enrichStudiesForExport(projectId, subject);
      if (options.format === 'csv') {
        const rows = buildProjectCsvRows({
          studies,
          members,
          meta,
          includeNotes: options.includeNotes,
        });
        setPreview({ kind: 'csv', rows });
        return;
      }
      const doc = buildProjectPdf({
        studies,
        projectName:
          subject.length === 1 && options.delivery !== 'single' ? subject[0].name : projectName,
        members,
        meta,
        includeSignallingQuestions: options.includeSignallingQuestions,
        includeNotes: options.includeNotes,
        pageSize: options.pageSize,
        orientation: options.orientation,
      });
      // The viewer only reloads when it sees a new document id, so each build gets one
      versionRef.current += 1;
      setPreview({
        kind: 'pdf',
        data: doc.output('arraybuffer'),
        pages: doc.getNumberOfPages(),
        version: versionRef.current,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // The download runs the same exporter, so this is the earliest sign it will fail too
      clientLogger.error('client.export.preview_failed', {
        format: options.format,
        studies: subject.length,
        error: message,
      });
      setPreview({ kind: 'error', message });
    }
  });

  useEffect(() => {
    if (isEmpty) {
      setPreview(null);
      setUpdating(false);
      return;
    }
    setUpdating(true);
    const timer = setTimeout(() => {
      build();
      setUpdating(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [subjectKey, optionsKey, isEmpty]);

  return { preview, updating };
}
