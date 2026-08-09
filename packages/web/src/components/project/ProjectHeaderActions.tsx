/**
 * ProjectHeaderActions - Add studies / Assign reviewers cluster in the sticky
 * project header, with the sheets they open.
 */

import { useState, useMemo, useCallback } from 'react';
import { PlusIcon, UsersIcon, TargetIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AddStudiesSheet } from './add-studies/AddStudiesSheet';
import { AssignReviewersSheet } from './assign-reviewers/AssignReviewersSheet';
import { OutcomesSheet } from './outcomes/OutcomesSheet';
import { useAllStudies, useProjectMembers, useProjectOutcomes } from '@/project/workspace-data';
import { useProjectContext } from './ProjectContext';

export function ProjectHeaderActions() {
  const { projectId, isOwner } = useProjectContext();

  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [outcomesOpen, setOutcomesOpen] = useState(false);

  const studies = useAllStudies(projectId);
  const members = useProjectMembers(projectId);
  const outcomes = useProjectOutcomes(projectId);

  const unassignedCount = useMemo(
    () => studies.filter(s => !s.reviewer1 && !s.reviewer2).length,
    [studies],
  );

  // addBatch already shows its own result toast; this one is just the handoff
  // into bulk assignment for the studies that arrived unassigned.
  const handleAdded = useCallback(
    (count: number) => {
      if (!isOwner || members.length < 2 || count === 0) return;
      toast('Assign reviewers to the new studies?', {
        duration: 10000,
        action: {
          label: 'Assign reviewers',
          onClick: () => setAssignOpen(true),
        },
      });
    },
    [isOwner, members.length],
  );

  return (
    <div className='flex shrink-0 items-center gap-2'>
      <Button
        variant='ghost'
        onClick={() => setOutcomesOpen(true)}
        className='text-muted-foreground'
      >
        <TargetIcon className='size-4' />
        Outcomes
        {outcomes.length > 0 && (
          <Badge variant='secondary' className='min-w-5 px-1.5 tabular-nums'>
            {outcomes.length}
          </Badge>
        )}
      </Button>

      {isOwner && studies.length > 0 && (
        <Button variant='outline' onClick={() => setAssignOpen(true)}>
          <UsersIcon className='size-4' />
          Assign reviewers
          {unassignedCount > 0 && (
            <Badge variant='info' className='min-w-5 px-1.5 tabular-nums'>
              {unassignedCount}
            </Badge>
          )}
        </Button>
      )}

      <Button onClick={() => setAddOpen(true)}>
        <PlusIcon className='size-4' />
        Add studies
      </Button>

      <AddStudiesSheet open={addOpen} onOpenChange={setAddOpen} onAdded={handleAdded} />
      {isOwner && <AssignReviewersSheet open={assignOpen} onOpenChange={setAssignOpen} />}
      <OutcomesSheet open={outcomesOpen} onOpenChange={setOutcomesOpen} />
    </div>
  );
}
