/**
 * ReconcileTab - Studies in the reconciliation workflow
 */

import { useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRightLeftIcon } from 'lucide-react';
import { ReconcileStudyRow } from './ReconcileStudyRow';
import { useProjectStore } from '@/stores/projectStore';
import { useProjectContext } from '../ProjectContext';
import { getStudiesForTab } from '@/lib/checklist-domain.js';
import _projectActionsStore from '@/stores/projectActionsStore/index.js';

const projectActionsStore = _projectActionsStore as any;

export function ReconcileTab() {
  const { projectId, getAssigneeName, getReconcilePath } = useProjectContext();
  const navigate = useNavigate();

  const studies = useProjectStore(s => s.projects[projectId]?.studies || []);
  const meta = useProjectStore(s => s.projects[projectId]?.meta) as any;

  const getOutcomeName = useCallback(
    (outcomeId: string) => {
      const outcomes = meta?.outcomes || [];
      return outcomes.find((o: any) => o.id === outcomeId)?.name || null;
    },
    [meta],
  );

  const studiesInReconciliation = useMemo(
    () => getStudiesForTab(studies, 'reconcile', null as any),
    [studies],
  );

  const openReconciliation = useCallback(
    (studyId: string, checklist1Id: string, checklist2Id: string) => {
      navigate({ to: getReconcilePath(studyId, checklist1Id, checklist2Id) as string });
    },
    [navigate, getReconcilePath],
  );

  return (
    <div className="space-y-2">
      {studiesInReconciliation.length > 0 ? (
        studiesInReconciliation.map((study: any) => (
          <ReconcileStudyRow
            key={study.id}
            study={study}
            onReconcile={(c1Id, c2Id) => openReconciliation(study.id, c1Id, c2Id)}
            onViewPdf={pdf => projectActionsStore.pdf.view(study.id, pdf)}
            onDownloadPdf={pdf => projectActionsStore.pdf.download(study.id, pdf)}
            getAssigneeName={getAssigneeName}
            getOutcomeName={getOutcomeName}
          />
        ))
      ) : (
        <div className="py-16 text-center">
          <ArrowRightLeftIcon className="text-muted-foreground/50 mx-auto mb-4 h-12 w-12" />
          <h3 className="text-foreground mb-2 text-lg font-medium">Reconciliation</h3>
          <p className="text-muted-foreground mx-auto max-w-md">
            Studies where reviewers have completed their checklists will appear here for
            reconciliation.
          </p>
        </div>
      )}
    </div>
  );
}
