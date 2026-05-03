/**
 * Migrates old nested Y.Map checklist answers to flat dot-notation keys.
 * Modifies the answers Y.Map in-place so existing reactor observers stay valid.
 *
 * TODO(agent): Remove this migration module once all production Y.Docs have
 * been opened at least once on the flat-key format (shipped 2026-05-02).
 * Drop: this file, its test, the three call sites in ConnectionPool.ts, and
 * the import. See https://github.com/InfinityBowman/corates/issues/514
 */

import * as Y from 'yjs';

function isNestedFormat(answersMap: Y.Map<unknown>): boolean {
  for (const val of answersMap.values()) {
    if (val instanceof Y.Map) return true;
  }
  return false;
}

function cloneYText(src: Y.Text): Y.Text {
  const dest = new Y.Text();
  const content = src.toString();
  if (content) dest.insert(0, content);
  return dest;
}

function getYText(ymap: Y.Map<unknown>, key: string): Y.Text {
  const val = ymap.get(key);
  if (val instanceof Y.Text) return cloneYText(val);
  return new Y.Text();
}

function flattenAMSTAR2(answersMap: Y.Map<unknown>): void {
  const entries = [...answersMap.entries()];
  for (const [key, val] of entries) {
    if (!(val instanceof Y.Map)) continue;
    const qMap = val as Y.Map<unknown>;

    const answers = qMap.get('answers');
    if (answers !== undefined) answersMap.set(`${key}.answers`, answers);

    const critical = qMap.get('critical');
    answersMap.set(`${key}.critical`, critical ?? false);

    const note = qMap.get('note');
    if (note instanceof Y.Text) {
      answersMap.set(`${key}.note`, cloneYText(note));
    } else {
      answersMap.set(`${key}.note`, new Y.Text());
    }

    answersMap.delete(key);
  }
}

function flattenROB2(answersMap: Y.Map<unknown>): void {
  const entries = [...answersMap.entries()];
  for (const [key, val] of entries) {
    if (!(val instanceof Y.Map)) continue;
    const section = val as Y.Map<unknown>;

    if (key === 'preliminary') {
      for (const field of ['aim', 'studyDesign', 'deviationsToAddress', 'sources']) {
        const v = section.get(field);
        if (v !== undefined) answersMap.set(`preliminary.${field}`, v);
      }
      for (const field of ['experimental', 'comparator', 'numericalResult']) {
        answersMap.set(`preliminary.${field}`, getYText(section, field));
      }
    } else if (key.startsWith('domain')) {
      const direction = section.get('direction');
      if (direction !== undefined) answersMap.set(`${key}.direction`, direction);

      const answersNested = section.get('answers');
      if (answersNested instanceof Y.Map) {
        for (const [qKey, qVal] of answersNested.entries()) {
          if (qVal instanceof Y.Map) {
            answersMap.set(qKey, qVal.get('answer') ?? null);
            answersMap.set(`${qKey}.comment`, getYText(qVal, 'comment'));
          }
        }
      }
    } else if (key === 'overall') {
      const direction = section.get('direction');
      if (direction !== undefined) answersMap.set('overall.direction', direction);
    }

    answersMap.delete(key);
  }
}

function flattenROBINSI(answersMap: Y.Map<unknown>): void {
  const entries = [...answersMap.entries()];
  for (const [key, val] of entries) {
    if (!(val instanceof Y.Map)) continue;
    const section = val as Y.Map<unknown>;

    if (key === 'planning') {
      answersMap.set('planning.confoundingFactors', getYText(section, 'confoundingFactors'));
    } else if (key === 'sectionA') {
      for (const field of ['numericalResult', 'furtherDetails', 'outcome']) {
        answersMap.set(`sectionA.${field}`, getYText(section, field));
      }
    } else if (key === 'sectionB') {
      for (const [subKey, subVal] of section.entries()) {
        if (subVal instanceof Y.Map) {
          answersMap.set(`sectionB.${subKey}`, subVal.get('answer') ?? null);
          answersMap.set(`sectionB.${subKey}.comment`, getYText(subVal, 'comment'));
        } else {
          answersMap.set(`sectionB.${subKey}`, subVal);
        }
      }
    } else if (key === 'sectionC') {
      answersMap.set('sectionC.isPerProtocol', section.get('isPerProtocol') ?? false);
      for (const field of ['participants', 'interventionStrategy', 'comparatorStrategy']) {
        answersMap.set(`sectionC.${field}`, getYText(section, field));
      }
    } else if (key === 'sectionD') {
      const sources = section.get('sources');
      if (sources !== undefined) answersMap.set('sectionD.sources', sources);
      answersMap.set('sectionD.otherSpecify', getYText(section, 'otherSpecify'));
    } else if (key === 'confoundingEvaluation') {
      const predefined = section.get('predefined');
      if (predefined !== undefined) answersMap.set('confoundingEvaluation.predefined', predefined);
      const additional = section.get('additional');
      if (additional !== undefined) answersMap.set('confoundingEvaluation.additional', additional);
    } else if (key.startsWith('domain') || key === 'overall') {
      const direction = section.get('direction');
      if (direction !== undefined) answersMap.set(`${key}.direction`, direction);
      const judgement = section.get('judgement');
      if (judgement !== undefined) answersMap.set(`${key}.judgement`, judgement);
      const judgementSource = section.get('judgementSource');
      if (judgementSource !== undefined) answersMap.set(`${key}.judgementSource`, judgementSource);

      if (key !== 'overall') {
        const answersNested = section.get('answers');
        if (answersNested instanceof Y.Map) {
          for (const [qKey, qVal] of answersNested.entries()) {
            if (qVal instanceof Y.Map) {
              answersMap.set(qKey, qVal.get('answer') ?? null);
              answersMap.set(`${qKey}.comment`, getYText(qVal, 'comment'));
            }
          }
        }
      }
    }

    answersMap.delete(key);
  }
}

function migrateChecklist(checklistYMap: Y.Map<unknown>): void {
  const answersMap = checklistYMap.get('answers') as Y.Map<unknown> | undefined;
  if (!answersMap || !isNestedFormat(answersMap)) return;

  const type = (checklistYMap.get('type') as string) || 'AMSTAR2';

  if (type === 'AMSTAR2') {
    flattenAMSTAR2(answersMap);
  } else if (type === 'ROB2') {
    flattenROB2(answersMap);
  } else if (type === 'ROBINS_I') {
    flattenROBINSI(answersMap);
  }
}

export function migrateYDocToFlatKeys(ydoc: Y.Doc): void {
  const reviewsMap = ydoc.getMap('reviews');
  if (reviewsMap.size === 0) return;

  let needsMigration = false;
  for (const [, studyYMap] of reviewsMap.entries()) {
    const study = studyYMap as Y.Map<unknown>;
    const checklists = study.get('checklists') as Y.Map<unknown> | undefined;
    if (!checklists) continue;
    for (const [, clYMap] of checklists.entries()) {
      const cl = clYMap as Y.Map<unknown>;
      const answers = cl.get('answers') as Y.Map<unknown> | undefined;
      if (answers && isNestedFormat(answers)) {
        needsMigration = true;
        break;
      }
    }
    if (needsMigration) break;
  }

  if (!needsMigration) return;

  ydoc.transact(() => {
    for (const [, studyYMap] of reviewsMap.entries()) {
      const study = studyYMap as Y.Map<unknown>;
      const checklists = study.get('checklists') as Y.Map<unknown> | undefined;
      if (!checklists) continue;
      for (const [, clYMap] of checklists.entries()) {
        migrateChecklist(clYMap as Y.Map<unknown>);
      }
    }
  });
}
