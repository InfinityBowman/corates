/**
 * Tests for referenceLookup.js - External API lookups for DOI and PMID
 *
 * P2 Priority: Reference metadata enrichment
 * Tests identifier parsing, DOI/PMID lookups, and PDF availability checking.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkPdfAvailability,
  fetchFromDOI,
  fetchReferenceByIdentifier,
  parseIdentifiers,
} from '../referenceLookup.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock DOMParser for PubMed XML parsing
class MockDOMParser {
  parseFromString(xmlText) {
    // Simple mock that extracts some data from the XML
    const mockDoc = {
      querySelector: vi.fn(selector => {
        if (selector.includes('error') || selector.includes('ERROR')) {
          return null;
        }
        if (selector === 'PubmedArticle') {
          return {};
        }
        if (selector === 'ArticleTitle' && xmlText.includes('<ArticleTitle>')) {
          const match = xmlText.match(/<ArticleTitle>([^<]+)<\/ArticleTitle>/);
          return match ? { textContent: match[1] } : null;
        }
        return null;
      }),
      querySelectorAll: vi.fn(() => []),
    };
    return mockDoc;
  }
}
global.DOMParser = MockDOMParser;

describe('parseIdentifiers', () => {
  it('should parse single identifier', () => {
    const result = parseIdentifiers('10.1234/test.2024');
    expect(result).toEqual(['10.1234/test.2024']);
  });

  it('should parse newline-separated identifiers', () => {
    const result = parseIdentifiers('10.1234/first\n10.1234/second\n10.1234/third');
    expect(result).toEqual(['10.1234/first', '10.1234/second', '10.1234/third']);
  });

  it('should parse comma-separated identifiers', () => {
    const result = parseIdentifiers('10.1234/first, 10.1234/second, 10.1234/third');
    expect(result).toEqual(['10.1234/first', '10.1234/second', '10.1234/third']);
  });

  it('should parse semicolon-separated identifiers', () => {
    const result = parseIdentifiers('10.1234/first; 10.1234/second; 10.1234/third');
    expect(result).toEqual(['10.1234/first', '10.1234/second', '10.1234/third']);
  });

  it('should trim whitespace from identifiers', () => {
    const result = parseIdentifiers('  10.1234/first  ,  10.1234/second  ');
    expect(result).toEqual(['10.1234/first', '10.1234/second']);
  });

  it('should filter out empty strings', () => {
    const result = parseIdentifiers('10.1234/first,,,10.1234/second');
    expect(result).toEqual(['10.1234/first', '10.1234/second']);
  });

  it('should handle mixed separators', () => {
    const result = parseIdentifiers('DOI1\nDOI2, DOI3; DOI4');
    expect(result).toEqual(['DOI1', 'DOI2', 'DOI3', 'DOI4']);
  });

  it('should handle PMID format', () => {
    const result = parseIdentifiers('12345678, pmid:87654321');
    expect(result).toEqual(['12345678', 'pmid:87654321']);
  });

  it('should return empty array for empty input', () => {
    expect(parseIdentifiers('')).toEqual([]);
    expect(parseIdentifiers('   ')).toEqual([]);
  });
});

describe('checkPdfAvailability', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return unavailable for null/empty DOI', async () => {
    const result = await checkPdfAvailability(null);
    expect(result).toEqual({
      available: false,
      url: null,
      source: null,
      accessible: false,
    });

    const result2 = await checkPdfAvailability('');
    expect(result2).toEqual({
      available: false,
      url: null,
      source: null,
      accessible: false,
    });
  });

  it('should clean DOI prefix before lookup', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ oa_locations: [] }),
    });

    await checkPdfAvailability('https://doi.org/10.1234/test');

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('10.1234%2Ftest'));
  });

  it('should return accessible PDF from repository', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          oa_locations: [
            {
              url_for_pdf: 'https://europepmc.org/articles/PMC12345/pdf/article.pdf',
              host_type: 'repository',
            },
          ],
          best_oa_location: null,
        }),
    });

    const result = await checkPdfAvailability('10.1234/test');

    expect(result.available).toBe(true);
    expect(result.accessible).toBe(true);
    expect(result.url).toContain('europepmc');
  });

  it('should return non-accessible PDF from publisher', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          oa_locations: [],
          best_oa_location: {
            url_for_pdf: 'https://www.sciencedirect.com/article/pdf',
            host_type: 'publisher',
          },
        }),
    });

    const result = await checkPdfAvailability('10.1234/test');

    expect(result.available).toBe(true);
    expect(result.accessible).toBe(false);
    expect(result.source).toBe('publisher');
  });

  it('should prioritize repository over publisher', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          oa_locations: [
            {
              url_for_pdf: 'https://publisher.com/pdf',
              host_type: 'publisher',
            },
            {
              url_for_pdf: 'https://arxiv.org/pdf/1234.pdf',
              host_type: 'repository',
            },
          ],
          best_oa_location: {
            url_for_pdf: 'https://publisher.com/pdf',
            host_type: 'publisher',
          },
        }),
    });

    const result = await checkPdfAvailability('10.1234/test');

    expect(result.accessible).toBe(true);
    expect(result.url).toContain('arxiv');
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await checkPdfAvailability('10.1234/test');

    expect(result).toEqual({
      available: false,
      url: null,
      source: null,
      accessible: false,
    });
  });

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await checkPdfAvailability('10.1234/test');

    expect(result).toEqual({
      available: false,
      url: null,
      source: null,
      accessible: false,
    });
  });

  it('should recognize PMC URLs as accessible', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          oa_locations: [
            {
              url_for_pdf: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12345/pdf/article.pdf',
              host_type: 'publisher',
            },
          ],
        }),
    });

    const result = await checkPdfAvailability('10.1234/test');

    expect(result.accessible).toBe(true);
  });
});

describe('fetchFromDOI', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should throw for empty DOI', async () => {
    await expect(fetchFromDOI('')).rejects.toThrow('Invalid DOI');
    await expect(fetchFromDOI('   ')).rejects.toThrow('Invalid DOI');
  });

  it('should clean DOI prefixes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          message: {
            title: ['Test Article'],
            author: [],
            DOI: '10.1234/test',
          },
        }),
    });

    await fetchFromDOI('https://doi.org/10.1234/test');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('10.1234%2Ftest'),
      expect.any(Object),
    );

    await fetchFromDOI('doi:10.1234/test');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('10.1234%2Ftest'),
      expect.any(Object),
    );
  });

  it('should throw for 404 (not found)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    });

    await expect(fetchFromDOI('10.1234/notfound')).rejects.toThrow('DOI not found');
  });

  it('should throw for other HTTP errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(fetchFromDOI('10.1234/test')).rejects.toThrow('Failed to fetch DOI: 500');
  });

  it('should normalize CrossRef response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          message: {
            title: ['Effect of Sleep on Cognitive Performance'],
            author: [
              { family: 'Smith', given: 'John' },
              { family: 'Doe', given: 'Jane' },
            ],
            published: { 'date-parts': [[2024]] },
            'container-title': ['Sleep Medicine'],
            abstract: '<p>This is the abstract.</p>',
            DOI: '10.1234/sleep.2024',
            type: 'journal-article',
            volume: '15',
            issue: '3',
            page: '100-110',
          },
        }),
    });

    const result = await fetchFromDOI('10.1234/sleep.2024');

    expect(result.title).toBe('Effect of Sleep on Cognitive Performance');
    expect(result.firstAuthor).toBe('Smith');
    expect(result.publicationYear).toBe(2024);
    expect(result.journal).toBe('Sleep Medicine');
    expect(result.abstract).toBe('This is the abstract.'); // HTML stripped
    expect(result.doi).toBe('10.1234/sleep.2024');
    expect(result.volume).toBe('15');
    expect(result.issue).toBe('3');
    expect(result.pages).toBe('100-110');
  });

  it('should format multiple authors correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          message: {
            title: ['Test'],
            author: [
              { family: 'Smith', given: 'John' },
              { family: 'Doe', given: 'Jane' },
              { family: 'Brown', given: 'Bob' },
            ],
            DOI: '10.1234/test',
          },
        }),
    });

    const result = await fetchFromDOI('10.1234/test');

    expect(result.authors).toContain('Smith, John');
    expect(result.authors).toContain('Doe, Jane');
    expect(result.authors).toContain('Brown, Bob');
  });

  it('should handle missing publication date', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          message: {
            title: ['Test'],
            author: [],
            DOI: '10.1234/test',
            // No published, published-print, or published-online
          },
        }),
    });

    const result = await fetchFromDOI('10.1234/test');

    expect(result.publicationYear).toBeNull();
  });

  it('should try published-print if published is missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          message: {
            title: ['Test'],
            author: [],
            DOI: '10.1234/test',
            'published-print': { 'date-parts': [[2023]] },
          },
        }),
    });

    const result = await fetchFromDOI('10.1234/test');

    expect(result.publicationYear).toBe(2023);
  });
});

describe('fetchReferenceByIdentifier', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should detect and fetch DOI', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            message: {
              title: ['DOI Article'],
              author: [{ family: 'Test' }],
              DOI: '10.1234/test',
            },
          }),
      })
      .mockResolvedValueOnce({
        // Unpaywall check
        ok: true,
        json: () => Promise.resolve({ oa_locations: [] }),
      });

    const result = await fetchReferenceByIdentifier('10.1234/test');

    expect(result.title).toBe('DOI Article');
    expect(result.importSource).toBe('doi');
  });

  it('should detect DOI with https prefix', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            message: { title: ['Test'], author: [], DOI: '10.1234/test' },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ oa_locations: [] }),
      });

    const result = await fetchReferenceByIdentifier('https://doi.org/10.1234/test');

    expect(result.importSource).toBe('doi');
  });

  it('should throw for unrecognized identifier', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    });

    await expect(fetchReferenceByIdentifier('invalid-identifier')).rejects.toThrow(
      'Could not identify reference',
    );
  });

  it('should include PDF availability info from Unpaywall', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            message: { title: ['Test'], author: [], DOI: '10.1234/test' },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            oa_locations: [
              {
                url_for_pdf: 'https://arxiv.org/pdf/test.pdf',
                host_type: 'repository',
              },
            ],
          }),
      });

    const result = await fetchReferenceByIdentifier('10.1234/test');

    expect(result.pdfAvailable).toBe(true);
    expect(result.pdfAccessible).toBe(true);
    expect(result.pdfUrl).toContain('arxiv');
  });
});
