/**
 * ReviewerAssignment - Studies in scope with two reviewer slots each, a team
 * load strip, and Auto-fill. Nothing is written until Save.
 */

import { useState } from 'react';
import { EraserIcon, WandSparklesIcon, XIcon } from 'lucide-react';
import { getInProgressChecklistsOfLeavingReviewers } from '@corates/shared/checklists';
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
import { Button } from '@/components/ui/button';
import { SheetFooter } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { showToast } from '@/lib/toast';
import type { StudyInfo, MemberEntry } from '@/stores/projectStore';
import { getCitationLine, sortStudyPdfs } from '../study-utils';
import { MemberAvatar, memberDisplayName } from '../MemberAvatar';
import type { AssignSheetScope } from '../ProjectContext';
import { TruncatedText } from '@/components/ui/truncated-text';
import { ReviewerPicker } from './ReviewerPicker';
import { AutoFillSettings, evenShares } from './AutoFillSettings';
import {
  autoFillSlots,
  countLoad,
  unassignedFirst,
  type ReviewerSlots,
  type SlotRows,
} from './autoFill';

const SLOTS = ['reviewer1', 'reviewer2'] as const;

interface ReviewerAssignmentProps {
  scope: AssignSheetScope | null;
  studies: StudyInfo[];
  members: MemberEntry[];
  currentUserId: string | null;
  onSave: (studyId: string, slots: ReviewerSlots, onInProgress?: InProgressPolicy) => void;
  onClose: () => void;
}

type InProgressPolicy = 'handOver' | 'discard';

function slotsOf(study: StudyInfo): ReviewerSlots {
  return { reviewer1: study.reviewer1, reviewer2: study.reviewer2 };
}

function sameSlots(a: ReviewerSlots, b: ReviewerSlots): boolean {
  return a.reviewer1 === b.reviewer1 && a.reviewer2 === b.reviewer2;
}

function firstName(member: MemberEntry): string {
  return member.givenName || memberDisplayName(member).split(' ')[0];
}

/** Hand-over needs someone to hand to: a joiner for every reviewer who leaves. */
function canHandOver(study: StudyInfo, next: ReviewerSlots): boolean {
  const before = [study.reviewer1, study.reviewer2].filter(Boolean);
  const after = [next.reviewer1, next.reviewer2].filter(Boolean);
  const leavers = before.filter(u => !after.includes(u));
  const joiners = after.filter(u => !before.includes(u));
  return joiners.length >= leavers.length;
}

export function ReviewerAssignment({
  scope,
  studies,
  members,
  currentUserId,
  onSave,
  onClose,
}: ReviewerAssignmentProps) {
  // Snapshot on open so rows do not move while editing.
  const [studyIds] = useState(() => scope?.studyIds ?? unassignedFirst(studies));
  const [draft, setDraft] = useState<SlotRows>(() =>
    Object.fromEntries(studies.filter(s => studyIds.includes(s.id)).map(s => [s.id, slotsOf(s)])),
  );

  const [shares, setShares] = useState<Record<string, number>>({});
  // Members who join mid-edit get the even share.
  const effectiveShares = { ...evenShares(members.map(m => m.userId)), ...shares };
  // `${studyId}:${slot}` keys Auto-fill chose, so Reshuffle spares hand picks.
  const [autoFilled, setAutoFilled] = useState<Set<string>>(() => new Set());

  const rows = studyIds.map(id => studies.find(s => s.id === id)).filter(s => s !== undefined);
  const inScope = new Set(studyIds);
  const baseLoad = countLoad(
    Object.fromEntries(studies.filter(s => !inScope.has(s.id)).map(s => [s.id, slotsOf(s)])),
    {},
  );
  const load = countLoad(draft, baseLoad);

  const changedRows = rows.filter(row => !sameSlots(draft[row.id] ?? slotsOf(row), slotsOf(row)));
  const completeCount = rows.filter(row => {
    const slots = draft[row.id];
    return slots?.reviewer1 && slots.reviewer2;
  }).length;
  const hasEmptySlot = rows.some(row => !draft[row.id]?.reviewer1 || !draft[row.id]?.reviewer2);
  const hasFilledSlot = rows.some(row => draft[row.id]?.reviewer1 || draft[row.id]?.reviewer2);
  const canAutoFill = hasEmptySlot || autoFilled.size > 0;
  const isReshuffle = autoFilled.size > 0 && !hasEmptySlot;

  const setSlot = (studyId: string, slot: keyof ReviewerSlots, userId: string | null) => {
    setDraft(prev => ({ ...prev, [studyId]: { ...prev[studyId], [slot]: userId } }));
    setAutoFilled(prev => {
      const next = new Set(prev);
      next.delete(`${studyId}:${slot}`);
      return next;
    });
  };

  const clearRow = (studyId: string) => {
    setDraft(prev => ({ ...prev, [studyId]: { reviewer1: null, reviewer2: null } }));
    setAutoFilled(prev => {
      const next = new Set(prev);
      next.delete(`${studyId}:reviewer1`);
      next.delete(`${studyId}:reviewer2`);
      return next;
    });
  };

  const handleClearAll = () => {
    setDraft(Object.fromEntries(studyIds.map(id => [id, { reviewer1: null, reviewer2: null }])));
    setAutoFilled(new Set());
  };

  const handleAutoFill = () => {
    const cleared: SlotRows = {};
    for (const [studyId, slots] of Object.entries(draft)) {
      cleared[studyId] = {
        reviewer1: autoFilled.has(`${studyId}:reviewer1`) ? null : slots.reviewer1,
        reviewer2: autoFilled.has(`${studyId}:reviewer2`) ? null : slots.reviewer2,
      };
    }
    const filled = autoFillSlots(cleared, {
      memberIds: members.map(m => m.userId),
      baseLoad,
      weights: effectiveShares,
    });
    const chosen = new Set<string>();
    for (const [studyId, slots] of Object.entries(filled)) {
      for (const slot of SLOTS) {
        if (!cleared[studyId][slot] && slots[slot]) chosen.add(`${studyId}:${slot}`);
      }
    }
    setDraft(filled);
    setAutoFilled(chosen);
  };

  // Rows whose outgoing reviewer has in-progress work; saving asks first.
  const [inProgressPrompt, setInProgressPrompt] = useState<{
    count: number;
    canHandOver: boolean;
  } | null>(null);

  const handleSave = () => {
    const blockedRows = changedRows.filter(
      row => getInProgressChecklistsOfLeavingReviewers(row, draft[row.id]).length > 0,
    );
    if (blockedRows.length > 0) {
      setInProgressPrompt({
        count: blockedRows.reduce(
          (n, row) => n + getInProgressChecklistsOfLeavingReviewers(row, draft[row.id]).length,
          0,
        ),
        canHandOver: blockedRows.every(row => canHandOver(row, draft[row.id])),
      });
      return;
    }
    void commitSave(undefined);
  };

  const commitSave = async (onInProgress: InProgressPolicy | undefined) => {
    setInProgressPrompt(null);
    let saved = 0;
    for (const row of changedRows) {
      try {
        onSave(row.id, draft[row.id], onInProgress);
        saved++;
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { toastTitle: 'Could not save the reviewers' });
      }
    }
    if (saved > 0) {
      showToast.success(
        'Reviewers saved',
        `${saved} ${saved === 1 ? 'study' : 'studies'} updated. Reviewers see their studies on the To do tab.`,
      );
    }
    onClose();
  };

  if (rows.length === 0) {
    return (
      <>
        <div className='flex-1 p-4'>
          <p className='text-muted-foreground text-sm'>
            {scope ? 'These studies are no longer in the project.' : 'No studies to assign yet.'}
          </p>
        </div>
        <SheetFooter className='flex-row justify-end'>
          <Button variant='outline' onClick={onClose}>
            Close
          </Button>
        </SheetFooter>
      </>
    );
  }

  const scopeLabel =
    scope?.label ?? `All ${rows.length} ${rows.length === 1 ? 'study' : 'studies'}`;

  return (
    <>
      <div className='flex min-h-0 flex-1 flex-col overflow-y-auto'>
        <div className='border-border flex items-center gap-3 border-b px-4 py-2.5'>
          <div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1'>
            {members.map(member => {
              const count = load[member.userId] ?? 0;
              return (
                <Tooltip key={member.userId}>
                  <TooltipTrigger asChild>
                    <span className='flex items-center gap-1.5 text-xs'>
                      <MemberAvatar member={member} className='text-3xs size-5' />
                      <span className='text-foreground'>
                        {member.userId === currentUserId ? 'You' : firstName(member)}
                      </span>
                      <span className='text-muted-foreground tabular-nums'>{count}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {memberDisplayName(member)} reviews {count} {count === 1 ? 'study' : 'studies'}{' '}
                    in this project
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className='flex shrink-0 items-center gap-1'>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={handleClearAll}
                  disabled={!hasFilledSlot}
                  data-testid='clear-all-reviewers'
                >
                  <EraserIcon />
                  Clear all
                </Button>
              </TooltipTrigger>
              <TooltipContent className='max-w-64'>
                Empties every reviewer slot in this list so Auto-fill can lay them out again.
                Nothing changes until you save.
              </TooltipContent>
            </Tooltip>
            <div className='flex -space-x-px'>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={handleAutoFill}
                    disabled={!canAutoFill}
                    className='rounded-r-none'
                  >
                    <WandSparklesIcon />
                    {isReshuffle ? 'Reshuffle' : 'Auto-fill'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className='max-w-64'>
                  {isReshuffle ?
                    'Picks reviewers again for the slots Auto-fill chose. Reviewers you picked by hand stay.'
                  : 'Fills every empty reviewer slot, giving each study to whoever is furthest below their share of the project.'
                  }
                </TooltipContent>
              </Tooltip>
              <AutoFillSettings
                members={members}
                currentUserId={currentUserId}
                shares={effectiveShares}
                onChange={setShares}
                disabled={!canAutoFill}
              />
            </div>
          </div>
        </div>

        <div className='text-2xs text-muted-foreground hidden grid-cols-[1fr_9rem_9rem_1.5rem] gap-x-2 px-4 pt-3 pb-1.5 font-semibold tracking-wide uppercase sm:grid'>
          <span className='truncate'>{scopeLabel}</span>
          <span>Reviewer 1</span>
          <span>Reviewer 2</span>
          <span />
        </div>
        <p className='text-2xs text-muted-foreground px-4 pt-3 pb-1.5 font-semibold tracking-wide uppercase sm:hidden'>
          {scopeLabel}
        </p>

        <ul className='divide-border divide-y'>
          {rows.map(row => {
            const slots = draft[row.id] ?? slotsOf(row);
            const rowFilled = Boolean(slots.reviewer1 || slots.reviewer2);
            const studyName = row.name || 'Untitled study';
            const citation = getCitationLine(sortStudyPdfs(row.pdfs ?? []), row);
            return (
              <li
                key={row.id}
                className='hover:bg-muted/40 grid grid-cols-1 items-center gap-x-2 gap-y-2 px-4 py-2 sm:grid-cols-[1fr_9rem_9rem_1.5rem]'
              >
                <div className='min-w-0'>
                  <TruncatedText text={studyName} className='text-foreground text-sm font-medium' />
                  {citation && <p className='text-muted-foreground truncate text-xs'>{citation}</p>}
                </div>
                <div className='grid grid-cols-[1fr_1fr_1.5rem] gap-2 sm:contents'>
                  <ReviewerPicker
                    slotLabel='Reviewer 1'
                    testId='reviewer-picker-1'
                    studyName={studyName}
                    value={slots.reviewer1}
                    onChange={userId => setSlot(row.id, 'reviewer1', userId)}
                    members={members}
                    takenBy={slots.reviewer2}
                    takenLabel='Reviewer 2'
                    currentUserId={currentUserId}
                    load={load}
                  />
                  <ReviewerPicker
                    slotLabel='Reviewer 2'
                    testId='reviewer-picker-2'
                    studyName={studyName}
                    value={slots.reviewer2}
                    onChange={userId => setSlot(row.id, 'reviewer2', userId)}
                    members={members}
                    takenBy={slots.reviewer1}
                    takenLabel='Reviewer 1'
                    currentUserId={currentUserId}
                    load={load}
                  />
                  <Button
                    variant='ghost'
                    size='icon-xs'
                    onClick={() => clearRow(row.id)}
                    disabled={!rowFilled}
                    aria-label={`Clear reviewers for ${studyName}`}
                    className='text-muted-foreground hover:text-foreground disabled:invisible'
                  >
                    <XIcon className='size-3.5' />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <SheetFooter className='flex-row items-center gap-2'>
        <p className='text-muted-foreground min-w-0 flex-1 text-xs'>
          {members.length < 2 ?
            'A study with one reviewer finalizes without reconciliation.'
          : `${completeCount} of ${rows.length} ${rows.length === 1 ? 'study has' : 'studies have'} two reviewers`
          }
        </p>
        <Button variant='outline' onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={changedRows.length === 0}>
          Save reviewers
        </Button>
      </SheetFooter>

      <AlertDialog
        open={inProgressPrompt !== null}
        onOpenChange={open => !open && setInProgressPrompt(null)}
      >
        <AlertDialogContent data-testid='in-progress-prompt'>
          <AlertDialogHeader>
            <AlertDialogIcon variant='warning' />
            <div>
              <AlertDialogTitle>Appraisals in progress</AlertDialogTitle>
              <AlertDialogDescription>
                {inProgressPrompt?.count === 1 ?
                  'A reviewer being removed has started an appraisal.'
                : `Reviewers being removed have started ${inProgressPrompt?.count ?? 0} appraisals.`
                }{' '}
                {inProgressPrompt?.canHandOver ?
                  'Hand the work over to the new reviewer, or discard it so they start fresh.'
                : 'Discarding removes those answers; assign a replacement first to hand the work over instead.'
                }{' '}
                Completed appraisals are kept either way.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={() => void commitSave('discard')}>
              Discard
            </AlertDialogAction>
            {inProgressPrompt?.canHandOver && (
              <AlertDialogAction onClick={() => void commitSave('handOver')}>
                Hand over
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
