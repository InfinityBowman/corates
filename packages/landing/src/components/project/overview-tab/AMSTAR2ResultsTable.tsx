/**
 * AMSTAR2ResultsTable - Displays AMSTAR 2 quality scores for each study
 */

import { useMemo } from 'react';
import { CHECKLIST_STATUS } from '@/constants/checklist-status.js';
import { ScoreTag, ScoreTooltip } from '@/components/checklist/ScoreTag';

interface AMSTAR2ResultsTableProps {
  studies: any[];
}

export function AMSTAR2ResultsTable({ studies }: AMSTAR2ResultsTableProps) {
  const studyScores = useMemo(() => {
    if (studies.length === 0) return [];

    const results: Array<{ studyId: string; studyName: string; score: string }> = [];

    for (const study of studies) {
      const checklists = study.checklists || [];
      if (checklists.length === 0) continue;

      let checklistToScore = null;

      if (study.reconciliation?.reconciledChecklistId) {
        const reconciled = checklists.find(
          (c: any) =>
            c.id === study.reconciliation.reconciledChecklistId && c.type === 'AMSTAR2',
        );
        if (reconciled && reconciled.status === CHECKLIST_STATUS.FINALIZED) {
          checklistToScore = reconciled;
        }
      }

      if (!checklistToScore) {
        checklistToScore = checklists.find(
          (c: any) => c.type === 'AMSTAR2' && c.status === CHECKLIST_STATUS.FINALIZED,
        );
      }

      if (!checklistToScore?.score) continue;

      results.push({
        studyId: study.id,
        studyName: study.name,
        score: checklistToScore.score,
      });
    }

    return results;
  }, [studies]);

  const summary = useMemo(() => {
    if (studyScores.length === 0) return null;

    const counts: Record<string, number> = {
      High: 0,
      Moderate: 0,
      Low: 0,
      'Critically Low': 0,
    };

    studyScores.forEach(item => {
      if (Object.prototype.hasOwnProperty.call(counts, item.score)) {
        counts[item.score]++;
      }
    });

    const total = studyScores.length;
    return {
      counts,
      percentages: {
        High: total > 0 ? Math.round((counts.High / total) * 100) : 0,
        Moderate: total > 0 ? Math.round((counts.Moderate / total) * 100) : 0,
        Low: total > 0 ? Math.round((counts.Low / total) * 100) : 0,
        'Critically Low':
          total > 0 ? Math.round((counts['Critically Low'] / total) * 100) : 0,
      },
      total,
    };
  }, [studyScores]);

  if (studyScores.length === 0) {
    return (
      <div className="border-border bg-card rounded-lg border px-4 py-8 text-center">
        <p className="text-muted-foreground">
          Once appraisals are completed, this section will display tables summarizing the
          distribution of overall confidence ratings and the overall confidence rating for each
          included review.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary */}
      {summary && (
        <div className="border-border bg-muted rounded-lg border p-4">
          <h3 className="text-foreground mb-3 text-sm font-semibold">Summary</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(['High', 'Moderate', 'Low', 'Critically Low'] as const).map(level => (
              <div key={level} className="text-center">
                <p className="text-foreground text-lg font-semibold">
                  {summary.percentages[level]}%
                </p>
                <p className="text-secondary-foreground text-xs">{level}</p>
                <p className="text-muted-foreground text-xs">
                  ({summary.counts[level]} of {summary.total})
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="divide-border min-w-full divide-y">
          <thead className="bg-muted">
            <tr>
              <th className="text-muted-foreground px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Study
              </th>
              <th className="text-muted-foreground px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  Rating <ScoreTooltip checklistType="AMSTAR2" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border bg-card divide-y">
            {studyScores.map(item => (
              <tr key={item.studyId} className="hover:bg-muted">
                <td className="text-foreground whitespace-nowrap px-6 py-4 text-sm font-medium">
                  {item.studyName}
                </td>
                <td className="text-muted-foreground whitespace-nowrap px-6 py-4 text-sm">
                  <ScoreTag currentScore={item.score} checklistType="AMSTAR2" showRatingOnly />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
