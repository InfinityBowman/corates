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
      const questionYMap = new Y.Map();
      questionYMap.set('answers', qd.answers);
      questionYMap.set('critical', qd.critical ?? false);

      if (!subQuestionPattern.test(questionKey)) {
        questionYMap.set('note', new Y.Text());
      }

      answersYMap.set(questionKey, questionYMap);
      addedKeys.add(questionKey);
    });

    multiPartParents.forEach(parentKey => {
      if (!addedKeys.has(parentKey)) {
        const parentYMap = new Y.Map();
        parentYMap.set('note', new Y.Text());
        answersYMap.set(parentKey, parentYMap);
      }
    });

    return answersYMap;
  }

  serializeAnswers(answersMap: Y.Map<unknown>): Record<string, unknown> {
    const answers: Record<string, unknown> = {};
    for (const [key, sectionYMap] of answersMap.entries()) {
      const section = sectionYMap as { toJSON?: () => unknown };
      answers[key] = section.toJSON ? section.toJSON() : sectionYMap;
    }
    return answers;
  }

  updateAnswer<K extends Amstar2Key>(
    answersMap: Y.Map<unknown>,
    key: K,
    data: Amstar2Answers[K],
  ): void;
  updateAnswer(answersMap: Y.Map<unknown>, key: string, data: unknown): void;
  updateAnswer(answersMap: Y.Map<unknown>, key: string, data: unknown): void {
    const typed = data as Amstar2Answers[Amstar2Key];
    let questionYMap = answersMap.get(key) as Y.Map<unknown> | undefined;
    if (!questionYMap || !(questionYMap instanceof Y.Map)) {
      questionYMap = new Y.Map();
      answersMap.set(key, questionYMap);
    }
    questionYMap.set('answers', typed.answers);
    questionYMap.set('critical', typed.critical ?? false);
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
