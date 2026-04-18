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
import { CHECKLIST_STATUS } from '@/constants/checklist-status';
import { createCommonOperations } from './common';
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

export interface ChecklistOperations {
  createChecklist: (
    studyId: string,
    type?: string,
    assignedTo?: string | null,
    outcomeId?: string | null,
  ) => string | null;
  updateChecklist: (studyId: string, checklistId: string, updates: Record<string, unknown>) => void;
  deleteChecklist: (studyId: string, checklistId: string) => void;
  getChecklistAnswersMap: (studyId: string, checklistId: string) => Y.Map<unknown> | null;
  getChecklistData: (studyId: string, checklistId: string) => Record<string, unknown> | null;
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

export function createChecklistOperations(
  _projectId: string,
  getYDoc: () => Y.Doc | null,
  _isSynced: () => boolean,
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

      // For ROBINS-I, auto-fill sectionA.outcome with the outcome name
      if (type === CHECKLIST_TYPES.ROBINS_I && outcomeId) {
        const metaMap = ydoc.getMap('meta');
        const outcomesMap = metaMap.get('outcomes') as Y.Map<unknown> | undefined;
        if (outcomesMap) {
          const outcomeYMap = outcomesMap.get(outcomeId) as Y.Map<unknown> | undefined;
          if (outcomeYMap) {
            const outcomeName = outcomeYMap.get('name') as string | undefined;
            if (outcomeName) {
              const sectionAYMap = answersYMap.get('sectionA') as Y.Map<unknown> | undefined;
              if (sectionAYMap) {
                const outcomeYText = sectionAYMap.get('outcome');
                if (outcomeYText instanceof Y.Text) {
                  outcomeYText.insert(0, outcomeName);
                }
              }
            }
          }
        }
      }

      checklistsMap.set(checklistId, checklistYMap);
      studyYMap.set('updatedAt', now);
      return checklistId;
    } catch (err) {
      console.error('[createChecklist] Error creating checklist:', err);
      return null;
    }
  }

  function getChecklistData(studyId: string, checklistId: string): Record<string, unknown> | null {
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

    let answersMap = checklistYMap.get('answers') as Y.Map<unknown> | undefined;
    if (!answersMap) {
      answersMap = new Y.Map();
      checklistYMap.set('answers', answersMap);
    }

    // The discriminated input pins (key, data) to the checklist type at the
    // type level, but we still parse with Zod to catch external callers that
    // bypass the type system with `as` casts.
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
    getChecklistAnswersMap: commonOps.getChecklistAnswersMap,
    getChecklistData,
    updateChecklistAnswer,
    getTextRef,
    setTextValue,
  };
}
