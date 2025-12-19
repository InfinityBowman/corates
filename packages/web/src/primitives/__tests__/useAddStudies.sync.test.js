/**
 * Tests for useAddStudies sync functionality
 *
 * This test suite validates critical sync behaviors:
 * 1. PDF matching with lookup refs (DOI and title-based)
 * 2. PDF matching with imported refs from reference files
 * 3. Deduplication in getStudiesToSubmit
 * 4. Collect mode effect synchronization
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot, createSignal } from 'solid-js';
import { useAddStudies } from '../useAddStudies';

// Mock dependencies
vi.mock('@corates/ui', () => ({
  showToast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/pdfUtils.js', () => ({
  extractPdfTitle: vi.fn(),
  extractPdfDoi: vi.fn(),
  normalizeTitle: title => {
    if (!title) return '';
    return title
      .toLowerCase()
      .trim()
      .replaceAll(/[^a-z0-9]/g, '');
  },
  readFileAsArrayBuffer: vi.fn(),
  withTimeout: (promise, _ms, _operationName) => promise, // Pass through the promise without timeout in tests
}));

vi.mock('@/lib/referenceParser.js', () => ({
  parseReferenceFile: vi.fn(),
  separateFileTypes: vi.fn(),
}));

vi.mock('@/lib/referenceLookup.js', () => ({
  fetchReferenceByIdentifier: vi.fn(),
  parseIdentifiers: vi.fn(),
  checkPdfAvailability: vi.fn(),
  fetchFromDOI: vi.fn(),
}));

// Helper to create mock PDF files
const createMockPdfFile = name => {
  return new File(['mock pdf content'], name, { type: 'application/pdf' });
};

// Helper to create mock reference file
const createMockReferenceFile = name => {
  return new File(['mock reference content'], name, {
    type: 'application/x-research-info-systems',
  });
};

// Helper to create mock ArrayBuffer
const createMockArrayBuffer = (content = 'mock data') => {
  const encoder = new TextEncoder();
  return encoder.encode(content).buffer;
};

describe('useAddStudies - PDF Sync with Lookup Refs', () => {
  let dispose;

  afterEach(() => {
    if (dispose) dispose();
    vi.clearAllMocks();
  });

  it('should match uploaded PDFs to lookup refs by DOI', async () => {
    const { extractPdfTitle, extractPdfDoi, readFileAsArrayBuffer } =
      await import('@/lib/pdfUtils.js');

    const { fetchReferenceByIdentifier, parseIdentifiers, fetchFromDOI } =
      await import('@/lib/referenceLookup.js');

    // Mock fetchFromDOI for background metadata fetch
    fetchFromDOI.mockResolvedValue(null);

    await createRoot(async d => {
      dispose = d;

      const hook = useAddStudies();

      // First, add a lookup ref via DOI lookup
      const mockRefData = {
        title: 'Important Study About Cats',
        doi: '10.1234/cats.2024',
        pdfAvailable: false, // No PDF initially
        pdfAccessible: false,
        firstAuthor: 'Smith',
        publicationYear: 2024,
        authors: ['Smith, J.'],
        journal: 'Nature',
      };

      parseIdentifiers.mockReturnValue(['10.1234/cats.2024']);
      fetchReferenceByIdentifier.mockResolvedValue(mockRefData);

      hook.setIdentifierInput('10.1234/cats.2024');
      await hook.handleLookup();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify lookup ref was added
      expect(hook.lookupRefs().length).toBe(1);
      expect(hook.lookupRefs()[0].title).toBe('Important Study About Cats');

      // Now upload a PDF with matching DOI
      const pdfFile = createMockPdfFile('study.pdf');
      const mockArrayBuffer = createMockArrayBuffer();

      readFileAsArrayBuffer.mockResolvedValue(mockArrayBuffer);
      extractPdfTitle.mockResolvedValue('Important Study About Cats');
      extractPdfDoi.mockResolvedValue('10.1234/cats.2024');

      await hook.handlePdfSelect([pdfFile]);

      // Wait for async processing and effect
      await new Promise(resolve => setTimeout(resolve, 150));

      // The lookup ref should now have the PDF data attached
      const lookupRefs = hook.lookupRefs();
      expect(lookupRefs[0].manualPdfData).toBe(mockArrayBuffer);
      expect(lookupRefs[0].manualPdfFileName).toBe('study.pdf');
      expect(lookupRefs[0].pdfAvailable).toBe(true);
      expect(lookupRefs[0].matchedFromUpload).toBe(true);

      // The uploaded PDF should be marked as matched
      expect(hook.uploadedPdfs[0].matchedToRef).toBeDefined();

      // The lookup ref should be auto-selected
      expect(hook.selectedLookupIds().has(lookupRefs[0]._id)).toBe(true);
    });
  });

  it('should match uploaded PDFs to lookup refs by normalized title', async () => {
    const { extractPdfTitle, extractPdfDoi, readFileAsArrayBuffer } =
      await import('@/lib/pdfUtils.js');

    const { fetchReferenceByIdentifier, parseIdentifiers } =
      await import('@/lib/referenceLookup.js');

    await createRoot(async d => {
      dispose = d;

      const hook = useAddStudies();

      // Add a lookup ref without DOI
      const mockRefData = {
        title: 'Machine Learning for Healthcare',
        doi: null,
        pdfAvailable: false,
        pdfAccessible: false,
      };

      parseIdentifiers.mockReturnValue(['PMID:12345']);
      fetchReferenceByIdentifier.mockResolvedValue(mockRefData);

      hook.setIdentifierInput('PMID:12345');
      await hook.handleLookup();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Upload a PDF with matching title (different formatting)
      const pdfFile = createMockPdfFile('ml-health.pdf');
      const mockArrayBuffer = createMockArrayBuffer();

      readFileAsArrayBuffer.mockResolvedValue(mockArrayBuffer);
      extractPdfTitle.mockResolvedValue('Machine-Learning for Healthcare!');
      extractPdfDoi.mockResolvedValue(null);

      await hook.handlePdfSelect([pdfFile]);
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should match by normalized title
      const lookupRefs = hook.lookupRefs();
      expect(lookupRefs[0].manualPdfData).toBe(mockArrayBuffer);
      expect(lookupRefs[0].matchedFromUpload).toBe(true);
      expect(hook.selectedLookupIds().has(lookupRefs[0]._id)).toBe(true);
    });
  });

  it('should not match PDFs when neither DOI nor title matches', async () => {
    const { extractPdfTitle, extractPdfDoi, readFileAsArrayBuffer } =
      await import('@/lib/pdfUtils.js');

    const { fetchReferenceByIdentifier, parseIdentifiers, fetchFromDOI } =
      await import('@/lib/referenceLookup.js');

    // Mock fetchFromDOI for background metadata fetch
    fetchFromDOI.mockResolvedValue(null);

    await createRoot(async d => {
      dispose = d;

      const hook = useAddStudies();

      // Add a lookup ref
      const mockRefData = {
        title: 'Quantum Computing Advances',
        doi: '10.5678/quantum.2024',
        pdfAvailable: false,
      };

      parseIdentifiers.mockReturnValue(['10.5678/quantum.2024']);
      fetchReferenceByIdentifier.mockResolvedValue(mockRefData);

      hook.setIdentifierInput('10.5678/quantum.2024');
      await hook.handleLookup();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Upload a PDF with different DOI and title
      const pdfFile = createMockPdfFile('other-study.pdf');
      const mockArrayBuffer = createMockArrayBuffer();

      readFileAsArrayBuffer.mockResolvedValue(mockArrayBuffer);
      extractPdfTitle.mockResolvedValue('Neural Networks in Biology');
      extractPdfDoi.mockResolvedValue('10.9999/bio.2024');

      await hook.handlePdfSelect([pdfFile]);
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should NOT match
      const lookupRefs = hook.lookupRefs();
      expect(lookupRefs[0].manualPdfData).toBeFalsy();
      expect(lookupRefs[0].matchedFromUpload).toBeUndefined();
      expect(hook.selectedLookupIds().has(lookupRefs[0]._id)).toBe(false);
    });
  });
});

describe('useAddStudies - PDF Sync with Imported Refs', () => {
  let dispose;

  afterEach(() => {
    if (dispose) dispose();
    vi.clearAllMocks();
  });

  it('should match PDFs to imported refs by DOI', async () => {
    const { readFileAsArrayBuffer, extractPdfTitle, extractPdfDoi } =
      await import('@/lib/pdfUtils.js');

    const { parseReferenceFile, separateFileTypes } = await import('@/lib/referenceParser.js');

    await createRoot(async d => {
      dispose = d;

      const hook = useAddStudies();

      // Mock the reference file parsing
      const mockRefs = [
        {
          title: 'Systematic Review of AI',
          doi: '10.1234/ai.review',
          firstAuthor: 'Johnson',
          publicationYear: 2023,
        },
      ];

      parseReferenceFile.mockResolvedValue(mockRefs);

      // Create reference file and PDF files
      const refFile = createMockReferenceFile('references.ris');
      const pdfFile = createMockPdfFile('ai-review.pdf');
      const mockArrayBuffer = createMockArrayBuffer();

      separateFileTypes.mockReturnValue({
        referenceFiles: [refFile],
        pdfFiles: [pdfFile],
      });

      readFileAsArrayBuffer.mockResolvedValue(mockArrayBuffer);
      extractPdfTitle.mockResolvedValue('Systematic Review of AI');
      extractPdfDoi.mockResolvedValue('10.1234/ai.review');

      // Handle the file select with both reference and PDF
      await hook.handleRefFileSelect([refFile, pdfFile]);

      // Wait for parsing and matching
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check that ref was imported
      const refs = hook.importedRefs();
      expect(refs.length).toBe(1);

      // Check that PDF was matched
      expect(refs[0].pdfData).toBe(mockArrayBuffer);
      expect(refs[0].pdfFileName).toBe('ai-review.pdf');
    });
  });

  it('should match PDFs to imported refs by normalized title', async () => {
    const { readFileAsArrayBuffer, extractPdfTitle, extractPdfDoi } =
      await import('@/lib/pdfUtils.js');

    const { parseReferenceFile, separateFileTypes } = await import('@/lib/referenceParser.js');

    await createRoot(async d => {
      dispose = d;

      const hook = useAddStudies();

      // Mock refs without DOI
      const mockRefs = [
        {
          title: 'Meta-Analysis of Clinical Trials',
          doi: null,
          firstAuthor: 'Brown',
        },
      ];

      parseReferenceFile.mockResolvedValue(mockRefs);

      const refFile = createMockReferenceFile('references.ris');
      const pdfFile = createMockPdfFile('meta.pdf');
      const mockArrayBuffer = createMockArrayBuffer();

      separateFileTypes.mockReturnValue({
        referenceFiles: [refFile],
        pdfFiles: [pdfFile],
      });

      readFileAsArrayBuffer.mockResolvedValue(mockArrayBuffer);
      extractPdfTitle.mockResolvedValue('Meta Analysis of Clinical-Trials');
      extractPdfDoi.mockResolvedValue(null);

      await hook.handleRefFileSelect([refFile, pdfFile]);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should match by normalized title
      const refs = hook.importedRefs();
      expect(refs[0].pdfData).toBe(mockArrayBuffer);
      expect(refs[0].pdfFileName).toBe('meta.pdf');
    });
  });
});

describe('useAddStudies - Deduplication in getStudiesToSubmit', () => {
  let dispose;

  afterEach(() => {
    if (dispose) dispose();
    vi.clearAllMocks();
  });

  it('should deduplicate studies by DOI', async () => {
    const { extractPdfTitle, extractPdfDoi, readFileAsArrayBuffer } =
      await import('@/lib/pdfUtils.js');

    const { fetchReferenceByIdentifier, parseIdentifiers } =
      await import('@/lib/referenceLookup.js');

    const { fetchFromDOI } = await import('@/lib/referenceLookup.js');

    await createRoot(async d => {
      dispose = d;

      const hook = useAddStudies();

      // Mock metadata fetch to avoid errors
      fetchFromDOI.mockResolvedValue({
        firstAuthor: 'Smith',
        publicationYear: 2024,
        authors: ['Smith, J.', 'Doe, A.'],
        journal: 'Nature',
        abstract: 'This is important.',
      });

      // Add a PDF with DOI
      const pdfFile = createMockPdfFile('study.pdf');
      const mockArrayBuffer = createMockArrayBuffer();

      readFileAsArrayBuffer.mockResolvedValue(mockArrayBuffer);
      extractPdfTitle.mockResolvedValue('Important Study');
      extractPdfDoi.mockResolvedValue('10.1234/study');

      await hook.handlePdfSelect([pdfFile]);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Add a lookup ref with the same DOI (but with metadata)
      const mockRefData = {
        title: 'Important Study',
        doi: '10.1234/study',
        pdfAvailable: true,
        pdfUrl: 'https://example.com/study.pdf',
        pdfSource: 'unpaywall',
        pdfAccessible: true,
        firstAuthor: 'Smith',
        publicationYear: 2024,
        authors: ['Smith, J.', 'Doe, A.'],
        journal: 'Nature',
        abstract: 'This is important.',
      };

      parseIdentifiers.mockReturnValue(['10.1234/study']);
      fetchReferenceByIdentifier.mockResolvedValue(mockRefData);

      hook.setIdentifierInput('10.1234/study');
      await hook.handleLookup();
      await new Promise(resolve => setTimeout(resolve, 150));

      // Get deduplicated studies
      const studies = hook.getStudiesToSubmit();

      // Should have only one study
      expect(studies.length).toBe(1);

      // Should have metadata from the lookup ref
      expect(studies[0].firstAuthor).toBe('Smith');
      expect(studies[0].publicationYear).toBe(2024);
      expect(studies[0].journal).toBe('Nature');

      // Should have PDF data from the uploaded PDF
      expect(studies[0].pdfData).toBe(mockArrayBuffer);
      expect(studies[0].pdfFileName).toBe('study.pdf');

      // Should indicate it was merged
      expect(studies[0].importSource).toBe('merged');
    });
  });

  it('should deduplicate studies by normalized title', async () => {
    const { extractPdfTitle, extractPdfDoi, readFileAsArrayBuffer } =
      await import('@/lib/pdfUtils.js');

    const { parseReferenceFile, separateFileTypes } = await import('@/lib/referenceParser.js');

    await createRoot(async d => {
      dispose = d;

      const hook = useAddStudies();

      // Add a PDF without DOI
      const pdfFile = createMockPdfFile('ml-study.pdf');
      const mockArrayBuffer = createMockArrayBuffer();

      readFileAsArrayBuffer.mockResolvedValue(mockArrayBuffer);
      extractPdfTitle.mockResolvedValue('Machine-Learning in Healthcare');
      extractPdfDoi.mockResolvedValue(null);

      await hook.handlePdfSelect([pdfFile]);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Add an imported ref with similar title
      const mockRefs = [
        {
          title: 'Machine Learning in Healthcare',
          doi: null,
          firstAuthor: 'Johnson',
          publicationYear: 2023,
          authors: ['Johnson, K.'],
          journal: 'JAMA',
        },
      ];

      parseReferenceFile.mockResolvedValue(mockRefs);

      const refFile = createMockReferenceFile('references.ris');
      separateFileTypes.mockReturnValue({
        referenceFiles: [refFile],
        pdfFiles: [],
      });

      await hook.handleRefFileSelect([refFile]);
      await new Promise(resolve => setTimeout(resolve, 150));

      // Get deduplicated studies
      const studies = hook.getStudiesToSubmit();

      // Should have only one study
      expect(studies.length).toBe(1);

      // Should have metadata from the ref
      expect(studies[0].firstAuthor).toBe('Johnson');
      expect(studies[0].journal).toBe('JAMA');

      // Should have PDF data from the upload
      expect(studies[0].pdfData).toBe(mockArrayBuffer);
    });
  });

  it('should keep separate studies when neither DOI nor title matches', async () => {
    const { extractPdfTitle, extractPdfDoi, readFileAsArrayBuffer } =
      await import('@/lib/pdfUtils.js');

    const { fetchFromDOI } = await import('@/lib/referenceLookup.js');

    await createRoot(async d => {
      dispose = d;

      const hook = useAddStudies();

      // Mock metadata fetches
      fetchFromDOI
        .mockResolvedValueOnce({
          firstAuthor: 'Author A',
          publicationYear: 2024,
        })
        .mockResolvedValueOnce({
          firstAuthor: 'Author B',
          publicationYear: 2023,
        });

      // Add two PDFs with different titles and DOIs
      const mockArrayBuffer1 = createMockArrayBuffer('data1');
      const mockArrayBuffer2 = createMockArrayBuffer('data2');

      readFileAsArrayBuffer
        .mockResolvedValueOnce(mockArrayBuffer1)
        .mockResolvedValueOnce(mockArrayBuffer2);

      extractPdfTitle.mockResolvedValueOnce('Study A').mockResolvedValueOnce('Study B');

      extractPdfDoi.mockResolvedValueOnce('10.1111/a').mockResolvedValueOnce('10.2222/b');

      await hook.handlePdfSelect([createMockPdfFile('a.pdf'), createMockPdfFile('b.pdf')]);

      await new Promise(resolve => setTimeout(resolve, 150));

      // Get studies
      const studies = hook.getStudiesToSubmit();

      // Should have two separate studies
      expect(studies.length).toBe(2);
      expect(studies[0].title).toBe('Study A');
      expect(studies[1].title).toBe('Study B');
    });
  });
});

describe('useAddStudies - Collect Mode Effect', () => {
  let dispose;

  afterEach(() => {
    if (dispose) dispose();
    vi.clearAllMocks();
  });

  it('should trigger onStudiesChange when in collect mode', async () => {
    const { extractPdfTitle, extractPdfDoi, readFileAsArrayBuffer } =
      await import('@/lib/pdfUtils.js');

    const { fetchFromDOI } = await import('@/lib/referenceLookup.js');

    await createRoot(async d => {
      dispose = d;

      const onStudiesChange = vi.fn();
      const hook = useAddStudies({
        collectMode: true,
        onStudiesChange,
      });

      fetchFromDOI.mockResolvedValue({
        firstAuthor: 'Test',
        publicationYear: 2024,
      });

      // Add a PDF
      const mockArrayBuffer = createMockArrayBuffer();
      readFileAsArrayBuffer.mockResolvedValue(mockArrayBuffer);
      extractPdfTitle.mockResolvedValue('Test Study');
      extractPdfDoi.mockResolvedValue('10.1234/test');

      await hook.handlePdfSelect([createMockPdfFile('test.pdf')]);

      // Wait for processing and effect
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have called onStudiesChange
      expect(onStudiesChange).toHaveBeenCalled();

      // Check the structure of the data passed
      const call = onStudiesChange.mock.calls.at(-1)[0];
      expect(call).toHaveProperty('pdfs');
      expect(call).toHaveProperty('refs');
      expect(call).toHaveProperty('lookups');
      expect(call).toHaveProperty('driveFiles');

      // Should have one PDF
      expect(call.pdfs.length).toBe(1);
      expect(call.pdfs[0].title).toBe('Test Study');
      expect(call.pdfs[0].doi).toBe('10.1234/test');
      expect(call.pdfs[0].data).toBe(mockArrayBuffer);
    });
  });

  it('should preserve PDF metadata even when abstract is missing', async () => {
    const { extractPdfTitle, extractPdfDoi, readFileAsArrayBuffer } =
      await import('@/lib/pdfUtils.js');

    const { fetchFromDOI } = await import('@/lib/referenceLookup.js');

    await createRoot(async d => {
      dispose = d;

      const onStudiesChange = vi.fn();
      const hook = useAddStudies({
        collectMode: true,
        onStudiesChange,
      });

      // Regression: previously metadata was set to null if abstract was falsy
      fetchFromDOI.mockResolvedValue({
        firstAuthor: 'NoAbstractAuthor',
        publicationYear: 2025,
        abstract: null,
      });

      const mockArrayBuffer = createMockArrayBuffer('no-abstract');
      readFileAsArrayBuffer.mockResolvedValue(mockArrayBuffer);
      extractPdfTitle.mockResolvedValue('No Abstract Study');
      extractPdfDoi.mockResolvedValue('10.9999/no-abstract');

      await hook.handlePdfSelect([createMockPdfFile('no-abstract.pdf')]);
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(onStudiesChange).toHaveBeenCalled();

      const call = onStudiesChange.mock.calls.at(-1)[0];
      expect(call.pdfs.length).toBe(1);
      expect(call.pdfs[0].title).toBe('No Abstract Study');
      expect(call.pdfs[0].doi).toBe('10.9999/no-abstract');

      // Critical assertions
      expect(call.pdfs[0].metadata).toBeTruthy();
      expect(call.pdfs[0].metadata.firstAuthor).toBe('NoAbstractAuthor');
      expect(call.pdfs[0].metadata.publicationYear).toBe(2025);
      expect(call.pdfs[0].metadata.doi).toBe('10.9999/no-abstract');
      expect(call.pdfs[0].metadata.importSource).toBe('pdf');
    });
  });

  it('should preserve lookup PDF availability metadata in collected refs', async () => {
    const { fetchReferenceByIdentifier, parseIdentifiers } =
      await import('@/lib/referenceLookup.js');

    await createRoot(async d => {
      dispose = d;

      const onStudiesChange = vi.fn();
      const hook = useAddStudies({
        collectMode: true,
        onStudiesChange,
      });

      parseIdentifiers.mockReturnValue(['10.1234/available']);
      fetchReferenceByIdentifier.mockResolvedValue({
        title: 'Lookup With PDF',
        doi: '10.1234/available',
        pdfAvailable: true,
        pdfUrl: 'https://example.com/paper.pdf',
        pdfSource: 'unpaywall',
        pdfAccessible: true,
        firstAuthor: 'LookupAuthor',
        publicationYear: 2024,
        journal: 'Test Journal',
      });

      hook.setIdentifierInput('10.1234/available');
      await hook.handleLookup();
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(onStudiesChange).toHaveBeenCalled();
      const call = onStudiesChange.mock.calls.at(-1)[0];

      // Lookups are surfaced as refs for backward compatibility
      expect(call.refs.length).toBe(1);
      expect(call.refs[0].title).toBe('Lookup With PDF');
      expect(call.refs[0].metadata.doi).toBe('10.1234/available');
      expect(call.refs[0].metadata.pdfUrl).toBe('https://example.com/paper.pdf');
      expect(call.refs[0].metadata.pdfSource).toBe('unpaywall');
      expect(call.refs[0].metadata.pdfAccessible).toBe(true);
      expect(call.refs[0].metadata.importSource).toBe('identifier-lookup');
    });
  });

  it('should not call onStudiesChange when not in collect mode', async () => {
    const { extractPdfTitle, extractPdfDoi, readFileAsArrayBuffer } =
      await import('@/lib/pdfUtils.js');

    const { fetchFromDOI } = await import('@/lib/referenceLookup.js');

    await createRoot(async d => {
      dispose = d;

      const onStudiesChange = vi.fn();
      const hook = useAddStudies({
        collectMode: false,
        onStudiesChange,
      });

      fetchFromDOI.mockResolvedValue({ firstAuthor: 'Test' });

      // Add a PDF
      const mockArrayBuffer = createMockArrayBuffer();
      readFileAsArrayBuffer.mockResolvedValue(mockArrayBuffer);
      extractPdfTitle.mockResolvedValue('Test Study');
      extractPdfDoi.mockResolvedValue('10.1234/test');

      await hook.handlePdfSelect([createMockPdfFile('test.pdf')]);
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should NOT have called onStudiesChange
      expect(onStudiesChange).not.toHaveBeenCalled();
    });
  });

  it('should handle reactive collectMode signal', async () => {
    const { extractPdfTitle, extractPdfDoi, readFileAsArrayBuffer } =
      await import('@/lib/pdfUtils.js');

    const { fetchFromDOI } = await import('@/lib/referenceLookup.js');

    await createRoot(async d => {
      dispose = d;

      const [collectMode, setCollectMode] = createSignal(false);
      const onStudiesChange = vi.fn();

      const hook = useAddStudies({
        collectMode,
        onStudiesChange,
      });

      fetchFromDOI.mockResolvedValue({ firstAuthor: 'Test' });

      // Add a PDF while NOT in collect mode
      const mockArrayBuffer = createMockArrayBuffer();
      readFileAsArrayBuffer.mockResolvedValue(mockArrayBuffer);
      extractPdfTitle.mockResolvedValue('Test Study');
      extractPdfDoi.mockResolvedValue('10.1234/test');

      await hook.handlePdfSelect([createMockPdfFile('test.pdf')]);
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should not call yet
      expect(onStudiesChange).not.toHaveBeenCalled();

      // Enable collect mode
      setCollectMode(true);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Now it should call
      expect(onStudiesChange).toHaveBeenCalled();
    });
  });
});
