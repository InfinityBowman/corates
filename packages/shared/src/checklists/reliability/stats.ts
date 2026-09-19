/**
 * Inter-rater reliability statistics
 *
 * Tool-agnostic: works on pairs of ratings and an ordered scale. Tool adapters
 * turn checklists into pairs; the UI explains the numbers using the same
 * constants exported here so the explanation cannot drift from the maths.
 */

/** Sentinel for "not applicable", whether chosen explicitly or skipped by branching. */
export const NOT_APPLICABLE = 'NA';

/** Below this many compared pairs a kappa swings too much to be worth showing. */
export const MIN_PAIRS_FOR_KAPPA = 20;

/** Two-sided 95% normal quantile used for the kappa confidence interval. */
export const CI_Z = 1.96;

/** Landis and Koch (1977) bands, lower bound inclusive. */
export const KAPPA_BANDS = [
  { min: 0.8, label: 'Almost perfect' },
  { min: 0.6, label: 'Substantial' },
  { min: 0.4, label: 'Moderate' },
  { min: 0.2, label: 'Fair' },
  { min: 0, label: 'Slight' },
  { min: -Infinity, label: 'Poor' },
] as const;

export interface RatingPair {
  /** Which domain, question or item the pair belongs to. */
  item: string;
  a: string | null;
  b: string | null;
}

export type PairClass = 'compared' | 'one-sided' | 'excluded';

export interface KappaResult {
  kappa: number;
  se: number;
  ci: [number, number];
  observed: number;
  expected: number;
}

export interface ItemStats {
  key: string;
  label: string;
  title: string;
  compared: number;
  agreed: number;
}

export interface LevelStats {
  /** Ordered categories the kappa is weighted over; null for percent agreement only. */
  scale: string[] | null;
  compared: number;
  agreed: number;
  percentAgreement: number | null;
  /** Not applicable for exactly one reviewer, so no comparison was possible. */
  oneSided: number;
  /** Unanswered by either reviewer, or not applicable for both. */
  excluded: number;
  kappa: KappaResult | null;
  /** Counts of compared pairs, rows are reviewer A and columns reviewer B, in scale order. */
  matrix: number[][] | null;
  items: ItemStats[];
}

export interface ItemDefinition {
  key: string;
  label: string;
  title: string;
}

/**
 * A pair is compared only when both reviewers gave a substantive answer. When
 * exactly one side is not applicable the pair is reported separately rather
 * than counted as a disagreement, because the branching answer that caused it
 * is already compared on its own.
 */
export function classifyPair(pair: RatingPair, scale: string[] | null): PairClass {
  const { a, b } = pair;
  if (a == null || b == null) return 'excluded';
  const aNa = a === NOT_APPLICABLE;
  const bNa = b === NOT_APPLICABLE;
  if (aNa && bNa) return 'excluded';
  if (aNa || bNa) return 'one-sided';
  if (scale && (!scale.includes(a) || !scale.includes(b))) return 'excluded';
  return 'compared';
}

/** Linear disagreement weight: distance along the scale as a fraction of its length. */
export function linearDisagreement(i: number, j: number, categories: number): number {
  if (categories < 2) return 0;
  return Math.abs(i - j) / (categories - 1);
}

/**
 * Linear weighted Cohen's kappa with the large-sample standard error of
 * Fleiss, Cohen and Everitt (1969). With identity weights this is plain
 * Cohen's kappa. Pairs must already be on the scale.
 */
export function weightedKappa(pairs: Array<[string, string]>, scale: string[]): KappaResult | null {
  const k = scale.length;
  const n = pairs.length;
  if (k < 2 || n === 0) return null;

  const index = new Map(scale.map((category, i) => [category, i]));
  const counts: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
  for (const [a, b] of pairs) {
    const i = index.get(a);
    const j = index.get(b);
    if (i == null || j == null) return null;
    counts[i][j] += 1;
  }

  const p = counts.map(row => row.map(c => c / n));
  const rowMarginal = p.map(row => row.reduce((s, v) => s + v, 0));
  const colMarginal = scale.map((_, j) => p.reduce((s, row) => s + row[j], 0));
  const w = (i: number, j: number) => 1 - linearDisagreement(i, j, k);

  let observed = 0;
  let expected = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      observed += p[i][j] * w(i, j);
      expected += rowMarginal[i] * colMarginal[j] * w(i, j);
    }
  }

  const denominator = 1 - expected;
  if (Math.abs(denominator) < 1e-12) return null;
  const kappa = (observed - expected) / denominator;

  const rowWeight = scale.map((_, i) =>
    scale.reduce((s, _c, j) => s + colMarginal[j] * w(i, j), 0),
  );
  const colWeight = scale.map((_, j) =>
    scale.reduce((s, _c, i) => s + rowMarginal[i] * w(i, j), 0),
  );
  let sum = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const term = w(i, j) - (rowWeight[i] + colWeight[j]) * (1 - kappa);
      sum += p[i][j] * term * term;
    }
  }
  const centre = kappa - expected * (1 - kappa);
  const variance = Math.max(0, (sum - centre * centre) / (n * denominator * denominator));
  const se = Math.sqrt(variance);

  return {
    kappa,
    se,
    ci: [Math.max(-1, kappa - CI_Z * se), Math.min(1, kappa + CI_Z * se)],
    observed,
    expected,
  };
}

export function getKappaInterpretation(kappa: number | null): string {
  if (kappa == null) return 'N/A';
  return KAPPA_BANDS.find(band => kappa >= band.min)?.label ?? 'Poor';
}

/**
 * Summarise one level of comparison (domain judgements, overall judgement or
 * signaling questions) from its pairs.
 */
export function summarizeLevel(
  pairs: RatingPair[],
  scale: string[] | null,
  items: ItemDefinition[],
): LevelStats {
  const itemStats = new Map<string, ItemStats>(
    items.map(item => [item.key, { ...item, compared: 0, agreed: 0 }]),
  );
  const compared: Array<[string, string]> = [];
  let agreed = 0;
  let oneSided = 0;
  let excluded = 0;

  for (const pair of pairs) {
    const cls = classifyPair(pair, scale);
    if (cls === 'excluded') {
      excluded += 1;
      continue;
    }
    if (cls === 'one-sided') {
      oneSided += 1;
      continue;
    }
    const a = pair.a as string;
    const b = pair.b as string;
    compared.push([a, b]);
    const item = itemStats.get(pair.item);
    if (item) item.compared += 1;
    if (a === b) {
      agreed += 1;
      if (item) item.agreed += 1;
    }
  }

  let matrix: number[][] | null = null;
  if (scale && compared.length > 0) {
    const index = new Map(scale.map((c, i) => [c, i]));
    matrix = scale.map(() => Array(scale.length).fill(0));
    for (const [a, b] of compared) matrix[index.get(a)!][index.get(b)!] += 1;
  }

  return {
    scale,
    compared: compared.length,
    agreed,
    percentAgreement: compared.length > 0 ? (agreed / compared.length) * 100 : null,
    oneSided,
    excluded,
    kappa: scale && compared.length >= MIN_PAIRS_FOR_KAPPA ? weightedKappa(compared, scale) : null,
    matrix,
    items: Array.from(itemStats.values()),
  };
}
