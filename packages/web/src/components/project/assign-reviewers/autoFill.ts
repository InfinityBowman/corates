/**
 * Auto-fill for reviewer slots: each empty slot goes to whoever is furthest
 * below their share of the work.
 */

export interface ReviewerSlots {
  reviewer1: string | null;
  reviewer2: string | null;
}

export type SlotRows = Record<string, ReviewerSlots>;

export interface AutoFillOptions {
  memberIds: string[];
  /** Studies each member already reviews outside `rows`. */
  baseLoad?: Record<string, number>;
  /** Relative share per member; missing means 1, zero leaves them out. */
  weights?: Record<string, number>;
  random?: () => number;
}

/** Studies per member across `rows`, added to `baseLoad`. */
export function countLoad(
  rows: SlotRows,
  baseLoad: Record<string, number>,
): Record<string, number> {
  const load = { ...baseLoad };
  for (const slots of Object.values(rows)) {
    for (const id of [slots.reviewer1, slots.reviewer2]) {
      if (id) load[id] = (load[id] ?? 0) + 1;
    }
  }
  return load;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Fills every empty slot without touching filled ones or repeating a person
 * on a row. Ties break by a per-call shuffle so refills vary.
 */
export function autoFillSlots(rows: SlotRows, options: AutoFillOptions): SlotRows {
  const { baseLoad = {}, weights = {}, random = Math.random } = options;
  const memberIds = options.memberIds.filter(id => (weights[id] ?? 1) > 0);
  if (memberIds.length === 0) return rows;

  const priority = new Map(shuffle(memberIds, random).map((id, index) => [id, index]));
  const load = countLoad(rows, baseLoad);
  const totalWeight = memberIds.reduce((sum, id) => sum + (weights[id] ?? 1), 0);
  let total = memberIds.reduce((sum, id) => sum + (load[id] ?? 0), 0);
  const next: SlotRows = {};

  // Weighted round-robin by deficit lands exact splits like 50/25/25; a plain
  // load-per-share comparison drifts on ties.
  const deficit = (id: string) =>
    ((weights[id] ?? 1) / totalWeight) * (total + 1) - (load[id] ?? 0);

  const pick = (exclude: string | null): string | null => {
    let best: string | null = null;
    for (const id of memberIds) {
      if (id === exclude) continue;
      if (
        best === null ||
        deficit(id) > deficit(best) ||
        (deficit(id) === deficit(best) && priority.get(id)! < priority.get(best)!)
      ) {
        best = id;
      }
    }
    if (best) {
      load[best] = (load[best] ?? 0) + 1;
      total++;
    }
    return best;
  };

  for (const [studyId, slots] of Object.entries(rows)) {
    const reviewer1 = slots.reviewer1 ?? pick(slots.reviewer2);
    const reviewer2 = slots.reviewer2 ?? pick(reviewer1);
    next[studyId] = { reviewer1, reviewer2 };
  }
  return next;
}
