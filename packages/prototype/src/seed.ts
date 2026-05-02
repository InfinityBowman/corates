import * as Y from 'yjs';
import {
  AMSTAR2_QUESTION_KEYS,
  AMSTAR2_SCHEMA,
  cbKey,
  verdictKey,
} from './amstar2';
import type { Verdict } from './amstar2';

function seedCheckboxes(
  q: Y.Map<unknown>,
  columns: { options: string[] }[],
  allChecked: boolean,
  section?: string,
) {
  const cbCols = columns.slice(0, -1);
  for (let c = 0; c < cbCols.length; c++) {
    for (let o = 0; o < cbCols[c].options.length; o++) {
      q.set(cbKey(c, o, section), allChecked);
    }
  }
}

function makeSimpleQuestion(
  key: string,
  verdict: Verdict,
  allChecked: boolean,
  note?: string,
): Y.Map<unknown> {
  const schema = AMSTAR2_SCHEMA[key];
  const q = new Y.Map();
  q.set('critical', schema.critical);

  if (schema.sections) {
    for (const sec of schema.sections) {
      seedCheckboxes(q, sec.columns, allChecked, sec.key);
      q.set(verdictKey(sec.key), verdict);
    }
  } else {
    seedCheckboxes(q, schema.columns!, allChecked);
    q.set(verdictKey(), verdict);
  }

  const noteText = new Y.Text();
  if (note) noteText.insert(0, note);
  q.set('note', noteText);
  return q;
}

export function seedYDoc(ydoc: Y.Doc): void {
  ydoc.transact(() => {
    const reviewsMap = ydoc.getMap('reviews');

    // -- Study 1: all Yes (High confidence) --
    const study1 = new Y.Map();
    study1.set('name', 'Effectiveness of CBT for Depression');
    study1.set('firstAuthor', 'Smith');
    study1.set('publicationYear', '2024');
    study1.set('reviewer1', 'alice');
    study1.set('reviewer2', 'bob');
    study1.set('createdAt', 1000);

    const checklists1 = new Y.Map();

    const cl1 = new Y.Map();
    cl1.set('type', 'AMSTAR2');
    cl1.set('status', 'in_progress');
    cl1.set('assignedTo', 'alice');
    cl1.set('createdAt', Date.now());
    const answers1 = new Y.Map();
    for (const key of AMSTAR2_QUESTION_KEYS) {
      answers1.set(key, makeSimpleQuestion(key, 'Yes', true,
        key === 'q1' ? 'Protocol was registered on PROSPERO.' :
        key === 'q4' ? 'Searched PubMed, Cochrane, EMBASE, PsycINFO.' :
        undefined,
      ));
    }
    cl1.set('answers', answers1);
    checklists1.set('cl-1', cl1);

    // Study 1 second checklist: non-critical flaws (Moderate)
    const cl2 = new Y.Map();
    cl2.set('type', 'AMSTAR2');
    cl2.set('status', 'finalized');
    cl2.set('assignedTo', 'bob');
    cl2.set('createdAt', Date.now() + 1);
    const answers2 = new Y.Map();
    const noKeys = new Set(['q6', 'q10', 'q14']);
    for (const key of AMSTAR2_QUESTION_KEYS) {
      if (noKeys.has(key)) {
        answers2.set(key, makeSimpleQuestion(key, 'No', false,
          key === 'q6' ? 'Only one author extracted data.' : undefined,
        ));
      } else {
        answers2.set(key, makeSimpleQuestion(key, 'Yes', true));
      }
    }
    cl2.set('answers', answers2);
    checklists1.set('cl-2', cl2);

    study1.set('checklists', checklists1);
    reviewsMap.set('study-1', study1);

    // -- Study 2: no reviewers, no checklists --
    const study2 = new Y.Map();
    study2.set('name', 'Meta-analysis of Exercise Interventions');
    study2.set('firstAuthor', 'Johnson');
    study2.set('publicationYear', '2023');
    study2.set('reviewer1', null);
    study2.set('reviewer2', null);
    study2.set('createdAt', 2000);
    study2.set('checklists', new Y.Map());
    reviewsMap.set('study-2', study2);

    // -- Study 3: many critical flaws (Critically Low) --
    const study3 = new Y.Map();
    study3.set('name', 'Systematic Review of Sleep Hygiene');
    study3.set('firstAuthor', 'Park');
    study3.set('publicationYear', '2025');
    study3.set('reviewer1', 'carol');
    study3.set('reviewer2', null);
    study3.set('createdAt', 3000);

    const checklists3 = new Y.Map();
    const cl3 = new Y.Map();
    cl3.set('type', 'AMSTAR2');
    cl3.set('status', 'in_progress');
    cl3.set('assignedTo', 'carol');
    cl3.set('createdAt', Date.now());
    const answers3 = new Y.Map();
    const yesKeys = new Set(['q1', 'q16']);
    for (const key of AMSTAR2_QUESTION_KEYS) {
      if (yesKeys.has(key)) {
        answers3.set(key, makeSimpleQuestion(key, 'Yes', true));
      } else {
        answers3.set(key, makeSimpleQuestion(key, 'No', false,
          key === 'q2' ? 'No protocol registered.' : undefined,
        ));
      }
    }
    cl3.set('answers', answers3);
    checklists3.set('cl-1', cl3);

    study3.set('checklists', checklists3);
    reviewsMap.set('study-3', study3);
  });
}
