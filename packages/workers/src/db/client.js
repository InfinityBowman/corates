import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema.js';

/**
 * Create a Drizzle client instance from the D1 binding
 * @param {D1Database} d1 - The D1 database binding from env
 * @returns {DrizzleD1Database} Drizzle client instance
 */
export function createDb(d1) {
  return drizzle(d1, { schema });
}
