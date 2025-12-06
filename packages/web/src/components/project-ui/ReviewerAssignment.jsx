/**
 * ReviewerAssignment component - Allows assigning reviewers to studies based on percentages
 * Supports multiple reviewers in each role with customizable distribution percentages
 */

import { createSignal, createMemo, For, Show } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { showToast } from '@components/zag/Toast.jsx';
import {
  BiRegularShuffle,
  BiRegularCheck,
  BiRegularX,
  BiRegularChevronDown,
  BiRegularChevronUp,
} from 'solid-icons/bi';
import { FiUsers } from 'solid-icons/fi';

/**
 * @param {Object} props
 * @param {Function} props.studies - Signal returning array of studies
 * @param {Function} props.members - Signal returning array of members
 * @param {Function} props.onAssignReviewers - Callback to update study with reviewer assignments
 */
export default function ReviewerAssignment(props) {
  // Expanded state
  const [isExpanded, setIsExpanded] = createSignal(false);

  // Reviewer pools with percentages
  // Each pool item: { userId: string, percent: number }
  const [reviewer1Pool, setReviewer1Pool] = createStore([]);
  const [reviewer2Pool, setReviewer2Pool] = createStore([]);

  // Preview state
  const [showPreview, setShowPreview] = createSignal(false);
  const [previewAssignments, setPreviewAssignments] = createSignal([]);

  const members = () => props.members() || [];
  const studies = () => props.studies() || [];

  // Studies that don't have reviewers assigned yet
  const unassignedStudies = createMemo(() => studies().filter(s => !s.reviewer1 && !s.reviewer2));

  // Get member name by userId
  const getMemberName = userId => {
    if (!userId) return 'Unknown';
    const member = members().find(m => m.userId === userId);
    return member?.displayName || member?.name || member?.email || 'Unknown';
  };

  // Get members not in a specific pool
  const availableForPool1 = createMemo(() => {
    const usedIds = new Set(reviewer1Pool.map(r => r.userId));
    return members().filter(m => !usedIds.has(m.userId));
  });

  const availableForPool2 = createMemo(() => {
    const usedIds = new Set(reviewer2Pool.map(r => r.userId));
    return members().filter(m => !usedIds.has(m.userId));
  });

  // Calculate total percentages
  const pool1Total = createMemo(() => reviewer1Pool.reduce((sum, r) => sum + r.percent, 0));
  const pool2Total = createMemo(() => reviewer2Pool.reduce((sum, r) => sum + r.percent, 0));

  // Check if pools are valid (total = 100% and at least one reviewer in each)
  const isPool1Valid = createMemo(() => reviewer1Pool.length > 0 && pool1Total() === 100);
  const isPool2Valid = createMemo(() => reviewer2Pool.length > 0 && pool2Total() === 100);
  const canGenerate = createMemo(() => isPool1Valid() && isPool2Valid());

  // Add reviewer to pool
  const addToPool1 = userId => {
    if (!userId) return;
    setReviewer1Pool(
      produce(pool => {
        pool.push({ userId, percent: 0 });
      }),
    );
    setShowPreview(false);
  };

  const addToPool2 = userId => {
    if (!userId) return;
    setReviewer2Pool(
      produce(pool => {
        pool.push({ userId, percent: 0 });
      }),
    );
    setShowPreview(false);
  };

  // Remove reviewer from pool
  const removeFromPool1 = userId => {
    setReviewer1Pool(
      produce(pool => {
        const idx = pool.findIndex(r => r.userId === userId);
        if (idx !== -1) pool.splice(idx, 1);
      }),
    );
    setShowPreview(false);
  };

  const removeFromPool2 = userId => {
    setReviewer2Pool(
      produce(pool => {
        const idx = pool.findIndex(r => r.userId === userId);
        if (idx !== -1) pool.splice(idx, 1);
      }),
    );
    setShowPreview(false);
  };

  // Update percentage for a reviewer in pool
  const updatePool1Percent = (userId, percent) => {
    const val = Math.max(0, Math.min(100, parseInt(percent) || 0));
    setReviewer1Pool(
      produce(pool => {
        const item = pool.find(r => r.userId === userId);
        if (item) item.percent = val;
      }),
    );
    setShowPreview(false);
  };

  const updatePool2Percent = (userId, percent) => {
    const val = Math.max(0, Math.min(100, parseInt(percent) || 0));
    setReviewer2Pool(
      produce(pool => {
        const item = pool.find(r => r.userId === userId);
        if (item) item.percent = val;
      }),
    );
    setShowPreview(false);
  };

  // Auto-distribute percentages evenly
  const distributeEvenly1 = () => {
    if (reviewer1Pool.length === 0) return;
    const each = Math.floor(100 / reviewer1Pool.length);
    const remainder = 100 - each * reviewer1Pool.length;
    setReviewer1Pool(
      produce(pool => {
        pool.forEach((r, i) => {
          r.percent = each + (i < remainder ? 1 : 0);
        });
      }),
    );
    setShowPreview(false);
  };

  const distributeEvenly2 = () => {
    if (reviewer2Pool.length === 0) return;
    const each = Math.floor(100 / reviewer2Pool.length);
    const remainder = 100 - each * reviewer2Pool.length;
    setReviewer2Pool(
      produce(pool => {
        pool.forEach((r, i) => {
          r.percent = each + (i < remainder ? 1 : 0);
        });
      }),
    );
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

  // Generate random assignments based on percentages
  const generateAssignments = () => {
    if (!canGenerate()) {
      if (!isPool1Valid()) {
        showToast.warning('Invalid 1st Reviewer Pool', 'Percentages must add up to 100%.');
      } else if (!isPool2Valid()) {
        showToast.warning('Invalid 2nd Reviewer Pool', 'Percentages must add up to 100%.');
      }
      return null;
    }

    const studiesToAssign = unassignedStudies();
    if (studiesToAssign.length === 0) {
      showToast.info('No Studies', 'All studies already have reviewers assigned.');
      return null;
    }

    // Calculate how many studies each reviewer should get based on percentages
    const totalStudies = studiesToAssign.length;

    // Build assignment arrays based on percentages
    const pool1Assignments = [];
    const pool2Assignments = [];

    // For pool 1, calculate study counts
    let remaining1 = totalStudies;
    reviewer1Pool.forEach((r, i) => {
      const count =
        i === reviewer1Pool.length - 1 ?
          remaining1 // Last one gets remainder to ensure exact total
        : Math.round((r.percent / 100) * totalStudies);
      remaining1 -= count;
      for (let j = 0; j < count; j++) {
        pool1Assignments.push(r.userId);
      }
    });

    // For pool 2, calculate study counts
    let remaining2 = totalStudies;
    reviewer2Pool.forEach((r, i) => {
      const count =
        i === reviewer2Pool.length - 1 ? remaining2 : Math.round((r.percent / 100) * totalStudies);
      remaining2 -= count;
      for (let j = 0; j < count; j++) {
        pool2Assignments.push(r.userId);
      }
    });

    // Shuffle both pools
    const shuffled1 = shuffleArray(pool1Assignments);
    const shuffled2 = shuffleArray(pool2Assignments);

    // Shuffle studies too
    const shuffledStudies = shuffleArray(studiesToAssign);

    // Create assignments, avoiding same reviewer for both roles where possible
    const assignments = shuffledStudies.map((study, index) => {
      let r1 = shuffled1[index];
      let r2 = shuffled2[index];

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
        // Find another assignment to swap reviewer2 with
        for (let j = 0; j < assignments.length; j++) {
          if (i !== j && !assignments[j].sameReviewer) {
            const canSwap =
              assignments[j].reviewer2 !== assignments[i].reviewer1 &&
              assignments[i].reviewer2 !== assignments[j].reviewer1;

            if (canSwap) {
              // Swap reviewer2
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

  // Preview the assignments
  const handlePreview = () => {
    const assignments = generateAssignments();
    if (assignments) {
      setPreviewAssignments(assignments);
      setShowPreview(true);
    }
  };

  // Re-shuffle the preview
  const handleReshuffle = () => {
    const assignments = generateAssignments();
    if (assignments) {
      setPreviewAssignments(assignments);
    }
  };

  // Apply the assignments
  const handleApply = () => {
    const assignments = previewAssignments();
    if (assignments.length === 0) return;

    // Check for conflicts
    const conflicts = assignments.filter(a => a.sameReviewer);
    if (conflicts.length > 0) {
      showToast.warning(
        'Conflicts Detected',
        `${conflicts.length} ${conflicts.length === 1 ? 'study has' : 'studies have'} the same reviewer for both roles. Try reshuffling or adjusting pools.`,
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
        console.error('Error assigning reviewers to study:', assignment.studyId, err);
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
  };

  // Cancel preview
  const handleCancel = () => {
    setShowPreview(false);
    setPreviewAssignments([]);
  };

  // Render a reviewer pool section
  const ReviewerPoolSection = poolProps => {
    const pool = () => poolProps.pool;
    const available = () => poolProps.available;
    const total = () => poolProps.total;
    const isValid = () => poolProps.isValid;

    return (
      <div class='bg-gray-50 rounded-lg p-4'>
        <div class='flex items-center justify-between mb-3'>
          <h4 class='text-sm font-semibold text-gray-700'>{poolProps.title}</h4>
          <Show when={pool().length > 1}>
            <button
              type='button'
              onClick={() => poolProps.onDistributeEvenly()}
              class='text-xs text-blue-600 hover:text-blue-800 font-medium'
            >
              Distribute evenly
            </button>
          </Show>
        </div>

        {/* Current reviewers in pool */}
        <div class='space-y-2 mb-3'>
          <For each={pool()}>
            {reviewer => (
              <div class='flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-200'>
                <div class='flex-1 text-sm text-gray-900 truncate'>
                  {getMemberName(reviewer.userId)}
                </div>
                <div class='flex items-center gap-1'>
                  <input
                    type='number'
                    min='0'
                    max='100'
                    value={reviewer.percent}
                    onInput={e => poolProps.onUpdatePercent(reviewer.userId, e.target.value)}
                    class='w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500'
                  />
                  <span class='text-sm text-gray-500'>%</span>
                </div>
                <button
                  type='button'
                  onClick={() => poolProps.onRemove(reviewer.userId)}
                  class='p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors'
                >
                  <BiRegularX class='w-4 h-4' />
                </button>
              </div>
            )}
          </For>
        </div>

        {/* Add reviewer dropdown */}
        <Show when={available().length > 0}>
          <div class='flex items-center gap-2'>
            <select
              onChange={e => {
                poolProps.onAdd(e.target.value);
                e.target.value = '';
              }}
              class='flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
            >
              <option value=''>Add reviewer...</option>
              <For each={available()}>
                {member => (
                  <option value={member.userId}>
                    {member.displayName || member.name || member.email || 'Unknown'}
                  </option>
                )}
              </For>
            </select>
          </div>
        </Show>

        {/* Total percentage indicator */}
        <div class={`mt-3 text-xs font-medium ${isValid() ? 'text-green-600' : 'text-amber-600'}`}>
          Total: {total()}%{!isValid() && pool().length > 0 && ' (must equal 100%)'}
          {pool().length === 0 && ' (add at least one reviewer)'}
        </div>
      </div>
    );
  };

  // Collapse and reset state
  const handleCollapse = () => {
    setIsExpanded(false);
    setShowPreview(false);
    setPreviewAssignments([]);
  };

  return (
    <div class='bg-white border border-gray-200 rounded-lg overflow-hidden'>
      {/* Trigger Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded())}
        class='w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors'
      >
        <div class='flex items-center gap-2'>
          <FiUsers class='w-4 h-4 text-blue-600' />
          <span class='text-sm font-medium text-gray-900'>Assign Reviewers to Studies</span>
        </div>
        <Show when={isExpanded()} fallback={<BiRegularChevronDown class='w-5 h-5 text-gray-400' />}>
          <BiRegularChevronUp class='w-5 h-5 text-gray-400' />
        </Show>
      </button>

      {/* Expandable Content */}
      <Show when={isExpanded()}>
        <div class='px-4 pb-4 border-t border-gray-200'>
          <Show
            when={members().length >= 2}
            fallback={
              <p class='text-gray-500 text-sm mt-4'>
                At least 2 project members are required to assign reviewers.
              </p>
            }
          >
            <Show
              when={unassignedStudies().length > 0 || showPreview()}
              fallback={
                <div class='flex items-center gap-2 text-green-600 mt-4'>
                  <BiRegularCheck class='w-5 h-5' />
                  <p class='text-sm'>All studies have reviewers assigned.</p>
                </div>
              }
            >
              <div class='space-y-4'>
                <p class='text-sm text-gray-600 mt-4'>
                  Add reviewers to each pool and set their percentage. Studies will be randomly
                  assigned one reviewer from each pool based on the percentages.
                </p>

                {/* Reviewer Pools */}
                <div class='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <ReviewerPoolSection
                    title='1st Reviewer Pool'
                    pool={reviewer1Pool}
                    available={availableForPool1()}
                    total={pool1Total()}
                    isValid={isPool1Valid()}
                    onAdd={addToPool1}
                    onRemove={removeFromPool1}
                    onUpdatePercent={updatePool1Percent}
                    onDistributeEvenly={distributeEvenly1}
                  />
                  <ReviewerPoolSection
                    title='2nd Reviewer Pool'
                    pool={reviewer2Pool}
                    available={availableForPool2()}
                    total={pool2Total()}
                    isValid={isPool2Valid()}
                    onAdd={addToPool2}
                    onRemove={removeFromPool2}
                    onUpdatePercent={updatePool2Percent}
                    onDistributeEvenly={distributeEvenly2}
                  />
                </div>

                <p class='text-xs text-gray-500'>
                  {unassignedStudies().length}{' '}
                  {unassignedStudies().length === 1 ? 'study' : 'studies'} without reviewers
                </p>

                {/* Preview Button */}
                <Show when={!showPreview()}>
                  <button
                    onClick={handlePreview}
                    disabled={!canGenerate() || unassignedStudies().length === 0}
                    class='inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors gap-2'
                  >
                    <BiRegularShuffle class='w-4 h-4' />
                    Generate Random Assignments
                  </button>
                </Show>

                {/* Preview Section */}
                <Show when={showPreview()}>
                  <div class='border border-blue-200 rounded-lg overflow-hidden'>
                    <div class='bg-blue-50 px-4 py-2 border-b border-blue-200 flex items-center justify-between'>
                      <h4 class='text-sm font-semibold text-blue-900'>
                        Preview Assignments ({previewAssignments().length} studies)
                      </h4>
                      <button
                        onClick={handleReshuffle}
                        class='inline-flex items-center px-2 py-1 text-blue-700 text-xs font-medium hover:bg-blue-100 rounded transition-colors gap-1'
                      >
                        <BiRegularShuffle class='w-3 h-3' />
                        Reshuffle
                      </button>
                    </div>
                    <div class='max-h-64 overflow-y-auto'>
                      <table class='w-full text-sm'>
                        <thead class='bg-gray-50 sticky top-0'>
                          <tr>
                            <th class='text-left px-4 py-2 font-medium text-gray-700'>Study</th>
                            <th class='text-left px-4 py-2 font-medium text-gray-700'>
                              1st Reviewer
                            </th>
                            <th class='text-left px-4 py-2 font-medium text-gray-700'>
                              2nd Reviewer
                            </th>
                          </tr>
                        </thead>
                        <tbody class='divide-y divide-gray-200'>
                          <For each={previewAssignments()}>
                            {assignment => (
                              <tr
                                class={`hover:bg-gray-50 ${assignment.sameReviewer ? 'bg-red-50' : ''}`}
                              >
                                <td class='px-4 py-2 text-gray-900 truncate max-w-xs'>
                                  {assignment.studyName}
                                </td>
                                <td class='px-4 py-2 text-gray-600'>{assignment.reviewer1Name}</td>
                                <td
                                  class={`px-4 py-2 ${assignment.sameReviewer ? 'text-red-600 font-medium' : 'text-gray-600'}`}
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
                    <div class='bg-gray-50 px-4 py-3 border-t border-gray-200 flex gap-2'>
                      <button
                        onClick={() => {
                          handleApply();
                          handleCollapse();
                        }}
                        disabled={previewAssignments().some(a => a.sameReviewer)}
                        class='inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors gap-2'
                      >
                        <BiRegularCheck class='w-4 h-4' />
                        Apply Assignments
                      </button>
                      <button
                        onClick={handleCancel}
                        class='px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:border-gray-400 transition-colors'
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
      </Show>
    </div>
  );
}
