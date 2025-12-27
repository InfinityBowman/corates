import { For, Show, createMemo } from 'solid-js';
import { scoreChecklist } from '@/AMSTAR2/checklist.js';
import { CHECKLIST_STATUS } from '@/constants/checklist-status.js';
import ScoreTag, { ScoreTooltip } from '@/components/checklist/ScoreTag.jsx';

/**
 * AMSTAR2ResultsTable - Displays AMSTAR 2 quality scores for each study
 *
 * Props:
 * - studies: signal returning array of studies with checklists
 * - getChecklistData: function (studyId, checklistId) => checklist with answers
 * - synced: signal returning boolean indicating if Y.Doc data is ready
 */
export default function AMSTAR2ResultsTable(props) {
  // Process studies and calculate scores
  const studyScores = createMemo(() => {
    // Track synced state to ensure memo re-runs when data becomes available
    const _isSynced = props.synced?.() ?? false;
    const studiesList = props.studies?.() || [];
    if (studiesList.length === 0) return [];

    const results = [];

    for (const study of studiesList) {
      if (!study.checklists || study.checklists.length === 0) continue;

      // Find the checklist to score for this study
      let checklistToScore = null;

      // First, check for reconciled checklist
      if (study.reconciliation?.reconciledChecklistId) {
        const reconciledChecklist = study.checklists.find(
          c => c.id === study.reconciliation.reconciledChecklistId && c.type === 'AMSTAR2',
        );
        if (reconciledChecklist && reconciledChecklist.status === CHECKLIST_STATUS.COMPLETED) {
          checklistToScore = reconciledChecklist;
        }
      }

      // If no reconciled checklist, use first completed AMSTAR2 checklist
      if (!checklistToScore) {
        checklistToScore = study.checklists.find(
          c => c.type === 'AMSTAR2' && c.status === CHECKLIST_STATUS.COMPLETED,
        );
      }

      if (!checklistToScore) continue;

      // Get full checklist data with answers
      const fullChecklist = props.getChecklistData?.(study.id, checklistToScore.id);
      if (!fullChecklist?.answers) continue;

      // Calculate score
      const score = scoreChecklist(fullChecklist.answers);
      if (!score || score === 'Error') continue;

      results.push({
        studyId: study.id,
        studyName: study.name,
        score: score,
      });
    }

    return results;
  });

  // Calculate summary statistics
  const summary = createMemo(() => {
    const scores = studyScores();
    if (scores.length === 0) return null;

    const counts = {
      High: 0,
      Moderate: 0,
      Low: 0,
      'Critically Low': 0,
    };

    scores.forEach(item => {
      if (Object.prototype.hasOwnProperty.call(counts, item.score)) {
        counts[item.score]++;
      }
    });

    const total = scores.length;
    const percentages = {
      High: total > 0 ? Math.round((counts.High / total) * 100) : 0,
      Moderate: total > 0 ? Math.round((counts.Moderate / total) * 100) : 0,
      Low: total > 0 ? Math.round((counts.Low / total) * 100) : 0,
      'Critically Low': total > 0 ? Math.round((counts['Critically Low'] / total) * 100) : 0,
    };

    return {
      counts,
      percentages,
      total,
    };
  });

  return (
    <Show
      when={studyScores().length > 0}
      fallback={
        <div class='rounded-lg border border-gray-200 bg-white py-8 text-center'>
          <p class='text-gray-500'>No completed AMSTAR 2 appraisals to display.</p>
          <p class='mt-1 text-sm text-gray-400'>
            Complete AMSTAR 2 checklists to see quality assessment results.
          </p>
        </div>
      }
    >
      <div class='flex flex-col gap-6'>
        {/* Summary Section */}
        <Show when={summary()}>
          {summaryData => (
            <div class='rounded-lg border border-gray-200 bg-gray-50 p-4'>
              <h3 class='mb-3 text-sm font-semibold text-gray-900'>Summary</h3>
              <div class='grid grid-cols-2 gap-3 md:grid-cols-4'>
                <div class='text-center'>
                  <p class='text-lg font-semibold text-gray-900'>
                    {summaryData().percentages.High}%
                  </p>
                  <p class='text-xs text-gray-600'>High</p>
                  <p class='text-xs text-gray-500'>
                    ({summaryData().counts.High} of {summaryData().total})
                  </p>
                </div>
                <div class='text-center'>
                  <p class='text-lg font-semibold text-gray-900'>
                    {summaryData().percentages.Moderate}%
                  </p>
                  <p class='text-xs text-gray-600'>Moderate</p>
                  <p class='text-xs text-gray-500'>
                    ({summaryData().counts.Moderate} of {summaryData().total})
                  </p>
                </div>
                <div class='text-center'>
                  <p class='text-lg font-semibold text-gray-900'>
                    {summaryData().percentages.Low}%
                  </p>
                  <p class='text-xs text-gray-600'>Low</p>
                  <p class='text-xs text-gray-500'>
                    ({summaryData().counts.Low} of {summaryData().total})
                  </p>
                </div>
                <div class='text-center'>
                  <p class='text-lg font-semibold text-gray-900'>
                    {summaryData().percentages['Critically Low']}%
                  </p>
                  <p class='text-xs text-gray-600'>Critically Low</p>
                  <p class='text-xs text-gray-500'>
                    ({summaryData().counts['Critically Low']} of {summaryData().total})
                  </p>
                </div>
              </div>
            </div>
          )}
        </Show>

        {/* Results Table */}
        <div class='overflow-x-auto'>
          <table class='min-w-full divide-y divide-gray-200'>
            <thead class='bg-gray-50'>
              <tr>
                <th
                  scope='col'
                  class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'
                >
                  Study
                </th>
                <th
                  scope='col'
                  class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'
                >
                  <div class='flex items-center gap-1'>
                    Rating <ScoreTooltip checklistType='AMSTAR2' />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class='divide-y divide-gray-200 bg-white'>
              <For each={studyScores()}>
                {item => (
                  <tr class='hover:bg-gray-50'>
                    <td class='px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900'>
                      {item.studyName}
                    </td>
                    <td class='px-6 py-4 text-sm whitespace-nowrap text-gray-500'>
                      <ScoreTag currentScore={item.score} checklistType='AMSTAR2' showRatingOnly />
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </Show>
  );
}
