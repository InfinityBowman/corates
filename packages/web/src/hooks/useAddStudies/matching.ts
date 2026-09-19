/**
 * Shared matching utilities for PDF-to-reference matching
 * Used by both PDF uploads and reference imports to deduplicate matching logic
 */

import { normalizeTitle } from '@/lib/pdfUtils.js';

export interface Matchable {
  doi?: string | null;
  title?: string | null;
  /** Byte size of the PDF behind this entry, when there is one. */
  fileSize?: number | null;
}

/** How two entries were found to be the same paper. */
export type MatchKind = 'doi' | 'file' | 'title' | 'title-substring';

/** Extracted titles that name a publisher, not a paper, and so repeat across unrelated papers. */
const BOILERPLATE =
  /^(untitled|preview summary|open access|research(\s+(report|article|open access))?|original (research|article)|review article|abstract|copyright|clinical trial protocol|supplementary|foreword|report)\b/i;

/** Titles that are really the typesetter's file name. */
const TYPESETTER =
  /^(microsoft word\b|hrev_|[a-z]+[_-]\d)|\.(docx?|pdf|indd|qxd|tex)\b|\d+\s*\.\.\s*\d+\s*$/i;

/** Letter-spaced headings ("RE S E AR C H RE P O R T") collapse to their real words. */
function deSpace(title: string): string {
  return title.replace(/\b(\w) (?=\w\b)/g, '$1');
}

/**
 * Whether a title is too generic to identify a paper by. The shortest real title in the
 * production corpus is 9 words / 57 characters, so the floors below reject only boilerplate.
 */
export function isWeakTitle(title: string | null | undefined): boolean {
  if (!title) return true;

  const normalized = normalizeTitle(title);
  if (normalized.length < 25 || normalized.split(' ').length < 5) return true;
  if (BOILERPLATE.test(normalized) || BOILERPLATE.test(normalizeTitle(deSpace(title)))) return true;

  const trimmed = title.trim();
  if (TYPESETTER.test(trimmed)) return true;
  if ((trimmed.match(/\d/g)?.length ?? 0) > trimmed.length * 0.25) return true;
  if (/^(www\.|https?:\/\/)|©|\ball rights reserved\b/i.test(trimmed)) return true;
  // Journal running heads, e.g. "International Journal of ... (www.example.org)".
  if (/www\.|\bissn\b/i.test(trimmed) || /^(the\s+)?[a-z ]*\bjournal of\b/i.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * A DOI lookup knows the paper's real title, but the page may have given a better one than
 * the lookup's, so prefer the published title only when the page gave nothing usable or the
 * published title continues what the page gave.
 */
export function preferPublishedTitle(extracted: string, published: string | undefined): string {
  if (!published?.trim()) return extracted;
  const publishedNorm = normalizeTitle(published);
  if (!publishedNorm) return extracted;
  if (isWeakTitle(extracted)) return published.trim();
  return publishedNorm.includes(normalizeTitle(extracted)) ? published.trim() : extracted;
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
 * How two entries match, or null when they are different papers.
 */
export function matchEntries(a: Matchable, b: Matchable): MatchKind | null {
  const aDoi = normalizeDoi(a.doi);
  const bDoi = normalizeDoi(b.doi);
  // Two DOIs settle it either way: different DOIs are different papers, whatever the titles say.
  if (aDoi && bDoi) return aDoi === bDoi ? 'doi' : null;

  if (a.fileSize && b.fileSize && a.fileSize === b.fileSize) return 'file';

  if (isWeakTitle(a.title) || isWeakTitle(b.title)) return null;

  const aTitle = normalizeTitle(a.title);
  const bTitle = normalizeTitle(b.title);
  if (aTitle === bTitle) return 'title';

  // A wrapped title arrives truncated and a study named from a file name reads
  // "Author Year- <title>", so in both cases the shorter sits inside the longer.
  const [shorter, longer] = aTitle.length <= bTitle.length ? [aTitle, bTitle] : [bTitle, aTitle];
  if (shorter.length >= 40 && longer.includes(shorter)) return 'title-substring';

  return null;
}

/**
 * Check if two entries are the same paper
 */
export function entriesMatch(a: Matchable, b: Matchable): boolean {
  return matchEntries(a, b) !== null;
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
