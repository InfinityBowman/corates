/**
 * CompletedTab - Studies that have completed review/reconciliation
 */

import { useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { CheckCircleIcon } from 'lucide-react';
import { useProjectContext } from '../ProjectContext';
import {
  useAllReconciliationProgress,
  useAllStudies,
  useProjectOutcomes,
  type ReconciliationProgressEntry,
} from '@/project/workspace-data';
import {
  getStudiesForTab,
  isDualReviewerStudy,
  getOutcomeKey,
  CHECKLIST_STATUS,
} from '@corates/shared/checklists';
import { showToast } from '@/lib/toast';
import { CompletedStudyRow } from './CompletedStudyRow';
import { project } from '@/project';
import { useProjectExport } from '@/hooks/useProjectExport';

export function CompletedTab() {
  const { projectId, getAssigneeName, getChecklistPath } = useProjectContext();
  const navigate = useNavigate();
  const allProgress = useAllReconciliationProgress(projectId);

  const studies = useAllStudies(projectId);
  const outcomes = useProjectOutcomes(projectId);
  const { exportStudyCsv, exportStudyPdf } = useProjectExport(projectId);

  const getOutcomeName = useCallback(
    (outcomeId: string) => {
      return outcomes.find(o => o.id === outcomeId)?.name || null;
    },
    [outcomes],
  );

  const completedStudies = useMemo(() => getStudiesForTab(studies, 'completed', null), [studies]);

  const openChecklist = useCallback(
    (studyId: string, checklistId: string) => {
      navigate({ to: getChecklistPath(studyId, checklistId, 'completed') as string });
    },
    [navigate, getChecklistPath],
  );

  const reopenReconciliation = useCallback((studyId: string, checklistId: string) => {
    project.checklist.update(studyId, checklistId, { status: CHECKLIST_STATUS.RECONCILING });
    showToast.success('Reconciliation Reopened', 'The study has moved to the Reconcile tab.');
  }, []);

  const getReconciliationProgress = useCallback(
    (
      studyId: string,
      outcomeId: string | null,
      type: string,
    ): ReconciliationProgressEntry | null => {
      const study = studies.find(s => s.id === studyId);
      if (!study || !isDualReviewerStudy(study)) return null;

      const outcomeKey = getOutcomeKey(outcomeId, type);
      return allProgress.find(p => p.studyId === studyId && p.outcomeKey === outcomeKey) || null;
    },
    [studies, allProgress],
  );

  return (
    <div className='flex flex-col gap-2'>
      {completedStudies.length > 0 ?
        completedStudies.map(study => (
          <CompletedStudyRow
            key={study.id}
            study={study}
            onOpenChecklist={checklistId => openChecklist(study.id, checklistId)}
            onReopenReconciliation={checklistId => reopenReconciliation(study.id, checklistId)}
            onViewPdf={pdf => project.pdf.view(study.id, pdf)}
            onDownloadPdf={pdf => project.pdf.download(study.id, pdf)}
            onExportCsv={() => exportStudyCsv(study.id)}
            onExportPdf={() => exportStudyPdf(study.id)}
            getReconciliationProgress={(outcomeId, type) =>
              getReconciliationProgress(study.id, outcomeId, type)
            }
            getAssigneeName={getAssigneeName}
            getOutcomeName={getOutcomeName}
          />
        ))
      : <div className='py-16 text-center'>
          <CheckCircleIcon className='text-muted-foreground mx-auto mb-4 size-12 opacity-50' />
          <h3 className='text-foreground mb-2 text-lg font-medium'>Completed</h3>
          <p className='text-muted-foreground mx-auto max-w-md'>
            Studies that have completed reconciliation will appear here.
          </p>
        </div>
      }
    </div>
  );
}
