/**
 * Reference Lookup API - Fetch metadata from DOI (CrossRef) and PMID (PubMed)
 * Also checks for PDF availability via Unpaywall
 */

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

/**
 * Check if a PDF URL is likely to be programmatically accessible
 * Publisher-hosted PDFs often block automated access
 */
function isPdfAccessible(location) {
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
 * @param {string} doi - The DOI to check
 * @returns {Promise<{available: boolean, url: string|null, source: string|null, accessible: boolean}>}
 */
export async function checkPdfAvailability(doi) {
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
    const locations = data.oa_locations || [];

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

/**
 * Fetch reference metadata from a DOI using CrossRef API
 * @param {string} doi - The DOI to look up (with or without https://doi.org/ prefix)
 * @returns {Promise<Object>} - Normalized reference object
 */
export async function fetchFromDOI(doi) {
  // Clean up DOI - remove URL prefix if present
  const cleanDoi = doi
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:/i, '')
    .trim();

  if (!cleanDoi) {
    throw new Error('Invalid DOI');
  }

  const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`, {
    headers: {
      Accept: 'application/json',
      // Polite pool - include email for better rate limits
      'User-Agent': 'CoRATES/1.0 (https://corates.org; mailto:support@corates.org)',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('DOI not found');
    }
    throw new Error(`Failed to fetch DOI: ${response.status}`);
  }

  const data = await response.json();
  const work = data.message;

  return normalizeCrossRefWork(work);
}

/**
 * Normalize CrossRef API response to our reference format
 */
function normalizeCrossRefWork(work) {
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
  let publicationYear = null;
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
    authors: formatAuthorList(authors),
    journal,
    abstract,
    doi: work.DOI,
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
 * @param {string} pmid - The PubMed ID to look up
 * @returns {Promise<Object>} - Normalized reference object
 */
export async function fetchFromPMID(pmid) {
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
function parsePubMedXML(xmlText, pmid) {
  // DOMParser is available in browser environment
  // eslint-disable-next-line no-undef
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
  const authors = [];
  let firstAuthor = null;

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
  const publicationYear = pubDateEl ? parseInt(pubDateEl.textContent, 10) : null;

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
  abstract = abstract.trim() || null;

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
    authors: formatAuthorList(authors),
    journal,
    abstract,
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
 * Format author list as a single string
 */
function formatAuthorList(authors) {
  if (!authors || authors.length === 0) return null;

  if (authors.length === 1) {
    return authors[0];
  }

  if (authors.length === 2) {
    return `${authors[0]} and ${authors[1]}`;
  }

  // More than 2 authors: "First, Second, ... and Last"
  const allButLast = authors.slice(0, -1).join(', ');
  return `${allButLast}, and ${authors[authors.length - 1]}`;
}

/**
 * Detect identifier type and fetch metadata
 * @param {string} identifier - DOI, PMID, or URL
 * @returns {Promise<Object>} - Normalized reference object with source type and PDF availability
 */
export async function fetchReferenceByIdentifier(identifier) {
  const trimmed = identifier.trim();
  let ref;

  // Check if it's a PubMed ID
  if (/^(pmid:?)?\d+$/i.test(trimmed)) {
    ref = await fetchFromPMID(trimmed);
    ref.importSource = 'pubmed';
  }
  // Check if it's a PubMed URL
  else if (/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i.test(trimmed)) {
    const match = trimmed.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
    ref = await fetchFromPMID(match[1]);
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
    } catch {
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
    ref.pdfAccessible = pdfInfo.accessible; // true = can auto-download, false = needs manual download
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
 * @param {string} text - Text containing identifiers
 * @returns {string[]} - Array of individual identifiers
 */
export function parseIdentifiers(text) {
  return text
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}
