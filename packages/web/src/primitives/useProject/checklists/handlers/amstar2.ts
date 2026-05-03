/**
 * AMSTAR2 checklist type handler
 */

import * as Y from 'yjs';
import type { Amstar2Answers, Amstar2Key } from '@corates/shared/checklists/amstar2';
import { ChecklistHandler, type TextGetterFn } from './base';

export class AMSTAR2Handler extends ChecklistHandler {
  extractAnswersFromTemplate(template: Record<string, unknown>): Record<string, unknown> {
    const answersData: Record<string, unknown> = {};
    Object.entries(template).forEach(([key, value]) => {
      if (/^q\d+[a-z]*$/i.test(key)) {
        answersData[key] = value;
      }
    });
    return answersData;
  }

  createAnswersYMap(answersData: Record<string, unknown>): Y.Map<unknown> {
    const answersYMap = new Y.Map();
    const multiPartParents = ['q9', 'q11'];
    const subQuestionPattern = /^(q9|q11)[a-z]$/;
    const addedKeys = new Set<string>();

    Object.entries(answersData).forEach(([questionKey, questionData]) => {
      const qd = questionData as Amstar2Answers[Amstar2Key];
      answersYMap.set(`${questionKey}.answers`, qd.answers);
      answersYMap.set(`${questionKey}.critical`, qd.critical ?? false);
      if (!subQuestionPattern.test(questionKey)) {
        answersYMap.set(`${questionKey}.note`, new Y.Text());
      }
      addedKeys.add(questionKey);
    });

    multiPartParents.forEach(parentKey => {
      if (!addedKeys.has(parentKey)) {
        answersYMap.set(`${parentKey}.note`, new Y.Text());
      }
    });

    return answersYMap;
  }

  updateAnswer<K extends Amstar2Key>(
    answersMap: Y.Map<unknown>,
    key: K,
    data: Amstar2Answers[K],
  ): void {
    answersMap.set(`${key}.answers`, data.answers);
    answersMap.set(`${key}.critical`, data.critical ?? false);
  }

  serializeAnswers(answersMap: Y.Map<unknown>): Record<string, unknown> {
    const grouped: Record<string, Record<string, unknown>> = {};
    for (const [key, value] of answersMap.entries()) {
      const dotIdx = key.indexOf('.');
      if (dotIdx === -1) continue;
      const prefix = key.substring(0, dotIdx);
      const field = key.substring(dotIdx + 1);
      if (!grouped[prefix]) grouped[prefix] = {};
      grouped[prefix][field] = value instanceof Y.Text ? value.toString() : value;
    }
    return grouped;
  }

  getTextGetter(getYDoc: () => Y.Doc | null): TextGetterFn {
    return (studyId: string, checklistId: string, questionKey: string): Y.Text | null => {
      const ydoc = getYDoc();
      if (!ydoc) return null;

      const studiesMap = ydoc.getMap('reviews');
      const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
      if (!studyYMap) return null;

      const checklistsMap = studyYMap.get('checklists') as Y.Map<unknown> | undefined;
      if (!checklistsMap) return null;

      const checklistYMap = checklistsMap.get(checklistId) as Y.Map<unknown> | undefined;
      if (!checklistYMap) return null;

      const answersMap = checklistYMap.get('answers') as Y.Map<unknown> | undefined;
      if (!answersMap) return null;

      const flatKey = `${questionKey}.note`;
      const note = answersMap.get(flatKey);
      if (note instanceof Y.Text) return note;

      const newNote = new Y.Text();
      answersMap.set(flatKey, newNote);
      return newNote;
    };
  }
}
