/**
 * useAddStudies - Re-export from sub-module structure
 *
 * The implementation has been refactored into domain-focused sub-modules:
 * - pdfs.js: PDF upload operations
 * - references.js: Reference file import operations
 * - lookup.js: DOI/PMID lookup operations
 * - drive.js: Google Drive operations
 * - deduplication.js: Study merging and deduplication
 * - matching.js: Shared PDF-to-reference matching utilities
 * - serialization.js: State persistence utilities
 * - index.js: Coordinator that wires sub-modules together
 */

export { useAddStudies } from './useAddStudies/index.js';
