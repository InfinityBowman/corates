/**
 * ChangeOutcomeDialog - Move a study's checklists for one outcome to another
 *
 * Moves the reviewer checklists and, when the group is already reconciled,
 * the finalized consensus checklist along with them. Outcomes that would
 * collide with an existing checklist for one of the same reviewers are not
 * offered as targets.
 */

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { getChecklistMetadata } from '@/checklist-registry';
import { CHECKLIST_STATUS, isReconciledChecklist } from '@corates/shared/checklists';
import { useProjectMetaById } from '@/primitives/useProject/reactor';
import { useProjectContext } from './ProjectContext';
import { project } from '@/project';
import type { StudyInfo } from '@/stores/projectStore';

interface ChangeOutcomeDialogProps {
  study: StudyInfo;
  checklistType: string;
  outcomeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeOutcomeDialog({
  study,
  checklistType,
  outcomeId,
  open,
  onOpenChange,
}: ChangeOutcomeDialogProps) {
  const { projectId } = useProjectContext();
  const meta = useProjectMetaById(projectId);
  const outcomes = useMemo(() => meta?.outcomes ?? [], [meta?.outcomes]);

  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);

  const currentOutcomeName = outcomes.find(o => o.id === outcomeId)?.name || 'Unknown Outcome';

  const availableOutcomes = useMemo(() => {
    const moverAssignees = new Set(
      study.checklists
        .filter(c => c.type === checklistType && c.outcomeId === outcomeId)
        .map(c => c.assignedTo ?? null),
    );
    return outcomes.filter(outcome => {
      if (outcome.id === outcomeId) return false;
      const collides = study.checklists.some(
        c =>
          c.type === checklistType &&
          c.outcomeId === outcome.id &&
          moverAssignees.has(c.assignedTo ?? null),
      );
      return !collides;
    });
  }, [outcomes, study.checklists, checklistType, outcomeId]);

  const hasFinalizedConsensus = study.checklists.some(
    c =>
      isReconciledChecklist(c) &&
      c.type === checklistType &&
      c.outcomeId === outcomeId &&
      c.status === CHECKLIST_STATUS.FINALIZED,
  );

  const handleConfirm = () => {
    if (!selectedOutcomeId) return;
    const success = project.checklist.changeOutcome(
      study.id,
      checklistType,
      outcomeId,
      selectedOutcomeId,
    );
    if (success) {
      setSelectedOutcomeId(null);
      onOpenChange(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setSelectedOutcomeId(null);
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Outcome</DialogTitle>
          <DialogDescription>
            Move the {getChecklistMetadata(checklistType).name} appraisals of{' '}
            <span className='font-medium'>{study.name}</span> from{' '}
            <span className='font-medium'>{currentOutcomeName}</span> to a different outcome.
            {hasFinalizedConsensus && ' The finalized reconciliation moves with them.'}
          </DialogDescription>
        </DialogHeader>

        {availableOutcomes.length > 0 ?
          <Select value={selectedOutcomeId || ''} onValueChange={v => setSelectedOutcomeId(v || null)}>
            <SelectTrigger>
              <SelectValue placeholder='Select new outcome...' />
            </SelectTrigger>
            <SelectContent>
              {availableOutcomes.map(outcome => (
                <SelectItem key={outcome.id} value={outcome.id}>
                  {outcome.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        : <div className='border-warning-border bg-warning-bg rounded-lg border p-3'>
            <p className='text-warning-foreground text-sm font-medium'>No available outcomes</p>
            <p className='text-warning mt-1 text-xs'>
              Every other outcome already has a checklist for one of these reviewers. Add a new
              outcome in the All Studies tab first.
            </p>
          </div>
        }

        <DialogFooter>
          <Button variant='secondary' onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedOutcomeId}>
            Change Outcome
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
