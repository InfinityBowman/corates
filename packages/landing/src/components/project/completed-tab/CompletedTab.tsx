/**
 * CompletedTab - Studies that have completed review/reconciliation
 */

import { useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { CheckCircleIcon } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useProjectContext } from '../ProjectContext';
import { getStudiesForTab, isDualReviewerStudy, getOutcomeKey } from '@/lib/checklist-domain.js';
import { useProject } from '@/primitives/useProject';
import { CompletedStudyRow } from './CompletedStudyRow';
import _projectActionsStore from '@/stores/projectActionsStore/index.js';

const projectActionsStore = _projectActionsStore as any;

export function CompletedTab() {
  const { projectId, getAssigneeName, getChecklistPath } = useProjectContext();
  const navigate = useNavigate();
  const { getAllReconciliationProgress } = useProject(projectId);

  const studies = useProjectStore(s => s.projects[projectId]?.studies || []);
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
    <div className='space-y-2'>
      {completedStudies.length > 0 ?
        completedStudies.map((study: any) => (
          <CompletedStudyRow
            key={study.id}
            study={study}
            onOpenChecklist={checklistId => openChecklist(study.id, checklistId)}
            onViewPdf={pdf => projectActionsStore.pdf.view(study.id, pdf)}
            onDownloadPdf={pdf => projectActionsStore.pdf.download(study.id, pdf)}
            getReconciliationProgress={(outcomeId, type) =>
              getReconciliationProgress(study.id, outcomeId, type)
            }
            getAssigneeName={getAssigneeName}
            getOutcomeName={getOutcomeName}
          />
        ))
      : <div className='py-16 text-center'>
          <CheckCircleIcon className='text-muted-foreground/50 mx-auto mb-4 h-12 w-12' />
          <h3 className='text-foreground mb-2 text-lg font-medium'>Completed</h3>
          <p className='text-muted-foreground mx-auto max-w-md'>
            Studies that have completed reconciliation will appear here.
          </p>
        </div>
      }
    </div>
  );
}
