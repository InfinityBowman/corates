/**
 * AMSTAR2ResultsTable - Displays AMSTAR 2 quality scores for each study
 */

import { useMemo } from 'react';
import { CHECKLIST_STATUS } from '@corates/shared/checklists';
import { ScoreTag, ScoreTooltip } from '@/components/checklist/ScoreTag';
import type { StudyInfo } from '@/stores/projectStore';
import { OutputCard, OutputCardHeader, OutputCardPlate } from './OutputCard';

interface AMSTAR2ResultsTableProps {
  studies: StudyInfo[];
  tableNumber: number;
}

const CONFIDENCE_LEVELS = ['High', 'Moderate', 'Low', 'Critically Low'] as const;

function summaryValueColor(level: (typeof CONFIDENCE_LEVELS)[number], percentage: number): string {
  if (percentage === 0) return 'text-[#d0d5dd]';
  if (level === 'High') return 'text-[#067647]';
  if (level === 'Critically Low') return 'text-[#b42318]';
  if (level === 'Moderate') return 'text-[#a15c07]';
  return 'text-[#344054]';
}

export function AMSTAR2ResultsTable({ studies, tableNumber }: AMSTAR2ResultsTableProps) {
  const studyScores = useMemo(() => {
    if (studies.length === 0) return [];

    const results: Array<{ studyId: string; studyName: string; score: string }> = [];

    for (const study of studies) {
      if (study.checklists.length === 0) continue;

      let checklistToScore = null;

      if (study.reconciliation?.reconciledChecklistId) {
        const reconciled = study.checklists.find(
          c => c.id === study.reconciliation!.reconciledChecklistId && c.type === 'AMSTAR2',
        );
        if (reconciled && reconciled.status === CHECKLIST_STATUS.FINALIZED) {
          checklistToScore = reconciled;
        }
      }

      if (!checklistToScore) {
        checklistToScore = study.checklists.find(
          c => c.type === 'AMSTAR2' && c.status === CHECKLIST_STATUS.FINALIZED,
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
        'Critically Low': total > 0 ? Math.round((counts['Critically Low'] / total) * 100) : 0,
      },
      total,
    };
  }, [studyScores]);

  if (studyScores.length === 0) {
    return null;
  }

  const reviewLabel = studyScores.length === 1 ? 'review' : 'reviews';

  return (
    <OutputCard>
      <OutputCardHeader
        number={tableNumber}
        numberPrefix='TBL'
        name='Overall confidence by review'
        instrumentLabel='AMSTAR 2'
        instrumentKind='amstar'
        description='Algorithm-derived confidence rating for each completed appraisal.'
      />
      <OutputCardPlate className='px-[18px] pt-[18px] pb-[18px]'>
        {summary && (
          <div className='bg-card mb-4 flex overflow-hidden rounded-xl border border-[#eaecf0]'>
            {CONFIDENCE_LEVELS.map((level, index) => (
              <div
                key={level}
                className={`flex flex-1 flex-col gap-[3px] px-[18px] py-3.5 ${
                  index < CONFIDENCE_LEVELS.length - 1 ? 'border-r border-[#f2f4f7]' : ''
                }`}
              >
                <span
                  className={`text-2xl leading-none font-semibold tracking-[-0.02em] tabular-nums ${summaryValueColor(level, summary.percentages[level])}`}
                >
                  {summary.percentages[level]}%
                </span>
                <span className='text-[12.5px] leading-snug font-medium text-[#344054]'>
                  {level === 'Critically Low' ? 'Critically low' : level}
                </span>
                <span className='text-[11.5px] leading-snug text-[#98a2b3]'>
                  {summary.counts[level]} of {summary.total} {reviewLabel}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className='bg-card overflow-x-auto rounded-xl border border-[#eaecf0]'>
          <table className='min-w-full'>
            <thead className='bg-[#fafbfc]'>
              <tr>
                <th className='px-4 py-[11px] text-left text-[10.5px] font-semibold tracking-[0.07em] text-[#98a2b3] uppercase'>
                  Study
                </th>
                <th className='px-4 py-[11px] text-left text-[10.5px] font-semibold tracking-[0.07em] text-[#98a2b3] uppercase'>
                  <div className='flex items-center gap-1'>
                    Overall confidence <ScoreTooltip checklistType='AMSTAR2' />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {studyScores.map(item => (
                <tr key={item.studyId} className='border-t border-[#f2f4f7] hover:bg-[#fcfcfd]'>
                  <td className='px-4 py-3 text-[13.5px] font-normal whitespace-nowrap text-[#101828]'>
                    {item.studyName}
                  </td>
                  <td className='px-4 py-3 text-[13.5px] whitespace-nowrap'>
                    <ScoreTag currentScore={item.score} checklistType='AMSTAR2' showRatingOnly />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OutputCardPlate>
    </OutputCard>
  );
}
