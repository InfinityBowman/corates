/**
 * Reference Parser - Parses RIS, BibTeX, and other reference formats
 * Supports exports from Zotero, EndNote, Mendeley, and other reference managers
 */

interface RawReference {
  type?: string;
  id?: string;
  title?: string;
  authors: string[];
  keywords: string[];
  year?: number;
  journal?: string;
  journalAbbrev?: string;
  abstract?: string;
  doi?: string;
  volume?: string;
  issue?: string;
  startPage?: string;
  endPage?: string;
  url?: string;
  pdfUrl?: string;
  fullTextUrl?: string;
  issn?: string;
  publisher?: string;
  city?: string;
  notes?: string;
  language?: string;
  secondaryAuthor?: string;
  date?: string;
  [key: string]: unknown;
}

export interface NormalizedReference {
  title: string;
  firstAuthor: string | null;
  authors: string | null;
  publicationYear: number | null;
  journal: string | null;
  abstract: string | null;
  doi: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  url: string | null;
  keywords: string[];
  type: string;
  [key: string]: unknown;
}

interface SupportedFormat {
  extension: string;
  name: string;
  description: string;
}

/**
 * Parses RIS format (used by EndNote, Zotero, and most reference managers)
 */
export function parseRIS(content: string): NormalizedReference[] {
  const references: NormalizedReference[] = [];
  const lines = content.split(/\r?\n/);
  let currentRef: RawReference | null = null;
  let currentTag: string | null = null;
  let currentValue = '';

  for (const line of lines) {
    // RIS tags are in format "TY  - " (two uppercase letters, two spaces, dash, space)
    const tagMatch = line.match(/^([A-Z][A-Z0-9]) {2}- (.*)$/);

    if (tagMatch) {
      // Save previous tag value if exists
      if (currentRef && currentTag) {
        addRISValue(currentRef, currentTag, currentValue.trim());
      }

      const [, tag, value] = tagMatch;

      if (tag === 'TY') {
        // Start of new reference
        currentRef = {
          type: value,
          authors: [],
          keywords: [],
        };
      } else if (tag === 'ER') {
        // End of reference
        if (currentRef) {
          references.push(normalizeReference(currentRef));
          currentRef = null;
        }
      } else if (currentRef) {
        currentTag = tag;
        currentValue = value;
      }
    } else if (currentRef && currentTag && line.trim()) {
      // Continuation of previous value
      currentValue += ' ' + line.trim();
    }
  }

  // Handle case where file doesn't end with ER tag
  if (currentRef) {
    if (currentTag) {
      addRISValue(currentRef, currentTag, currentValue.trim());
    }
    references.push(normalizeReference(currentRef));
  }

  return references;
}

/**
 * Add a value to a RIS reference based on tag
 */
function addRISValue(ref: RawReference, tag: string, value: string): void {
  if (!value) return;

  const tagMap: Record<string, string> = {
    TI: 'title',
    T1: 'title',
    CT: 'title',
    BT: 'title', // Book title
    AU: 'author',
    A1: 'author',
    A2: 'secondaryAuthor',
    PY: 'year',
    Y1: 'year',
    DA: 'date',
    JO: 'journal',
    JF: 'journal',
    JA: 'journalAbbrev',
    T2: 'journal',
    AB: 'abstract',
    N2: 'abstract',
    DO: 'doi',
    VL: 'volume',
    IS: 'issue',
    SP: 'startPage',
    EP: 'endPage',
    KW: 'keyword',
    UR: 'url',
    L1: 'pdfUrl',
    L2: 'fullTextUrl',
    SN: 'issn',
    PB: 'publisher',
    CY: 'city',
    N1: 'notes',
    ID: 'id',
    LA: 'language',
  };

  const field = tagMap[tag];

  if (!field) return;

  if (field === 'author') {
    ref.authors.push(value);
  } else if (field === 'keyword') {
    ref.keywords.push(value);
  } else if (field === 'year') {
    // Extract year from various formats (2024, 2024/01/15, etc.)
    const yearMatch = value.match(/^(\d{4})/);
    if (yearMatch) {
      ref.year = parseInt(yearMatch[1], 10);
    }
  } else if (field === 'date') {
    // Date format might be YYYY/MM/DD or YYYY-MM-DD
    const yearMatch = value.match(/^(\d{4})/);
    if (yearMatch && !ref.year) {
      ref.year = parseInt(yearMatch[1], 10);
    }
  } else {
    (ref as Record<string, unknown>)[field] = value;
  }
}

/**
 * Parses BibTeX format
 */
export function parseBibTeX(content: string): NormalizedReference[] {
  const references: NormalizedReference[] = [];
  // Match @type{key, ... } entries
  const entryRegex = /@(\w+)\s*\{\s*([^,]*)\s*,([^@]*)\}/g;

  let match: RegExpExecArray | null;
  while ((match = entryRegex.exec(content)) !== null) {
    const [, type, key, fields] = match;
    const ref: RawReference = {
      type: type.toLowerCase(),
      id: key.trim(),
      authors: [],
      keywords: [],
    };

    // Parse fields
    const fieldRegex = /(\w+)\s*=\s*[{"]([^}"]*)[}"]/g;
    let fieldMatch: RegExpExecArray | null;

    while ((fieldMatch = fieldRegex.exec(fields)) !== null) {
      const [, fieldName, fieldValue] = fieldMatch;
      const cleanValue = fieldValue.trim();

      switch (fieldName.toLowerCase()) {
        case 'title':
          ref.title = cleanBibTeXValue(cleanValue);
          break;
        case 'author':
          // BibTeX authors are separated by " and "
          ref.authors = cleanValue.split(/\s+and\s+/).map(a => cleanBibTeXValue(a.trim()));
          break;
        case 'year':
          ref.year = parseInt(cleanValue, 10);
          break;
        case 'journal':
        case 'journaltitle':
          ref.journal = cleanBibTeXValue(cleanValue);
          break;
        case 'abstract':
          ref.abstract = cleanBibTeXValue(cleanValue);
          break;
        case 'doi':
          ref.doi = cleanValue;
          break;
        case 'volume':
          ref.volume = cleanValue;
          break;
        case 'number':
        case 'issue':
          ref.issue = cleanValue;
          break;
        case 'pages': {
          const pageMatch = cleanValue.match(/(\d+)[-\u2013](\d+)/);
          if (pageMatch) {
            ref.startPage = pageMatch[1];
            ref.endPage = pageMatch[2];
          }
          break;
        }
        case 'url':
          ref.url = cleanValue;
          break;
        case 'keywords':
          ref.keywords = cleanValue.split(/[,;]/).map(k => k.trim());
          break;
        case 'publisher':
          ref.publisher = cleanBibTeXValue(cleanValue);
          break;
        case 'issn':
          ref.issn = cleanValue;
          break;
      }
    }

    references.push(normalizeReference(ref));
  }

  return references;
}

/**
 * Clean BibTeX special characters and braces
 */
function cleanBibTeXValue(value: string): string {
  return value
    .replace(/[{}]/g, '')
    .replace(/\\&/g, '&')
    .replace(/\\\$/g, '$')
    .replace(/\\%/g, '%')
    .replace(/\\_/g, '_')
    .replace(/\\#/g, '#')
    .replace(/\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\emph\{([^}]*)\}/g, '$1')
    .trim();
}

/**
 * Normalize a parsed reference to a consistent format
 */
function normalizeReference(ref: RawReference): NormalizedReference {
  const normalized: NormalizedReference = {
    title: ref.title || 'Untitled',
    firstAuthor: extractFirstAuthor(ref.authors),
    authors: formatAuthors(ref.authors),
    publicationYear: ref.year || null,
    journal: ref.journal || ref.journalAbbrev || null,
    abstract: ref.abstract || null,
    doi: ref.doi || null,
    volume: ref.volume || null,
    issue: ref.issue || null,
    pages: formatPages(ref.startPage, ref.endPage),
    url: ref.url || ref.pdfUrl || ref.fullTextUrl || null,
    keywords: ref.keywords || [],
    type: ref.type || 'article',
  };

  return normalized;
}

/**
 * Extract first author's last name from author list
 */
function extractFirstAuthor(authors: string[]): string | null {
  if (!authors || authors.length === 0) return null;

  const firstAuthor = authors[0];

  // Handle "Last, First" format
  if (firstAuthor.includes(',')) {
    return firstAuthor.split(',')[0].trim();
  }

  // Handle "First Last" format - take last word
  const parts = firstAuthor.trim().split(/\s+/);
  return parts[parts.length - 1];
}

/**
 * Format author list as a single string
 */
export function formatAuthors(authors: string[]): string | null {
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
 * Format page range
 */
function formatPages(start: string | undefined, end: string | undefined): string | null {
  if (!start) return null;
  if (!end || start === end) return start;
  return `${start}-${end}`;
}

/**
 * Detect file format and parse accordingly
 */
export function parseReferences(content: string, fileName = ''): NormalizedReference[] {
  const extension = fileName.toLowerCase().split('.').pop();

  // Try to detect format from extension
  if (extension === 'ris' || extension === 'enw') {
    return parseRIS(content);
  }

  if (extension === 'bib' || extension === 'bibtex') {
    return parseBibTeX(content);
  }

  // Try to auto-detect format from content
  if (content.trim().startsWith('TY  -') || content.includes('\nTY  -')) {
    return parseRIS(content);
  }

  if (content.trim().startsWith('@') || content.includes('\n@')) {
    return parseBibTeX(content);
  }

  // Default to RIS (more common)
  return parseRIS(content);
}

/**
 * Read and parse a reference file
 */
export async function parseReferenceFile(file: File): Promise<NormalizedReference[]> {
  const content = await file.text();
  return parseReferences(content, file.name);
}

/**
 * Generate display name for a reference (FirstAuthor, Year)
 */
export function getRefDisplayName(ref: NormalizedReference): string {
  const author = ref.firstAuthor || 'Unknown';
  const year = ref.publicationYear || 'n.d.';
  return `${author} (${year})`;
}

/**
 * Supported file formats and their descriptions
 */
export const SUPPORTED_FORMATS: SupportedFormat[] = [
  { extension: '.ris', name: 'RIS', description: 'EndNote, Zotero, Mendeley' },
  { extension: '.enw', name: 'EndNote', description: 'EndNote export format' },
  { extension: '.bib', name: 'BibTeX', description: 'LaTeX bibliography format' },
  { extension: '.bibtex', name: 'BibTeX', description: 'LaTeX bibliography format' },
  { extension: '.pdf', name: 'PDF', description: 'PDF files (auto-matched to references)' },
];

/**
 * Get accept string for mixed import (reference files + PDFs)
 */
export const MIXED_IMPORT_ACCEPT = '.ris,.enw,.bib,.bibtex,.pdf,application/pdf';

/**
 * Check if a file is a reference file (RIS, BibTeX, etc.)
 */
function isReferenceFile(file: File): boolean {
  const ext = file.name.toLowerCase().split('.').pop();
  return ['ris', 'enw', 'bib', 'bibtex'].includes(ext || '');
}

/**
 * Check if a file is a PDF
 */
function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Separate files into reference files and PDFs
 */
export function separateFileTypes(files: File[]): { referenceFiles: File[]; pdfFiles: File[] } {
  const referenceFiles: File[] = [];
  const pdfFiles: File[] = [];

  for (const file of files) {
    if (isPdfFile(file)) {
      pdfFiles.push(file);
    } else if (isReferenceFile(file)) {
      referenceFiles.push(file);
    }
  }

  return { referenceFiles, pdfFiles };
}
