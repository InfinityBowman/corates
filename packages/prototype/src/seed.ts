import * as Y from 'yjs';
import {
  AMSTAR2_QUESTION_KEYS,
  AMSTAR2_SCHEMA,
  cbKey,
  verdictKey,
  noteKey,
} from './amstar2';
import type { Verdict } from './amstar2';
import { ROB2_DOMAINS, getActiveDomainKeys } from './rob2';
import {
  ROBINSI_DOMAINS,
  getActiveDomainKeys as getROBINSIActiveDomainKeys,
  getDomainQuestions,
} from './robins-i';

function seedAMSTAR2Checkboxes(
  answers: Y.Map<unknown>,
  questionKey: string,
  columns: { options: string[] }[],
  allChecked: boolean,
  section?: string,
) {
  const cbCols = columns.slice(0, -1);
  for (let c = 0; c < cbCols.length; c++) {
    for (let o = 0; o < cbCols[c].options.length; o++) {
      answers.set(cbKey(questionKey, c, o, section), allChecked);
    }
  }
}

function seedAMSTAR2Question(
  answers: Y.Map<unknown>,
  key: string,
  verdict: Verdict,
  allChecked: boolean,
  note?: string,
) {
  const schema = AMSTAR2_SCHEMA[key];

  if (schema.sections) {
    for (const sec of schema.sections) {
      seedAMSTAR2Checkboxes(answers, key, sec.columns, allChecked, sec.key);
      answers.set(verdictKey(key, sec.key), verdict);
    }
  } else {
    seedAMSTAR2Checkboxes(answers, key, schema.columns!, allChecked);
    answers.set(verdictKey(key), verdict);
  }

  const noteText = new Y.Text();
  if (note) noteText.insert(0, note);
  answers.set(noteKey(key), noteText);
}

function seedROB2Answers(answers: Y.Map<unknown>) {
  answers.set('preliminary.aim', 'ASSIGNMENT');
  answers.set('preliminary.studyDesign', 'Individually-randomized parallel-group trial');

  const active = getActiveDomainKeys('ASSIGNMENT');
  for (const dk of active) {
    const domain = ROB2_DOMAINS[dk];
    for (const q of domain.questions) {
      answers.set(q.id, 'Y');
    }
  }
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
      seedAMSTAR2Question(answers1, key, 'Yes', true,
        key === 'q1' ? 'Protocol was registered on PROSPERO.' :
        key === 'q4' ? 'Searched PubMed, Cochrane, EMBASE, PsycINFO.' :
        undefined,
      );
    }
    cl1.set('answers', answers1);
    checklists1.set('cl-1', cl1);

    const cl2 = new Y.Map();
    cl2.set('type', 'AMSTAR2');
    cl2.set('status', 'finalized');
    cl2.set('assignedTo', 'bob');
    cl2.set('createdAt', Date.now() + 1);
    const answers2 = new Y.Map();
    const noKeys = new Set(['q6', 'q10', 'q14']);
    for (const key of AMSTAR2_QUESTION_KEYS) {
      if (noKeys.has(key)) {
        seedAMSTAR2Question(answers2, key, 'No', false,
          key === 'q6' ? 'Only one author extracted data.' : undefined,
        );
      } else {
        seedAMSTAR2Question(answers2, key, 'Yes', true);
      }
    }
    cl2.set('answers', answers2);
    checklists1.set('cl-2', cl2);

    study1.set('checklists', checklists1);
    reviewsMap.set('study-1', study1);

    // -- Study 2: ROB2 checklist --
    const study2 = new Y.Map();
    study2.set('name', 'Meta-analysis of Exercise Interventions');
    study2.set('firstAuthor', 'Johnson');
    study2.set('publicationYear', '2023');
    study2.set('reviewer1', 'alice');
    study2.set('reviewer2', null);
    study2.set('createdAt', 2000);

    const checklists2 = new Y.Map();
    const clRob2 = new Y.Map();
    clRob2.set('type', 'ROB2');
    clRob2.set('status', 'in_progress');
    clRob2.set('assignedTo', 'alice');
    clRob2.set('createdAt', Date.now());
    const answersRob2 = new Y.Map();
    seedROB2Answers(answersRob2);
    clRob2.set('answers', answersRob2);
    checklists2.set('cl-1', clRob2);

    study2.set('checklists', checklists2);
    reviewsMap.set('study-2', study2);

    // -- Study 2b: ROBINS-I checklist --
    const clRobinsI = new Y.Map();
    clRobinsI.set('type', 'ROBINS_I');
    clRobinsI.set('status', 'in_progress');
    clRobinsI.set('assignedTo', 'bob');
    clRobinsI.set('createdAt', Date.now() + 2);
    const answersRobinsI = new Y.Map();
    answersRobinsI.set('preliminary.isPerProtocol', false);
    const robinsiActive = getROBINSIActiveDomainKeys(false);
    for (const dk of robinsiActive) {
      const domain = ROBINSI_DOMAINS[dk];
      for (const q of getDomainQuestions(domain)) {
        answersRobinsI.set(q.id, q.responses[0]);
      }
    }
    clRobinsI.set('answers', answersRobinsI);
    checklists2.set('cl-2', clRobinsI);

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
        seedAMSTAR2Question(answers3, key, 'Yes', true);
      } else {
        seedAMSTAR2Question(answers3, key, 'No', false,
          key === 'q2' ? 'No protocol registered.' : undefined,
        );
      }
    }
    cl3.set('answers', answers3);
    checklists3.set('cl-1', cl3);

    study3.set('checklists', checklists3);
    reviewsMap.set('study-3', study3);
  });
}
