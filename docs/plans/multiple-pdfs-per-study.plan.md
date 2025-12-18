# Multiple PDFs Per Study - Implementation Plan

## Status: IMPLEMENTED

The core multi-PDF functionality has been implemented. See Implementation Progress below.

## Overview

Enable uploading multiple PDF files per study with the ability to tag one as:

- **Primary Report** - The main publication/article
- **Protocol** - Study protocol document
- **Secondary** - Additional supplementary PDFs (default)

## Current State

### Data Storage

- PDF binaries stored in R2 bucket (`corates-pdfs`)
- PDF metadata stored in Y.js documents within Durable Objects
- R2 key format: `projects/{projectId}/studies/{studyId}/{fileName}`
- No D1 database tables for study PDFs

### Y.js Structure (Current)

```
Y.Doc
├── reviews (Y.Map)
│   └── {studyId} (Y.Map)
│       ├── name
│       ├── checklists (Y.Map)
│       └── pdfs (Y.Map)
│           └── {fileName} (Y.Map)
│               ├── key (R2 key)
│               ├── fileName
│               ├── size
│               ├── uploadedBy
│               └── uploadedAt
```

### Limitation

The frontend explicitly deletes existing PDFs before uploading new ones (single PDF enforced).

---

## Proposed Changes

### Phase 1: Y.js Schema Update

Update the PDF metadata structure to support multiple PDFs with tags:

```
pdfs (Y.Map)
└── {pdfId} (Y.Map)      // Changed: Use unique ID instead of fileName
    ├── id               // New: Unique identifier (nanoid)
    ├── key              // R2 storage key
    ├── fileName         // Original filename
    ├── size
    ├── uploadedBy
    ├── uploadedAt
    └── tag              // New: 'primary' | 'protocol' | 'secondary'
```

**Files to modify:**

- [packages/web/src/stores/project-store.js](packages/web/src/stores/project-store.js) - Update selectors/getters
- [packages/web/src/primitives/useProject/pdfs.js](packages/web/src/primitives/useProject/pdfs.js) - Update Y.js operations
- [packages/web/src/primitives/useProject/index.js](packages/web/src/primitives/useProject/index.js) - Export new functions

### Phase 2: Update PDF Primitives

#### 2.1 Update `pdfs.js` primitive

```js
// New/modified functions needed:

// Add PDF with tag support
export function addStudyPdf(projectStore, studyId, pdfData, tag = 'secondary') {
  const pdfId = nanoid();
  // ... add to Y.Map with pdfId as key
}

// Update PDF tag
export function updatePdfTag(projectStore, studyId, pdfId, tag) {
  // ... update tag field in Y.Map
}

// Get PDFs by tag
export function getStudyPdfsByTag(projectStore, studyId, tag) {
  // ... filter PDFs by tag
}

// Get primary PDF
export function getPrimaryPdf(projectStore, studyId) {
  // ... return PDF with tag='primary'
}

// Get protocol PDF
export function getProtocolPdf(projectStore, studyId) {
  // ... return PDF with tag='protocol'
}

// Remove specific PDF by ID
export function removeStudyPdf(projectStore, studyId, pdfId) {
  // ... remove from Y.Map
}

// Set as primary (ensure only one primary)
export function setPdfAsPrimary(projectStore, studyId, pdfId) {
  // ... clear existing primary, set new one
}

// Set as protocol (ensure only one protocol)
export function setPdfAsProtocol(projectStore, studyId, pdfId) {
  // ... clear existing protocol, set new one
}
```

**Files to modify:**

- [packages/web/src/primitives/useProject/pdfs.js](packages/web/src/primitives/useProject/pdfs.js)

### Phase 3: Update PDF Handler

Modify the PDF operations handler to support multiple uploads:

```js
// Remove the single-PDF enforcement
// Before: Delete existing PDF before upload
// After: Just add new PDF alongside existing ones

const handleUploadPdf = async (file, tag = 'secondary') => {
  // Upload to R2
  // Add metadata to Y.js with tag
  // If tag is 'primary' or 'protocol', clear existing tag from other PDFs
};
```

**Files to modify:**

- [packages/web/src/primitives/usePdfOperations.jsx](packages/web/src/primitives/usePdfOperations.jsx)

### Phase 4: Update Project Store Selectors

Add derived signals for convenient access:

```js
// In project-store.js or as separate selectors

export const studyPdfs = studyId =>
  createMemo(() => {
    // Return all PDFs for a study
  });

export const primaryPdf = studyId =>
  createMemo(() => {
    // Return primary PDF or null
  });

export const protocolPdf = studyId =>
  createMemo(() => {
    // Return protocol PDF or null
  });

export const secondaryPdfs = studyId =>
  createMemo(() => {
    // Return array of secondary PDFs
  });
```

**Files to modify:**

- [packages/web/src/stores/project-store.js](packages/web/src/stores/project-store.js)

### Phase 5: UI Components

#### 5.1 PDF List Component (New)

Create a component to display all PDFs for a study with tag management:

```
packages/web/src/components/pdf/
├── PdfList.jsx           // List all PDFs for a study
├── PdfListItem.jsx       // Single PDF row with actions
├── PdfTagBadge.jsx       // Visual badge for tag type
├── PdfTagSelect.jsx      // Dropdown to change tag
└── index.js              // Barrel export
```

Features:

- Display all PDFs with their tags (badge indicators)
- View/download PDF
- Delete PDF (with confirmation)
- Change tag dropdown
- Visual distinction for primary/protocol/secondary
- Drag to reorder (optional, future)

#### 5.2 Update Study Edit Panel

Modify the study edit/details panel to show the new PDF list:

**Files to modify:**

- [packages/web/src/components/checklist-ui/StudyPanel.jsx](packages/web/src/components/checklist-ui/StudyPanel.jsx) (or similar)
- Add PDF upload button that opens file picker
- Show PdfList component with all study PDFs
- Option to set primary/protocol on upload or after

#### 5.3 Update PDF Viewer

The PDF viewer should indicate which PDF is being viewed:

**Files to modify:**

- [packages/web/src/components/checklist-ui/PdfViewer.jsx](packages/web/src/components/checklist-ui/PdfViewer.jsx)
- Add tabs or dropdown to switch between study PDFs
- Show current PDF's tag
- Quick navigation between primary/protocol/secondary

#### 5.4 Update Batch Upload (Add Studies Form)

Modify the batch upload to allow tagging during import:

**Files to modify:**

- [packages/web/src/components/add-studies/BatchPdfUpload.jsx](packages/web/src/components/add-studies/BatchPdfUpload.jsx)
- First PDF uploaded automatically tagged as 'primary'
- Option to specify tag during upload
- Match PDFs to studies by filename pattern (optional enhancement)

---

## Implementation Order

### Step 1: Core Infrastructure - COMPLETED

1. [x] Update Y.js PDF structure in `pdfs.js` primitive
2. [x] Update project store selectors
3. [ ] Test with console/dev tools

> **Note:** Since this project is not yet in production, no migration is needed. We can implement the new structure directly without backward compatibility concerns.

### Step 2: PDF Management UI - COMPLETED

1. [x] Create PdfList component and related sub-components
2. [x] Integrate into StudyPanel (via ChecklistYjsWrapper)
3. [ ] Test CRUD operations on PDFs

### Step 3: Upload Flow Updates - COMPLETED

1. [x] Update useProjectPdfHandlers to not delete existing PDFs
2. [x] Add tag selection to upload flow
3. [x] Auto-tag first upload as primary

### Step 4: PDF Viewer Updates - COMPLETED

1. [x] Add PDF switcher to viewer (PdfSelector component)
2. [x] Show current PDF info/tag
3. [ ] Test multi-PDF viewing workflow

### Step 5: Batch Upload Updates - DEFERRED

The batch upload currently creates one study per PDF. Matching multiple PDFs to a single study is a more complex feature deferred to future work.

1. [ ] Update PdfUploadSection for multiple PDFs per study
2. [ ] Add tag assignment UI
3. [ ] Smart matching (optional)

---

## Implementation Progress

### Files Created

- `packages/web/src/components/checklist-ui/pdf/PdfTagBadge.jsx` - Visual badge for tag types
- `packages/web/src/components/checklist-ui/pdf/PdfTagSelect.jsx` - Dropdown for changing tags
- `packages/web/src/components/checklist-ui/pdf/PdfListItem.jsx` - Single PDF row with actions
- `packages/web/src/components/checklist-ui/pdf/PdfList.jsx` - List all PDFs for a study
- `packages/web/src/components/checklist-ui/pdf/PdfSelector.jsx` - Dropdown to select PDF in viewer
- `packages/web/src/components/checklist-ui/pdf/index.js` - Barrel export

### Files Modified

- `packages/web/src/primitives/useProject/pdfs.js` - Updated with tag support and new operations
- `packages/web/src/primitives/useProject/sync.js` - Updated to sync tag field
- `packages/web/src/primitives/useProject/index.js` - Exported new PDF operations
- `packages/web/src/stores/projectStore.js` - Added PDF selectors
- `packages/web/src/primitives/useProjectPdfHandlers.js` - Updated for multi-PDF support
- `packages/web/src/components/checklist-ui/ChecklistYjsWrapper.jsx` - Added PDF selector support

---

## UI/UX Considerations

### Tag Visual Design

- **Primary**: Blue badge, star icon
- **Protocol**: Purple badge, document icon
- **Secondary**: Do not display any tag (implied unimportance)

### Default Behavior

- First PDF uploaded to a study is automatically tagged as 'primary'
- Subsequent uploads default to 'secondary'
- User can change tags anytime
- Only one 'primary' and one 'protocol' allowed per study

### Validation Rules

- Cannot delete primary PDF if it's the only PDF (warn user)
- Changing a PDF to 'primary' automatically demotes current primary to 'secondary'
- Same for 'protocol' tag

---

## API Considerations

The existing R2 API endpoints don't need changes since they're already designed to handle multiple files per study (the limitation was only in the frontend). The endpoints support:

- `GET /api/projects/:projectId/studies/:studyId/pdfs` - Already returns a list
- `POST /api/projects/:projectId/studies/:studyId/pdfs` - Already supports adding
- `DELETE /api/projects/:projectId/studies/:studyId/pdfs/:filename` - Already supports deleting individual files

The tag metadata is stored in Y.js, not R2, so no API changes needed.

---

## Testing Checklist

- [ ] Upload multiple PDFs to a single study
- [ ] View list of all PDFs for a study
- [ ] Change PDF tag (primary/protocol/secondary)
- [ ] Delete individual PDF
- [ ] Primary tag auto-moves when another PDF set as primary
- [ ] Protocol tag auto-moves when another PDF set as protocol
- [ ] PDF viewer can switch between study PDFs
- [ ] Batch upload assigns correct default tags
- [ ] Offline caching works with multiple PDFs
- [ ] Y.js sync works correctly with multiple PDFs

---

## Future Enhancements (Out of Scope)

- PDF version history
- Thumbnail previews
- Automatic metadata extraction per PDF
- PDF comparison view
- Drag-and-drop reordering of secondary PDFs
- Bulk tag assignment
- PDF deduplication across studies
