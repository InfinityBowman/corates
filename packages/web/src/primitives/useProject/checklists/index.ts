/**
 * Checklist operations for useProject
 * Main coordinator that delegates to type-specific handlers
 */

import * as Y from 'yjs';
import { AMSTAR2_KEY_SCHEMAS, isAmstar2Key } from '@corates/shared/checklists/amstar2';
import type { Amstar2Key, Amstar2Answers } from '@corates/shared/checklists/amstar2';
import { ROBINS_I_KEY_SCHEMAS, isRobinsIKey } from '@corates/shared/checklists/robins-i';
import type { RobinsIKey, RobinsIAnswers } from '@corates/shared/checklists/robins-i';
import { ROB2_KEY_SCHEMAS, isRob2Key } from '@corates/shared/checklists/rob2';
import type { Rob2Key, Rob2Answers } from '@corates/shared/checklists/rob2';
import { createChecklistOfType, CHECKLIST_TYPES } from '@/checklist-registry';
import { CHECKLIST_STATUS, getOutcomeKey } from '@corates/shared/checklists';
import { createCommonOperations } from './common';
import {
  readReconciliationEntry,
  writeReconciliationEntry,
  deleteReconciliationEntry,
} from '../reconciliation';
import { AMSTAR2Handler } from './handlers/amstar2';
import { ROBINSIHandler } from './handlers/robins-i';
import { ROB2Handler } from './handlers/rob2';
import type { ChecklistHandler } from './handlers/base';
import { applyYTextDiff } from '@/hooks/useYText';

export type TextRef =
  | { type: 'AMSTAR2'; questionKey: string }
  | { type: 'ROBINS_I'; sectionKey: string; fieldKey: string; questionKey?: string | null }
  | { type: 'ROB2'; sectionKey: string; fieldKey: string; questionKey?: string | null };

/**
 * Discriminated input for `updateChecklistAnswer`. Each variant ties the
 * `key` to the per-checklist key union and `data` to that key's answer
 * payload type, so callers can't pass mismatched (type, key, data) triples.
 */
export type ChecklistAnswerInput =
  | { [K in Amstar2Key]: { type: 'AMSTAR2'; key: K; data: Amstar2Answers[K] } }[Amstar2Key]
  | { [K in RobinsIKey]: { type: 'ROBINS_I'; key: K; data: RobinsIAnswers[K] } }[RobinsIKey]
  | { [K in Rob2Key]: { type: 'ROB2'; key: K; data: Rob2Answers[K] } }[Rob2Key];

/**
 * Narrow a (checklistType, key, data) triple coming from a dynamic patch into
 * a typed `ChecklistAnswerInput`. Returns null when the key is not valid for
 * the given checklist type. Data is asserted via `as` because patches arrive
 * as `unknown` from React event handlers; the dispatcher's Zod parse catches
 * any shape mismatch at runtime.
 */
export function buildChecklistAnswerInput(
  checklistType: string,
  key: string,
  data: unknown,
): ChecklistAnswerInput | null {
  // The (key, data) correlation is a runtime fact; widening through the
  // narrowed `key` would require a per-variant branch for every key. Cast
  // through the variant once — the dispatcher's Zod parse validates `data`
  // matches the schema for `key` at runtime.
  switch (checklistType) {
    case CHECKLIST_TYPES.AMSTAR2:
      if (!isAmstar2Key(key)) return null;
      return { type: 'AMSTAR2', key, data } as ChecklistAnswerInput;
    case CHECKLIST_TYPES.ROBINS_I:
      if (!isRobinsIKey(key)) return null;
      return { type: 'ROBINS_I', key, data } as ChecklistAnswerInput;
    case CHECKLIST_TYPES.ROB2:
      if (!isRob2Key(key)) return null;
      return { type: 'ROB2', key, data } as ChecklistAnswerInput;
    default:
      return null;
  }
}

export interface ChecklistData {
  answers: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ChecklistOperations {
  createChecklist: (
    studyId: string,
    type?: string,
    assignedTo?: string | null,
    outcomeId?: string | null,
  ) => string | null;
  updateChecklist: (studyId: string, checklistId: string, updates: Record<string, unknown>) => void;
  deleteChecklist: (studyId: string, checklistId: string) => void;
  changeChecklistOutcome: (
    studyId: string,
    type: string,
    fromOutcomeId: string,
    toOutcomeId: string,
  ) => { success: boolean; error?: string };
  getChecklistAnswersMap: (studyId: string, checklistId: string) => Y.Map<unknown> | null;
  getChecklistData: (studyId: string, checklistId: string) => ChecklistData | null;
  updateChecklistAnswer: (
    studyId: string,
    checklistId: string,
    input: ChecklistAnswerInput,
  ) => void;
  getTextRef: (studyId: string, checklistId: string, ref: TextRef) => Y.Text | null;
  setTextValue: (
    studyId: string,
    checklistId: string,
    ref: TextRef,
    text: string,
    maxLength?: number,
  ) => void;
}

/**
 * Pre-creates the checklist's annotations sub-map while checklist creation is
 * still a single-client operation. Creating it lazily on the first annotation
 * lets two clients race to create it, and Yjs silently discards the loser's
 * annotations. Skipped when the study-level container is missing (docs that
 * predate container pre-creation); the lazy path in annotations.ts still
 * covers those until the server migrates them.
 */
function preCreateAnnotationsSubMap(studyYMap: Y.Map<unknown>, checklistId: string): void {
  const annotationsMap = studyYMap.get('annotations') as Y.Map<unknown> | undefined;
  if (annotationsMap && !annotationsMap.has(checklistId)) {
    annotationsMap.set(checklistId, new Y.Map());
  }
}

export function createChecklistOperations(
  _projectId: string,
  getYDoc: () => Y.Doc | null,
): ChecklistOperations {
  const commonOps = createCommonOperations(getYDoc);

  const amstar2Handler = new AMSTAR2Handler();
  const robinsIHandler = new ROBINSIHandler();
  const rob2Handler = new ROB2Handler();

  const handlers: Record<string, ChecklistHandler> = {
    [CHECKLIST_TYPES.AMSTAR2]: amstar2Handler,
    [CHECKLIST_TYPES.ROBINS_I]: robinsIHandler,
    [CHECKLIST_TYPES.ROB2]: rob2Handler,
  };

  function getHandler(type: string): ChecklistHandler | null {
    return handlers[type] || null;
  }

  function requiresOutcome(type: string): boolean {
    return type === CHECKLIST_TYPES.ROB2 || type === CHECKLIST_TYPES.ROBINS_I;
  }

  function createChecklist(
    studyId: string,
    type = 'AMSTAR2',
    assignedTo: string | null = null,
    outcomeId: string | null = null,
  ): string | null {
    try {
      const ydoc = getYDoc();
      if (!ydoc) {
        console.error('[createChecklist] No YDoc available');
        return null;
      }

      if (requiresOutcome(type) && !outcomeId) {
        console.error(`[createChecklist] ${type} requires an outcomeId`);
        return null;
      }

      const studiesMap = ydoc.getMap('reviews');
      const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;

      if (!studyYMap) {
        const studyIds = Array.from(studiesMap.keys());
        console.error('[createChecklist] Study not found:', studyId);
        console.error('[createChecklist] Available studies in YDoc:', studyIds);
        return null;
      }

      let checklistsMap = studyYMap.get('checklists') as Y.Map<unknown> | undefined;
      if (!checklistsMap) {
        checklistsMap = new Y.Map();
        studyYMap.set('checklists', checklistsMap);
      }

      // Check for duplicate: same type + outcome + assignedTo
      if (requiresOutcome(type) && outcomeId) {
        for (const [, existingChecklistYMap] of checklistsMap.entries()) {
          const existing = existingChecklistYMap as Y.Map<unknown>;
          const existingType = existing.get('type');
          const existingOutcomeId = existing.get('outcomeId');
          const existingAssignedTo = existing.get('assignedTo');

          if (
            existingType === type &&
            existingOutcomeId === outcomeId &&
            existingAssignedTo === assignedTo
          ) {
            console.error(
              `[createChecklist] User already has a ${type} checklist for this outcome`,
            );
            return null;
          }
        }
      }

      const checklistId = crypto.randomUUID();
      const now = Date.now();

      const checklistTemplate = createChecklistOfType(type, {
        id: checklistId,
        name: `${type} Checklist`,
        createdAt: now,
      });

      const handler = getHandler(type);
      if (!handler) {
        console.warn('[createChecklist] No handler for type, using fallback:', type);
        const checklistYMap = new Y.Map();
        checklistYMap.set('type', type);
        checklistYMap.set('title', `${type} Checklist`);
        checklistYMap.set('assignedTo', assignedTo);
        checklistYMap.set('status', CHECKLIST_STATUS.PENDING);
        checklistYMap.set('createdAt', now);
        checklistYMap.set('updatedAt', now);
        if (outcomeId) checklistYMap.set('outcomeId', outcomeId);

        const answersYMap = new Y.Map();
        Object.entries(checklistTemplate as Record<string, unknown>).forEach(([key, value]) => {
          answersYMap.set(key, value);
        });
        checklistYMap.set('answers', answersYMap);
        checklistsMap.set(checklistId, checklistYMap);
        preCreateAnnotationsSubMap(studyYMap, checklistId);
        studyYMap.set('updatedAt', now);
        return checklistId;
      }

      const answersData = handler.extractAnswersFromTemplate(
        checklistTemplate as Record<string, unknown>,
      );

      const checklistYMap = new Y.Map();
      checklistYMap.set('type', type);
      checklistYMap.set('title', `${type} Checklist`);
      checklistYMap.set('assignedTo', assignedTo);
      checklistYMap.set('status', CHECKLIST_STATUS.PENDING);
      checklistYMap.set('createdAt', now);
      checklistYMap.set('updatedAt', now);
      if (outcomeId) checklistYMap.set('outcomeId', outcomeId);

      const answersYMap = handler.createAnswersYMap(answersData);
      checklistYMap.set('answers', answersYMap);

      checklistsMap.set(checklistId, checklistYMap);
      preCreateAnnotationsSubMap(studyYMap, checklistId);

      // For ROBINS-I, auto-fill sectionA.outcome with the outcome name.
      // This must happen after the checklist is attached to the doc:
      // Y.Map.get() on an unattached map cannot see prelim content, so the
      // Y.Text would not be found before integration.
      if (type === CHECKLIST_TYPES.ROBINS_I && outcomeId) {
        const metaMap = ydoc.getMap('meta');
        const outcomesMap = metaMap.get('outcomes') as Y.Map<unknown> | undefined;
        if (outcomesMap) {
          const outcomeYMap = outcomesMap.get(outcomeId) as Y.Map<unknown> | undefined;
          if (outcomeYMap) {
            const outcomeName = outcomeYMap.get('name') as string | undefined;
            if (outcomeName) {
              const outcomeYText = answersYMap.get('sectionA.outcome');
              if (outcomeYText instanceof Y.Text) {
                outcomeYText.insert(0, outcomeName);
              }
            }
          }
        }
      }

      studyYMap.set('updatedAt', now);
      return checklistId;
    } catch (err) {
      console.error('[createChecklist] Error creating checklist:', err);
      return null;
    }
  }

  /**
   * Move all checklists of a type from one outcome to another: both reviewer
   * checklists and, when the group is already reconciled, the finalized
   * consensus checklist plus its reconciliation progress entry. Everything
   * moves intact; an in-progress reconciliation blocks the change so we never
   * have to migrate partial reconciliation state.
   */
  function changeChecklistOutcome(
    studyId: string,
    type: string,
    fromOutcomeId: string,
    toOutcomeId: string,
  ): { success: boolean; error?: string } {
    const ydoc = getYDoc();
    if (!ydoc) return { success: false, error: 'No active project connection' };

    if (!requiresOutcome(type)) {
      return { success: false, error: `${type} checklists are not linked to outcomes` };
    }
    if (fromOutcomeId === toOutcomeId) {
      return { success: false, error: 'The checklists are already under this outcome' };
    }

    const outcomesMap = ydoc.getMap('meta').get('outcomes') as Y.Map<unknown> | undefined;
    const toOutcomeYMap = outcomesMap?.get(toOutcomeId) as Y.Map<unknown> | undefined;
    if (!toOutcomeYMap) {
      return { success: false, error: 'Target outcome not found' };
    }
    const fromOutcomeYMap = outcomesMap?.get(fromOutcomeId) as Y.Map<unknown> | undefined;
    const fromOutcomeName = fromOutcomeYMap?.get('name') as string | undefined;
    const toOutcomeName = toOutcomeYMap.get('name') as string | undefined;

    const studyYMap = ydoc.getMap('reviews').get(studyId) as Y.Map<unknown> | undefined;
    if (!studyYMap) {
      return { success: false, error: 'Study not found' };
    }
    const checklistsMap = studyYMap.get('checklists') as Y.Map<unknown> | undefined;

    const movers: Y.Map<unknown>[] = [];
    const targetAssignees = new Set<string | null>();
    if (checklistsMap) {
      for (const [, value] of checklistsMap.entries()) {
        const checklist = value as Y.Map<unknown>;
        if (checklist.get('type') !== type) continue;
        const outcomeId = checklist.get('outcomeId');
        if (outcomeId === fromOutcomeId) {
          movers.push(checklist);
        } else if (outcomeId === toOutcomeId) {
          targetAssignees.add((checklist.get('assignedTo') as string | null) ?? null);
        }
      }
    }

    if (movers.length === 0) {
      return { success: false, error: 'No checklists found for this outcome' };
    }
    if (movers.some(c => c.get('status') === CHECKLIST_STATUS.RECONCILING)) {
      return {
        success: false,
        error:
          'Reconciliation is in progress for this outcome. Finish it before changing the outcome.',
      };
    }
    if (movers.some(c => targetAssignees.has((c.get('assignedTo') as string | null) ?? null))) {
      return {
        success: false,
        error: 'A checklist for the target outcome already exists for one of the reviewers',
      };
    }

    const now = Date.now();
    ydoc.transact(() => {
      for (const mover of movers) {
        mover.set('outcomeId', toOutcomeId);
        mover.set('updatedAt', now);

        // Section A of ROBINS-I is auto-filled with the outcome name at
        // creation; keep it in sync only when it still matches the old name
        // so user-edited text is never overwritten.
        if (type === CHECKLIST_TYPES.ROBINS_I && fromOutcomeName && toOutcomeName) {
          const answersMap = mover.get('answers') as Y.Map<unknown> | undefined;
          const outcomeText = answersMap?.get('sectionA.outcome');
          if (outcomeText instanceof Y.Text && outcomeText.toString() === fromOutcomeName) {
            outcomeText.delete(0, outcomeText.length);
            outcomeText.insert(0, toOutcomeName);
          }
        }
      }

      const reconciliationsMap = studyYMap.get('reconciliations') as Y.Map<unknown> | undefined;
      if (reconciliationsMap) {
        const fromKey = getOutcomeKey(fromOutcomeId, type);
        const oldEntry = readReconciliationEntry(reconciliationsMap, fromKey, type);
        if (oldEntry) {
          writeReconciliationEntry(reconciliationsMap, getOutcomeKey(toOutcomeId, type), {
            ...oldEntry,
            outcomeId: toOutcomeId,
          });
          deleteReconciliationEntry(reconciliationsMap, fromKey);
        }
      }

      studyYMap.set('updatedAt', now);
    });

    return { success: true };
  }

  function getChecklistData(studyId: string, checklistId: string): ChecklistData | null {
    const result = commonOps.getChecklistYMap(studyId, checklistId);
    if (!result) return null;

    const { checklistYMap, checklistType } = result;
    const data = checklistYMap.toJSON ? checklistYMap.toJSON() : {};

    const handler = getHandler(checklistType);
    const answersMap = checklistYMap.get('answers') as Y.Map<unknown> | undefined;

    let answers: Record<string, unknown> = {};
    if (answersMap && typeof answersMap.entries === 'function') {
      if (handler) {
        answers = handler.serializeAnswers(answersMap);
      } else {
        for (const [key, sectionYMap] of answersMap.entries()) {
          const section = sectionYMap as { toJSON?: () => unknown };
          answers[key] = section.toJSON ? section.toJSON() : sectionYMap;
        }
      }
    }

    return { ...data, answers };
  }

  function updateChecklistAnswer(
    studyId: string,
    checklistId: string,
    input: ChecklistAnswerInput,
  ): void {
    const result = commonOps.getChecklistYMap(studyId, checklistId);
    if (!result) return;

    const { checklistYMap, checklistType } = result;
    if (checklistType !== input.type) {
      throw new Error(
        `[updateChecklistAnswer] checklist ${checklistId} is type ${checklistType} but input was ${input.type}`,
      );
    }

    const ydoc = checklistYMap.doc;
    if (!ydoc) return;

    ydoc.transact(() => {
      let answersMap = checklistYMap.get('answers') as Y.Map<unknown> | undefined;
      if (!answersMap) {
        answersMap = new Y.Map();
        checklistYMap.set('answers', answersMap);
      }

      switch (input.type) {
        case CHECKLIST_TYPES.AMSTAR2: {
          const parsed = AMSTAR2_KEY_SCHEMAS[input.key].parse(input.data);
          amstar2Handler.updateAnswer(answersMap, input.key, parsed);
          break;
        }
        case CHECKLIST_TYPES.ROBINS_I: {
          const parsed = ROBINS_I_KEY_SCHEMAS[input.key].parse(input.data);
          robinsIHandler.updateAnswer(answersMap, input.key, parsed as RobinsIAnswers[RobinsIKey]);
          break;
        }
        case CHECKLIST_TYPES.ROB2: {
          const parsed = ROB2_KEY_SCHEMAS[input.key].parse(input.data);
          rob2Handler.updateAnswer(answersMap, input.key, parsed as Rob2Answers[Rob2Key]);
          break;
        }
      }

      const currentStatus = checklistYMap.get('status');
      if (currentStatus === CHECKLIST_STATUS.PENDING) {
        checklistYMap.set('status', CHECKLIST_STATUS.IN_PROGRESS);
      }

      checklistYMap.set('updatedAt', Date.now());
    });
  }

  function getTextRef(studyId: string, checklistId: string, ref: TextRef): Y.Text | null {
    switch (ref.type) {
      case 'AMSTAR2': {
        const textGetter = amstar2Handler.getTextGetter(getYDoc);
        if (!textGetter) return null;
        return textGetter(studyId, checklistId, ref.questionKey, '', null);
      }
      case 'ROBINS_I': {
        const textGetter = robinsIHandler.getTextGetter(getYDoc);
        if (!textGetter) return null;
        return textGetter(
          studyId,
          checklistId,
          ref.sectionKey,
          ref.fieldKey,
          ref.questionKey ?? null,
        );
      }
      case 'ROB2': {
        const textGetter = rob2Handler.getTextGetter(getYDoc);
        if (!textGetter) return null;
        return textGetter(
          studyId,
          checklistId,
          ref.sectionKey,
          ref.fieldKey,
          ref.questionKey ?? null,
        );
      }
    }
  }

  function setTextValue(
    studyId: string,
    checklistId: string,
    ref: TextRef,
    text: string,
    maxLength = 2000,
  ): void {
    const yText = getTextRef(studyId, checklistId, ref);
    if (!yText) return;
    const str = (typeof text === 'string' ? text : '').slice(0, maxLength);
    if (yText.toString() === str) return;
    applyYTextDiff(yText, yText.toString(), str);
  }

  return {
    createChecklist,
    updateChecklist: commonOps.updateChecklist,
    deleteChecklist: commonOps.deleteChecklist,
    changeChecklistOutcome,
    getChecklistAnswersMap: commonOps.getChecklistAnswersMap,
    getChecklistData,
    updateChecklistAnswer,
    getTextRef,
    setTextValue,
  };
}
