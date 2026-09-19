/**
 * Matching staged studies against the studies a project already holds. A match is flagged,
 * never acted on: reviewers legitimately add one paper twice, one study per site it reports.
 */

import { matchEntries, type MatchKind } from './matching';
import type { MergedStudy } from './deduplication';

export interface ExistingStudy {
  id: string;
  title: string | null;
  doi: string | null;
  /** Byte sizes of the PDFs attached to the study. */
  fileSizes: number[];
}

export interface ExistingMatch {
  studyId: string;
  studyTitle: string;
  kind: MatchKind;
}

/** The first study in the project that is the same paper as `staged`. */
export function findExistingMatch(
  staged: Pick<MergedStudy, 'title' | 'doi' | 'fileSize'>,
  existing: ExistingStudy[],
): ExistingMatch | null {
  for (const study of existing) {
    const sizes = study.fileSizes.length > 0 ? study.fileSizes : [null];
    for (const fileSize of sizes) {
      const kind = matchEntries(staged, {
        title: study.title,
        doi: study.doi,
        fileSize,
      });
      if (kind) {
        return { studyId: study.id, studyTitle: study.title || 'Untitled study', kind };
      }
    }
  }
  return null;
}

/** Why a staged study is flagged, in the reviewer's words. */
export function describeMatch(match: ExistingMatch): string {
  switch (match.kind) {
    case 'doi':
      return 'Same DOI as a study already in this project';
    case 'file':
      return 'Same file as a study already in this project';
    default:
      return 'Same title as a study already in this project';
  }
}
