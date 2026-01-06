# Robust PDF Upload and Validation Plan

Created: 2026-01-06

## Overview

This plan outlines improvements to PDF upload/validation across the CoRATES application, addressing security concerns from the security audit and improving robustness, error handling, and user experience.

## Current State Assessment

### What Exists

**Backend (`packages/workers/src/routes/orgs/pdfs.js`):**

- File size validation (50MB limit via `FILE_SIZE_LIMITS.PDF`)
- Magic bytes validation (checks `%PDF-` header)
- Filename validation (no slashes, control chars, quotes, max 200 chars)
- Auto-rename for duplicates (`generateUniqueFileName`)
- R2 storage with metadata
- Database tracking via `mediaFiles` table
- Domain error responses for all failure cases

**Frontend:**

- `uploadPdf()` in `api/pdf-api.js` using FormData
- IndexedDB caching via `pdfCache.js`
- PDF metadata extraction (title, DOI) via EmbedPDF
- MIME type check (`file.type === 'application/pdf'`)

### Gaps and Issues

1. **No client-side size validation** - Large files are sent before rejection
2. **Inconsistent validation** - Frontend only checks MIME type, not magic bytes
3. **Limited metadata extraction error handling** - Failures during extraction aren't well communicated
4. **No quota enforcement** - No limit on total storage per org/project
5. **Missing audit logging** - No tracking of upload/delete events

---

## Implementation Plan

### Phase 1: Client-Side Validation (Priority: High)

**Goal:** Reject invalid files before network transfer

#### 1.1 Add Shared PDF Validation to `@corates/shared`

**File:** `packages/shared/src/pdf.js`

```javascript
/**
 * Shared PDF validation constants and utilities
 * Used by both web (frontend) and workers (backend)
 */

/**
 * PDF file limits
 */
export const PDF_LIMITS = {
  MAX_SIZE: 50 * 1024 * 1024, // 50 MB
  MAX_FILENAME_LENGTH: 200,
};

/**
 * PDF magic bytes signature: %PDF-
 */
export const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d];

/**
 * Validate filename for PDF uploads
 * @param {string} fileName - Filename to validate
 * @returns {boolean} True if valid
 */
export function isValidPdfFilename(fileName) {
  if (!fileName) return false;
  if (fileName.length > PDF_LIMITS.MAX_FILENAME_LENGTH) return false;
  if (/[\\/]/.test(fileName)) return false;
  if (/\p{C}/u.test(fileName)) return false;
  if (fileName.includes('"')) return false;
  return true;
}

/**
 * Check if bytes match PDF magic signature
 * @param {Uint8Array} bytes - First 5+ bytes of file
 * @returns {boolean} True if valid PDF signature
 */
export function isPdfSignature(bytes) {
  return PDF_MAGIC_BYTES.every((byte, i) => bytes[i] === byte);
}

/**
 * Format file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

**Update:** `packages/shared/src/index.js` - Export new PDF utilities

```javascript
export * from './pdf.js';
```

#### 1.2 Create Frontend Validation Wrapper

**File:** `packages/web/src/lib/pdfValidation.js`

```javascript
/**
 * PDF validation for frontend (wraps shared utilities)
 */
import { PDF_LIMITS, isValidPdfFilename, isPdfSignature, formatFileSize } from '@corates/shared';

export { PDF_LIMITS, formatFileSize };

/**
 * Validate a PDF file before upload
 * @param {File} file - File to validate
 * @returns {Promise<{valid: boolean, error?: string, details?: object}>}
 */
export async function validatePdfFile(file) {
  // 1. Check file size
  if (file.size > PDF_LIMITS.MAX_SIZE) {
    return {
      valid: false,
      error: 'FILE_TOO_LARGE',
      details: {
        fileSize: file.size,
        maxSize: PDF_LIMITS.MAX_SIZE,
        message: `File size (${formatFileSize(file.size)}) exceeds ${formatFileSize(PDF_LIMITS.MAX_SIZE)} limit`,
      },
    };
  }

  // 2. Check MIME type
  if (file.type !== 'application/pdf') {
    return {
      valid: false,
      error: 'INVALID_FILE_TYPE',
      details: {
        fileType: file.type || 'unknown',
        message: 'File must be a PDF document',
      },
    };
  }

  // 3. Check filename
  if (!isValidPdfFilename(file.name)) {
    return {
      valid: false,
      error: 'INVALID_FILENAME',
      details: {
        fileName: file.name,
        message: 'Invalid filename. Avoid special characters and keep under 200 characters.',
      },
    };
  }

  // 4. Check magic bytes
  try {
    const slice = file.slice(0, 5);
    const buffer = await slice.arrayBuffer();
    const header = new Uint8Array(buffer);

    if (!isPdfSignature(header)) {
      return {
        valid: false,
        error: 'INVALID_PDF_SIGNATURE',
        details: {
          message: 'File content does not appear to be a valid PDF',
        },
      };
    }
  } catch (err) {
    // If we can't read the header, let backend validate
    console.warn('Could not validate PDF header:', err);
  }

  return { valid: true };
}
```

#### 1.3 Update Upload Components

Update all PDF upload entry points to use validation:

- `StudyPdfSection.jsx` - Main study PDF upload
- `PdfUploadSection.jsx` - Add studies flow
- `ChecklistYjsWrapper.jsx` - Checklist PDF upload
- `CreateLocalChecklist.jsx` - Local checklist creation

**Pattern:**

```javascript
import { validatePdfFile } from '@/lib/pdfValidation.js';

const handleFileSelect = async file => {
  const validation = await validatePdfFile(file);
  if (!validation.valid) {
    showToast.error('Invalid File', validation.details.message);
    return;
  }
  // Proceed with upload
};
```

#### Tasks

- [ ] Create `packages/shared/src/pdf.js` with shared constants and utilities
- [ ] Export from `packages/shared/src/index.js`
- [ ] Add unit tests for shared validation functions
- [ ] Create `packages/web/src/lib/pdfValidation.js` (frontend wrapper)
- [ ] Update `StudyPdfSection.jsx` to use validation
- [ ] Update `PdfUploadSection.jsx` to use validation
- [ ] Update `ChecklistYjsWrapper.jsx` to use validation
- [ ] Update `CreateLocalChecklist.jsx` to use validation
- [ ] Update `packages/workers/src/routes/orgs/pdfs.js` to use shared utilities
- [ ] Remove duplicate `FILE_SIZE_LIMITS.PDF` from `config/constants.js`

---

### Phase 2: Backend Enhancements (Priority: Medium)

**Goal:** Improve backend robustness and security, using shared validation

#### 2.1 Update Backend to Use Shared Utilities

**File:** `packages/workers/src/routes/orgs/pdfs.js`

```javascript
import { PDF_LIMITS, isPdfSignature, isValidPdfFilename } from '@corates/shared';

// Replace hardcoded FILE_SIZE_LIMITS.PDF with PDF_LIMITS.MAX_SIZE
// Replace inline magic bytes check with isPdfSignature()
// Replace isValidFileName() with isValidPdfFilename()
```

#### 2.2 Enhanced Validation (Optional)

Add to `packages/shared/src/pdf.js` if needed:

```javascript
/**
 * Extended PDF validation (checks EOF marker)
 * @param {ArrayBuffer} pdfData - Full PDF data
 * @returns {{valid: boolean, error?: string}}
 */
export function validatePdfStructure(pdfData) {
  const bytes = new Uint8Array(pdfData);

  // Check magic bytes
  if (!isPdfSignature(bytes.slice(0, 5))) {
    return { valid: false, error: 'Not a valid PDF file' };
  }

  // Check for EOF marker (basic structural validation)
  const footer = bytes.slice(-10);
  const footerStr = String.fromCharCode(...footer);
  if (!footerStr.includes('%%EOF')) {
    return { valid: false, error: 'PDF appears to be corrupted (missing EOF)' };
  }

  return { valid: true };
}
```

#### 4.2 Audit Logging

Log all PDF operations for audit trail:

```javascript
/**
 * Log PDF operation for audit
 */
async function logPdfOperation(db, operation, details) {
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    type: 'pdf_operation',
    operation, // upload, delete, download
    userId: details.userId,
    orgId: details.orgId,
    projectId: details.projectId,
    studyId: details.studyId,
    resourceId: details.fileId,
    metadata: JSON.stringify({
      fileName: details.fileName,
      fileSize: details.fileSize,
    }),
    createdAt: new Date(),
  });
}
```

#### 4.3 Storage Quota Enforcement

Implement org/project storage limits:

```javascript
/**
 * Check if upload would exceed storage quota
 */
async function checkStorageQuota(db, orgId, projectId, fileSize) {
  // Get current storage usage
  const usage = await db
    .select({ total: sql`SUM(file_size)` })
    .from(mediaFiles)
    .where(eq(mediaFiles.orgId, orgId))
    .get();

  const currentUsage = usage?.total || 0;
  const orgQuota = await getOrgStorageQuota(db, orgId);

  if (currentUsage + fileSize > orgQuota) {
    return {
      allowed: false,
      currentUsage,
      quota: orgQuota,
      required: fileSize,
    };
  }

  return { allowed: true };
}
```

#### Tasks

- [ ] Add enhanced PDF validation (EOF check, version check)
- [ ] Create audit log table and logging function
- [ ] Implement storage quota checking
- [ ] Add quota exceeded error response
- [ ] Add tests for quota enforcement

---

### Phase 3: Metadata Extraction Improvements (Priority: Low)

**Goal:** More reliable metadata extraction with better error handling

#### 5.1 Graceful Degradation

- If title extraction fails, use filename (without extension)
- If DOI extraction fails, continue without DOI
- Show user-friendly messages for extraction failures

#### 5.2 Async Extraction

Move metadata extraction to background:

1. Upload file immediately
2. Start extraction in background
3. Update metadata when extraction completes
4. Show "Extracting metadata..." indicator

#### Tasks

- [ ] Add extraction timeout handling
- [ ] Implement background extraction pattern
- [ ] Add UI for extraction status
- [ ] Update error messages for extraction failures

---

### Phase 4: Testing (Priority: High)

#### 4.1 Frontend Tests

```javascript
// pdfValidation.test.js
describe('validatePdfFile', () => {
  it('should reject files over 50MB');
  it('should reject non-PDF MIME types');
  it('should reject files without PDF magic bytes');
  it('should reject invalid filenames');
  it('should accept valid PDF files');
});
```

#### 4.2 Backend Tests

```javascript
// pdfs.test.js (additions)
describe('PDF Upload Validation', () => {
  it('should reject corrupted PDFs (missing EOF)');
  it('should reject when quota exceeded');
  it('should log upload to audit log');
  it('should handle concurrent duplicate uploads');
});
```

#### Tasks

- [ ] Add frontend validation tests
- [ ] Add backend quota tests
- [ ] Add audit logging tests
- [ ] Add E2E upload flow tests

---

## Implementation Order

### Sprint 1 (High Priority)

1. **Phase 1.1** - Create shared PDF utilities in `@corates/shared`
2. **Phase 1.2** - Create frontend validation wrapper
3. **Phase 1.3** - Update upload components
4. **Phase 4** - Add tests for shared and frontend validation

### Sprint 2 (Medium Priority)

1. **Phase 2.1** - Update backend to use shared utilities
2. **Phase 2.3** - Audit logging
3. **Phase 2.4** - Storage quota enforcement

### Sprint 3 (Low Priority)

1. **Phase 3** - Metadata extraction improvements
2. Final testing and documentation

---

## Files to Modify/Create

### New Files

- `packages/shared/src/pdf.js` - Shared constants and validation utilities
- `packages/shared/src/__tests__/pdf.test.js` - Tests for shared utilities
- `packages/web/src/lib/pdfValidation.js` - Frontend validation wrapper
- `packages/web/src/lib/__tests__/pdfValidation.test.js` - Frontend validation tests

### Modified Files

- `packages/shared/src/index.js` - Export PDF utilities
- `packages/web/src/components/project/all-studies-tab/study-card/StudyPdfSection.jsx`
- `packages/web/src/components/project/add-studies/PdfUploadSection.jsx`
- `packages/web/src/components/checklist/ChecklistYjsWrapper.jsx`
- `packages/web/src/components/checklist/CreateLocalChecklist.jsx`
- `packages/web/src/primitives/useAddStudies/pdfs.js`
- `packages/workers/src/routes/orgs/pdfs.js` - Use shared utilities
- `packages/workers/src/routes/__tests__/pdfs.test.js`
- `packages/workers/src/config/constants.js` - Remove `FILE_SIZE_LIMITS.PDF` (moved to shared)

---

## Success Criteria

1. **Validation** - Invalid files rejected before upload starts
2. **Error Messages** - Clear, actionable error messages for all failure cases
3. **Quota** - Uploads blocked when org quota exceeded
4. **Audit** - All PDF operations logged
5. **Tests** - 90%+ coverage for validation logic

---

## Related Documents

- [Security Audit H3: File Upload Validation](../audits/security-audit-2026-01.md#h3-file-upload-validation)
- [API Actions Diagrams - PDF Upload Flow](../architecture/diagrams/07-api-actions.md)
- [PDF Handling Rules](../../.cursor/rules/pdf-handling.mdc)
