import { useCallback, useMemo } from 'react';
import { clientLogger } from '@/lib/clientLogger';
import { buildProjectCsv, downloadCsv } from '@/lib/export-csv';
import { buildProjectPdf, downloadPdf } from '@/lib/export-pdf';
import { enrichStudiesForExport } from '@/lib/enrich-studies-for-export';
import {
  useAllStudies,
  useProjectMembers,
  useProjectMeta,
  useProjectOutcomes,
} from '@/project/workspace-data';
import type { ProjectMeta, StudyInfo } from '@/stores/projectStore';

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'export';
}

export function useProjectExport(projectId: string) {
  const studies = useAllStudies(projectId);
  const members = useProjectMembers(projectId);
  const outcomes = useProjectOutcomes(projectId);
  const projectMeta = useProjectMeta(projectId);

  const exportMeta: ProjectMeta = useMemo(
    () => ({
      name: projectMeta.name ?? undefined,
      outcomes,
    }),
    [projectMeta.name, outcomes],
  );

  const hasExportableData = useMemo(
    () => studies.some(study => study.checklists.length > 0),
    [studies],
  );

  const enrich = useCallback(
    (toExport: StudyInfo[]) => enrichStudiesForExport(projectId, toExport),
    [projectId],
  );

  const exportAllCsv = useCallback(() => {
    const csv = buildProjectCsv({ studies: enrich(studies), members, meta: exportMeta });
    const date = new Date().toISOString().slice(0, 10);
    const projectName = safeFilename(projectMeta.name || 'project');
    downloadCsv(csv, `corates-${projectName}-${date}.csv`);
    clientLogger.info('client.export.project', { format: 'csv', scope: 'all' });
  }, [studies, enrich, members, exportMeta, projectMeta.name]);

  const exportAllPdf = useCallback(() => {
    const doc = buildProjectPdf({
      studies: enrich(studies),
      projectName: projectMeta.name || undefined,
      members,
      meta: exportMeta,
    });
    const date = new Date().toISOString().slice(0, 10);
    const projectName = safeFilename(projectMeta.name || 'project');
    downloadPdf(doc, `corates-${projectName}-${date}.pdf`);
    clientLogger.info('client.export.project', { format: 'pdf', scope: 'all' });
  }, [studies, enrich, projectMeta.name, members, exportMeta]);

  const exportStudyCsv = useCallback(
    (studyId: string) => {
      const study = studies.find(s => s.id === studyId);
      if (!study) return;
      const csv = buildProjectCsv({ studies: enrich([study]), members, meta: exportMeta });
      downloadCsv(csv, `${safeFilename(study.name || 'study')}.csv`);
      clientLogger.info('client.export.project', { format: 'csv', scope: 'single' });
    },
    [studies, enrich, members, exportMeta],
  );

  const exportStudyPdf = useCallback(
    (studyId: string) => {
      const study = studies.find(s => s.id === studyId);
      if (!study) return;
      const doc = buildProjectPdf({
        studies: enrich([study]),
        projectName: study.name || undefined,
        members,
        meta: exportMeta,
      });
      downloadPdf(doc, `${safeFilename(study.name || 'study')}.pdf`);
      clientLogger.info('client.export.project', { format: 'pdf', scope: 'single' });
    },
    [studies, enrich, members, exportMeta],
  );

  return {
    hasExportableData,
    exportAllCsv,
    exportAllPdf,
    exportStudyCsv,
    exportStudyPdf,
  };
}
