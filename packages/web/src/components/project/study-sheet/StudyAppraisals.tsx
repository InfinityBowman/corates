/**
 * StudyAppraisals - one study's reviewers, tool, and the outcomes it is
 * appraised on. Each tick adds or removes one appraisal cell; every reviewer
 * on the study gets or loses the matching checklist.
 */

import { useState } from 'react';
import { CHECKLIST_STATUS, getAppraisalCells, requiresOutcome } from '@corates/shared/checklists';
import type { AppraisalCell } from '@corates/shared/checklists';
import { getChecklistMetadata, getChecklistTypeOptions } from '@/checklist-registry';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MemberAvatar, memberDisplayName } from '@/components/project/MemberAvatar';
import type { ProjectMember } from '@/components/project/ProjectContext';
import type { AppraisalCellRef } from '@/project/actions/appraisals';
import type { OutcomeEntry, StudyInfo } from '@/stores/projectStore';

interface StudyAppraisalsProps {
  study: StudyInfo;
  outcomes: OutcomeEntry[];
  /** Tool to offer when the study has no appraisals yet. */
  defaultTool: string;
  readOnly: boolean;
  getMember: (userId: string | null) => ProjectMember | null;
  onAssignReviewers: () => void;
  onManageOutcomes: () => void;
  onCreate: (cells: AppraisalCellRef[]) => void;
  onDelete: (cells: AppraisalCellRef[], force: boolean) => void;
  cellHasAnswers: (cell: AppraisalCellRef) => boolean;
}

type Confirm =
  | { kind: 'remove'; cell: AppraisalCellRef; label: string }
  | { kind: 'switch'; to: string; cells: AppraisalCellRef[]; withAnswers: boolean };

function cellStatus(cell: AppraisalCell | undefined, hasReviewers: boolean): string {
  if (!cell) return '';
  if (cell.checklists.length === 0) return hasReviewers ? 'Not started' : 'Waiting for reviewers';
  const statuses = cell.checklists.map(c => c.status);
  if (statuses.includes(CHECKLIST_STATUS.FINALIZED)) return 'Complete';
  if (statuses.includes(CHECKLIST_STATUS.RECONCILING)) return 'Reconciling';
  if (statuses.every(s => s === CHECKLIST_STATUS.PENDING)) return 'Not started';
  return 'In progress';
}

export function StudyAppraisals({
  study,
  outcomes,
  defaultTool,
  readOnly,
  getMember,
  onAssignReviewers,
  onManageOutcomes,
  onCreate,
  onDelete,
  cellHasAnswers,
}: StudyAppraisalsProps) {
  const [pickedTool, setPickedTool] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const cells = getAppraisalCells(study);
  // A study uses one tool: the one its appraisals already carry, else the pick.
  const tool = cells[0]?.type ?? pickedTool ?? defaultTool;
  const toolName = getChecklistMetadata(tool).shortName;
  const toolCells = cells.filter(c => c.type === tool);
  const outcomeLinked = requiresOutcome(tool);
  const reviewers = [study.reviewer1, study.reviewer2]
    .filter((id): id is string => !!id)
    .map(id => getMember(id) ?? { userId: id });
  const hasReviewers = reviewers.length > 0;

  const toRef = (outcomeId: string | null): AppraisalCellRef => ({
    studyId: study.id,
    type: tool,
    outcomeId,
  });

  function toggle(outcomeId: string | null, label: string, checked: boolean) {
    const cell = toRef(outcomeId);
    if (checked) {
      onCreate([cell]);
    } else if (cellHasAnswers(cell)) {
      setConfirm({ kind: 'remove', cell, label });
    } else {
      onDelete([cell], false);
    }
  }

  function changeTool(next: string) {
    if (next === tool) return;
    if (toolCells.length === 0) {
      setPickedTool(next);
      return;
    }
    const refs = toolCells.map(c => toRef(c.outcomeId));
    setConfirm({ kind: 'switch', to: next, cells: refs, withAnswers: refs.some(cellHasAnswers) });
  }

  function runConfirm() {
    if (!confirm) return;
    if (confirm.kind === 'remove') {
      onDelete([confirm.cell], true);
    } else {
      onDelete(confirm.cells, true);
      setPickedTool(confirm.to);
    }
    setConfirm(null);
  }

  const rows =
    outcomeLinked ?
      outcomes.map(o => ({ outcomeId: o.id, label: o.name }))
    : [{ outcomeId: null, label: `Appraise with ${toolName}` }];

  return (
    <div data-testid='study-appraisals'>
      <dl className='grid grid-cols-[6rem_1fr] items-center gap-x-3 gap-y-3 px-4 pt-4 pb-4 text-sm'>
        <dt className='text-muted-foreground'>Reviewers</dt>
        <dd className='flex min-w-0 flex-wrap items-center gap-2'>
          {reviewers.map(member => (
            <span key={member.userId} className='flex items-center gap-1.5'>
              <MemberAvatar member={member} className='size-5 text-[10px]' />
              <span className='truncate'>{memberDisplayName(member)}</span>
            </span>
          ))}
          {!hasReviewers && <span className='text-muted-foreground italic'>None yet</span>}
          {!readOnly && (
            <Button variant='ghost' size='xs' onClick={onAssignReviewers}>
              {hasReviewers ? 'Change' : 'Assign'}
            </Button>
          )}
        </dd>

        <dt className='text-muted-foreground'>Tool</dt>
        <dd>
          {readOnly ?
            <span>{toolName}</span>
          : <Select value={tool} onValueChange={changeTool}>
              <SelectTrigger size='sm' className='w-fit min-w-40' aria-label='Tool'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getChecklistTypeOptions().map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        </dd>
      </dl>

      <p className='text-2xs text-muted-foreground border-border border-t px-4 pt-3 pb-1.5 font-semibold tracking-wide uppercase'>
        Appraisals
      </p>

      {outcomeLinked && outcomes.length === 0 ?
        <div className='border-warning-border bg-warning-bg mx-4 my-2 rounded-lg border p-3'>
          <p className='text-warning-foreground text-sm font-medium'>No outcomes yet</p>
          <p className='text-warning mt-1 text-xs'>
            {toolName} is completed once per outcome, so the project needs at least one outcome
            before this study can be appraised.
          </p>
          {!readOnly && (
            <Button variant='outline' size='xs' className='mt-2' onClick={onManageOutcomes}>
              Manage outcomes
            </Button>
          )}
        </div>
      : <ul className='divide-border divide-y'>
          {rows.map(row => {
            const cell = toolCells.find(c => c.outcomeId === row.outcomeId);
            const id = `appraisal-${study.id}-${row.outcomeId ?? 'single'}`;
            return (
              <li key={id} className='flex items-center gap-3 px-4 py-2'>
                <Checkbox
                  id={id}
                  checked={!!cell}
                  disabled={readOnly}
                  onCheckedChange={checked => toggle(row.outcomeId, row.label, checked === true)}
                  data-testid={`appraisal-toggle-${row.outcomeId ?? 'single'}`}
                />
                <label htmlFor={id} className='min-w-0 flex-1 truncate text-sm'>
                  {row.label}
                </label>
                <span className='text-muted-foreground shrink-0 text-xs'>
                  {cellStatus(cell, hasReviewers)}
                </span>
              </li>
            );
          })}
        </ul>
      }

      {!readOnly && (
        <p className='text-muted-foreground px-4 pt-3 pb-4 text-xs'>
          {hasReviewers ?
            `Each reviewer gets a ${toolName} checklist for every selected ${outcomeLinked ? 'outcome' : 'row'}.`
          : 'Reviewers get their checklists for the selected rows once they are assigned.'}
        </p>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={open => !open && setConfirm(null)}>
        <AlertDialogContent data-testid='appraisal-confirm'>
          <AlertDialogHeader>
            <AlertDialogIcon variant='danger' />
            <div>
              <AlertDialogTitle>
                {confirm?.kind === 'switch' ?
                  `Switch to ${getChecklistMetadata(confirm.to).shortName}?`
                : 'Remove this appraisal?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirm?.kind === 'switch' ?
                  `This study uses one tool. Its ${confirm.cells.length} ${toolName} ${
                    confirm.cells.length === 1 ? 'appraisal' : 'appraisals'
                  } and every checklist on ${confirm.cells.length === 1 ? 'it' : 'them'}${
                    confirm.withAnswers ? ', including recorded answers,' : ''
                  } will be removed.`
                : `${toolName} on ${confirm?.label ?? 'this outcome'} already has answers. Removing it deletes every reviewer's checklist for it and any reconciliation.`
                }
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={runConfirm}>
              {confirm?.kind === 'switch' ? 'Switch tool' : 'Remove anyway'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
