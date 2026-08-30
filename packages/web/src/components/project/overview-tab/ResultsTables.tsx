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
import { useProjectOutcomes } from '@/project/workspace-data';
import { AMSTAR2ResultsTable } from './AMSTAR2ResultsTable';
import { OutputCard, OutputCardHeader, OutputCardPlate } from './OutputCard';
import { ResultsTable } from './ResultsTable';
import type { InstrumentKind } from './OutputCard';
import type { StudyInfo } from '@/stores/projectStore';

interface TableRow {
  id: string;
  studyName: string;
  values: Record<string, string>;
}

interface TableGroup {
  key: string;
  name: string;
  description: string;
  instrumentLabel: string;
  instrumentKind: InstrumentKind;
  config: ChecklistChartConfig;
  rows: TableRow[];
}

interface ResultsTablesProps {
  studies: StudyInfo[];
}

export function ResultsTables({ studies }: ResultsTablesProps) {
  const { projectId } = useProjectContext();
  const outcomes = useProjectOutcomes(projectId);

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

      const orderedKeys = [
        ...outcomes.map(o => o.id).filter(id => byOutcome.has(id)),
        ...[...byOutcome.keys()].filter(key => !outcomes.some(o => o.id === key)),
      ];
      for (const outcomeKey of orderedKeys) {
        const outcomeName = outcomes.find(o => o.id === outcomeKey)?.name ?? 'Unspecified outcome';
        result.push({
          key: `${tool.type}-${outcomeKey || 'none'}`,
          name: `Domain judgments — ${outcomeName}`,
          description: `Per-domain and overall judgments derived from the ${tool.name} algorithm.`,
          instrumentLabel: tool.name,
          instrumentKind: 'rob',
          config: tool.config,
          rows: byOutcome.get(outcomeKey) ?? [],
        });
      }
    }
    return result;
  }, [studies, outcomes]);

  if (!hasAmstarData && groups.length === 0) {
    return (
      <div className='bg-card rounded-[14px] border border-dashed border-[#d0d5dd] px-4 py-8 text-center'>
        <p className='text-muted-foreground'>
          Once appraisals are completed, this section will display tables summarizing the ratings
          for each included study.
        </p>
      </div>
    );
  }

  let tableNumber = 0;

  return (
    <div className='flex flex-col gap-[18px]'>
      {hasAmstarData && <AMSTAR2ResultsTable studies={studies} tableNumber={++tableNumber} />}

      {groups.map(group => {
        tableNumber += 1;
        return (
          <OutputCard key={group.key}>
            <OutputCardHeader
              number={tableNumber}
              numberPrefix='TBL'
              name={group.name}
              instrumentLabel={group.instrumentLabel}
              instrumentKind={group.instrumentKind}
              description={group.description}
            />
            <OutputCardPlate className='px-[18px] pt-[18px] pb-[18px]'>
              <ResultsTable columns={group.config.columns} rows={group.rows} />
            </OutputCardPlate>
          </OutputCard>
        );
      })}
    </div>
  );
}
