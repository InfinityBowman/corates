/**
 * Inter-rater reliability across a project
 *
 * Every (study, tool, outcome) cell with two completed reviewer checklists is
 * one reviewer pair. Pairs are pooled per tool, never across tools, because
 * each tool has its own scale. The reviewer checklists keep their status after
 * the consensus is finalized, so the numbers describe agreement before
 * reconciliation and stay stable afterwards.
 */

import { CHECKLIST_STATUS } from '../status.js';
import { getAppraisalCells, isReconciledChecklist } from '../domain.js';
import type { Study } from '../types.js';
import { summarizeLevel, type LevelStats } from './stats.js';
import type { ToolPairs, ToolReliabilityDefinition, ReliabilityToolType } from './types.js';
import { ROB2_RELIABILITY } from './rob2.js';
import { ROBINS_I_RELIABILITY } from './robins-i.js';
import { AMSTAR2_RELIABILITY } from './amstar2.js';

export * from './stats.js';
export * from './types.js';
export { extractRob2Pairs, ROB2_JUDGEMENT_SCALE } from './rob2.js';
export { extractRobinsIPairs, ROBINS_I_JUDGEMENT_SCALE } from './robins-i.js';
export { extractAmstar2Pairs, AMSTAR2_ITEM_SCALE, AMSTAR2_OVERALL_SCALE } from './amstar2.js';

export const RELIABILITY_TOOLS: Record<ReliabilityToolType, ToolReliabilityDefinition> = {
  ROB2: ROB2_RELIABILITY,
  ROBINS_I: ROBINS_I_RELIABILITY,
  AMSTAR2: AMSTAR2_RELIABILITY,
};

const TOOL_ORDER: ReliabilityToolType[] = ['ROB2', 'ROBINS_I', 'AMSTAR2'];

export interface ToolReliability {
  definition: ToolReliabilityDefinition;
  /** Reviewer pairs compared. */
  cells: number;
  studies: number;
  judgements: LevelStats;
  overall: LevelStats;
  questions: LevelStats | null;
}

export type ChecklistDataGetter = (
  studyId: string,
  checklistId: string,
) => { answers?: unknown } | null | undefined;

function isReliabilityTool(type: string): type is ReliabilityToolType {
  return type in RELIABILITY_TOOLS;
}

export function calculateProjectReliability(
  studies: Study[] | null | undefined,
  getChecklistData: ChecklistDataGetter,
): ToolReliability[] {
  const pools = new Map<
    ReliabilityToolType,
    { pairs: ToolPairs; cells: number; studies: Set<string> }
  >();

  for (const study of studies ?? []) {
    for (const cell of getAppraisalCells(study)) {
      if (!isReliabilityTool(cell.type)) continue;
      const reviewers = cell.checklists.filter(
        c => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
      );
      if (reviewers.length !== 2) continue;
      if (reviewers[0].assignedTo && reviewers[0].assignedTo === reviewers[1].assignedTo) continue;

      // Stable orientation for the matrix: rows are the lower user id.
      reviewers.sort((x, y) => (x.assignedTo ?? '').localeCompare(y.assignedTo ?? ''));
      const dataA = getChecklistData(study.id, reviewers[0].id)?.answers;
      const dataB = getChecklistData(study.id, reviewers[1].id)?.answers;
      if (!dataA || !dataB) continue;

      const definition = RELIABILITY_TOOLS[cell.type];
      const extracted = definition.extractPairs(dataA, dataB);
      let pool = pools.get(cell.type);
      if (!pool) {
        pool = {
          pairs: { judgements: [], overall: [], questions: [] },
          cells: 0,
          studies: new Set(),
        };
        pools.set(cell.type, pool);
      }
      pool.pairs.judgements.push(...extracted.judgements);
      pool.pairs.overall.push(...extracted.overall);
      pool.pairs.questions.push(...extracted.questions);
      pool.cells += 1;
      pool.studies.add(study.id);
    }
  }

  const results: ToolReliability[] = [];
  for (const type of TOOL_ORDER) {
    const pool = pools.get(type);
    if (!pool) continue;
    const definition = RELIABILITY_TOOLS[type];
    results.push({
      definition,
      cells: pool.cells,
      studies: pool.studies.size,
      judgements: summarizeLevel(
        pool.pairs.judgements,
        definition.judgementScale,
        definition.items,
      ),
      overall: summarizeLevel(pool.pairs.overall, definition.overallScale, [
        { key: 'overall', label: 'Overall', title: 'Overall judgement' },
      ]),
      questions: definition.hasQuestions ? summarizeLevel(pool.pairs.questions, null, []) : null,
    });
  }
  return results;
}
