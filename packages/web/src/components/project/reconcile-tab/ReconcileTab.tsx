/**
 * ReconcileTab - Studies in the reconciliation workflow
 */

import { useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRightLeftIcon } from 'lucide-react';
import { ReconcileStudyRow } from './ReconcileStudyRow';
import { useProjectStore, selectStudies } from '@/stores/projectStore';
import { useProjectContext } from '../ProjectContext';
import { getStudiesForTab } from '@corates/shared/checklists';
import { project } from '@/project';

export function ReconcileTab() {
  const { projectId, getAssigneeName, getReconcilePath } = useProjectContext();
  const navigate = useNavigate();

  const studies = useProjectStore(s => selectStudies(s, projectId));
  const meta = useProjectStore(s => s.projects[projectId]?.meta);

  const getOutcomeName = useCallback(
    (outcomeId: string) => {
      const outcomes = meta?.outcomes ?? [];
      return outcomes.find(o => o.id === outcomeId)?.name || null;
    },
    [meta],
  );

  const studiesInReconciliation = useMemo(
    () => getStudiesForTab(studies, 'reconcile', null),
    [studies],
  );

  const openReconciliation = useCallback(
    (studyId: string, checklist1Id: string, checklist2Id: string) => {
      navigate({ to: getReconcilePath(studyId, checklist1Id, checklist2Id) as string });
    },
    [navigate, getReconcilePath],
  );

  return (
    <div className='flex flex-col gap-2'>
      {studiesInReconciliation.length > 0 ?
        studiesInReconciliation.map(study => (
          <ReconcileStudyRow
            key={study.id}
            study={study}
            onReconcile={(c1Id, c2Id) => openReconciliation(study.id, c1Id, c2Id)}
            onViewPdf={pdf => project.pdf.view(study.id, pdf)}
            onDownloadPdf={pdf => project.pdf.download(study.id, pdf)}
            getAssigneeName={getAssigneeName}
            getOutcomeName={getOutcomeName}
          />
        ))
      : <div className='py-16 text-center'>
          <ArrowRightLeftIcon className='text-muted-foreground/50 mx-auto mb-4 size-12' />
          <h3 className='text-foreground mb-2 text-lg font-medium'>Reconciliation</h3>
          <p className='text-muted-foreground mx-auto max-w-md'>
            Studies where reviewers have completed their checklists will appear here for
            reconciliation.
          </p>
        </div>
      }
    </div>
  );
}
