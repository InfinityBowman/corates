/**
 * ROB-2 checklist type handler
 */

import * as Y from 'yjs';
import { ChecklistHandler, yTextToString, type TextGetterFn } from './base';

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

interface ROB2DomainUpdate {
  judgement?: string | null;
  direction?: string | null;
  answers?: Record<string, { answer?: string | null; comment?: string }>;
}

interface ROB2PreliminaryUpdate {
  studyDesign?: string | null;
  aim?: string | null;
  deviationsToAddress?: string[];
  sources?: Record<string, boolean>;
  experimental?: string;
  comparator?: string;
  numericalResult?: string;
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
      const sectionYMap = new Y.Map();
      const val = value as Record<string, unknown>;

      if (key.startsWith('domain')) {
        const domain = val as ROB2DomainTemplate;
        sectionYMap.set('judgement', domain.judgement ?? null);
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
      } else if (key === 'overall') {
        const overall = val as ROB2DomainTemplate;
        sectionYMap.set('judgement', overall.judgement ?? null);
        sectionYMap.set('direction', overall.direction ?? null);
      } else if (key === 'preliminary') {
        const prelim = val as ROB2PreliminaryTemplate;
        sectionYMap.set('studyDesign', prelim.studyDesign ?? null);
        sectionYMap.set('experimental', new Y.Text());
        sectionYMap.set('comparator', new Y.Text());
        sectionYMap.set('numericalResult', new Y.Text());
        sectionYMap.set('aim', prelim.aim ?? null);
        sectionYMap.set('deviationsToAddress', prelim.deviationsToAddress ?? []);
        sectionYMap.set('sources', prelim.sources ?? {});
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
        };
        const direction = sectionYMap.get('direction');
        if (direction !== undefined) {
          sectionData.direction = direction;
        }
        answers[key] = sectionData;
      } else if (key === 'preliminary') {
        answers[key] = {
          studyDesign: sectionYMap.get('studyDesign') ?? null,
          experimental: yTextToString(sectionYMap.get('experimental')),
          comparator: yTextToString(sectionYMap.get('comparator')),
          numericalResult: yTextToString(sectionYMap.get('numericalResult')),
          aim: sectionYMap.get('aim') ?? null,
          deviationsToAddress: sectionYMap.get('deviationsToAddress') ?? [],
          sources: sectionYMap.get('sources') ?? {},
        };
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

  updateAnswer(answersMap: Y.Map<unknown>, key: string, data: Record<string, unknown>): void {
    const doc = answersMap.doc!;
    doc.transact(() => {
      let sectionYMap = answersMap.get(key) as Y.Map<unknown> | undefined;

      if (!sectionYMap || !(sectionYMap instanceof Y.Map)) {
        sectionYMap = new Y.Map();
        answersMap.set(key, sectionYMap);
      }

      if (key.startsWith('domain') || key === 'overall') {
        const domainData = data as ROB2DomainUpdate;
        if (domainData.judgement !== undefined) {
          sectionYMap.set('judgement', domainData.judgement);
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
          });
        }
      } else if (key === 'preliminary') {
        const prelimData = data as ROB2PreliminaryUpdate;
        if (prelimData.studyDesign !== undefined)
          sectionYMap.set('studyDesign', prelimData.studyDesign);
        if (prelimData.aim !== undefined) sectionYMap.set('aim', prelimData.aim);
        if (prelimData.deviationsToAddress !== undefined)
          sectionYMap.set('deviationsToAddress', prelimData.deviationsToAddress);
        if (prelimData.sources !== undefined) sectionYMap.set('sources', prelimData.sources);
        // NoteEditor manages Y.Text fields (experimental, comparator, numericalResult)
      } else {
        Object.entries(data).forEach(([fieldKey, fieldValue]) => {
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
      if (checklistType !== 'ROB2') return null;

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

      // Handle section-level fields (preliminary, overall)
      const text = sectionYMap.get(fieldKey);
      if (text instanceof Y.Text) return text;

      const newText = new Y.Text();
      sectionYMap.set(fieldKey, newText);
      return newText;
    };
  }
}
