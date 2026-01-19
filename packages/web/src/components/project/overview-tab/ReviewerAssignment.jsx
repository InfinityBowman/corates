/**
 * ReviewerAssignment component - Allows assigning reviewers to studies
 * By default does an even split across all members. Users can customize percentages.
 */

import { createSignal, createMemo, For, Show } from 'solid-js';
import { showToast } from '@/components/ui/toast';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { BiRegularShuffle, BiRegularCheck, BiRegularChevronRight } from 'solid-icons/bi';
import { FiUsers, FiSliders } from 'solid-icons/fi';

// Preset percentage options for reviewer distribution
const PRESETS = [0, 25, 33, 50, 100];

/**
 * MemberPercentRow - Row component for setting a member's percentage allocation
 * Extracted to top-level to preserve signal state across parent re-renders.
 *
 * @param {Object} props
 * @param {Object} props.member - Member object with userId, name, email
 * @param {number} props.percent - Current percentage value
 * @param {Function} props.onChange - Callback when percentage changes
 */
function MemberPercentRow(props) {
  const [showCustom, setShowCustom] = createSignal(false);
  const isPreset = () => PRESETS.includes(props.percent);

  return (
    <div class='border-border bg-card flex items-center gap-3 rounded-lg border p-2.5'>
      <div class='text-foreground min-w-0 flex-1 truncate text-sm font-medium'>
        {props.member.name || props.member.email || 'Unknown'}
      </div>
      <div class='flex items-center gap-1'>
        {/* Preset buttons */}
        <For each={PRESETS}>
          {preset => (
            <button
              type='button'
              onClick={() => {
                props.onChange(preset);
                setShowCustom(false);
              }}
              class='rounded px-2 py-1 text-xs font-medium transition-colors'
              classList={{
                'bg-primary text-white': props.percent === preset && !showCustom(),
                'bg-secondary text-secondary-foreground hover:bg-secondary/80':
                  props.percent !== preset || showCustom(),
              }}
            >
              {preset}%
            </button>
          )}
        </For>

        {/* Custom input toggle/field */}
        <Show
          when={showCustom() || !isPreset()}
          fallback={
            <button
              type='button'
              onClick={() => setShowCustom(true)}
              class='bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded px-2 py-1 text-xs font-medium transition-colors'
              title='Enter custom percentage'
            >
              ...
            </button>
          }
        >
          <input
            type='number'
            min='0'
            max='100'
            value={props.percent}
            onInput={e => props.onChange(e.target.value)}
            onBlur={() => {
              if (isPreset()) setShowCustom(false);
            }}
            class='border-border focus:ring-primary w-14 rounded border px-1.5 py-1 text-center text-xs focus:border-transparent focus:ring-2 focus:outline-none'
            autofocus={showCustom()}
          />
        </Show>
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {Function} props.studies - Signal returning array of studies
 * @param {Function} props.members - Signal returning array of members
 * @param {Function} props.onAssignReviewers - Callback to update study with reviewer assignments
 */
export default function ReviewerAssignment(props) {
  // Panel states
  const [isOpen, setIsOpen] = createSignal(false);
  const [showCustomize, setShowCustomize] = createSignal(false);
  const [showPreview, setShowPreview] = createSignal(false);
  const [previewAssignments, setPreviewAssignments] = createSignal([]);

  // Custom percentages (only used when customizing)
  // Maps userId -> percent for each pool
  const [pool1Percents, setPool1Percents] = createSignal({});
  const [pool2Percents, setPool2Percents] = createSignal({});

  const members = () => props.members() || [];
  const studies = () => props.studies() || [];

  // Studies that don't have reviewers assigned yet
  const unassignedStudies = createMemo(() => studies().filter(s => !s.reviewer1 && !s.reviewer2));

  // Get member name by userId
  const getMemberName = userId => {
    if (!userId) return 'Unknown';
    const member = members().find(m => m.userId === userId);
    return member?.name || member?.email || 'Unknown';
  };

  // Even split percentage
  const evenPercent = createMemo(() => {
    const count = members().length;
    return count > 0 ? Math.round(100 / count) : 0;
  });

  // Members with their percentages for display
  const pool1MembersWithPercent = createMemo(() => {
    const percents = pool1Percents();
    return members().map(m => ({
      ...m,
      percent: percents[m.userId] ?? evenPercent(),
    }));
  });

  const pool2MembersWithPercent = createMemo(() => {
    const percents = pool2Percents();
    return members().map(m => ({
      ...m,
      percent: percents[m.userId] ?? evenPercent(),
    }));
  });

  // Calculate totals
  const pool1Total = createMemo(() =>
    pool1MembersWithPercent().reduce((sum, m) => sum + m.percent, 0),
  );
  const pool2Total = createMemo(() =>
    pool2MembersWithPercent().reduce((sum, m) => sum + m.percent, 0),
  );

  // Validate pools (99-100% is OK due to rounding)
  const isPoolValid = total => total >= 99 && total <= 101;
  const isCustomValid = createMemo(() => isPoolValid(pool1Total()) && isPoolValid(pool2Total()));

  // Update percentage for a member
  const updatePool1Percent = (userId, value) => {
    const val = Math.max(0, Math.min(100, parseInt(value) || 0));
    setPool1Percents(prev => ({ ...prev, [userId]: val }));
    setShowPreview(false);
  };

  const updatePool2Percent = (userId, value) => {
    const val = Math.max(0, Math.min(100, parseInt(value) || 0));
    setPool2Percents(prev => ({ ...prev, [userId]: val }));
    setShowPreview(false);
  };

  // Reset to even distribution that sums exactly to 100
  const resetToEven = () => {
    const memberIds = members().map(m => m.userId);
    const count = memberIds.length;
    if (count === 0) {
      setPool1Percents({});
      setPool2Percents({});
      setShowPreview(false);
      return;
    }

    const base = Math.floor(100 / count);
    const remainder = 100 - base * count;

    const percents = {};
    memberIds.forEach((id, i) => {
      percents[id] = i < remainder ? base + 1 : base;
    });

    setPool1Percents({ ...percents });
    setPool2Percents({ ...percents });
    setShowPreview(false);
  };

  // Shuffle array using Fisher-Yates algorithm
  const shuffleArray = array => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Generate assignments based on percentages
  const generateAssignments = () => {
    const studiesToAssign = unassignedStudies();
    if (studiesToAssign.length === 0) {
      showToast.info('No Studies', 'All studies already have reviewers assigned.');
      return null;
    }

    if (showCustomize() && !isCustomValid()) {
      showToast.warning('Invalid Distribution', 'Each pool must total 99-101%.');
      return null;
    }

    const totalStudies = studiesToAssign.length;
    const pool1Members = pool1MembersWithPercent();
    const pool2Members = pool2MembersWithPercent();

    // Build assignment arrays based on percentages
    const pool1Assignments = [];
    const pool2Assignments = [];

    let remaining1 = totalStudies;
    pool1Members.forEach((m, i) => {
      const count =
        i === pool1Members.length - 1 ? remaining1 : Math.round((m.percent / 100) * totalStudies);
      remaining1 -= count;
      for (let j = 0; j < Math.max(0, count); j++) {
        pool1Assignments.push(m.userId);
      }
    });

    let remaining2 = totalStudies;
    pool2Members.forEach((m, i) => {
      const count =
        i === pool2Members.length - 1 ? remaining2 : Math.round((m.percent / 100) * totalStudies);
      remaining2 -= count;
      for (let j = 0; j < Math.max(0, count); j++) {
        pool2Assignments.push(m.userId);
      }
    });

    // Shuffle both pools and studies
    const shuffled1 = shuffleArray(pool1Assignments);
    const shuffled2 = shuffleArray(pool2Assignments);
    const shuffledStudies = shuffleArray(studiesToAssign);

    // Create assignments
    const assignments = shuffledStudies.map((study, index) => {
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

    // Try to resolve conflicts by swapping
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
              assignments[i].sameReviewer = assignments[i].reviewer1 === assignments[i].reviewer2;
              assignments[j].sameReviewer = assignments[j].reviewer1 === assignments[j].reviewer2;
              break;
            }
          }
        }
      }
    }

    return assignments;
  };

  // Generate and show preview
  const handleGenerate = () => {
    const assignments = generateAssignments();
    if (assignments) {
      setPreviewAssignments(assignments);
      setShowPreview(true);
    }
  };

  // Apply assignments
  const handleApply = () => {
    const assignments = previewAssignments();
    if (assignments.length === 0) return;

    const conflicts = assignments.filter(a => a.sameReviewer);
    if (conflicts.length > 0) {
      showToast.warning(
        'Conflicts Detected',
        `${conflicts.length} ${conflicts.length === 1 ? 'study has' : 'studies have'} the same reviewer for both roles. Try reshuffling.`,
      );
      return;
    }

    let successCount = 0;
    for (const assignment of assignments) {
      try {
        props.onAssignReviewers(assignment.studyId, {
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
  };

  // Cancel preview
  const handleCancel = () => {
    setShowPreview(false);
    setPreviewAssignments([]);
  };

  const hasConflicts = createMemo(() => previewAssignments().some(a => a.sameReviewer));
  const conflictCount = createMemo(() => previewAssignments().filter(a => a.sameReviewer).length);

  return (
    <div class='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
      {/* Header - always visible */}
      <div class='flex items-center justify-between px-4 py-4'>
        <div class='flex items-center gap-3'>
          <div class='bg-primary-subtle text-primary flex h-10 w-10 items-center justify-center rounded-lg'>
            <FiUsers class='h-5 w-5' />
          </div>
          <div>
            <h3 class='text-foreground text-base font-semibold'>Assign Reviewers</h3>
            <p class='text-muted-foreground text-sm'>
              {unassignedStudies().length} studies need assignment
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen())}
          class='flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors'
          classList={{
            'bg-primary text-white': isOpen(),
            'bg-primary-subtle text-primary hover:bg-primary/20': !isOpen(),
          }}
        >
          <BiRegularChevronRight
            class='h-4 w-4 transition-transform duration-200'
            classList={{ 'rotate-90': isOpen() }}
          />
          {isOpen() ? 'Hide' : 'Show'}
        </button>
      </div>

      {/* Collapsible content */}
      <Collapsible open={isOpen()} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <div class='border-border border-t px-4 pt-4 pb-4'>
            <Show
              when={members().length >= 2}
              fallback={
                <p class='text-muted-foreground text-sm'>
                  At least 2 project members are required to assign reviewers.
                </p>
              }
            >
              <Show
                when={unassignedStudies().length > 0 || showPreview()}
                fallback={
                  <div class='flex items-center gap-2 text-green-600'>
                    <BiRegularCheck class='h-5 w-5' />
                    <p class='text-sm'>All studies have reviewers assigned.</p>
                  </div>
                }
              >
                <div class='space-y-4'>
                  {/* Summary stats row */}
                  <div class='bg-muted flex items-center justify-between rounded-lg px-4 py-3'>
                    <p class='text-muted-foreground text-sm'>
                      <span class='text-foreground font-semibold'>
                        {unassignedStudies().length}
                      </span>{' '}
                      unassigned
                    </p>
                    <p class='text-muted-foreground text-sm'>
                      <span class='text-foreground font-semibold'>{members().length}</span>{' '}
                      reviewers
                    </p>
                    <p class='text-muted-foreground text-sm'>
                      <span class='text-foreground font-semibold'>{evenPercent()}%</span> each
                      (even)
                    </p>
                  </div>

                  {/* Customize toggle with collapsible */}
                  <Collapsible open={showCustomize()} onOpenChange={setShowCustomize}>
                    <CollapsibleTrigger class='border-border bg-card hover:bg-muted data-[state=open]:border-primary data-[state=open]:bg-primary-subtle flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition-all'>
                      <div class='flex items-center gap-2'>
                        <FiSliders class='h-4 w-4' />
                        <span>Customize distribution</span>
                      </div>
                      <div class='flex items-center gap-2'>
                        <span class='text-muted-foreground text-xs'>
                          {showCustomize() ? 'Using custom' : 'Adjust percentages'}
                        </span>
                        <BiRegularChevronRight
                          class='h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-90'
                          classList={{ 'rotate-90': showCustomize() }}
                        />
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div class='mt-4 space-y-4'>
                        {/* Pool 1 */}
                        <div class='border-border bg-muted rounded-xl border p-4'>
                          <div class='mb-3 flex items-center justify-between'>
                            <h4 class='text-secondary-foreground text-sm font-semibold'>
                              1st Reviewer Pool
                            </h4>
                            <span
                              class='text-xs font-medium'
                              classList={{
                                'text-green-600': isPoolValid(pool1Total()),
                                'text-amber-600': !isPoolValid(pool1Total()),
                              }}
                            >
                              Total: {pool1Total()}%
                            </span>
                          </div>
                          <div class='space-y-2'>
                            <For each={pool1MembersWithPercent()}>
                              {member => (
                                <MemberPercentRow
                                  member={member}
                                  percent={member.percent}
                                  onChange={val => updatePool1Percent(member.userId, val)}
                                />
                              )}
                            </For>
                          </div>
                        </div>

                        {/* Pool 2 */}
                        <div class='border-border bg-muted rounded-xl border p-4'>
                          <div class='mb-3 flex items-center justify-between'>
                            <h4 class='text-secondary-foreground text-sm font-semibold'>
                              2nd Reviewer Pool
                            </h4>
                            <span
                              class='text-xs font-medium'
                              classList={{
                                'text-green-600': isPoolValid(pool2Total()),
                                'text-amber-600': !isPoolValid(pool2Total()),
                              }}
                            >
                              Total: {pool2Total()}%
                            </span>
                          </div>
                          <div class='space-y-2'>
                            <For each={pool2MembersWithPercent()}>
                              {member => (
                                <MemberPercentRow
                                  member={member}
                                  percent={member.percent}
                                  onChange={val => updatePool2Percent(member.userId, val)}
                                />
                              )}
                            </For>
                          </div>
                        </div>

                        <div class='flex items-center justify-between'>
                          <Show when={!isCustomValid()}>
                            <p class='text-xs text-amber-600'>
                              Each pool must total 99-101% to generate
                            </p>
                          </Show>
                          <button
                            type='button'
                            onClick={resetToEven}
                            class='text-primary hover:text-primary/80 ml-auto text-xs font-medium'
                          >
                            Reset to even split
                          </button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Action button */}
                  <button
                    onClick={handleGenerate}
                    disabled={showCustomize() && !isCustomValid()}
                    class='bg-primary hover:bg-primary/90 focus:ring-primary inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    <BiRegularShuffle class='h-4 w-4' />
                    {showPreview() ?
                      'Reshuffle'
                    : showCustomize() ?
                      'Generate with Custom Split'
                    : 'Assign Randomly (Even Split)'}
                  </button>

                  {/* Preview Section */}
                  <Show when={showPreview()}>
                    <div
                      class='overflow-hidden rounded-xl border'
                      classList={{
                        'border-red-200': hasConflicts(),
                        'border-primary': !hasConflicts(),
                      }}
                    >
                      <div
                        class='flex items-center justify-between border-b px-4 py-3'
                        classList={{
                          'border-red-200 bg-red-50': hasConflicts(),
                          'border-primary bg-primary-subtle': !hasConflicts(),
                        }}
                      >
                        <div>
                          <h4
                            class='text-sm font-semibold'
                            classList={{
                              'text-red-900': hasConflicts(),
                              'text-primary-strong': !hasConflicts(),
                            }}
                          >
                            Assignment Preview
                          </h4>
                          <Show when={hasConflicts()}>
                            <p class='text-xs text-red-600'>
                              {conflictCount()} conflict{conflictCount() !== 1 && 's'} - click
                              Reshuffle
                            </p>
                          </Show>
                        </div>
                        <span class='text-muted-foreground text-xs'>
                          {previewAssignments().length} studies
                        </span>
                      </div>

                      <div class='max-h-64 overflow-y-auto'>
                        <table class='w-full text-left text-sm'>
                          <thead class='bg-muted sticky top-0'>
                            <tr>
                              <th class='text-muted-foreground py-2 pr-4 pl-4 text-xs font-medium'>
                                Study
                              </th>
                              <th class='text-muted-foreground py-2 pr-4 text-xs font-medium'>
                                1st Reviewer
                              </th>
                              <th class='text-muted-foreground py-2 pr-4 text-xs font-medium'>
                                2nd Reviewer
                              </th>
                            </tr>
                          </thead>
                          <tbody class='divide-border divide-y'>
                            <For each={previewAssignments()}>
                              {assignment => (
                                <tr
                                  class='hover:bg-muted'
                                  classList={{ 'bg-red-50': assignment.sameReviewer }}
                                >
                                  <td class='text-foreground max-w-xs truncate py-2 pr-4 pl-4'>
                                    {assignment.studyName}
                                  </td>
                                  <td class='text-secondary-foreground py-2 pr-4'>
                                    {assignment.reviewer1Name}
                                  </td>
                                  <td
                                    class='py-2 pr-4'
                                    classList={{
                                      'font-medium text-red-600': assignment.sameReviewer,
                                      'text-secondary-foreground': !assignment.sameReviewer,
                                    }}
                                  >
                                    {assignment.reviewer2Name}
                                    {assignment.sameReviewer && ' (conflict)'}
                                  </td>
                                </tr>
                              )}
                            </For>
                          </tbody>
                        </table>
                      </div>

                      <div class='border-border bg-muted flex gap-2 border-t px-4 py-3'>
                        <button
                          onClick={handleApply}
                          disabled={hasConflicts()}
                          class='focus:ring-primary inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          <BiRegularCheck class='h-4 w-4' />
                          Apply Assignments
                        </button>
                        <button
                          onClick={handleCancel}
                          class='border-border bg-card text-secondary-foreground hover:bg-secondary rounded-lg border px-4 py-2 text-sm font-medium transition-colors'
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </Show>
                </div>
              </Show>
            </Show>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
