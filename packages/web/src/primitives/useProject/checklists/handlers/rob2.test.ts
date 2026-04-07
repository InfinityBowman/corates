/**
 * Tests for ROB2Handler - verifying that changing answers preserves Y.Text comments
 *
 * These tests reproduce a bug where changing an answer causes comment text to be
 * deleted. The root cause: when an answer changes, the component sends the ENTIRE
 * domain's serialized state (including potentially stale comment strings) through
 * updateAnswer. If Y.Text was modified by NoteEditor after the last serialization,
 * setYTextField overwrites the Y.Text content with the stale empty string.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { ROB2Handler } from './rob2.js';

/**
 * Minimal ROB2 template for domain1 (questions d1_1, d1_2, d1_3).
 * Mirrors the structure produced by createROB2Checklist from @corates/shared.
 */
function createMinimalTemplate() {
  return {
    preliminary: {
      studyDesign: null,
      aim: null,
      deviationsToAddress: [],
      sources: {},
    },
    domain1: {
      answers: {
        d1_1: { answer: null },
        d1_2: { answer: null },
        d1_3: { answer: null },
      },
      judgement: null,
      direction: null,
    },
    overall: {
      judgement: null,
      direction: null,
    },
  };
}

describe('ROB2Handler - answer changes should preserve Y.Text comments', () => {
  let handler: ROB2Handler;
  let doc: Y.Doc;
  // Nested Y.Map with heterogeneous values (domain maps -> answer maps ->
  // Y.Text fields). serializeAnswers() returns Record<string, unknown>; the
  // tests mutate nested dynamic fields, so we interact via any inside the
  // describe block.
  let answersYMap: any;
  // serializeAnswers's dynamic Record<string, unknown> return walks nested
  // schema; tests reach into it by path, so mutations go through a cast.
  type SerializedAnswers = Record<string, any>;

  beforeEach(() => {
    handler = new ROB2Handler();
    doc = new Y.Doc();

    const template = createMinimalTemplate();
    const answersData = handler.extractAnswersFromTemplate(template);
    const ymap = handler.createAnswersYMap(answersData);

    // Attach to the Y.Doc so Y.Text transactions work
    doc.getMap('checklist').set('answers', ymap);
    answersYMap = doc.getMap('checklist').get('answers');
  });

  /** Get the Y.Text for a question's comment field */
  function getCommentYText(domainKey: string, questionKey: string) {
    const domainMap = answersYMap.get(domainKey);
    const answersMap = domainMap.get('answers');
    const questionMap = answersMap.get(questionKey);
    return questionMap.get('comment');
  }

  it('changing a different question answer should not wipe comments', () => {
    // Step 1: Serialize the initial state (this is what React state would hold)
    const serialized = handler.serializeAnswers(answersYMap) as SerializedAnswers;
    // serialized.domain1.answers.d1_1.comment === ''

    // Step 2: User types a comment on d1_1 via NoteEditor (directly modifies Y.Text)
    const d1_1Comment = getCommentYText('domain1', 'd1_1');
    d1_1Comment.insert(0, 'Important note about randomization');
    expect(d1_1Comment.toString()).toBe('Important note about randomization');

    // Step 3: User changes the answer for d1_2 (a DIFFERENT question).
    // The React component still has the stale serialized state from Step 1,
    // where d1_1.comment = ''. It sends the entire domain through updateAnswer.
    const staleDomain = serialized.domain1;
    staleDomain.answers.d1_2 = { ...staleDomain.answers.d1_2, answer: 'Y' };

    handler.updateAnswer(answersYMap, 'domain1', staleDomain);

    // The d1_1 comment should NOT be overwritten with the stale empty string
    expect(d1_1Comment.toString()).toBe('Important note about randomization');
  });

  it('changing a question own answer should not wipe its comment', () => {
    // Step 1: Answer d1_1 as 'Y'
    handler.updateAnswer(answersYMap, 'domain1', {
      answers: { d1_1: { answer: 'Y' } },
    });

    // Step 2: Serialize state (React snapshot: d1_1.answer='Y', d1_1.comment='')
    const serialized = handler.serializeAnswers(answersYMap) as SerializedAnswers;

    // Step 3: User types a comment on d1_1 via NoteEditor
    const d1_1Comment = getCommentYText('domain1', 'd1_1');
    d1_1Comment.insert(0, 'This was properly randomized');
    expect(d1_1Comment.toString()).toBe('This was properly randomized');

    // Step 4: User now changes d1_1's answer from 'Y' to 'N'.
    // The React component uses the stale serialized state with comment = ''.
    const staleDomain = serialized.domain1;
    staleDomain.answers.d1_1 = { ...staleDomain.answers.d1_1, answer: 'N' };

    handler.updateAnswer(answersYMap, 'domain1', staleDomain);

    // The comment should NOT be lost just because the answer changed
    expect(d1_1Comment.toString()).toBe('This was properly randomized');
  });

  it('changing aim should not wipe preliminary text fields', () => {
    // Step 1: Serialize initial state (experimental = '')
    const serialized = handler.serializeAnswers(answersYMap) as SerializedAnswers;

    // Step 2: User types into the experimental field via NoteEditor
    const prelimMap = answersYMap.get('preliminary');
    const experimentalYText = prelimMap.get('experimental');
    experimentalYText.insert(0, 'Drug A 10mg daily');
    expect(experimentalYText.toString()).toBe('Drug A 10mg daily');

    // Step 3: User changes the aim (sends full preliminary state from stale snapshot)
    const stalePrelim = serialized.preliminary;
    stalePrelim.aim = 'ASSIGNMENT';

    handler.updateAnswer(answersYMap, 'preliminary', stalePrelim);

    // The experimental text should NOT be overwritten
    expect(experimentalYText.toString()).toBe('Drug A 10mg daily');
  });
});
