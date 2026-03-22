/**
 * CompletedTab - Studies that have completed review/reconciliation
 */

import { useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { CheckCircleIcon } from 'lucide-react';
import { useProjectStore, selectStudies } from '@/stores/projectStore';
import { useProjectContext } from '../ProjectContext';
import { connectionPool } from '@/project/ConnectionPool';
import { getStudiesForTab, isDualReviewerStudy, getOutcomeKey } from '@/lib/checklist-domain.js';
import { CompletedStudyRow } from './CompletedStudyRow';
import { project } from '@/project';

export function CompletedTab() {
  const { projectId, getAssigneeName, getChecklistPath } = useProjectContext();
  const navigate = useNavigate();
  const conn = connectionPool.get(projectId);
  if (!conn) throw new Error(`No connection for project ${projectId}`);
  const getAllReconciliationProgress = conn.getAllReconciliationProgress;

  const studies = useProjectStore(s => selectStudies(s, projectId));
  const meta = useProjectStore(s => s.projects[projectId]?.meta) as any;

  const getOutcomeName = useCallback(
    (outcomeId: string) => {
      const outcomes = meta?.outcomes || [];
      return outcomes.find((o: any) => o.id === outcomeId)?.name || null;
    },
    [meta],
  );

  const completedStudies = useMemo(() => getStudiesForTab(studies, 'completed', null), [studies]);

  const openChecklist = useCallback(
    (studyId: string, checklistId: string) => {
      navigate({ to: getChecklistPath(studyId, checklistId, 'completed') as string });
    },
    [navigate, getChecklistPath],
  );

  const getReconciliationProgress = useCallback(
    (studyId: string, outcomeId: string | null, type: string) => {
      const study = studies.find((s: any) => s.id === studyId);
      if (!study || !isDualReviewerStudy(study)) return null;

      const allProgress = getAllReconciliationProgress(studyId) || [];
      const outcomeKey = getOutcomeKey(outcomeId, type);
      return (allProgress as any[]).find((p: any) => p.outcomeKey === outcomeKey) || null;
    },
    [studies, getAllReconciliationProgress],
  );

  return (
    <div className='flex flex-col gap-2'>
      {completedStudies.length > 0 ?
        completedStudies.map((study: any) => (
          <CompletedStudyRow
            key={study.id}
            study={study}
            onOpenChecklist={checklistId => openChecklist(study.id, checklistId)}
            onViewPdf={pdf => project.pdf.view(study.id, pdf)}
            onDownloadPdf={pdf => project.pdf.download(study.id, pdf)}
            getReconciliationProgress={(outcomeId, type) =>
              getReconciliationProgress(study.id, outcomeId, type)
            }
            getAssigneeName={getAssigneeName}
            getOutcomeName={getOutcomeName}
          />
        ))
      : <div className='py-16 text-center'>
          <CheckCircleIcon className='text-muted-foreground/50 mx-auto mb-4 size-12' />
          <h3 className='text-foreground mb-2 text-lg font-medium'>Completed</h3>
          <p className='text-muted-foreground mx-auto max-w-md'>
            Studies that have completed reconciliation will appear here.
          </p>
        </div>
      }
    </div>
  );
}
