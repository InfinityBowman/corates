/**
 * Tests for the reliability statistics core
 *
 * INTENDED BEHAVIOR:
 * - classifyPair: a pair is compared only when both sides are substantive
 *   and on the scale; one not-applicable side is reported separately,
 *   unanswered is excluded (the counts are checked through summarizeLevel)
 * - weightedKappa: linear weighted Cohen's kappa with the Fleiss, Cohen and
 *   Everitt (1969) standard error; identity weights reduce to plain kappa
 * - summarizeLevel: per-item agreement, confusion matrix, and a kappa only
 *   once enough pairs have been compared
 */

import { describe, it, expect } from 'vitest';
import {
  classifyPair,
  weightedKappa,
  summarizeLevel,
  getKappaInterpretation,
  MIN_PAIRS_FOR_KAPPA,
  NOT_APPLICABLE,
} from '../stats.js';

function repeat<T>(value: T, times: number): T[] {
  return Array.from({ length: times }, () => value);
}

describe('classifyPair', () => {
  it('excludes an answer that is off the scale', () => {
    expect(classifyPair({ item: 'x', a: 'Maybe', b: 'Low' }, ['Low', 'High'])).toBe('excluded');
  });
});

describe('weightedKappa', () => {
  it('reduces to plain Cohen kappa on a two-category scale', () => {
    // a\b table [[20, 5], [10, 15]]: Po = 0.7, Pe = 0.5, kappa = 0.4.
    // SE hand-computed from the unweighted Fleiss formula: 0.1270.
    const pairs: Array<[string, string]> = [
      ...repeat<[string, string]>(['Y', 'Y'], 20),
      ...repeat<[string, string]>(['Y', 'N'], 5),
      ...repeat<[string, string]>(['N', 'Y'], 10),
      ...repeat<[string, string]>(['N', 'N'], 15),
    ];
    const result = weightedKappa(pairs, ['Y', 'N'])!;
    expect(result.observed).toBeCloseTo(0.7, 10);
    expect(result.expected).toBeCloseTo(0.5, 10);
    expect(result.kappa).toBeCloseTo(0.4, 10);
    expect(result.se).toBeCloseTo(0.127, 3);
    expect(result.ci[0]).toBeCloseTo(0.4 - 1.96 * 0.127, 2);
    expect(result.ci[1]).toBeCloseTo(0.4 + 1.96 * 0.127, 2);
  });

  it('gives half credit to a one-step disagreement on a three-category scale', () => {
    // a\b table [[10, 4, 2], [2, 5, 1], [1, 0, 5]], n = 30.
    // Linear weights: Po = 23.5/30, Pe = 511/900, kappa = 0.4987.
    const pairs: Array<[string, string]> = [
      ...repeat<[string, string]>(['L', 'L'], 10),
      ...repeat<[string, string]>(['L', 'S'], 4),
      ...repeat<[string, string]>(['L', 'H'], 2),
      ...repeat<[string, string]>(['S', 'L'], 2),
      ...repeat<[string, string]>(['S', 'S'], 5),
      ...repeat<[string, string]>(['S', 'H'], 1),
      ...repeat<[string, string]>(['H', 'L'], 1),
      ...repeat<[string, string]>(['H', 'H'], 5),
    ];
    const result = weightedKappa(pairs, ['L', 'S', 'H'])!;
    expect(result.observed).toBeCloseTo(23.5 / 30, 10);
    expect(result.expected).toBeCloseTo(511 / 900, 10);
    expect(result.kappa).toBeCloseTo(0.4987, 4);
    expect(result.se).toBeGreaterThan(0);
  });

  it('is 1 on perfect agreement with both categories used', () => {
    const pairs: Array<[string, string]> = [
      ...repeat<[string, string]>(['L', 'L'], 5),
      ...repeat<[string, string]>(['H', 'H'], 5),
    ];
    const result = weightedKappa(pairs, ['L', 'H'])!;
    expect(result.kappa).toBe(1);
    expect(result.se).toBe(0);
  });

  it('is undefined when every rating is the same category', () => {
    expect(weightedKappa(repeat<[string, string]>(['L', 'L'], 10), ['L', 'H'])).toBeNull();
  });

  it('is undefined for a rating outside the scale or an empty input', () => {
    expect(weightedKappa([['L', 'X']], ['L', 'H'])).toBeNull();
    expect(weightedKappa([], ['L', 'H'])).toBeNull();
  });
});

describe('summarizeLevel', () => {
  const scale = ['Low', 'Some concerns', 'High'];
  const items = [
    { key: 'domain1', label: 'D1', title: 'Domain 1' },
    { key: 'domain2', label: 'D2', title: 'Domain 2' },
  ];

  it('counts compared, agreed, one-sided and excluded pairs', () => {
    const result = summarizeLevel(
      [
        { item: 'domain1', a: 'Low', b: 'Low' },
        { item: 'domain1', a: 'Low', b: 'High' },
        { item: 'domain2', a: NOT_APPLICABLE, b: 'Low' },
        { item: 'domain2', a: null, b: 'Low' },
        { item: 'domain2', a: 'High', b: 'High' },
      ],
      scale,
      items,
    );
    expect(result.compared).toBe(3);
    expect(result.agreed).toBe(2);
    expect(result.oneSided).toBe(1);
    expect(result.excluded).toBe(1);
    expect(result.percentAgreement).toBeCloseTo(66.67, 1);
    expect(result.items).toEqual([
      { key: 'domain1', label: 'D1', title: 'Domain 1', compared: 2, agreed: 1 },
      { key: 'domain2', label: 'D2', title: 'Domain 2', compared: 1, agreed: 1 },
    ]);
    expect(result.matrix).toEqual([
      [1, 0, 1],
      [0, 0, 0],
      [0, 0, 1],
    ]);
  });

  it('withholds the kappa until enough pairs have been compared', () => {
    const pair = { item: 'domain1', a: 'Low', b: 'High' };
    const agree = { item: 'domain1', a: 'Low', b: 'Low' };
    const few = summarizeLevel(repeat(pair, MIN_PAIRS_FOR_KAPPA - 1), scale, items);
    expect(few.kappa).toBeNull();
    const enough = summarizeLevel(
      [...repeat(pair, MIN_PAIRS_FOR_KAPPA / 2), ...repeat(agree, MIN_PAIRS_FOR_KAPPA / 2)],
      scale,
      items,
    );
    expect(enough.kappa).not.toBeNull();
  });

  it('gives percent agreement only when there is no scale', () => {
    const result = summarizeLevel(
      repeat({ item: 'd1_1', a: 'Y', b: 'Y' }, MIN_PAIRS_FOR_KAPPA + 5),
      null,
      [],
    );
    expect(result.percentAgreement).toBe(100);
    expect(result.kappa).toBeNull();
    expect(result.matrix).toBeNull();
  });

  it('returns nulls for an empty level', () => {
    const result = summarizeLevel([], scale, items);
    expect(result.percentAgreement).toBeNull();
    expect(result.kappa).toBeNull();
    expect(result.matrix).toBeNull();
  });
});

describe('getKappaInterpretation', () => {
  it('places values on the Landis and Koch bands', () => {
    expect(getKappaInterpretation(null)).toBe('N/A');
    expect(getKappaInterpretation(-0.1)).toBe('Poor');
    expect(getKappaInterpretation(0)).toBe('Slight');
    expect(getKappaInterpretation(0.2)).toBe('Fair');
    expect(getKappaInterpretation(0.4)).toBe('Moderate');
    expect(getKappaInterpretation(0.6)).toBe('Substantial');
    expect(getKappaInterpretation(0.8)).toBe('Almost perfect');
    expect(getKappaInterpretation(1)).toBe('Almost perfect');
  });
});
