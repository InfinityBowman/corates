import { z } from 'zod';

// One-time UI hints a user has dismissed. Keyed by name so every hint shares
// the same preferences field; add new hints here so the server can reject
// anything else.
export const HINT_IDS = ['studiesExplainer'] as const;
export type HintId = (typeof HINT_IDS)[number];

// Loose so keys the column already anticipates (theme, notifications) survive
// a read-merge-write from code that does not know about them yet.
export const userPreferencesSchema = z.looseObject({
  dismissedHints: z.array(z.string()).default([]),
});
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

const EMPTY: UserPreferences = { dismissedHints: [] };

// The column is raw JSON text; anything unreadable counts as no preferences set
export function parseUserPreferences(raw: unknown): UserPreferences {
  if (typeof raw !== 'string' || raw === '') return EMPTY;
  try {
    const result = userPreferencesSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : EMPTY;
  } catch {
    return EMPTY;
  }
}
