/**
 * ReconcileTab - Studies in the reconciliation workflow
 */

import { useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRightLeftIcon } from 'lucide-react';
import { ReconcileStudyRow } from './ReconcileStudyRow';
import { useProjectContext } from '../ProjectContext';
import { useAllStudies, useProjectOutcomes } from '@/project/workspace-data';
import { getStudiesForTab } from '@corates/shared/checklists';
import { project } from '@/project';

export function ReconcileTab() {
  const { projectId, getAssigneeName, getReconcilePath } = useProjectContext();
  const navigate = useNavigate();

  const studies = useAllStudies(projectId);
  const outcomes = useProjectOutcomes(projectId);

  const getOutcomeName = useCallback(
    (outcomeId: string) => outcomes.find(o => o.id === outcomeId)?.name || null,
    [outcomes],
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
          <ArrowRightLeftIcon className='text-muted-foreground mx-auto mb-4 size-12 opacity-50' />
          <h3 className='text-foreground mb-2 text-lg font-medium'>Nothing to reconcile yet</h3>
          <p className='text-muted-foreground mx-auto max-w-md'>
            A study appears here once both of its reviewers have completed their appraisal. Open the
            To-Do tab to see which appraisals are still in progress.
          </p>
        </div>
      }
    </div>
  );
}
