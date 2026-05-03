/**
 * ROBINS-I checklist type handler
 */

import * as Y from 'yjs';
import type { RobinsIAnswers, RobinsIKey } from '@corates/shared/checklists/robins-i';
import { ChecklistHandler, type TextGetterFn } from './base';

interface ROBINSDomainTemplate {
  judgement?: string | null;
  judgementSource?: string | null;
  direction?: string | null;
  answers?: Record<string, { answer: string | null }>;
}

function questionKeyToDomain(qKey: string): string | null {
  const match = qKey.match(/^d(\d+[a-z]?)_/);
  if (!match) return null;
  return `domain${match[1]}`;
}

function isSectionBKey(key: string): boolean {
  return /^b\d+$/.test(key);
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
      const val = value as Record<string, unknown>;

      if (key === 'planning') {
        answersYMap.set('planning.confoundingFactors', new Y.Text());
      } else if (key === 'sectionA') {
        answersYMap.set('sectionA.numericalResult', new Y.Text());
        answersYMap.set('sectionA.furtherDetails', new Y.Text());
        answersYMap.set('sectionA.outcome', new Y.Text());
      } else if (key === 'sectionB') {
        Object.entries(val).forEach(([subKey, subValue]) => {
          if (typeof subValue === 'object' && subValue !== null) {
            const q = subValue as { answer?: string | null };
            answersYMap.set(`sectionB.${subKey}`, q.answer ?? null);
            answersYMap.set(`sectionB.${subKey}.comment`, new Y.Text());
          } else {
            answersYMap.set(`sectionB.${subKey}`, subValue);
          }
        });
      } else if (key === 'sectionC') {
        const sc = val as { isPerProtocol?: boolean };
        answersYMap.set('sectionC.isPerProtocol', sc.isPerProtocol ?? false);
        answersYMap.set('sectionC.participants', new Y.Text());
        answersYMap.set('sectionC.interventionStrategy', new Y.Text());
        answersYMap.set('sectionC.comparatorStrategy', new Y.Text());
      } else if (key === 'sectionD') {
        const sd = val as { sources?: Record<string, boolean> };
        answersYMap.set('sectionD.sources', sd.sources ?? {});
        answersYMap.set('sectionD.otherSpecify', new Y.Text());
      } else if (key === 'confoundingEvaluation') {
        const ce = val as { predefined?: unknown[]; additional?: unknown[] };
        answersYMap.set('confoundingEvaluation.predefined', ce.predefined ?? []);
        answersYMap.set('confoundingEvaluation.additional', ce.additional ?? []);
      } else if (key.startsWith('domain') || key === 'overall') {
        const domain = val as ROBINSDomainTemplate;
        if (domain.direction !== undefined) {
          answersYMap.set(`${key}.direction`, domain.direction ?? null);
        }
        answersYMap.set(`${key}.judgement`, domain.judgement ?? null);
        answersYMap.set(`${key}.judgementSource`, domain.judgementSource ?? 'auto');
        if (domain.answers) {
          Object.entries(domain.answers).forEach(([qKey, qValue]) => {
            answersYMap.set(qKey, qValue.answer ?? null);
            answersYMap.set(`${qKey}.comment`, new Y.Text());
          });
        }
      }
    });

    return answersYMap;
  }

  serializeAnswers(answersMap: Y.Map<unknown>): Record<string, unknown> {
    const result: Record<string, Record<string, unknown>> = {};

    for (const [key, value] of answersMap.entries()) {
      const dotIdx = key.indexOf('.');
      if (dotIdx === -1) {
        // Bare question key like "d1a_1" → domain1a.answers.d1a_1
        const domain = questionKeyToDomain(key);
        if (domain) {
          if (!result[domain]) result[domain] = {};
          if (!result[domain].answers) result[domain].answers = {};
          const answers = result[domain].answers as Record<string, Record<string, unknown>>;
          if (!answers[key]) answers[key] = {};
          answers[key].answer = value;
          continue;
        }
        // Bare sectionB key like "b1" → handled via sectionB.b1 flat keys instead
        continue;
      }

      const prefix = key.substring(0, dotIdx);
      const field = key.substring(dotIdx + 1);

      // Question comment keys like "d1a_1.comment" → domain1a.answers.d1a_1.comment
      const domain = questionKeyToDomain(prefix);
      if (domain) {
        if (!result[domain]) result[domain] = {};
        if (!result[domain].answers) result[domain].answers = {};
        const answers = result[domain].answers as Record<string, Record<string, unknown>>;
        if (!answers[prefix]) answers[prefix] = {};
        answers[prefix][field] = value instanceof Y.Text ? value.toString() : value;
        continue;
      }

      // sectionB sub-keys: "sectionB.b1" → sectionB.b1.answer, "sectionB.b1.comment"
      if (prefix === 'sectionB') {
        if (!result.sectionB) result.sectionB = {};
        const secondDot = field.indexOf('.');
        if (secondDot === -1) {
          if (isSectionBKey(field)) {
            // "sectionB.b1" stores the answer value
            if (!result.sectionB[field]) result.sectionB[field] = {};
            (result.sectionB[field] as Record<string, unknown>).answer = value;
          } else {
            result.sectionB[field] = value;
          }
        } else {
          const subKey = field.substring(0, secondDot);
          const subField = field.substring(secondDot + 1);
          if (!result.sectionB[subKey]) result.sectionB[subKey] = {};
          (result.sectionB[subKey] as Record<string, unknown>)[subField] =
            value instanceof Y.Text ? value.toString() : value;
        }
        continue;
      }

      // Everything else: "planning.confoundingFactors", "sectionA.outcome", "domain1a.judgement", etc.
      if (!result[prefix]) result[prefix] = {};
      result[prefix][field] = value instanceof Y.Text ? value.toString() : value;
    }

    return result;
  }

  updateAnswer<K extends RobinsIKey>(
    answersMap: Y.Map<unknown>,
    key: K,
    data: RobinsIAnswers[K],
  ): void {
    const doc = answersMap.doc!;
    doc.transact(() => {
      if (key.startsWith('domain') || key === 'overall') {
        const domainData = data as RobinsIAnswers['domain1a'];
        if (domainData.judgement !== undefined) {
          answersMap.set(`${key}.judgement`, domainData.judgement);
        }
        if (domainData.judgementSource !== undefined) {
          answersMap.set(`${key}.judgementSource`, domainData.judgementSource);
        }
        if (domainData.direction !== undefined) {
          answersMap.set(`${key}.direction`, domainData.direction);
        }
        if (domainData.answers) {
          Object.entries(domainData.answers).forEach(([qKey, qValue]) => {
            if (qValue.answer !== undefined) answersMap.set(qKey, qValue.answer);
          });
        }
      } else if (key === 'sectionB') {
        const sb = data as RobinsIAnswers['sectionB'];
        Object.entries(sb).forEach(([subKey, subValue]) => {
          if (typeof subValue === 'object' && subValue !== null) {
            if (subValue.answer !== undefined)
              answersMap.set(`sectionB.${subKey}`, subValue.answer);
          } else {
            answersMap.set(`sectionB.${subKey}`, subValue);
          }
        });
      } else if (key === 'confoundingEvaluation') {
        const ce = data as RobinsIAnswers['confoundingEvaluation'];
        if (ce.predefined !== undefined)
          answersMap.set('confoundingEvaluation.predefined', ce.predefined);
        if (ce.additional !== undefined)
          answersMap.set('confoundingEvaluation.additional', ce.additional);
      } else if (key === 'sectionD') {
        const sd = data as RobinsIAnswers['sectionD'];
        if (sd.sources !== undefined) answersMap.set('sectionD.sources', sd.sources);
        if (sd.otherSpecify !== undefined) {
          let ytext = answersMap.get('sectionD.otherSpecify');
          if (!(ytext instanceof Y.Text)) {
            ytext = new Y.Text();
            answersMap.set('sectionD.otherSpecify', ytext);
          }
          (ytext as Y.Text).delete(0, (ytext as Y.Text).length);
          if (sd.otherSpecify) (ytext as Y.Text).insert(0, sd.otherSpecify as string);
        }
      } else if (key === 'sectionC') {
        const sc = data as RobinsIAnswers['sectionC'];
        if (sc.isPerProtocol !== undefined)
          answersMap.set('sectionC.isPerProtocol', sc.isPerProtocol);
      } else if (key === 'planning') {
        // Planning text fields are handled via getTextGetter, nothing to set here
      } else if (key === 'sectionA') {
        // SectionA text fields are handled via getTextGetter, nothing to set here
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

      const flatKey = questionKey ? `${questionKey}.${fieldKey}` : `${sectionKey}.${fieldKey}`;
      const text = answersMap.get(flatKey);
      if (text instanceof Y.Text) return text;

      const newText = new Y.Text();
      answersMap.set(flatKey, newText);
      return newText;
    };
  }
}
