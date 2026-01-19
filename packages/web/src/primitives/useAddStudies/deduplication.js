/**
 * Deduplication and merge logic for studies submission
 */

import { normalizeTitle } from '@/lib/pdfUtils.js';
import { normalizeDoi } from './matching.js';

/**
 * Build deduplicated studies by merging entries that match by DOI or title.
 * Priority: metadata from refs/lookups, PDF data from uploads.
 *
 * @param {Object} sources - All study sources
 * @param {Array} sources.uploadedPdfs - Uploaded PDFs store
 * @param {Array} sources.selectedRefs - Selected imported refs
 * @param {Array} sources.selectedLookups - Selected lookup refs
 * @param {Array} sources.driveFiles - Selected drive files
 * @returns {Array} Merged and deduplicated studies
 */
export function buildDeduplicatedStudies({
  uploadedPdfs,
  selectedRefs,
  selectedLookups,
  driveFiles,
}) {
  const candidates = [];

  // Add uploaded PDFs
  for (const pdf of uploadedPdfs) {
    if (pdf.title?.trim() && !pdf.extracting) {
      candidates.push({
        type: 'pdf',
        sourceId: pdf.id,
        title: pdf.title.trim(),
        doi: pdf.doi || null,
        pdfData: pdf.data,
        pdfFileName: pdf.file?.name || null,
        metadata: pdf.metadata || null,
      });
    }
  }

  // Add selected imported refs
  for (const ref of selectedRefs) {
    candidates.push({
      type: 'ref',
      sourceId: ref._id,
      title: ref.title,
      doi: ref.doi || null,
      pdfData: ref.pdfData || null,
      pdfFileName: ref.pdfFileName || null,
      pdfUrl: ref.pdfUrl || null,
      pdfSource: ref.pdfSource || null,
      pdfAccessible: ref.pdfAccessible || false,
      metadata: {
        firstAuthor: ref.firstAuthor,
        publicationYear: ref.publicationYear,
        authors: ref.authors,
        journal: ref.journal,
        abstract: ref.abstract,
        pmid: ref.pmid || null,
        url: ref.url || null,
        volume: ref.volume || null,
        issue: ref.issue || null,
        pages: ref.pages || null,
        type: ref.type || null,
        importSource: ref.importSource || 'reference-file',
      },
    });
  }

  // Add selected DOI/PMID lookups
  for (const ref of selectedLookups) {
    candidates.push({
      type: 'lookup',
      sourceId: ref._id,
      title: ref.title,
      doi: ref.doi || null,
      pdfData: ref.manualPdfData || null,
      pdfFileName: ref.manualPdfFileName || null,
      pdfUrl: ref.pdfUrl || null,
      pdfSource: ref.pdfSource || null,
      pdfAccessible: ref.pdfAccessible || false,
      metadata: {
        firstAuthor: ref.firstAuthor,
        publicationYear: ref.publicationYear,
        authors: ref.authors,
        journal: ref.journal,
        abstract: ref.abstract,
        pmid: ref.pmid || null,
        url: ref.url || null,
        volume: ref.volume || null,
        issue: ref.issue || null,
        pages: ref.pages || null,
        type: ref.type || null,
        importSource: ref.importSource || 'identifier-lookup',
      },
    });
  }

  // Add Google Drive files
  for (const file of driveFiles) {
    candidates.push({
      type: 'drive',
      sourceId: file.id,
      title: file.name.replace(/\.pdf$/i, ''),
      doi: null,
      googleDriveFileId: file.id,
      googleDriveFileName: file.name,
      metadata: null,
    });
  }

  // Deduplicate by DOI or normalized title
  const merged = [];
  const usedIndices = new Set();

  for (let i = 0; i < candidates.length; i++) {
    if (usedIndices.has(i)) continue;

    const base = candidates[i];
    const baseDoi = normalizeDoi(base.doi);
    const baseTitleNorm = normalizeTitle(base.title);

    // Find all matching candidates
    const matches = [base];
    usedIndices.add(i);

    for (let j = i + 1; j < candidates.length; j++) {
      if (usedIndices.has(j)) continue;

      const other = candidates[j];
      const otherDoi = normalizeDoi(other.doi);
      const otherTitleNorm = normalizeTitle(other.title);

      let isMatch = false;

      if (baseDoi && otherDoi && baseDoi === otherDoi) {
        isMatch = true;
      } else if (baseTitleNorm && otherTitleNorm && baseTitleNorm === otherTitleNorm) {
        isMatch = true;
      }

      if (isMatch) {
        matches.push(other);
        usedIndices.add(j);
      }
    }

    // Merge all matches into one study
    const mergedStudy = createMergedStudy(base, matches);
    merged.push(mergedStudy);
  }

  return merged;
}

/**
 * Create a merged study from multiple matching entries
 */
function createMergedStudy(base, matches) {
  // Track all sources that contributed to this merged study
  const sources = matches.map(m => ({ type: m.type, sourceId: m.sourceId }));

  const mergedStudy = {
    title: base.title,
    doi: null,
    pdfData: null,
    pdfFileName: null,
    pdfUrl: null,
    pdfSource: null,
    pdfAccessible: false,
    googleDriveFileId: null,
    googleDriveFileName: null,
    firstAuthor: null,
    publicationYear: null,
    authors: null,
    journal: null,
    abstract: null,
    importSource:
      base.type === 'pdf' ? 'pdf'
      : base.type === 'drive' ? 'google-drive'
      : base.type === 'ref' ? 'reference-file'
      : 'identifier-lookup',
    sources, // Track contributing sources for removal
  };

  for (const match of matches) {
    // Prefer richer title from metadata sources
    if (match.metadata && match.title) {
      mergedStudy.title = match.title;
    }

    if (match.doi && !mergedStudy.doi) {
      mergedStudy.doi = match.doi;
    }

    if (match.pdfData && !mergedStudy.pdfData) {
      mergedStudy.pdfData = match.pdfData;
      mergedStudy.pdfFileName = match.pdfFileName;
    }

    if (match.pdfUrl && !mergedStudy.pdfUrl) {
      mergedStudy.pdfUrl = match.pdfUrl;
      mergedStudy.pdfSource = match.pdfSource;
      mergedStudy.pdfAccessible = match.pdfAccessible;
    }

    if (match.googleDriveFileId) {
      mergedStudy.googleDriveFileId = match.googleDriveFileId;
      mergedStudy.googleDriveFileName = match.googleDriveFileName;
    }

    if (match.metadata) {
      if (match.metadata.firstAuthor) mergedStudy.firstAuthor = match.metadata.firstAuthor;
      if (match.metadata.publicationYear)
        mergedStudy.publicationYear = match.metadata.publicationYear;
      if (match.metadata.authors) mergedStudy.authors = match.metadata.authors;
      if (match.metadata.journal) mergedStudy.journal = match.metadata.journal;
      if (match.metadata.abstract) mergedStudy.abstract = match.metadata.abstract;

      if (match.type === 'ref') mergedStudy.importSource = 'reference-file';
      else if (match.type === 'lookup') mergedStudy.importSource = 'identifier-lookup';
    }
  }

  if (matches.length > 1) {
    const types = [...new Set(matches.map(m => m.type))];
    if (types.length > 1) {
      mergedStudy.importSource = 'merged';
    }
  }

  return mergedStudy;
}
