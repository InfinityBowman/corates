/**
 * Shared matching utilities for PDF-to-reference matching
 * Used by both PDF uploads and reference imports to deduplicate matching logic
 */

import { normalizeTitle } from '@/lib/pdfUtils.js';

/**
 * Normalize a DOI string for comparison
 * @param {string} doi
 * @returns {string|null}
 */
export function normalizeDoi(doi) {
  if (!doi) return null;
  return doi
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .trim();
}

/**
 * Check if two entries match by DOI or normalized title
 * @param {Object} a - First entry with doi and title
 * @param {Object} b - Second entry with doi and title
 * @returns {boolean}
 */
export function entriesMatch(a, b) {
  const aDoi = normalizeDoi(a.doi);
  const bDoi = normalizeDoi(b.doi);

  // Match by DOI if both have one
  if (aDoi && bDoi && aDoi === bDoi) {
    return true;
  }

  // Match by normalized title
  const aTitleNorm = normalizeTitle(a.title);
  const bTitleNorm = normalizeTitle(b.title);
  if (aTitleNorm && bTitleNorm && aTitleNorm === bTitleNorm) {
    return true;
  }

  return false;
}

/**
 * Find a matching reference for a PDF in a list of references
 * @param {Object} entry - Entry with doi and title to match
 * @param {Array} refs - Array of reference objects to search
 * @param {Function} [filter] - Optional filter predicate for refs
 * @returns {Object|null} Matching reference or null
 */
export function findMatchingRef(entry, refs, filter = () => true) {
  for (const ref of refs) {
    if (!filter(ref)) continue;
    if (entriesMatch(entry, ref)) {
      return ref;
    }
  }
  return null;
}
