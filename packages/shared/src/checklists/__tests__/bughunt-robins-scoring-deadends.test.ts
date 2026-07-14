/**
 * Bug hunt: ROBINS-I domain scoring dead ends.
 *
 * Invariant under test: when every signalling question in a domain has been
 * answered with a legal option from its own response scale (the exact options
 * the web UI renders via getResponseOptions), the domain scorer must resolve
 * to a judgement (isComplete === true, judgement !== null). The scoring
 * helpers even normalize NA to NI explicitly "to avoid stuck branches".
 *
 * A combination that leaves the scorer incomplete means a reviewer who has
 * answered everything on screen gets no domain judgement and the checklist
 * can never reach a complete state.
 */

import { describe, it, expect } from 'vitest';
import {
  getDomainQuestions,
  getResponseOptions,
  scoreRobinsDomain,
  type DomainAnswers,
} from '../robins-i/index.js';

interface SweepResult {
  total: number;
  failingCount: number;
  samples: string[];
}

function sweepDomain(
  domainKey: string,
  fixed: Record<string, string> = {},
): SweepResult {
  const questions = getDomainQuestions(domainKey);
  const keys = Object.keys(questions);
  const optionSets = keys.map(k =>
    fixed[k] !== undefined ?
      [fixed[k]]
    : [...getResponseOptions(questions[k].responseType)],
  );

  const total = optionSets.reduce((acc, s) => acc * s.length, 1);
  const idx = new Array(keys.length).fill(0);
  let failingCount = 0;
  const samples: string[] = [];

  for (let n = 0; n < total; n++) {
    const answers: DomainAnswers = {};
    for (let i = 0; i < keys.length; i++) {
      answers[keys[i]] = { answer: optionSets[i][idx[i]] };
    }

    const result = scoreRobinsDomain(domainKey, answers);
    if (!result.isComplete || result.judgement === null) {
      failingCount++;
      if (samples.length < 8) {
        samples.push(
          keys.map((k, i) => `${k}=${optionSets[i][idx[i]]}`).join(' ') +
            ` -> isComplete=${result.isComplete} judgement=${String(result.judgement)}`,
        );
      }
    }

    // Increment mixed-radix counter
    for (let i = keys.length - 1; i >= 0; i--) {
      idx[i]++;
      if (idx[i] < optionSets[i].length) break;
      idx[i] = 0;
    }
  }

  return { total, failingCount, samples };
}

describe('ROBINS-I fully-answered domains must always score', () => {
  it('domain1a resolves for every legal answer combination', () => {
    const r = sweepDomain('domain1a');
    expect({ failingCount: r.failingCount, samples: r.samples }).toEqual({
      failingCount: 0,
      samples: [],
    });
  });

  it('domain1b resolves for every legal answer combination', () => {
    const r = sweepDomain('domain1b');
    expect({ failingCount: r.failingCount, samples: r.samples }).toEqual({
      failingCount: 0,
      samples: [],
    });
  });

  it('domain2 resolves for every legal answer combination', () => {
    const r = sweepDomain('domain2');
    expect({ failingCount: r.failingCount, samples: r.samples }).toEqual({
      failingCount: 0,
      samples: [],
    });
  });

  it('domain3 resolves for every legal answer combination', () => {
    const r = sweepDomain('domain3');
    expect({ failingCount: r.failingCount, samples: r.samples }).toEqual({
      failingCount: 0,
      samples: [],
    });
  });

  it('domain4 resolves for every legal answer combination on the missing-data path', () => {
    // Full cross-product of all 11 questions is infeasible (~146M combos), so
    // fix the entry questions to force the missing-data path (4.1=Y, 4.2=Y,
    // 4.3=N) and sweep everything downstream exhaustively.
    const r = sweepDomain('domain4', { d4_1: 'Y', d4_2: 'Y', d4_3: 'N' });
    expect({ failingCount: r.failingCount, samples: r.samples }).toEqual({
      failingCount: 0,
      samples: [],
    });
  });

  it('domain5 resolves for every legal answer combination', () => {
    const r = sweepDomain('domain5');
    expect({ failingCount: r.failingCount, samples: r.samples }).toEqual({
      failingCount: 0,
      samples: [],
    });
  });

  it('domain6 resolves for every legal answer combination', () => {
    const r = sweepDomain('domain6');
    expect({ failingCount: r.failingCount, samples: r.samples }).toEqual({
      failingCount: 0,
      samples: [],
    });
  });
});

describe('ROBINS-I targeted reachable dead ends', () => {
  it('domain2: 2.1=N, 2.2=N, 2.3=SY, 2.4=WY, 2.5=N must produce a judgement', () => {
    // On-path per the question conditionals: 2.2 asked because N/PN/NI to 2.1,
    // 2.3 asked because N/PN/NI to 2.2, 2.4 and 2.5 always asked.
    const result = scoreRobinsDomain('domain2', {
      d2_1: { answer: 'N' },
      d2_2: { answer: 'N' },
      d2_3: { answer: 'SY' },
      d2_4: { answer: 'WY' },
      d2_5: { answer: 'N' },
    });
    expect(result.isComplete).toBe(true);
    expect(result.judgement).not.toBeNull();
  });

  it('domain2: 2.1=N, 2.2=N, 2.3=SY, 2.4=NI, 2.5=N must produce a judgement', () => {
    const result = scoreRobinsDomain('domain2', {
      d2_1: { answer: 'N' },
      d2_2: { answer: 'N' },
      d2_3: { answer: 'SY' },
      d2_4: { answer: 'NI' },
      d2_5: { answer: 'N' },
    });
    expect(result.isComplete).toBe(true);
    expect(result.judgement).not.toBeNull();
  });

  it('domain4: answering NA to 4.11 on the complete-case path must still score', () => {
    // 4.11 offers NA in the UI (WITH_NA_NO_NI). normalizeAnswer maps NA to NI
    // but every 4.11 check only handles Y/PY and N/PN, so the domain is stuck.
    const result = scoreRobinsDomain('domain4', {
      d4_1: { answer: 'Y' },
      d4_2: { answer: 'Y' },
      d4_3: { answer: 'N' },
      d4_4: { answer: 'Y' },
      d4_5: { answer: 'Y' },
      d4_6: { answer: 'Y' },
      d4_7: { answer: 'NA' },
      d4_8: { answer: 'NA' },
      d4_9: { answer: 'NA' },
      d4_10: { answer: 'NA' },
      d4_11: { answer: 'NA' },
    });
    expect(result.isComplete).toBe(true);
    expect(result.judgement).not.toBeNull();
  });
});
