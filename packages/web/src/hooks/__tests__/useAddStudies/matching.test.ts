/**
 * Tests for matching.js
 *
 * Tests DOI normalization and reference matching utilities.
 */

import { describe, it, expect } from 'vitest';
import { normalizeDoi, entriesMatch, findMatchingRef } from '../../useAddStudies/matching';

describe('matching', () => {
  describe('normalizeDoi', () => {
    it.each([
      ['10.1234/TEST', '10.1234/test'],
      ['https://doi.org/10.1234/test', '10.1234/test'],
      ['http://dx.doi.org/10.1234/test', '10.1234/test'],
      ['HTTPS://DOI.ORG/10.1234/test', '10.1234/test'],
      ['  10.1234/test  ', '10.1234/test'],
      ['10.1234/test-article_v2.1', '10.1234/test-article_v2.1'],
      ['10.1234/test(2024)1234', '10.1234/test(2024)1234'],
    ])('normalizes %s to %s', (input, expected) => {
      expect(normalizeDoi(input)).toBe(expected);
    });

    it.each([null, undefined, ''])('returns null for %s', input => {
      expect(normalizeDoi(input)).toBeNull();
    });
  });

  describe('entriesMatch', () => {
    describe('DOI matching', () => {
      it('matches when both DOIs normalize to the same value', () => {
        expect(
          entriesMatch(
            { doi: '10.1234/test', title: 'Title A' },
            { doi: '10.1234/test', title: 'Title B' },
          ),
        ).toBe(true);
        expect(entriesMatch({ doi: '10.1234/test' }, { doi: 'https://doi.org/10.1234/test' })).toBe(
          true,
        );
        expect(entriesMatch({ doi: '10.1234/TEST' }, { doi: '10.1234/test' })).toBe(true);
      });

      it('returns false for different DOIs', () => {
        const entry1 = { doi: '10.1234/test1' };
        const entry2 = { doi: '10.1234/test2' };
        expect(entriesMatch(entry1, entry2)).toBe(false);
      });
    });

    describe('title matching', () => {
      it('matches titles case-insensitively when neither has a DOI', () => {
        expect(
          entriesMatch(
            { title: 'Test Study Title', doi: null },
            { title: 'Test Study Title', doi: null },
          ),
        ).toBe(true);
        expect(
          entriesMatch(
            { title: 'TEST STUDY TITLE', doi: null },
            { title: 'test study title', doi: null },
          ),
        ).toBe(true);
      });

      it('returns false for different titles when no DOI', () => {
        const entry1 = { title: 'Title A', doi: null };
        const entry2 = { title: 'Title B', doi: null };
        expect(entriesMatch(entry1, entry2)).toBe(false);
      });
    });

    describe('priority rules', () => {
      it('returns false when one has DOI and other does not (no title match)', () => {
        const entry1 = { doi: '10.1234/test', title: 'Title A' };
        const entry2 = { doi: null, title: 'Title B' };
        expect(entriesMatch(entry1, entry2)).toBe(false);
      });
    });
  });

  describe('findMatchingRef', () => {
    const references = [
      { id: 'ref-1', doi: '10.1234/test1', title: 'Title One' },
      { id: 'ref-2', doi: '10.1234/test2', title: 'Title Two' },
      { id: 'ref-3', doi: null, title: 'Title Three' },
      { id: 'ref-4', doi: '10.1234/test4', title: 'Title Four' },
    ];

    describe('DOI-based matching', () => {
      it('finds reference with matching DOI, including URL-prefixed forms', () => {
        expect(findMatchingRef({ doi: '10.1234/test2' }, references)!.id).toBe('ref-2');
        expect(findMatchingRef({ doi: 'https://doi.org/10.1234/test1' }, references)!.id).toBe(
          'ref-1',
        );
      });

      it('returns null when no DOI matches', () => {
        const entry = { doi: '10.1234/nonexistent' };
        const result = findMatchingRef(entry, references);
        expect(result).toBeNull();
      });
    });

    describe('title-based matching', () => {
      it('finds reference with matching title when no DOI, case-insensitively', () => {
        expect(findMatchingRef({ title: 'Title Three' }, references)!.id).toBe('ref-3');
        expect(findMatchingRef({ title: 'TITLE ONE' }, references)!.id).toBe('ref-1');
      });

      it('returns null when no title matches', () => {
        const entry = { title: 'Nonexistent Title' };
        const result = findMatchingRef(entry, references);
        expect(result).toBeNull();
      });
    });

    describe('edge cases', () => {
      it('returns null for empty references array', () => {
        const entry = { doi: '10.1234/test1' };
        const result = findMatchingRef(entry, []);
        expect(result).toBeNull();
      });

      it('returns first match when multiple could match', () => {
        const duplicateRefs = [
          { id: 'ref-a', doi: '10.1234/same', title: 'Same Title' },
          { id: 'ref-b', doi: '10.1234/same', title: 'Same Title' },
        ];
        const entry = { doi: '10.1234/same' };
        const result = findMatchingRef(entry, duplicateRefs);
        expect(result!.id).toBe('ref-a');
      });

      it('respects filter parameter', () => {
        const entry = { doi: '10.1234/test1' };
        // Filter out ref-1
        const result = findMatchingRef(entry, references, ref => ref.id !== 'ref-1');
        expect(result).toBeNull();
      });
    });
  });
});
