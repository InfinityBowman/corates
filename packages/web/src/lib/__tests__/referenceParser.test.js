/**
 * Tests for referenceParser.js
 */

import { describe, it, expect } from 'vitest';
import { parseRIS, parseBibTeX, parseReferences, getRefDisplayName } from '../referenceParser.js';

describe('referenceParser', () => {
  describe('parseRIS', () => {
    it('parses a basic RIS entry', () => {
      const ris = `TY  - JOUR
TI  - Effect of sleep on cognitive performance
AU  - Smith, John
AU  - Doe, Jane
PY  - 2023
JO  - Sleep Medicine
AB  - This study examines the relationship between sleep and cognition.
DO  - 10.1234/sleep.2023.001
ER  - `;

      const refs = parseRIS(ris);
      expect(refs).toHaveLength(1);
      expect(refs[0].title).toBe('Effect of sleep on cognitive performance');
      expect(refs[0].firstAuthor).toBe('Smith');
      expect(refs[0].publicationYear).toBe(2023);
      expect(refs[0].journal).toBe('Sleep Medicine');
      expect(refs[0].doi).toBe('10.1234/sleep.2023.001');
    });

    it('parses multiple RIS entries', () => {
      const ris = `TY  - JOUR
TI  - First Study
AU  - Author, One
PY  - 2022
ER  - 
TY  - JOUR
TI  - Second Study
AU  - Author, Two
PY  - 2023
ER  - `;

      const refs = parseRIS(ris);
      expect(refs).toHaveLength(2);
      expect(refs[0].title).toBe('First Study');
      expect(refs[1].title).toBe('Second Study');
    });

    it('handles "First Last" author format', () => {
      const ris = `TY  - JOUR
TI  - Test Study
AU  - John Smith
PY  - 2024
ER  - `;

      const refs = parseRIS(ris);
      expect(refs[0].firstAuthor).toBe('Smith');
    });

    it('extracts year from date format', () => {
      const ris = `TY  - JOUR
TI  - Test Study
AU  - Test Author
DA  - 2024/05/15
ER  - `;

      const refs = parseRIS(ris);
      expect(refs[0].publicationYear).toBe(2024);
    });
  });

  describe('parseBibTeX', () => {
    it('parses a basic BibTeX entry', () => {
      const bibtex = `@article{smith2023,
  title = {Effect of exercise on health},
  author = {Smith, John and Doe, Jane},
  year = {2023},
  journal = {Health Journal},
  doi = {10.5678/health.2023.002}
}`;

      const refs = parseBibTeX(bibtex);
      expect(refs).toHaveLength(1);
      expect(refs[0].title).toBe('Effect of exercise on health');
      expect(refs[0].firstAuthor).toBe('Smith');
      expect(refs[0].publicationYear).toBe(2023);
    });

    it('parses multiple BibTeX entries', () => {
      const bibtex = `@article{one2022,
  title = {First Article},
  author = {One, Author},
  year = {2022}
}

@book{two2023,
  title = {Second Book},
  author = {Two, Author},
  year = {2023}
}`;

      const refs = parseBibTeX(bibtex);
      expect(refs).toHaveLength(2);
    });
  });

  describe('parseReferences', () => {
    it('auto-detects RIS format', () => {
      const content = `TY  - JOUR
TI  - Auto Detected Study
AU  - Test, Author
PY  - 2024
ER  - `;

      const refs = parseReferences(content, 'unknown.txt');
      expect(refs).toHaveLength(1);
      expect(refs[0].title).toBe('Auto Detected Study');
    });

    it('auto-detects BibTeX format', () => {
      const content = `@article{test,
  title = {Auto Detected Article},
  author = {Test Author},
  year = {2024}
}`;

      const refs = parseReferences(content, 'unknown.txt');
      expect(refs).toHaveLength(1);
      expect(refs[0].title).toBe('Auto Detected Article');
    });

    it('uses extension hint for .ris files', () => {
      const content = `TY  - JOUR
TI  - Test
AU  - Author
ER  - `;

      const refs = parseReferences(content, 'export.ris');
      expect(refs).toHaveLength(1);
    });

    it('uses extension hint for .bib files', () => {
      const content = `@article{test, title={Test}, author={Author}, year={2024}}`;

      const refs = parseReferences(content, 'library.bib');
      expect(refs).toHaveLength(1);
    });
  });

  describe('getRefDisplayName', () => {
    it('formats author and year correctly', () => {
      const ref = { firstAuthor: 'Smith', publicationYear: 2023 };
      expect(getRefDisplayName(ref)).toBe('Smith (2023)');
    });

    it('handles missing author', () => {
      const ref = { firstAuthor: null, publicationYear: 2023 };
      expect(getRefDisplayName(ref)).toBe('Unknown (2023)');
    });

    it('handles missing year', () => {
      const ref = { firstAuthor: 'Smith', publicationYear: null };
      expect(getRefDisplayName(ref)).toBe('Smith (n.d.)');
    });

    it('handles both missing', () => {
      const ref = {};
      expect(getRefDisplayName(ref)).toBe('Unknown (n.d.)');
    });
  });
});
