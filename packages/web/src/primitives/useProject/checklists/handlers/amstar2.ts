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
    let questionYMap = answersMap.get(key) as Y.Map<unknown> | undefined;
    if (!questionYMap || !(questionYMap instanceof Y.Map)) {
      questionYMap = new Y.Map();
      answersMap.set(key, questionYMap);
    }
    questionYMap.set('answers', data.answers);
    questionYMap.set('critical', data.critical ?? false);
    if (!questionYMap.get('note')) {
      questionYMap.set('note', new Y.Text());
    }
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

      const questionYMap = answersMap.get(questionKey);
      if (!questionYMap || !(questionYMap instanceof Y.Map)) return null;

      const note = questionYMap.get('note');
      if (note instanceof Y.Text) return note;

      const newNote = new Y.Text();
      questionYMap.set('note', newNote);
      return newNote;
    };
  }
}
