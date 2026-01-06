/**
 * Tests for deduplication.js
 *
 * Tests study deduplication and merging logic.
 */

import { describe, it, expect } from 'vitest';
import { buildDeduplicatedStudies } from '../../useAddStudies/deduplication.js';

describe('deduplication', () => {
  describe('buildDeduplicatedStudies', () => {
    describe('single source deduplication', () => {
      it('returns empty array when all sources are empty', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [],
          selectedRefs: [],
          selectedLookups: [],
          driveFiles: [],
        });
        expect(result).toEqual([]);
      });

      it('includes uploaded PDFs with valid titles', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [
            { title: 'Test Study', doi: '10.1234/test', data: 'pdf-data', extracting: false },
          ],
          selectedRefs: [],
          selectedLookups: [],
          driveFiles: [],
        });
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Test Study');
        expect(result[0].pdfData).toBe('pdf-data');
      });

      it('excludes PDFs still extracting', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [
            { title: 'Test Study', doi: '10.1234/test', data: 'pdf-data', extracting: true },
          ],
          selectedRefs: [],
          selectedLookups: [],
          driveFiles: [],
        });
        expect(result).toHaveLength(0);
      });

      it('excludes PDFs with empty titles', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [{ title: '', doi: '10.1234/test', data: 'pdf-data', extracting: false }],
          selectedRefs: [],
          selectedLookups: [],
          driveFiles: [],
        });
        expect(result).toHaveLength(0);
      });

      it('includes selected refs with metadata', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [],
          selectedRefs: [
            {
              title: 'Reference Study',
              doi: '10.1234/ref',
              firstAuthor: 'Smith',
              publicationYear: 2024,
              journal: 'Test Journal',
            },
          ],
          selectedLookups: [],
          driveFiles: [],
        });
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Reference Study');
        expect(result[0].firstAuthor).toBe('Smith');
        expect(result[0].importSource).toBe('reference-file');
      });

      it('includes selected lookups', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [],
          selectedRefs: [],
          selectedLookups: [
            {
              title: 'Lookup Study',
              doi: '10.1234/lookup',
              firstAuthor: 'Jones',
              publicationYear: 2023,
            },
          ],
          driveFiles: [],
        });
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Lookup Study');
        expect(result[0].importSource).toBe('identifier-lookup');
      });

      it('includes Google Drive files', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [],
          selectedRefs: [],
          selectedLookups: [],
          driveFiles: [{ id: 'drive-123', name: 'Study.pdf' }],
        });
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Study');
        expect(result[0].googleDriveFileId).toBe('drive-123');
      });
    });

    describe('DOI-based deduplication', () => {
      it('merges entries with matching DOIs', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [
            { title: 'PDF Title', doi: '10.1234/test', data: 'pdf-data', extracting: false },
          ],
          selectedRefs: [
            {
              title: 'Reference Title',
              doi: '10.1234/test',
              firstAuthor: 'Smith',
              publicationYear: 2024,
            },
          ],
          selectedLookups: [],
          driveFiles: [],
        });
        expect(result).toHaveLength(1);
        expect(result[0].pdfData).toBe('pdf-data');
        expect(result[0].firstAuthor).toBe('Smith');
      });

      it('merges DOIs with different URL prefixes', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [
            { title: 'PDF Title', doi: '10.1234/test', data: 'pdf-data', extracting: false },
          ],
          selectedRefs: [
            {
              title: 'Reference Title',
              doi: 'https://doi.org/10.1234/test',
              firstAuthor: 'Smith',
            },
          ],
          selectedLookups: [],
          driveFiles: [],
        });
        expect(result).toHaveLength(1);
      });

      it('keeps entries with different DOIs separate', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [],
          selectedRefs: [
            { title: 'Study One', doi: '10.1234/one' },
            { title: 'Study Two', doi: '10.1234/two' },
          ],
          selectedLookups: [],
          driveFiles: [],
        });
        expect(result).toHaveLength(2);
      });
    });

    describe('title-based deduplication', () => {
      it('merges entries with matching normalized titles', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [
            { title: 'Test Study Title', doi: null, data: 'pdf-data', extracting: false },
          ],
          selectedRefs: [
            {
              title: 'Test Study Title',
              doi: null,
              firstAuthor: 'Smith',
            },
          ],
          selectedLookups: [],
          driveFiles: [],
        });
        expect(result).toHaveLength(1);
        expect(result[0].pdfData).toBe('pdf-data');
        expect(result[0].firstAuthor).toBe('Smith');
      });

      it('merges case-insensitive title matches', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [{ title: 'TEST STUDY', doi: null, data: 'pdf-data', extracting: false }],
          selectedRefs: [{ title: 'test study', doi: null, firstAuthor: 'Smith' }],
          selectedLookups: [],
          driveFiles: [],
        });
        expect(result).toHaveLength(1);
      });

      it('keeps entries with different titles separate', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [],
          selectedRefs: [
            { title: 'Study Alpha', doi: null },
            { title: 'Study Beta', doi: null },
          ],
          selectedLookups: [],
          driveFiles: [],
        });
        expect(result).toHaveLength(2);
      });
    });

    describe('merge priority rules', () => {
      it('prefers metadata from ref/lookup sources', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [
            { title: 'PDF Title', doi: '10.1234/test', data: 'pdf-data', extracting: false },
          ],
          selectedRefs: [
            {
              title: 'Better Reference Title',
              doi: '10.1234/test',
              firstAuthor: 'Smith',
              publicationYear: 2024,
              journal: 'Good Journal',
              abstract: 'Study abstract',
            },
          ],
          selectedLookups: [],
          driveFiles: [],
        });
        expect(result).toHaveLength(1);
        expect(result[0].firstAuthor).toBe('Smith');
        expect(result[0].publicationYear).toBe(2024);
        expect(result[0].journal).toBe('Good Journal');
      });

      it('combines PDF data with reference metadata', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [
            {
              title: 'Study',
              doi: '10.1234/test',
              data: 'pdf-data',
              file: { name: 'study.pdf' },
              extracting: false,
            },
          ],
          selectedRefs: [
            {
              title: 'Study',
              doi: '10.1234/test',
              firstAuthor: 'Smith',
            },
          ],
          selectedLookups: [],
          driveFiles: [],
        });
        expect(result).toHaveLength(1);
        expect(result[0].pdfData).toBe('pdf-data');
        expect(result[0].firstAuthor).toBe('Smith');
      });

      it('sets importSource to merged when multiple types combine', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [
            { title: 'Study', doi: '10.1234/test', data: 'pdf-data', extracting: false },
          ],
          selectedRefs: [{ title: 'Study', doi: '10.1234/test', firstAuthor: 'Smith' }],
          selectedLookups: [],
          driveFiles: [],
        });
        expect(result).toHaveLength(1);
        expect(result[0].importSource).toBe('merged');
      });
    });

    describe('complex scenarios', () => {
      it('handles multiple sources all matching same study', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [
            { title: 'Study', doi: '10.1234/test', data: 'pdf-data', extracting: false },
          ],
          selectedRefs: [{ title: 'Study', doi: '10.1234/test', firstAuthor: 'Smith' }],
          selectedLookups: [{ title: 'Study', doi: '10.1234/test', publicationYear: 2024 }],
          driveFiles: [],
        });
        expect(result).toHaveLength(1);
        expect(result[0].pdfData).toBe('pdf-data');
        expect(result[0].firstAuthor).toBe('Smith');
        expect(result[0].publicationYear).toBe(2024);
      });

      it('handles mix of matching and non-matching studies', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [
            { title: 'Study A', doi: '10.1234/a', data: 'pdf-a', extracting: false },
            { title: 'Study B', doi: '10.1234/b', data: 'pdf-b', extracting: false },
          ],
          selectedRefs: [
            { title: 'Study A', doi: '10.1234/a', firstAuthor: 'Smith' },
            { title: 'Study C', doi: '10.1234/c', firstAuthor: 'Jones' },
          ],
          selectedLookups: [],
          driveFiles: [],
        });
        expect(result).toHaveLength(3);
      });

      it('preserves Google Drive file ID through merge', () => {
        const result = buildDeduplicatedStudies({
          uploadedPdfs: [],
          selectedRefs: [{ title: 'My Study', doi: null, firstAuthor: 'Smith' }],
          selectedLookups: [],
          driveFiles: [{ id: 'drive-123', name: 'My Study.pdf' }],
        });
        expect(result).toHaveLength(1);
        expect(result[0].googleDriveFileId).toBe('drive-123');
        expect(result[0].firstAuthor).toBe('Smith');
      });
    });
  });
});
