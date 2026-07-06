/**
 * ResultsTables - Composes the results tables for the Tables panel: the
 * AMSTAR 2 overall-confidence table plus one domain-judgement table per
 * assessed outcome for the risk-of-bias tools (RoB 2, ROBINS-I).
 */

import { useMemo } from 'react';
import { CHECKLIST_STATUS } from '@corates/shared/checklists';
import { ROB2_CHART_CONFIG, ROBINS_I_CHART_CONFIG } from '@/components/charts/chartConfigs';
import type { ChecklistChartConfig } from '@/components/charts/chartConfigs';
import { useProjectContext } from '../ProjectContext';
import { useProjectMetaById } from '@/primitives/useProject/reactor';
import { AMSTAR2ResultsTable } from './AMSTAR2ResultsTable';
import type { StudyInfo } from '@/stores/projectStore';

// Pill styling per judgement, keyed by lowercased consolidatedAnswers value.
// Mirrors the checklist-registry scoreColors, extended with the two values
// that only appear at domain level.
const JUDGEMENT_PILLS: Record<string, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-green-100 text-green-800' },
  'low (except for concerns about uncontrolled confounding)': {
    label: 'Low (confounding concerns)',
    className: 'bg-lime-100 text-lime-800',
  },
  'some concerns': { label: 'Some concerns', className: 'bg-yellow-100 text-yellow-800' },
  moderate: { label: 'Moderate', className: 'bg-yellow-100 text-yellow-800' },
  serious: { label: 'Serious', className: 'bg-orange-100 text-orange-800' },
  high: { label: 'High', className: 'bg-red-100 text-red-800' },
  critical: { label: 'Critical', className: 'bg-red-100 text-red-800' },
  'no information': { label: 'No information', className: 'bg-blue-100 text-blue-800' },
};

function JudgementPill({ value }: { value: string }) {
  const pill = JUDGEMENT_PILLS[value.toLowerCase()];
  if (!pill) return <span className='text-muted-foreground text-sm'>-</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${pill.className}`}
    >
      {pill.label}
    </span>
  );
}

interface TableRow {
  id: string;
  studyName: string;
  values: Record<string, string>;
}

interface TableGroup {
  key: string;
  heading: string;
  config: ChecklistChartConfig;
  rows: TableRow[];
}

interface ResultsTablesProps {
  studies: StudyInfo[];
}

export function ResultsTables({ studies }: ResultsTablesProps) {
  const { projectId } = useProjectContext();
  const meta = useProjectMetaById(projectId);
  const outcomes = meta.outcomes;

  const hasAmstarData = useMemo(
    () =>
      studies.some(study =>
        study.checklists.some(
          c => c.type === 'AMSTAR2' && c.status === CHECKLIST_STATUS.FINALIZED && c.score,
        ),
      ),
    [studies],
  );

  const groups = useMemo<TableGroup[]>(() => {
    const outcomeTools = [
      { type: 'ROB2', name: 'RoB 2', config: ROB2_CHART_CONFIG },
      { type: 'ROBINS_I', name: 'ROBINS-I', config: ROBINS_I_CHART_CONFIG },
    ];

    const result: TableGroup[] = [];
    for (const tool of outcomeTools) {
      const byOutcome = new Map<string, TableRow[]>();
      for (const study of studies) {
        for (const checklist of study.checklists || []) {
          if (checklist.status !== CHECKLIST_STATUS.FINALIZED) continue;
          if (checklist.type !== tool.type) continue;
          const answersObj = checklist.consolidatedAnswers;
          if (!answersObj) continue;

          const outcomeKey = checklist.outcomeId ?? '';
          const rows = byOutcome.get(outcomeKey) ?? [];
          const values: Record<string, string> = {};
          for (const column of tool.config.columns) {
            values[column.id] = answersObj[column.id] ?? '';
          }
          rows.push({ id: `${study.id}-${checklist.id}`, studyName: study.name, values });
          byOutcome.set(outcomeKey, rows);
        }
      }

      // Project outcome order first; any checklists without a matching
      // outcome entry go last.
      const orderedKeys = [
        ...outcomes.map(o => o.id).filter(id => byOutcome.has(id)),
        ...[...byOutcome.keys()].filter(key => !outcomes.some(o => o.id === key)),
      ];
      for (const outcomeKey of orderedKeys) {
        const outcomeName = outcomes.find(o => o.id === outcomeKey)?.name ?? 'Unspecified outcome';
        result.push({
          key: `${tool.type}-${outcomeKey || 'none'}`,
          heading: `${tool.name} - ${outcomeName}`,
          config: tool.config,
          rows: byOutcome.get(outcomeKey) ?? [],
        });
      }
    }
    return result;
  }, [studies, outcomes]);

  if (!hasAmstarData && groups.length === 0) {
    return (
      <div className='border-border bg-card rounded-lg border px-4 py-8 text-center'>
        <p className='text-muted-foreground'>
          Once appraisals are completed, this section will display tables summarizing the ratings
          for each included study.
        </p>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-8'>
      {hasAmstarData && <AMSTAR2ResultsTable studies={studies} />}

      {groups.map(group => (
        <div key={group.key} className='flex flex-col gap-3'>
          <h3 className='text-foreground text-sm font-semibold'>{group.heading}</h3>
          <div className='border-border overflow-x-auto rounded-lg border'>
            <table className='divide-border min-w-full divide-y'>
              <thead className='bg-muted'>
                <tr>
                  <th className='text-muted-foreground px-6 py-3 text-left text-xs font-medium tracking-wider uppercase'>
                    Study
                  </th>
                  {group.config.columns.map(column => (
                    <th
                      key={column.id}
                      className='text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase'
                      title={column.distributionLabel ?? column.label}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className='divide-border bg-card divide-y'>
                {group.rows.map(row => (
                  <tr key={row.id} className='hover:bg-muted'>
                    <td className='text-foreground px-6 py-4 text-sm font-medium whitespace-nowrap'>
                      {row.studyName}
                    </td>
                    {group.config.columns.map(column => (
                      <td key={column.id} className='px-4 py-4 text-sm'>
                        <JudgementPill value={row.values[column.id]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
