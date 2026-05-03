/**
 * ROB-2 checklist type handler
 */

import * as Y from 'yjs';
import type { Rob2Answers, Rob2Key } from '@corates/shared/checklists/rob2';
import { ChecklistHandler, type TextGetterFn } from './base';

interface ROB2DomainTemplate {
  judgement?: string | null;
  direction?: string | null;
  answers?: Record<string, { answer: string | null }>;
}

interface ROB2PreliminaryTemplate {
  studyDesign?: string | null;
  aim?: string | null;
  deviationsToAddress?: string[];
  sources?: Record<string, boolean>;
}

function questionKeyToDomain(qKey: string): string | null {
  const match = qKey.match(/^d(\d+[a-z]?)_/);
  if (!match) return null;
  return `domain${match[1]}`;
}

export class ROB2Handler extends ChecklistHandler {
  extractAnswersFromTemplate(template: Record<string, unknown>): Record<string, unknown> {
    const answersData: Record<string, unknown> = {};
    const rob2Keys = [
      'preliminary',
      'domain1',
      'domain2a',
      'domain2b',
      'domain3',
      'domain4',
      'domain5',
      'overall',
    ];
    rob2Keys.forEach(key => {
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

      if (key === 'preliminary') {
        const prelim = val as ROB2PreliminaryTemplate;
        answersYMap.set('preliminary.aim', prelim.aim ?? null);
        answersYMap.set('preliminary.studyDesign', prelim.studyDesign ?? null);
        answersYMap.set('preliminary.deviationsToAddress', prelim.deviationsToAddress ?? []);
        answersYMap.set('preliminary.sources', prelim.sources ?? {});
        answersYMap.set('preliminary.experimental', new Y.Text());
        answersYMap.set('preliminary.comparator', new Y.Text());
        answersYMap.set('preliminary.numericalResult', new Y.Text());
      } else if (key.startsWith('domain')) {
        const domain = val as ROB2DomainTemplate;
        if (domain.direction !== undefined) {
          answersYMap.set(`${key}.direction`, domain.direction ?? null);
        }
        if (domain.answers) {
          Object.entries(domain.answers).forEach(([qKey, qValue]) => {
            answersYMap.set(qKey, qValue.answer ?? null);
            answersYMap.set(`${qKey}.comment`, new Y.Text());
          });
        }
      } else if (key === 'overall') {
        const overall = val as ROB2DomainTemplate;
        answersYMap.set('overall.direction', overall.direction ?? null);
      }
    });

    return answersYMap;
  }

  serializeAnswers(answersMap: Y.Map<unknown>): Record<string, unknown> {
    const result: Record<string, Record<string, unknown>> = {};

    for (const [key, value] of answersMap.entries()) {
      if (value instanceof Y.Map) {
        result[key] = this.serializeKey(key, value);
        continue;
      }

      const dotIdx = key.indexOf('.');
      if (dotIdx === -1) {
        const domain = questionKeyToDomain(key);
        if (domain) {
          if (!result[domain]) result[domain] = {};
          if (!result[domain].answers) result[domain].answers = {};
          const answers = result[domain].answers as Record<string, Record<string, unknown>>;
          if (!answers[key]) answers[key] = {};
          answers[key].answer = value;
        }
        continue;
      }

      const prefix = key.substring(0, dotIdx);
      const field = key.substring(dotIdx + 1);

      const domain = questionKeyToDomain(prefix);
      if (domain) {
        if (!result[domain]) result[domain] = {};
        if (!result[domain].answers) result[domain].answers = {};
        const answers = result[domain].answers as Record<string, Record<string, unknown>>;
        if (!answers[prefix]) answers[prefix] = {};
        answers[prefix][field] = value instanceof Y.Text ? value.toString() : value;
        continue;
      }

      if (!result[prefix]) result[prefix] = {};
      result[prefix][field] = value instanceof Y.Text ? value.toString() : value;
    }

    return result;
  }

  updateAnswer<K extends Rob2Key>(answersMap: Y.Map<unknown>, key: K, data: Rob2Answers[K]): void {
    const doc = answersMap.doc!;
    doc.transact(() => {
      if (key.startsWith('domain') || key === 'overall') {
        const domainData = data as Rob2Answers['domain1'];
        if (domainData.direction !== undefined) {
          answersMap.set(`${key}.direction`, domainData.direction);
        }
        if (domainData.answers) {
          Object.entries(domainData.answers).forEach(([qKey, qValue]) => {
            if (qValue.answer !== undefined) answersMap.set(qKey, qValue.answer);
          });
        }
      } else if (key === 'preliminary') {
        const prelimData = data as Rob2Answers['preliminary'];
        if (prelimData.studyDesign !== undefined)
          answersMap.set('preliminary.studyDesign', prelimData.studyDesign);
        if (prelimData.aim !== undefined) answersMap.set('preliminary.aim', prelimData.aim);
        if (prelimData.deviationsToAddress !== undefined)
          answersMap.set('preliminary.deviationsToAddress', prelimData.deviationsToAddress);
        if (prelimData.sources !== undefined)
          answersMap.set('preliminary.sources', prelimData.sources);
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
      if (checklistType !== 'ROB2') return null;

      const answersMap = checklistYMap.get('answers') as Y.Map<unknown> | undefined;
      if (!answersMap) return null;

      // Flat key lookup
      const flatKey = questionKey ? `${questionKey}.${fieldKey}` : `${sectionKey}.${fieldKey}`;
      const text = answersMap.get(flatKey);
      if (text instanceof Y.Text) return text;

      const newText = new Y.Text();
      answersMap.set(flatKey, newText);
      return newText;
    };
  }
}
