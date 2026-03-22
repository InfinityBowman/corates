/**
 * Reference Lookup API - Fetch metadata from DOI (CrossRef) and PMID (PubMed)
 * Also checks for PDF availability via Unpaywall
 */

import { formatAuthors } from './referenceParser';

// Unpaywall API email (required for their API)
const UNPAYWALL_EMAIL = 'support@corates.org';

// Repositories that allow programmatic PDF access (vs publishers that block bots)
const ACCESSIBLE_REPOSITORIES = [
  'pubmedcentral',
  'pmc',
  'europepmc',
  'arxiv',
  'biorxiv',
  'medrxiv',
  'zenodo',
  'figshare',
  'hal',
  'oapen',
  'doaj',
  'core',
  'semanticscholar',
];

interface UnpaywallLocation {
  url_for_pdf?: string;
  host_type?: string;
}

export interface PdfAvailability {
  available: boolean;
  url: string | null;
  source: string | null;
  accessible: boolean;
}

export interface ReferenceMetadata {
  title: string;
  firstAuthor: string | null;
  publicationYear: number | null;
  authors: string | null;
  journal: string | null;
  abstract: string | null;
  doi: string | null;
  pmid?: string;
  url: string | null;
  type: string;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  issn?: string | null;
  publisher?: string | null;
  importSource?: string;
  pdfAvailable?: boolean;
  pdfUrl?: string | null;
  pdfSource?: string | null;
  pdfAccessible?: boolean;
}

/**
 * Check if a PDF URL is likely to be programmatically accessible
 * Publisher-hosted PDFs often block automated access
 */
function isPdfAccessible(location: UnpaywallLocation): boolean {
  if (!location?.url_for_pdf) return false;

  const url = location.url_for_pdf.toLowerCase();
  const hostType = (location.host_type || '').toLowerCase();

  // Repository sources are generally accessible
  if (hostType === 'repository') {
    // Check for known accessible repositories
    for (const repo of ACCESSIBLE_REPOSITORIES) {
      if (url.includes(repo)) return true;
    }
    // Most other repositories are also accessible
    return true;
  }

  // Check URL patterns for known accessible sources
  for (const repo of ACCESSIBLE_REPOSITORIES) {
    if (url.includes(repo)) return true;
  }

  // PMC URLs
  if (url.includes('ncbi.nlm.nih.gov/pmc')) return true;

  // Direct PDF file URLs (often work)
  if (url.endsWith('.pdf') && !url.includes('sciencedirect') && !url.includes('elsevier')) {
    return true;
  }

  // Publisher sources are often blocked
  if (hostType === 'publisher') {
    return false;
  }

  // Default to false for unknown sources
  return false;
}

/**
 * Check if a PDF is available via Unpaywall
 * Prioritizes repository sources that allow programmatic access
 */
export async function checkPdfAvailability(doi: string | null | undefined): Promise<PdfAvailability> {
  if (!doi) return { available: false, url: null, source: null, accessible: false };

  const cleanDoi = doi
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:/i, '')
    .trim();

  try {
    const response = await fetch(
      `https://api.unpaywall.org/v2/${encodeURIComponent(cleanDoi)}?email=${UNPAYWALL_EMAIL}`,
    );

    if (!response.ok) {
      return { available: false, url: null, source: null, accessible: false };
    }

    const data = await response.json();
    const locations: UnpaywallLocation[] = data.oa_locations || [];

    // First pass: look for accessible repository PDFs
    for (const location of locations) {
      if (location.url_for_pdf && isPdfAccessible(location)) {
        return {
          available: true,
          url: location.url_for_pdf,
          source: location.host_type || 'repository',
          accessible: true,
        };
      }
    }

    // Second pass: return any PDF URL (may require manual download)
    if (data.best_oa_location?.url_for_pdf) {
      return {
        available: true,
        url: data.best_oa_location.url_for_pdf,
        source: data.best_oa_location.host_type || 'publisher',
        accessible: false,
      };
    }

    for (const location of locations) {
      if (location.url_for_pdf) {
        return {
          available: true,
          url: location.url_for_pdf,
          source: location.host_type || 'publisher',
          accessible: false,
        };
      }
    }

    return { available: false, url: null, source: null, accessible: false };
  } catch (error) {
    console.error('Unpaywall check failed:', error);
    return { available: false, url: null, source: null, accessible: false };
  }
}

interface CrossRefAuthor {
  family?: string;
  given?: string;
  name?: string;
}

interface CrossRefWork {
  author?: CrossRefAuthor[];
  published?: { 'date-parts'?: number[][] };
  'published-print'?: { 'date-parts'?: number[][] };
  'published-online'?: { 'date-parts'?: number[][] };
  title?: string | string[];
  'container-title'?: string[];
  'short-container-title'?: string[];
  abstract?: string;
  DOI?: string;
  URL?: string;
  type?: string;
  volume?: string;
  issue?: string;
  page?: string;
  ISSN?: string[];
  publisher?: string;
}

/**
 * Fetch reference metadata from a DOI using CrossRef API
 */
export async function fetchFromDOI(doi: string): Promise<ReferenceMetadata> {
  // Clean up DOI - remove URL prefix if present
  const cleanDoi = doi
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:/i, '')
    .trim();

  if (!cleanDoi) {
    throw new Error('Invalid DOI');
  }

  // Use mailto parameter for polite pool instead of User-Agent header
  // Safari blocks/modifies User-Agent on CORS requests, causing 503 errors from CrossRef
  const url = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}?mailto=support@corates.org`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('DOI not found');
    }
    throw new Error(`Failed to fetch DOI: ${response.status}`);
  }

  const data = await response.json();
  const work: CrossRefWork = data.message;

  return normalizeCrossRefWork(work);
}

/**
 * Normalize CrossRef API response to our reference format
 */
function normalizeCrossRefWork(work: CrossRefWork): ReferenceMetadata {
  // Extract authors
  const authors = (work.author || []).map(a => {
    if (a.family && a.given) {
      return `${a.family}, ${a.given}`;
    }
    return a.name || a.family || 'Unknown';
  });

  // Extract first author's last name
  const firstAuthor = work.author?.[0]?.family || null;

  // Extract publication year
  let publicationYear: number | null = null;
  if (work.published?.['date-parts']?.[0]?.[0]) {
    publicationYear = work.published['date-parts'][0][0];
  } else if (work['published-print']?.['date-parts']?.[0]?.[0]) {
    publicationYear = work['published-print']['date-parts'][0][0];
  } else if (work['published-online']?.['date-parts']?.[0]?.[0]) {
    publicationYear = work['published-online']['date-parts'][0][0];
  }

  // Extract title (CrossRef returns array)
  const title = Array.isArray(work.title) ? work.title[0] : work.title || 'Untitled';

  // Extract journal name
  const journal = work['container-title']?.[0] || work['short-container-title']?.[0] || null;

  // Extract abstract (may contain HTML/JATS markup)
  let abstract = work.abstract || null;
  if (abstract) {
    // Strip JATS XML tags
    abstract = abstract.replace(/<[^>]*>/g, '').trim();
  }

  return {
    title,
    firstAuthor,
    publicationYear,
    authors: formatAuthors(authors),
    journal,
    abstract,
    doi: work.DOI || null,
    url: work.URL || (work.DOI ? `https://doi.org/${work.DOI}` : null),
    type: work.type || 'article',
    volume: work.volume || null,
    issue: work.issue || null,
    pages: work.page || null,
    issn: work.ISSN?.[0] || null,
    publisher: work.publisher || null,
  };
}

/**
 * Fetch reference metadata from a PubMed ID using NCBI E-utilities API
 */
export async function fetchFromPMID(pmid: string): Promise<ReferenceMetadata> {
  // Clean up PMID - extract just the number
  const cleanPmid = pmid
    .replace(/^pmid:/i, '')
    .replace(/\D/g, '')
    .trim();

  if (!cleanPmid) {
    throw new Error('Invalid PubMed ID');
  }

  // Use NCBI E-utilities efetch API
  const response = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${cleanPmid}&retmode=xml`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch PubMed ID: ${response.status}`);
  }

  const xmlText = await response.text();
  return parsePubMedXML(xmlText, cleanPmid);
}

/**
 * Parse PubMed XML response
 */
function parsePubMedXML(xmlText: string, pmid: string): ReferenceMetadata {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  // Check for errors
  const error = doc.querySelector('error, ERROR');
  if (error) {
    throw new Error('PubMed ID not found');
  }

  const article = doc.querySelector('PubmedArticle');
  if (!article) {
    throw new Error('PubMed ID not found');
  }

  // Extract title
  const titleEl = article.querySelector('ArticleTitle');
  const title = titleEl?.textContent?.trim() || 'Untitled';

  // Extract authors
  const authorEls = article.querySelectorAll('Author');
  const authors: string[] = [];
  let firstAuthor: string | null = null;

  authorEls.forEach((authorEl, index) => {
    const lastName = authorEl.querySelector('LastName')?.textContent || '';
    const foreName = authorEl.querySelector('ForeName')?.textContent || '';
    const initials = authorEl.querySelector('Initials')?.textContent || '';

    if (lastName) {
      const authorName = foreName ? `${lastName}, ${foreName}` : `${lastName}, ${initials}`;
      authors.push(authorName);

      if (index === 0) {
        firstAuthor = lastName;
      }
    }
  });

  // Extract publication year
  const pubDateEl =
    article.querySelector('PubDate Year') ||
    article.querySelector('PubMedPubDate[PubStatus="pubmed"] Year');
  const publicationYear = pubDateEl ? parseInt(pubDateEl.textContent || '', 10) : null;

  // Extract journal
  const journalEl = article.querySelector('Journal Title, ISOAbbreviation');
  const journal = journalEl?.textContent || null;

  // Extract abstract
  const abstractEls = article.querySelectorAll('AbstractText');
  let abstract = '';
  abstractEls.forEach(el => {
    const label = el.getAttribute('Label');
    if (label) {
      abstract += `${label}: `;
    }
    abstract += el.textContent + ' ';
  });
  abstract = abstract.trim() || '';

  // Extract DOI
  const doiEl = article.querySelector('ArticleId[IdType="doi"]');
  const doi = doiEl?.textContent || null;

  // Extract volume/issue/pages
  const volumeEl = article.querySelector('Volume');
  const issueEl = article.querySelector('Issue');
  const pagesEl = article.querySelector('MedlinePgn');

  return {
    title,
    firstAuthor,
    publicationYear,
    authors: formatAuthors(authors),
    journal,
    abstract: abstract || null,
    doi,
    pmid,
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    type: 'article',
    volume: volumeEl?.textContent || null,
    issue: issueEl?.textContent || null,
    pages: pagesEl?.textContent || null,
  };
}

/**
 * Detect identifier type and fetch metadata
 */
export async function fetchReferenceByIdentifier(identifier: string): Promise<ReferenceMetadata> {
  const trimmed = identifier.trim();
  let ref: ReferenceMetadata;

  // Check if it's a PubMed ID
  if (/^(pmid:?)?\d+$/i.test(trimmed)) {
    ref = await fetchFromPMID(trimmed);
    ref.importSource = 'pubmed';
  }
  // Check if it's a PubMed URL
  else if (/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i.test(trimmed)) {
    const match = trimmed.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
    ref = await fetchFromPMID(match![1]);
    ref.importSource = 'pubmed';
  }
  // Check if it's a DOI (various formats)
  else if (/^10\.\d{4,}/i.test(trimmed) || /^doi:/i.test(trimmed) || /doi\.org\//i.test(trimmed)) {
    ref = await fetchFromDOI(trimmed);
    ref.importSource = 'doi';
  } else {
    // Try DOI as fallback for unknown format
    try {
      ref = await fetchFromDOI(trimmed);
      ref.importSource = 'doi';
    } catch (err) {
      console.warn('Reference lookup failed:', (err as Error).message);
      throw new Error(
        'Could not identify reference. Please enter a valid DOI (e.g., 10.1234/example) or PubMed ID (e.g., 12345678).',
      );
    }
  }

  // Check PDF availability via Unpaywall (requires DOI)
  if (ref.doi) {
    const pdfInfo = await checkPdfAvailability(ref.doi);
    ref.pdfAvailable = pdfInfo.available;
    ref.pdfUrl = pdfInfo.url;
    ref.pdfSource = pdfInfo.source;
    ref.pdfAccessible = pdfInfo.accessible;
  } else {
    ref.pdfAvailable = false;
    ref.pdfUrl = null;
    ref.pdfSource = null;
    ref.pdfAccessible = false;
  }

  return ref;
}

/**
 * Parse multiple identifiers from text (one per line or comma-separated)
 */
export function parseIdentifiers(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}
