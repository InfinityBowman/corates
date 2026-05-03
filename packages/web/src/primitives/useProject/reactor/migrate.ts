import * as Y from 'yjs';

function isNestedFormat(answersMap: Y.Map<unknown>): boolean {
  for (const val of answersMap.values()) {
    if (val instanceof Y.Map) return true;
  }
  return false;
}

function getYTextContent(ymap: Y.Map<unknown>, key: string): string {
  const val = ymap.get(key);
  if (val instanceof Y.Text) return val.toString();
  return '';
}

type TextEntry = { key: string; content: string };

function flattenAMSTAR2(
  answersMap: Y.Map<unknown>,
  flat: Y.Map<unknown>,
  texts: TextEntry[],
): void {
  for (const [key, val] of answersMap.entries()) {
    if (!(val instanceof Y.Map)) continue;
    const qMap = val as Y.Map<unknown>;

    const answers = qMap.get('answers');
    if (answers !== undefined) flat.set(`${key}.answers`, answers);

    const critical = qMap.get('critical');
    if (critical !== undefined) flat.set(`${key}.critical`, critical);

    flat.set(`${key}.note`, new Y.Text());
    texts.push({ key: `${key}.note`, content: getYTextContent(qMap, 'note') });
  }
}

function flattenROB2(
  answersMap: Y.Map<unknown>,
  flat: Y.Map<unknown>,
  texts: TextEntry[],
): void {
  for (const [key, val] of answersMap.entries()) {
    if (!(val instanceof Y.Map)) {
      flat.set(key, val);
      continue;
    }
    const section = val as Y.Map<unknown>;

    if (key === 'preliminary') {
      for (const field of ['aim', 'studyDesign', 'deviationsToAddress', 'sources']) {
        const v = section.get(field);
        if (v !== undefined) flat.set(`preliminary.${field}`, v);
      }
      for (const field of ['experimental', 'comparator', 'numericalResult']) {
        flat.set(`preliminary.${field}`, new Y.Text());
        texts.push({ key: `preliminary.${field}`, content: getYTextContent(section, field) });
      }
    } else if (key.startsWith('domain')) {
      const direction = section.get('direction');
      if (direction !== undefined) flat.set(`${key}.direction`, direction);

      const answersNested = section.get('answers');
      if (answersNested instanceof Y.Map) {
        for (const [qKey, qVal] of answersNested.entries()) {
          if (qVal instanceof Y.Map) {
            flat.set(qKey, qVal.get('answer') ?? null);
            flat.set(`${qKey}.comment`, new Y.Text());
            texts.push({ key: `${qKey}.comment`, content: getYTextContent(qVal, 'comment') });
          }
        }
      }
    } else if (key === 'overall') {
      const direction = section.get('direction');
      if (direction !== undefined) flat.set('overall.direction', direction);
    }
  }
}

function flattenROBINSI(
  answersMap: Y.Map<unknown>,
  flat: Y.Map<unknown>,
  texts: TextEntry[],
): void {
  for (const [key, val] of answersMap.entries()) {
    if (!(val instanceof Y.Map)) {
      flat.set(key, val);
      continue;
    }
    const section = val as Y.Map<unknown>;

    if (key === 'planning') {
      flat.set('planning.confoundingFactors', new Y.Text());
      texts.push({
        key: 'planning.confoundingFactors',
        content: getYTextContent(section, 'confoundingFactors'),
      });
    } else if (key === 'sectionA') {
      for (const field of ['numericalResult', 'furtherDetails', 'outcome']) {
        flat.set(`sectionA.${field}`, new Y.Text());
        texts.push({ key: `sectionA.${field}`, content: getYTextContent(section, field) });
      }
    } else if (key === 'sectionB') {
      for (const [subKey, subVal] of section.entries()) {
        if (subVal instanceof Y.Map) {
          flat.set(`sectionB.${subKey}`, subVal.get('answer') ?? null);
          flat.set(`sectionB.${subKey}.comment`, new Y.Text());
          texts.push({
            key: `sectionB.${subKey}.comment`,
            content: getYTextContent(subVal, 'comment'),
          });
        } else {
          flat.set(`sectionB.${subKey}`, subVal);
        }
      }
    } else if (key === 'sectionC') {
      flat.set('sectionC.isPerProtocol', section.get('isPerProtocol') ?? false);
      for (const field of ['participants', 'interventionStrategy', 'comparatorStrategy']) {
        flat.set(`sectionC.${field}`, new Y.Text());
        texts.push({ key: `sectionC.${field}`, content: getYTextContent(section, field) });
      }
    } else if (key === 'sectionD') {
      const sources = section.get('sources');
      if (sources !== undefined) flat.set('sectionD.sources', sources);
      flat.set('sectionD.otherSpecify', new Y.Text());
      texts.push({ key: 'sectionD.otherSpecify', content: getYTextContent(section, 'otherSpecify') });
    } else if (key === 'confoundingEvaluation') {
      const predefined = section.get('predefined');
      if (predefined !== undefined) flat.set('confoundingEvaluation.predefined', predefined);
      const additional = section.get('additional');
      if (additional !== undefined) flat.set('confoundingEvaluation.additional', additional);
    } else if (key.startsWith('domain') || key === 'overall') {
      const direction = section.get('direction');
      if (direction !== undefined) flat.set(`${key}.direction`, direction);
      const judgement = section.get('judgement');
      if (judgement !== undefined) flat.set(`${key}.judgement`, judgement);
      const judgementSource = section.get('judgementSource');
      if (judgementSource !== undefined) flat.set(`${key}.judgementSource`, judgementSource);

      if (key !== 'overall') {
        const answersNested = section.get('answers');
        if (answersNested instanceof Y.Map) {
          for (const [qKey, qVal] of answersNested.entries()) {
            if (qVal instanceof Y.Map) {
              flat.set(qKey, qVal.get('answer') ?? null);
              flat.set(`${qKey}.comment`, new Y.Text());
              texts.push({ key: `${qKey}.comment`, content: getYTextContent(qVal, 'comment') });
            }
          }
        }
      }
    }
  }
}

export function migrateChecklist(checklistYMap: Y.Map<unknown>): void {
  const answersMap = checklistYMap.get('answers') as Y.Map<unknown> | undefined;
  if (!answersMap || !isNestedFormat(answersMap)) return;

  const type = (checklistYMap.get('type') as string) || 'AMSTAR2';

  // Collect flat entries from nested format
  const flat = new Y.Map<unknown>();
  const texts: TextEntry[] = [];

  if (type === 'AMSTAR2') {
    flattenAMSTAR2(answersMap, flat, texts);
  } else if (type === 'ROB2') {
    flattenROB2(answersMap, flat, texts);
  } else if (type === 'ROBINS_I') {
    flattenROBINSI(answersMap, flat, texts);
  }

  // Delete nested keys, then write flat keys in-place on the attached map
  const nestedKeys: string[] = [];
  for (const [key, val] of answersMap.entries()) {
    if (val instanceof Y.Map) nestedKeys.push(key);
  }
  for (const key of nestedKeys) {
    answersMap.delete(key);
  }

  // Write non-text flat entries
  for (const [key, val] of flat.entries()) {
    if (val instanceof Y.Text) {
      answersMap.set(key, new Y.Text());
    } else {
      answersMap.set(key, val);
    }
  }

  // Fill text content after Y.Text objects are attached
  for (const { key, content } of texts) {
    if (!content) continue;
    const ytext = answersMap.get(key);
    if (ytext instanceof Y.Text) {
      ytext.insert(0, content);
    }
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
