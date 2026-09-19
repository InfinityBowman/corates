import { CARRY_OVER_SECTIONS, type CarryOverSection } from '../checklists/carry-over.js';
import { defaultAnswerRows } from './answer-rows.js';
import type { ChecklistType } from './schema.js';

export type CopyBlocker = 'source-empty' | 'target-answered' | 'mismatch';

export interface CopyPlanEntry {
  section: CarryOverSection;
  keys: string[];
  /** Null when the section will copy. */
  blocker: CopyBlocker | null;
}

export function carryOverSections(type: ChecklistType): CarryOverSection[] {
  return type === 'AMSTAR2' ? [] : CARRY_OVER_SECTIONS[type];
}

function sectionKeys(section: CarryOverSection, defaults: Record<string, unknown>): string[] {
  return Object.keys(defaults).filter(
    key => section.keys?.includes(key) || section.prefixes?.some(prefix => key.startsWith(prefix)),
  );
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Which of the requested sections copy from `source` into `target`, and why
 * the rest do not. Shared by `checklist.copyAnswers` and the menu offering
 * it, so the two cannot disagree about what a click will do. A section only
 * copies into a blank target; a `requiresMatch` key is compared against the
 * value the target will hold once the other copying sections have landed.
 */
export function planAnswerCopy(
  type: ChecklistType,
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  sectionIds?: string[],
): CopyPlanEntry[] {
  const defaults = defaultAnswerRows(type);
  const entries: CopyPlanEntry[] = carryOverSections(type)
    .filter(section => !sectionIds || sectionIds.includes(section.id))
    .map(section => {
      const keys = sectionKeys(section, defaults);
      let blocker: CopyBlocker | null = null;
      if (keys.every(key => same(source[key] ?? defaults[key], defaults[key]))) {
        blocker = 'source-empty';
      } else if (keys.some(key => !same(target[key] ?? defaults[key], defaults[key]))) {
        blocker = 'target-answered';
      }
      return { section, keys, blocker };
    });

  const copied = new Set(entries.filter(entry => !entry.blocker).flatMap(entry => entry.keys));
  for (const entry of entries) {
    if (entry.blocker || !entry.section.requiresMatch) continue;
    const mismatch = entry.section.requiresMatch.some(key => {
      const effective = copied.has(key) ? source[key] : target[key];
      return !same(effective, source[key]);
    });
    if (mismatch) entry.blocker = 'mismatch';
  }
  return entries;
}
