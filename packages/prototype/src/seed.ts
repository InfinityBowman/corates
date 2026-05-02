import * as Y from 'yjs';

function makeQuestion(answer: string, note: string): Y.Map<unknown> {
  const q = new Y.Map();
  q.set('answer', answer);
  const noteText = new Y.Text();
  noteText.insert(0, note);
  q.set('note', noteText);
  return q;
}

export function seedYDoc(ydoc: Y.Doc): void {
  ydoc.transact(() => {
    const reviewsMap = ydoc.getMap('reviews');

    // -- Study 1: has two checklists (one in-progress, one finalized) --
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
    answers1.set('q1', makeQuestion('yes', 'Protocol was registered on PROSPERO.'));
    answers1.set('q2', makeQuestion('no', ''));
    answers1.set('q3', makeQuestion('partially_yes', 'Only PubMed and Cochrane searched.'));
    cl1.set('answers', answers1);
    checklists1.set('cl-1', cl1);

    const cl2 = new Y.Map();
    cl2.set('type', 'AMSTAR2');
    cl2.set('status', 'finalized');
    cl2.set('assignedTo', 'bob');
    cl2.set('createdAt', Date.now() + 1);
    const answers2 = new Y.Map();
    answers2.set('q1', makeQuestion('yes', 'Confirmed registration.'));
    answers2.set('q2', makeQuestion('yes', ''));
    answers2.set('q3', makeQuestion('yes', 'Comprehensive search strategy.'));
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

    const checklists2 = new Y.Map();
    study2.set('checklists', checklists2);
    reviewsMap.set('study-2', study2);

    // -- Study 3: one reviewer, one pending checklist --
    const study3 = new Y.Map();
    study3.set('name', 'Systematic Review of Sleep Hygiene');
    study3.set('firstAuthor', 'Park');
    study3.set('publicationYear', '2025');
    study3.set('reviewer1', 'carol');
    study3.set('reviewer2', null);
    study3.set('createdAt', 3000);

    const checklists3 = new Y.Map();
    const cl3 = new Y.Map();
    cl3.set('type', 'ROB2');
    cl3.set('status', 'pending');
    cl3.set('assignedTo', 'carol');
    cl3.set('createdAt', Date.now());
    const answers3 = new Y.Map();
    answers3.set('q1', makeQuestion('', ''));
    cl3.set('answers', answers3);
    checklists3.set('cl-1', cl3);

    study3.set('checklists', checklists3);
    reviewsMap.set('study-3', study3);
  });
}
