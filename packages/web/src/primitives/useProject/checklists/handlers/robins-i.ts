/**
 * ROBINS-I checklist type handler
 */

import * as Y from 'yjs';
import type { RobinsIAnswers, RobinsIKey } from '@corates/shared/checklists/robins-i';
import { ChecklistHandler, yTextToString, type TextGetterFn } from './base';

interface ROBINSDomainTemplate {
  judgement?: string | null;
  judgementSource?: string | null;
  direction?: string | null;
  answers?: Record<string, { answer: string | null }>;
}

export class ROBINSIHandler extends ChecklistHandler {
  extractAnswersFromTemplate(template: Record<string, unknown>): Record<string, unknown> {
    const answersData: Record<string, unknown> = {};
    const robinsKeys = [
      'planning',
      'sectionA',
      'sectionB',
      'sectionC',
      'sectionD',
      'confoundingEvaluation',
      'domain1a',
      'domain1b',
      'domain2',
      'domain3',
      'domain4',
      'domain5',
      'domain6',
      'overall',
    ];
    robinsKeys.forEach(key => {
      if (template[key] !== undefined) {
        answersData[key] = template[key];
      }
    });
    return answersData;
  }

  createAnswersYMap(answersData: Record<string, unknown>): Y.Map<unknown> {
    const answersYMap = new Y.Map();

    Object.entries(answersData).forEach(([key, value]) => {
      const sectionYMap = new Y.Map();
      const val = value as Record<string, unknown>;

      if (key.startsWith('domain') || key === 'overall') {
        const domain = val as ROBINSDomainTemplate;
        sectionYMap.set('judgement', domain.judgement ?? null);
        sectionYMap.set('judgementSource', domain.judgementSource ?? 'auto');
        if (domain.direction !== undefined) {
          sectionYMap.set('direction', domain.direction ?? null);
        }

        if (domain.answers) {
          const answersNestedYMap = new Y.Map();
          Object.entries(domain.answers).forEach(([qKey, qValue]) => {
            const questionYMap = new Y.Map();
            questionYMap.set('answer', qValue.answer ?? null);
            questionYMap.set('comment', new Y.Text());
            answersNestedYMap.set(qKey, questionYMap);
          });
          sectionYMap.set('answers', answersNestedYMap);
        }
      } else if (key === 'sectionB') {
        Object.entries(val).forEach(([subKey, subValue]) => {
          if (typeof subValue === 'object' && subValue !== null) {
            const questionYMap = new Y.Map();
            const q = subValue as { answer?: string | null };
            questionYMap.set('answer', q.answer ?? null);
            questionYMap.set('comment', new Y.Text());
            sectionYMap.set(subKey, questionYMap);
          } else {
            sectionYMap.set(subKey, subValue);
          }
        });
      } else if (key === 'confoundingEvaluation') {
        const ce = val as { predefined?: unknown[]; additional?: unknown[] };
        sectionYMap.set('predefined', ce.predefined ?? []);
        sectionYMap.set('additional', ce.additional ?? []);
      } else if (key === 'sectionD') {
        const sd = val as { sources?: Record<string, boolean> };
        sectionYMap.set('sources', sd.sources ?? {});
        sectionYMap.set('otherSpecify', new Y.Text());
      } else if (key === 'planning') {
        sectionYMap.set('confoundingFactors', new Y.Text());
      } else if (key === 'sectionA') {
        sectionYMap.set('numericalResult', new Y.Text());
        sectionYMap.set('furtherDetails', new Y.Text());
        sectionYMap.set('outcome', new Y.Text());
      } else if (key === 'sectionC') {
        const sc = val as { isPerProtocol?: boolean };
        sectionYMap.set('participants', new Y.Text());
        sectionYMap.set('interventionStrategy', new Y.Text());
        sectionYMap.set('comparatorStrategy', new Y.Text());
        sectionYMap.set('isPerProtocol', sc.isPerProtocol ?? false);
      } else {
        Object.entries(val).forEach(([fieldKey, fieldValue]) => {
          sectionYMap.set(fieldKey, fieldValue);
        });
      }

      answersYMap.set(key, sectionYMap);
    });

    return answersYMap;
  }

  serializeAnswers(answersMap: Y.Map<unknown>): Record<string, unknown> {
    const answers: Record<string, unknown> = {};
    for (const [key, sectionYMap] of answersMap.entries()) {
      if (!(sectionYMap instanceof Y.Map)) {
        answers[key] = sectionYMap;
        continue;
      }

      if (key.startsWith('domain')) {
        const sectionData: Record<string, unknown> = {
          judgement: sectionYMap.get('judgement') ?? null,
          judgementSource: sectionYMap.get('judgementSource') ?? 'auto',
          answers: {} as Record<string, { answer: string | null; comment: string }>,
        };
        const direction = sectionYMap.get('direction');
        if (direction !== undefined) {
          sectionData.direction = direction;
        }

        const answersNestedYMap = sectionYMap.get('answers');
        if (answersNestedYMap instanceof Y.Map) {
          const answersObj = sectionData.answers as Record<
            string,
            { answer: string | null; comment: string }
          >;
          for (const [qKey, questionYMap] of answersNestedYMap.entries()) {
            if (questionYMap instanceof Y.Map) {
              const commentValue = questionYMap.get('comment');
              answersObj[qKey] = {
                answer: (questionYMap.get('answer') as string) ?? null,
                comment: yTextToString(commentValue),
              };
            } else {
              answersObj[qKey] = questionYMap as { answer: string | null; comment: string };
            }
          }
        }
        answers[key] = sectionData;
      } else if (key === 'overall') {
        const sectionData: Record<string, unknown> = {
          judgement: sectionYMap.get('judgement') ?? null,
          judgementSource: sectionYMap.get('judgementSource') ?? 'auto',
        };
        const direction = sectionYMap.get('direction');
        if (direction !== undefined) {
          sectionData.direction = direction;
        }
        answers[key] = sectionData;
      } else if (key === 'sectionB') {
        const sectionData: Record<string, unknown> = {};
        for (const [subKey, subValue] of sectionYMap.entries()) {
          if (subValue instanceof Y.Map) {
            const commentValue = subValue.get('comment');
            sectionData[subKey] = {
              answer: subValue.get('answer') ?? null,
              comment: yTextToString(commentValue),
            };
          } else {
            sectionData[subKey] = subValue;
          }
        }
        answers[key] = sectionData;
      } else {
        const sectionData: Record<string, unknown> = {};
        for (const [fieldKey, fieldValue] of sectionYMap.entries()) {
          if (fieldValue instanceof Y.Text) {
            sectionData[fieldKey] = fieldValue.toString();
          } else {
            sectionData[fieldKey] = fieldValue;
          }
        }
        answers[key] = sectionData;
      }
    }
    return answers;
  }

  updateAnswer<K extends RobinsIKey>(
    answersMap: Y.Map<unknown>,
    key: K,
    data: RobinsIAnswers[K],
  ): void {
    const doc = answersMap.doc!;
    doc.transact(() => {
      let sectionYMap = answersMap.get(key) as Y.Map<unknown> | undefined;

      if (!sectionYMap || !(sectionYMap instanceof Y.Map)) {
        sectionYMap = new Y.Map();
        answersMap.set(key, sectionYMap);
      }

      if (key.startsWith('domain') || key === 'overall') {
        const domainData = data as RobinsIAnswers['domain1a'];
        if (domainData.judgement !== undefined) {
          sectionYMap.set('judgement', domainData.judgement);
        }
        if (domainData.judgementSource !== undefined) {
          sectionYMap.set('judgementSource', domainData.judgementSource);
        }
        if (domainData.direction !== undefined) {
          sectionYMap.set('direction', domainData.direction);
        }

        if (domainData.answers) {
          let answersNestedYMap = sectionYMap.get('answers') as Y.Map<unknown> | undefined;
          if (!answersNestedYMap || !(answersNestedYMap instanceof Y.Map)) {
            answersNestedYMap = new Y.Map();
            sectionYMap.set('answers', answersNestedYMap);
          }

          Object.entries(domainData.answers).forEach(([qKey, qValue]) => {
            let questionYMap = answersNestedYMap!.get(qKey) as Y.Map<unknown> | undefined;
            if (!questionYMap || !(questionYMap instanceof Y.Map)) {
              questionYMap = new Y.Map();
              answersNestedYMap!.set(qKey, questionYMap);
            }
            if (qValue.answer !== undefined) questionYMap.set('answer', qValue.answer);
            if (qValue.comment !== undefined)
              this.setYTextField(questionYMap, 'comment', qValue.comment);
          });
        }
      } else if (key === 'sectionB') {
        const sb = data as RobinsIAnswers['sectionB'];
        Object.entries(sb).forEach(([subKey, subValue]) => {
          if (typeof subValue === 'object' && subValue !== null) {
            let questionYMap = sectionYMap!.get(subKey) as Y.Map<unknown> | undefined;
            if (!questionYMap || !(questionYMap instanceof Y.Map)) {
              questionYMap = new Y.Map();
              sectionYMap!.set(subKey, questionYMap);
            }
            if (subValue.answer !== undefined) questionYMap.set('answer', subValue.answer);
            if (subValue.comment !== undefined)
              this.setYTextField(questionYMap, 'comment', subValue.comment);
          } else {
            sectionYMap!.set(subKey, subValue);
          }
        });
      } else if (key === 'confoundingEvaluation') {
        const ce = data as RobinsIAnswers['confoundingEvaluation'];
        if (ce.predefined !== undefined) sectionYMap.set('predefined', ce.predefined);
        if (ce.additional !== undefined) sectionYMap.set('additional', ce.additional);
      } else if (key === 'sectionD') {
        const sd = data as RobinsIAnswers['sectionD'];
        if (sd.sources !== undefined) sectionYMap.set('sources', sd.sources);
        if (sd.otherSpecify !== undefined) sectionYMap.set('otherSpecify', sd.otherSpecify);
      } else {
        Object.entries(data as Record<string, unknown>).forEach(([fieldKey, fieldValue]) => {
          sectionYMap!.set(fieldKey, fieldValue);
        });
      }
    });
  }

  getTextGetter(getYDoc: () => Y.Doc | null): TextGetterFn {
    return (
      studyId: string,
      checklistId: string,
      sectionKey: string,
      fieldKey: string,
      questionKey: string | null = null,
    ): Y.Text | null => {
      const ydoc = getYDoc();
      if (!ydoc) return null;

      const studiesMap = ydoc.getMap('reviews');
      const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
      if (!studyYMap) return null;

      const checklistsMap = studyYMap.get('checklists') as Y.Map<unknown> | undefined;
      if (!checklistsMap) return null;

      const checklistYMap = checklistsMap.get(checklistId) as Y.Map<unknown> | undefined;
      if (!checklistYMap) return null;

      const checklistType = checklistYMap.get('type');
      if (checklistType !== 'ROBINS_I') return null;

      const answersMap = checklistYMap.get('answers') as Y.Map<unknown> | undefined;
      if (!answersMap) return null;

      const sectionYMap = answersMap.get(sectionKey);
      if (!sectionYMap || !(sectionYMap instanceof Y.Map)) return null;

      // Handle domain questions
      if (sectionKey.startsWith('domain') && questionKey) {
        const answersNestedYMap = sectionYMap.get('answers');
        if (!answersNestedYMap || !(answersNestedYMap instanceof Y.Map)) return null;

        const questionYMap = answersNestedYMap.get(questionKey);
        if (!questionYMap || !(questionYMap instanceof Y.Map)) return null;

        const text = questionYMap.get(fieldKey);
        if (text instanceof Y.Text) return text;

        const newText = new Y.Text();
        questionYMap.set(fieldKey, newText);
        return newText;
      }

      // Handle sectionB questions
      if (sectionKey === 'sectionB' && questionKey) {
        const questionYMap = sectionYMap.get(questionKey);
        if (!questionYMap || !(questionYMap instanceof Y.Map)) return null;

        const text = questionYMap.get(fieldKey);
        if (text instanceof Y.Text) return text;

        const newText = new Y.Text();
        questionYMap.set(fieldKey, newText);
        return newText;
      }

      // Handle section-level fields
      const text = sectionYMap.get(fieldKey);
      if (text instanceof Y.Text) return text;

      const newText = new Y.Text();
      sectionYMap.set(fieldKey, newText);
      return newText;
    };
  }
}
