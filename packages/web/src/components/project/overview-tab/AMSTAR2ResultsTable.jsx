import { For, Show, createMemo } from 'solid-js';
import { CHECKLIST_STATUS } from '@/constants/checklist-status.js';
import ScoreTag, { ScoreTooltip } from '@/components/checklist/ScoreTag.jsx';

/**
 * AMSTAR2ResultsTable - Displays AMSTAR 2 quality scores for each study
 *
 * Props:
 * - studies: signal returning array of studies with checklists (includes score from store)
 */
export default function AMSTAR2ResultsTable(props) {
  // Process studies and extract scores from store data
  // Scores are computed during sync and stored on checklist objects
  const studyScores = createMemo(() => {
    const studiesList = props.studies?.() || [];
    if (studiesList.length === 0) return [];

    const results = [];

    for (const study of studiesList) {
      const checklists = study.checklists || [];
      if (checklists.length === 0) continue;

      // Find the checklist to display score for
      let checklistToScore = null;

      // First, check for reconciled checklist
      if (study.reconciliation?.reconciledChecklistId) {
        const reconciledChecklist = checklists.find(
          c => c.id === study.reconciliation.reconciledChecklistId && c.type === 'AMSTAR2',
        );
        if (reconciledChecklist && reconciledChecklist.status === CHECKLIST_STATUS.FINALIZED) {
          checklistToScore = reconciledChecklist;
        }
      }

      // If no reconciled checklist, use first finalized AMSTAR2 checklist
      if (!checklistToScore) {
        checklistToScore = checklists.find(
          c => c.type === 'AMSTAR2' && c.status === CHECKLIST_STATUS.FINALIZED,
        );
      }

      if (!checklistToScore) continue;

      // Score is pre-computed during sync and stored on the checklist
      const score = checklistToScore.score;
      if (!score) continue;

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
        <div class='border-border bg-card rounded-lg border px-4 py-8 text-center'>
          <p class='text-muted-foreground'>
            Once appraisals are completed, this section will display tables summarizing the
            distribution of overall confidence ratings (critically low, low, moderate, high) and the
            overall confidence rating for each included review.
          </p>
        </div>
      }
    >
      <div class='flex flex-col gap-6'>
        {/* Summary Section */}
        <Show when={summary()}>
          {summaryData => (
            <div class='border-border bg-muted rounded-lg border p-4'>
              <h3 class='text-foreground mb-3 text-sm font-semibold'>Summary</h3>
              <div class='grid grid-cols-2 gap-3 md:grid-cols-4'>
                <div class='text-center'>
                  <p class='text-foreground text-lg font-semibold'>
                    {summaryData().percentages.High}%
                  </p>
                  <p class='text-secondary-foreground text-xs'>High</p>
                  <p class='text-muted-foreground text-xs'>
                    ({summaryData().counts.High} of {summaryData().total})
                  </p>
                </div>
                <div class='text-center'>
                  <p class='text-foreground text-lg font-semibold'>
                    {summaryData().percentages.Moderate}%
                  </p>
                  <p class='text-secondary-foreground text-xs'>Moderate</p>
                  <p class='text-muted-foreground text-xs'>
                    ({summaryData().counts.Moderate} of {summaryData().total})
                  </p>
                </div>
                <div class='text-center'>
                  <p class='text-foreground text-lg font-semibold'>
                    {summaryData().percentages.Low}%
                  </p>
                  <p class='text-secondary-foreground text-xs'>Low</p>
                  <p class='text-muted-foreground text-xs'>
                    ({summaryData().counts.Low} of {summaryData().total})
                  </p>
                </div>
                <div class='text-center'>
                  <p class='text-foreground text-lg font-semibold'>
                    {summaryData().percentages['Critically Low']}%
                  </p>
                  <p class='text-secondary-foreground text-xs'>Critically Low</p>
                  <p class='text-muted-foreground text-xs'>
                    ({summaryData().counts['Critically Low']} of {summaryData().total})
                  </p>
                </div>
              </div>
            </div>
          )}
        </Show>

        {/* Results Table */}
        <div class='overflow-x-auto'>
          <table class='divide-border min-w-full divide-y'>
            <thead class='bg-muted'>
              <tr>
                <th
                  scope='col'
                  class='text-muted-foreground px-6 py-3 text-left text-xs font-medium tracking-wider uppercase'
                >
                  Study
                </th>
                <th
                  scope='col'
                  class='text-muted-foreground px-6 py-3 text-left text-xs font-medium tracking-wider uppercase'
                >
                  <div class='flex items-center gap-1'>
                    Rating <ScoreTooltip checklistType='AMSTAR2' />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class='divide-border bg-card divide-y'>
              <For each={studyScores()}>
                {item => (
                  <tr class='hover:bg-muted'>
                    <td class='text-foreground px-6 py-4 text-sm font-medium whitespace-nowrap'>
                      {item.studyName}
                    </td>
                    <td class='text-muted-foreground px-6 py-4 text-sm whitespace-nowrap'>
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
