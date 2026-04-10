/**
 * Shared matching utilities for PDF-to-reference matching
 * Used by both PDF uploads and reference imports to deduplicate matching logic
 */

import { normalizeTitle } from '@/lib/pdfUtils.js';

interface Matchable {
  doi?: string | null;
  title?: string | null;
}

/**
 * Normalize a DOI string for comparison
 */
export function normalizeDoi(doi: string | null | undefined): string | null {
  if (!doi) return null;
  return doi
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .trim();
}

/**
 * Check if two entries match by DOI or normalized title
 */
export function entriesMatch(a: Matchable, b: Matchable): boolean {
  const aDoi = normalizeDoi(a.doi);
  const bDoi = normalizeDoi(b.doi);

  // Match by DOI if both have one
  if (aDoi && bDoi && aDoi === bDoi) {
    return true;
  }

  // Match by normalized title
  const aTitleNorm = a.title ? normalizeTitle(a.title) : null;
  const bTitleNorm = b.title ? normalizeTitle(b.title) : null;
  if (aTitleNorm && bTitleNorm && aTitleNorm === bTitleNorm) {
    return true;
  }

  return false;
}

/**
 * Find a matching reference for a PDF in a list of references
 */
export function findMatchingRef<T extends Matchable>(
  entry: Matchable,
  refs: T[],
  filter: (ref: T) => boolean = () => true,
): T | null {
  for (const ref of refs) {
    if (!filter(ref)) continue;
    if (entriesMatch(entry, ref)) {
      return ref;
    }
  }
  return null;
}
