/**
 * Tests for matching.js
 *
 * Tests DOI normalization and reference matching utilities.
 */

import { describe, it, expect } from 'vitest';
import { normalizeDoi, entriesMatch, findMatchingRef } from '../../useAddStudies/matching.js';

describe('matching', () => {
  describe('normalizeDoi', () => {
    describe('basic normalization', () => {
      it('returns lowercase raw DOI', () => {
        expect(normalizeDoi('10.1234/TEST')).toBe('10.1234/test');
      });

      it('returns null for null input', () => {
        expect(normalizeDoi(null)).toBeNull();
      });

      it('returns null for undefined input', () => {
        expect(normalizeDoi(undefined)).toBeNull();
      });

      it('returns null for empty string', () => {
        expect(normalizeDoi('')).toBeNull();
      });
    });

    describe('URL prefix stripping', () => {
      it('strips https://doi.org/ prefix', () => {
        expect(normalizeDoi('https://doi.org/10.1234/test')).toBe('10.1234/test');
      });

      it('strips http://doi.org/ prefix', () => {
        expect(normalizeDoi('http://doi.org/10.1234/test')).toBe('10.1234/test');
      });

      it('strips https://dx.doi.org/ prefix', () => {
        expect(normalizeDoi('https://dx.doi.org/10.1234/test')).toBe('10.1234/test');
      });

      it('strips http://dx.doi.org/ prefix', () => {
        expect(normalizeDoi('http://dx.doi.org/10.1234/test')).toBe('10.1234/test');
      });
    });

    describe('case insensitivity', () => {
      it('converts to lowercase', () => {
        expect(normalizeDoi('10.1234/ABC')).toBe('10.1234/abc');
      });

      it('handles uppercase URL prefix', () => {
        expect(normalizeDoi('HTTPS://DOI.ORG/10.1234/test')).toBe('10.1234/test');
      });
    });

    describe('whitespace handling', () => {
      it('trims leading whitespace', () => {
        expect(normalizeDoi('  10.1234/test')).toBe('10.1234/test');
      });

      it('trims trailing whitespace', () => {
        expect(normalizeDoi('10.1234/test  ')).toBe('10.1234/test');
      });
    });

    describe('edge cases', () => {
      it('handles DOI with special characters', () => {
        expect(normalizeDoi('10.1234/test-article_v2.1')).toBe('10.1234/test-article_v2.1');
      });

      it('handles DOI with parentheses', () => {
        expect(normalizeDoi('10.1234/test(2024)1234')).toBe('10.1234/test(2024)1234');
      });
    });
  });

  describe('entriesMatch', () => {
    describe('DOI matching', () => {
      it('returns true for matching DOIs', () => {
        const entry1 = { doi: '10.1234/test', title: 'Title A' };
        const entry2 = { doi: '10.1234/test', title: 'Title B' };
        expect(entriesMatch(entry1, entry2)).toBe(true);
      });

      it('returns true for matching DOIs with different URL prefixes', () => {
        const entry1 = { doi: '10.1234/test' };
        const entry2 = { doi: 'https://doi.org/10.1234/test' };
        expect(entriesMatch(entry1, entry2)).toBe(true);
      });

      it('returns true for matching DOIs case insensitively', () => {
        const entry1 = { doi: '10.1234/TEST' };
        const entry2 = { doi: '10.1234/test' };
        expect(entriesMatch(entry1, entry2)).toBe(true);
      });

      it('returns false for different DOIs', () => {
        const entry1 = { doi: '10.1234/test1' };
        const entry2 = { doi: '10.1234/test2' };
        expect(entriesMatch(entry1, entry2)).toBe(false);
      });
    });

    describe('title matching', () => {
      it('returns true for matching titles when no DOI', () => {
        const entry1 = { title: 'Test Study Title', doi: null };
        const entry2 = { title: 'Test Study Title', doi: null };
        expect(entriesMatch(entry1, entry2)).toBe(true);
      });

      it('returns true for matching titles case insensitively', () => {
        const entry1 = { title: 'TEST STUDY TITLE', doi: null };
        const entry2 = { title: 'test study title', doi: null };
        expect(entriesMatch(entry1, entry2)).toBe(true);
      });

      it('returns false for different titles when no DOI', () => {
        const entry1 = { title: 'Title A', doi: null };
        const entry2 = { title: 'Title B', doi: null };
        expect(entriesMatch(entry1, entry2)).toBe(false);
      });
    });

    describe('priority rules', () => {
      it('DOI match takes priority over title mismatch', () => {
        const entry1 = { doi: '10.1234/test', title: 'Title A' };
        const entry2 = { doi: '10.1234/test', title: 'Title B' };
        expect(entriesMatch(entry1, entry2)).toBe(true);
      });

      it('falls back to title when neither has DOI', () => {
        const entry1 = { doi: null, title: 'Test Title' };
        const entry2 = { doi: null, title: 'Test Title' };
        expect(entriesMatch(entry1, entry2)).toBe(true);
      });

      it('returns false when one has DOI and other does not (no title match)', () => {
        const entry1 = { doi: '10.1234/test', title: 'Title A' };
        const entry2 = { doi: null, title: 'Title B' };
        expect(entriesMatch(entry1, entry2)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('returns false for entries with only DOI (different)', () => {
        const entry1 = { doi: '10.1234/test1' };
        const entry2 = { doi: '10.1234/test2' };
        expect(entriesMatch(entry1, entry2)).toBe(false);
      });

      it('returns true for entries with only matching DOI', () => {
        const entry1 = { doi: '10.1234/test' };
        const entry2 = { doi: '10.1234/test' };
        expect(entriesMatch(entry1, entry2)).toBe(true);
      });

      it('returns true for entries with only matching title', () => {
        const entry1 = { title: 'Test Title' };
        const entry2 = { title: 'Test Title' };
        expect(entriesMatch(entry1, entry2)).toBe(true);
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
      it('finds reference with matching DOI', () => {
        const entry = { doi: '10.1234/test2' };
        const result = findMatchingRef(entry, references);
        expect(result).toBeDefined();
        expect(result.id).toBe('ref-2');
      });

      it('finds reference with matching DOI URL', () => {
        const entry = { doi: 'https://doi.org/10.1234/test1' };
        const result = findMatchingRef(entry, references);
        expect(result).toBeDefined();
        expect(result.id).toBe('ref-1');
      });

      it('returns null when no DOI matches', () => {
        const entry = { doi: '10.1234/nonexistent' };
        const result = findMatchingRef(entry, references);
        expect(result).toBeNull();
      });
    });

    describe('title-based matching', () => {
      it('finds reference with matching title when no DOI', () => {
        const entry = { title: 'Title Three' };
        const result = findMatchingRef(entry, references);
        expect(result).toBeDefined();
        expect(result.id).toBe('ref-3');
      });

      it('finds reference with case-insensitive title match', () => {
        const entry = { title: 'TITLE ONE' };
        const result = findMatchingRef(entry, references);
        expect(result).toBeDefined();
        expect(result.id).toBe('ref-1');
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
        expect(result.id).toBe('ref-a');
      });

      it('respects filter parameter', () => {
        const entry = { doi: '10.1234/test1' };
        // Filter out ref-1
        const result = findMatchingRef(entry, references, ref => ref.id !== 'ref-1');
        expect(result).toBeNull();
      });
    });

    describe('integration scenarios', () => {
      it('matches PDF metadata to imported reference by DOI', () => {
        const pdfMetadata = {
          doi: '10.1234/test4',
          title: 'Extracted PDF Title', // Different from ref title
        };
        const result = findMatchingRef(pdfMetadata, references);
        expect(result).toBeDefined();
        expect(result.id).toBe('ref-4');
      });

      it('matches user input to reference library', () => {
        const userInput = {
          doi: null,
          title: 'title two', // Case different
        };
        const result = findMatchingRef(userInput, references);
        expect(result).toBeDefined();
        expect(result.id).toBe('ref-2');
      });
    });
  });
});
