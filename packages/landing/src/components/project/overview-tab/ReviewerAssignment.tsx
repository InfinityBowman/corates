/**
 * ReviewerAssignment - Bulk reviewer assignment with percentage distribution
 */

import { useState, useMemo, useCallback } from 'react';
import { showToast } from '@/components/ui/toast';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  ShuffleIcon,
  CheckIcon,
  ChevronRightIcon,
  UsersIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';

const PRESETS = [0, 25, 33, 50, 100];

function MemberPercentRow({
  member,
  percent,
  onChange,
}: {
  member: any;
  percent: number;
  onChange: (_val: number) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const isPreset = PRESETS.includes(percent);

  return (
    <div className='border-border bg-card flex items-center gap-3 rounded-lg border p-2.5'>
      <div className='text-foreground min-w-0 flex-1 truncate text-sm font-medium'>
        {member.name || member.email || 'Unknown'}
      </div>
      <div className='flex items-center gap-1'>
        {PRESETS.map(preset => (
          <button
            key={preset}
            type='button'
            onClick={() => {
              onChange(preset);
              setShowCustom(false);
            }}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              percent === preset && !showCustom ?
                'bg-primary text-white'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {preset}%
          </button>
        ))}

        {showCustom || !isPreset ?
          <input
            type='number'
            min={0}
            max={100}
            value={percent}
            onChange={e => onChange(parseInt(e.target.value) || 0)}
            onBlur={() => {
              if (isPreset) setShowCustom(false);
            }}
            className='border-border focus:ring-primary w-14 rounded border px-1.5 py-1 text-center text-xs focus:border-transparent focus:ring-2 focus:outline-none'
            autoFocus={showCustom}
          />
        : <button
            type='button'
            onClick={() => setShowCustom(true)}
            className='bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded px-2 py-1 text-xs font-medium transition-colors'
            title='Enter custom percentage'
          >
            ...
          </button>
        }
      </div>
    </div>
  );
}

/* eslint-disable no-unused-vars */
interface ReviewerAssignmentProps {
  studies: any[];
  members: any[];
  onAssignReviewers: (studyId: string, updates: any) => void;
}
/* eslint-enable no-unused-vars */

export function ReviewerAssignment({
  studies,
  members,
  onAssignReviewers,
}: ReviewerAssignmentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewAssignments, setPreviewAssignments] = useState<any[]>([]);
  const [pool1Percents, setPool1Percents] = useState<Record<string, number>>({});
  const [pool2Percents, setPool2Percents] = useState<Record<string, number>>({});

  const unassignedStudies = useMemo(
    () => studies.filter((s: any) => !s.reviewer1 && !s.reviewer2),
    [studies],
  );

  const getMemberName = useCallback(
    (userId: string) => {
      if (!userId) return 'Unknown';
      const member = members.find((m: any) => m.userId === userId);
      return member?.name || member?.email || 'Unknown';
    },
    [members],
  );

  const evenPercent = useMemo(
    () => (members.length > 0 ? Math.round(100 / members.length) : 0),
    [members],
  );

  const pool1Members = useMemo(
    () => members.map((m: any) => ({ ...m, percent: pool1Percents[m.userId] ?? evenPercent })),
    [members, pool1Percents, evenPercent],
  );

  const pool2Members = useMemo(
    () => members.map((m: any) => ({ ...m, percent: pool2Percents[m.userId] ?? evenPercent })),
    [members, pool2Percents, evenPercent],
  );

  const pool1Total = useMemo(
    () => pool1Members.reduce((sum, m) => sum + m.percent, 0),
    [pool1Members],
  );
  const pool2Total = useMemo(
    () => pool2Members.reduce((sum, m) => sum + m.percent, 0),
    [pool2Members],
  );

  const isPoolValid = (total: number) => total >= 99 && total <= 101;
  const isCustomValid = isPoolValid(pool1Total) && isPoolValid(pool2Total);

  const updatePool1 = useCallback((userId: string, value: number) => {
    const val = Math.max(0, Math.min(100, value));
    setPool1Percents(prev => ({ ...prev, [userId]: val }));
    setShowPreview(false);
  }, []);

  const updatePool2 = useCallback((userId: string, value: number) => {
    const val = Math.max(0, Math.min(100, value));
    setPool2Percents(prev => ({ ...prev, [userId]: val }));
    setShowPreview(false);
  }, []);

  const resetToEven = useCallback(() => {
    const memberIds = members.map((m: any) => m.userId);
    const count = memberIds.length;
    if (count === 0) {
      setPool1Percents({});
      setPool2Percents({});
      setShowPreview(false);
      return;
    }
    const base = Math.floor(100 / count);
    const remainder = 100 - base * count;
    const percents: Record<string, number> = {};
    memberIds.forEach((id: string, i: number) => {
      percents[id] = i < remainder ? base + 1 : base;
    });
    setPool1Percents({ ...percents });
    setPool2Percents({ ...percents });
    setShowPreview(false);
  }, [members]);

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const generateAssignments = useCallback(() => {
    if (unassignedStudies.length === 0) {
      showToast.info('No Studies', 'All studies already have reviewers assigned.');
      return null;
    }
    if (showCustomize && !isCustomValid) {
      showToast.warning('Invalid Distribution', 'Each pool must total 99-101%.');
      return null;
    }

    const totalStudies = unassignedStudies.length;
    const pool1Assignments: string[] = [];
    const pool2Assignments: string[] = [];

    let remaining1 = totalStudies;
    pool1Members.forEach((m, i) => {
      const count =
        i === pool1Members.length - 1 ? remaining1 : Math.round((m.percent / 100) * totalStudies);
      remaining1 -= count;
      for (let j = 0; j < Math.max(0, count); j++) pool1Assignments.push(m.userId);
    });

    let remaining2 = totalStudies;
    pool2Members.forEach((m, i) => {
      const count =
        i === pool2Members.length - 1 ? remaining2 : Math.round((m.percent / 100) * totalStudies);
      remaining2 -= count;
      for (let j = 0; j < Math.max(0, count); j++) pool2Assignments.push(m.userId);
    });

    const shuffled1 = shuffleArray(pool1Assignments);
    const shuffled2 = shuffleArray(pool2Assignments);
    const shuffledStudies = shuffleArray(unassignedStudies);

    const assignments = shuffledStudies.map((study: any, index: number) => {
      const r1 = shuffled1[index];
      const r2 = shuffled2[index];
      return {
        studyId: study.id,
        studyName: study.name,
        reviewer1: r1,
        reviewer2: r2,
        reviewer1Name: getMemberName(r1),
        reviewer2Name: getMemberName(r2),
        sameReviewer: r1 === r2,
      };
    });

    // Resolve conflicts by swapping
    for (let i = 0; i < assignments.length; i++) {
      if (assignments[i].sameReviewer) {
        for (let j = 0; j < assignments.length; j++) {
          if (i !== j && !assignments[j].sameReviewer) {
            const canSwap =
              assignments[j].reviewer2 !== assignments[i].reviewer1 &&
              assignments[i].reviewer2 !== assignments[j].reviewer1;
            if (canSwap) {
              const temp = assignments[i].reviewer2;
              assignments[i].reviewer2 = assignments[j].reviewer2;
              assignments[i].reviewer2Name = assignments[j].reviewer2Name;
              assignments[j].reviewer2 = temp;
              assignments[j].reviewer2Name = getMemberName(temp);
              assignments[i].sameReviewer = false;
              assignments[j].sameReviewer = assignments[j].reviewer1 === assignments[j].reviewer2;
              break;
            }
          }
        }
      }
    }

    return assignments;
  }, [unassignedStudies, showCustomize, isCustomValid, pool1Members, pool2Members, getMemberName]);

  const handleGenerate = useCallback(() => {
    const assignments = generateAssignments();
    if (assignments) {
      setPreviewAssignments(assignments);
      setShowPreview(true);
    }
  }, [generateAssignments]);

  const handleApply = useCallback(() => {
    if (previewAssignments.length === 0) return;
    const conflicts = previewAssignments.filter(a => a.sameReviewer);
    if (conflicts.length > 0) {
      showToast.warning(
        'Conflicts Detected',
        `${conflicts.length} ${conflicts.length === 1 ? 'study has' : 'studies have'} the same reviewer for both roles. Try reshuffling.`,
      );
      return;
    }
    let successCount = 0;
    for (const assignment of previewAssignments) {
      try {
        onAssignReviewers(assignment.studyId, {
          reviewer1: assignment.reviewer1,
          reviewer2: assignment.reviewer2,
        });
        successCount++;
      } catch (err) {
        console.error('Error assigning reviewers:', assignment.studyId, err);
      }
    }
    if (successCount > 0) {
      showToast.success(
        'Reviewers Assigned',
        `Successfully assigned reviewers to ${successCount} ${successCount === 1 ? 'study' : 'studies'}.`,
      );
    }
    setShowPreview(false);
    setPreviewAssignments([]);
    setIsOpen(false);
  }, [previewAssignments, onAssignReviewers]);

  const hasConflicts = previewAssignments.some(a => a.sameReviewer);
  const conflictCount = previewAssignments.filter(a => a.sameReviewer).length;

  return (
    <div className='border-border bg-card overflow-hidden rounded-lg border'>
      {/* Header */}
      <div className='flex items-center justify-between px-4 py-4'>
        <div className='flex items-center gap-3'>
          <div className='bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg'>
            <UsersIcon className='size-5' />
          </div>
          <div>
            <h3 className='text-foreground text-base font-semibold'>Assign Reviewers</h3>
            <p className='text-muted-foreground text-sm'>
              {unassignedStudies.length} studies need assignment
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isOpen ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'
          }`}
        >
          <ChevronRightIcon
            className={`size-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          />
          {isOpen ? 'Hide' : 'Show'}
        </button>
      </div>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <div className='border-border border-t px-4 pt-4 pb-4'>
            {members.length < 2 ?
              <p className='text-muted-foreground text-sm'>
                At least 2 project members are required to assign reviewers.
              </p>
            : unassignedStudies.length === 0 && !showPreview ?
              <div className='flex items-center gap-2 text-success'>
                <CheckIcon className='size-5' />
                <p className='text-sm'>All studies have reviewers assigned.</p>
              </div>
            : <div className='flex flex-col gap-4'>
                {/* Summary */}
                <div className='bg-muted flex items-center justify-between rounded-lg px-4 py-3'>
                  <p className='text-muted-foreground text-sm'>
                    <span className='text-foreground font-semibold'>
                      {unassignedStudies.length}
                    </span>{' '}
                    unassigned
                  </p>
                  <p className='text-muted-foreground text-sm'>
                    <span className='text-foreground font-semibold'>{members.length}</span>{' '}
                    reviewers
                  </p>
                  <p className='text-muted-foreground text-sm'>
                    <span className='text-foreground font-semibold'>{evenPercent}%</span> each
                    (even)
                  </p>
                </div>

                {/* Customize */}
                <Collapsible open={showCustomize} onOpenChange={setShowCustomize}>
                  <CollapsibleTrigger className='border-border bg-card hover:bg-muted data-[state=open]:border-primary data-[state=open]:bg-primary/5 flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition-all'>
                    <div className='flex items-center gap-2'>
                      <SlidersHorizontalIcon className='size-4' />
                      <span>Customize distribution</span>
                    </div>
                    <span className='text-muted-foreground text-xs'>
                      {showCustomize ? 'Using custom' : 'Adjust percentages'}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className='mt-4 flex flex-col gap-4'>
                      {/* Pool 1 */}
                      <div className='border-border bg-muted rounded-xl border p-4'>
                        <div className='mb-3 flex items-center justify-between'>
                          <h4 className='text-secondary-foreground text-sm font-semibold'>
                            1st Reviewer Pool
                          </h4>
                          <span
                            className={`text-xs font-medium ${isPoolValid(pool1Total) ? 'text-success' : 'text-amber-600'}`}
                          >
                            Total: {pool1Total}%
                          </span>
                        </div>
                        <div className='flex flex-col gap-2'>
                          {pool1Members.map((member: any) => (
                            <MemberPercentRow
                              key={member.userId}
                              member={member}
                              percent={member.percent}
                              onChange={val => updatePool1(member.userId, val)}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Pool 2 */}
                      <div className='border-border bg-muted rounded-xl border p-4'>
                        <div className='mb-3 flex items-center justify-between'>
                          <h4 className='text-secondary-foreground text-sm font-semibold'>
                            2nd Reviewer Pool
                          </h4>
                          <span
                            className={`text-xs font-medium ${isPoolValid(pool2Total) ? 'text-success' : 'text-amber-600'}`}
                          >
                            Total: {pool2Total}%
                          </span>
                        </div>
                        <div className='flex flex-col gap-2'>
                          {pool2Members.map((member: any) => (
                            <MemberPercentRow
                              key={member.userId}
                              member={member}
                              percent={member.percent}
                              onChange={val => updatePool2(member.userId, val)}
                            />
                          ))}
                        </div>
                      </div>

                      <div className='flex items-center justify-between'>
                        {!isCustomValid && (
                          <p className='text-xs text-amber-600'>
                            Each pool must total 99-101% to generate
                          </p>
                        )}
                        <button
                          type='button'
                          onClick={resetToEven}
                          className='text-primary hover:text-primary/80 ml-auto text-xs font-medium'
                        >
                          Reset to even split
                        </button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Generate button */}
                <button
                  onClick={handleGenerate}
                  disabled={showCustomize && !isCustomValid}
                  className='bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <ShuffleIcon className='size-4' />
                  {showPreview ?
                    'Reshuffle'
                  : showCustomize ?
                    'Generate with Custom Split'
                  : 'Assign Randomly (Even Split)'}
                </button>

                {/* Preview */}
                {showPreview && (
                  <div
                    className={`overflow-hidden rounded-xl border ${hasConflicts ? 'border-destructive/20' : 'border-primary'}`}
                  >
                    <div
                      className={`flex items-center justify-between border-b px-4 py-3 ${
                        hasConflicts ? 'border-destructive/20 bg-destructive/10' : 'border-primary bg-primary/5'
                      }`}
                    >
                      <div>
                        <h4
                          className={`text-sm font-semibold ${hasConflicts ? 'text-destructive' : 'text-primary'}`}
                        >
                          Assignment Preview
                        </h4>
                        {hasConflicts && (
                          <p className='text-xs text-destructive'>
                            {conflictCount} conflict{conflictCount !== 1 && 's'} - click Reshuffle
                          </p>
                        )}
                      </div>
                      <span className='text-muted-foreground text-xs'>
                        {previewAssignments.length} studies
                      </span>
                    </div>

                    <div className='max-h-64 overflow-y-auto'>
                      <table className='w-full text-left text-sm'>
                        <thead className='bg-muted sticky top-0'>
                          <tr>
                            <th className='text-muted-foreground py-2 pr-4 pl-4 text-xs font-medium'>
                              Study
                            </th>
                            <th className='text-muted-foreground py-2 pr-4 text-xs font-medium'>
                              1st Reviewer
                            </th>
                            <th className='text-muted-foreground py-2 pr-4 text-xs font-medium'>
                              2nd Reviewer
                            </th>
                          </tr>
                        </thead>
                        <tbody className='divide-border divide-y'>
                          {previewAssignments.map(assignment => (
                            <tr
                              key={assignment.studyId}
                              className={`hover:bg-muted ${assignment.sameReviewer ? 'bg-destructive/10' : ''}`}
                            >
                              <td className='text-foreground max-w-xs truncate py-2 pr-4 pl-4'>
                                {assignment.studyName}
                              </td>
                              <td className='text-secondary-foreground py-2 pr-4'>
                                {assignment.reviewer1Name}
                              </td>
                              <td
                                className={`py-2 pr-4 ${assignment.sameReviewer ? 'font-medium text-destructive' : 'text-secondary-foreground'}`}
                              >
                                {assignment.reviewer2Name}
                                {assignment.sameReviewer && ' (conflict)'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className='border-border bg-muted flex gap-2 border-t px-4 py-3'>
                      <button
                        onClick={handleApply}
                        disabled={hasConflicts}
                        className='inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-success/80 disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        <CheckIcon className='size-4' />
                        Apply Assignments
                      </button>
                      <button
                        onClick={() => {
                          setShowPreview(false);
                          setPreviewAssignments([]);
                        }}
                        className='border-border bg-card text-secondary-foreground hover:bg-secondary rounded-lg border px-4 py-2 text-sm font-medium transition-colors'
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            }
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
