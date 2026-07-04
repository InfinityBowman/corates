import { sql, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

/**
 * Case-insensitive (ASCII) literal substring match on a column.
 *
 * instr() instead of LIKE: some D1 nodes reject LIKE patterns longer than
 * ~50 chars with "LIKE or GLOB pattern too complex: SQLITE_ERROR", which
 * broke searches for long email addresses. instr() has no pattern limits
 * and does not treat % and _ in user input as wildcards.
 */
export function containsInsensitive(col: AnySQLiteColumn, term: string): SQL {
  return sql`instr(lower(${col}), ${term.toLowerCase()}) > 0`;
}
