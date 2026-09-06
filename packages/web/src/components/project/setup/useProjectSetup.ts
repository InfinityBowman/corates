/**
 * Shared state for the first-run setup surfaces (hero and compact card).
 * Steps are never gated: each reports done or an explanatory lock reason,
 * and every open handler targets the sheet the project header already uses.
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useAllStudies,
  useProjectMembers,
  useProjectMeta,
  useProjectOutcomes,
} from '@/project/workspace-data';
import { useMembers } from '@/hooks/useMembers';
import { useSubscription } from '@/hooks/useSubscription';
import { queryKeys } from '@/lib/queryKeys';
import { getInvitations, updateProjectSetupStep } from '@/server/functions/org-projects.functions';
import { useProjectContext } from '../ProjectContext';

export type SetupStepKey = 'studies' | 'outcomes' | 'team' | 'assign';

export interface SetupStep {
  key: SetupStepKey;
  title: string;
  description: string;
  cta: string;
  done: boolean;
  lockReason: string | null;
  onOpen: () => void;
}

interface PendingInvitation {
  id: string;
  email: string;
}

export function useProjectSetup() {
  const { projectId, orgId, setAddStudiesSheetOpen, openAssignSheet, setOutcomesSheetOpen } =
    useProjectContext();
  const queryClient = useQueryClient();
  const meta = useProjectMeta(projectId);
  const studies = useAllStudies(projectId);
  const outcomes = useProjectOutcomes(projectId);
  const members = useProjectMembers(projectId);
  const { quotas } = useSubscription();
  const { members: orgMembers } = useMembers();
  const { data: invitations = [] } = useQuery({
    queryKey: queryKeys.projects.invitations(projectId),
    queryFn: async () =>
      (await getInvitations({ data: { orgId: orgId!, projectId } })) as PendingInvitation[],
    enabled: !!orgId,
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const collaboratorQuotaInfo = {
    used: orgMembers.filter(m => m.role !== 'owner').length,
    max: quotas['collaborators.org.max'] ?? 0,
  };

  const hasStudies = studies.length > 0;
  const hasTeam = members.length > 1;
  const hasInvited = invitations.length > 0;
  const assignDone = hasStudies && studies.every(s => s.reviewer1 && s.reviewer2);

  const steps: SetupStep[] = [
    {
      key: 'studies',
      title: 'Add studies',
      description:
        'Upload PDFs, import a reference file, paste DOIs or PubMed IDs, or pull from Google Drive.',
      cta: 'Add studies',
      done: hasStudies,
      lockReason: null,
      onOpen: () => setAddStudiesSheetOpen(true),
    },
    {
      key: 'outcomes',
      title: 'Define outcomes',
      description:
        'RoB 2 and ROBINS-I judge each outcome separately. Add them now, or when a reviewer needs one.',
      cta: 'Add outcomes',
      done: outcomes.length > 0,
      lockReason: null,
      onOpen: () => setOutcomesSheetOpen(true),
    },
    {
      key: 'team',
      title: 'Invite your co-reviewers',
      description: 'Two reviewers appraise each study independently. You count as one.',
      cta: 'Invite',
      done: hasTeam || hasInvited,
      lockReason: null,
      onOpen: () => setInviteOpen(true),
    },
    {
      key: 'assign',
      title: 'Assign reviewers',
      description: 'Split the studies across the team. Everyone is notified once.',
      cta: 'Assign',
      done: assignDone,
      lockReason:
        !hasStudies ? 'Needs studies'
        : !hasTeam ? 'Needs a second member'
        : null,
      onOpen: () => openAssignSheet(),
    },
  ];
  const activeKey = steps.find(step => !step.done && !step.lockReason)?.key ?? null;
  const doneCount = steps.filter(step => step.done).length;

  const dismiss = async () => {
    if (!orgId) return;
    setIsDismissing(true);
    try {
      await updateProjectSetupStep({ data: { orgId, projectId, setupStep: null } });
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Could not close setup' });
      setIsDismissing(false);
    }
  };

  return {
    projectId,
    orgId,
    projectName: meta.name,
    steps,
    activeKey,
    doneCount,
    studies,
    outcomes,
    members,
    invitations,
    hasTeam,
    hasInvited,
    inviteOpen,
    setInviteOpen,
    collaboratorQuotaInfo,
    dismiss,
    isDismissing,
  };
}
