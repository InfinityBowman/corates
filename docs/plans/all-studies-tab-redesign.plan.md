# AllStudiesTab Redesign Plan

## Current Problems

1. **Cramped single-line layout** - Each study is a single row with too many actions crammed together
2. **PDF management is hidden** - No visibility into multiple PDFs per study
3. **Edit modal does too much** - Combines metadata editing, reviewer assignment, and should include PDF management
4. **Inline name editing is awkward** - Edit button next to name triggers inline edit
5. **No expandable detail view** - Can't see study details without opening a modal

## Proposed Design

### Study Card Layout (Expandable)

Each study becomes an expandable card showing PDFs when expanded:

```
┌─────────────────────────────────────────────────────────────────┐
│ ▶ Smith et al. (2024)                        [Reviewers] [⋮]   │
│   Journal of Clinical Research                                  │
└─────────────────────────────────────────────────────────────────┘

Expanded:
┌─────────────────────────────────────────────────────────────────┐
│ ▼ Smith et al. (2024)                        [Reviewers] [⋮]   │
│   Journal of Clinical Research                                  │
├─────────────────────────────────────────────────────────────────┤
│ PDFs                                              [+ Add PDF]   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📄 smith-2024-main.pdf          ⭐ Primary    [View] [⋮]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📄 smith-2024-protocol.pdf      📋 Protocol   [View] [⋮]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📄 supplementary.pdf                          [View] [⋮]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Component Structure

```
all-studies/
├── AllStudiesTab.jsx           # Main tab component (refactored)
├── study-card/
│   ├── StudyCard.jsx           # Expandable study card (header + content)
│   ├── StudyCardHeader.jsx     # Collapsed view with name, citation, reviewers
│   ├── StudyPdfSection.jsx     # PDF list within study card
│   ├── StudyActionsMenu.jsx    # Dropdown menu (edit metadata, assign reviewers, delete)
│   └── index.js
├── EditStudyMetadataModal.jsx  # Modal for citation info
├── AssignReviewersModal.jsx    # Modal for reviewer assignment
└── index.js
```

### Actions Menu (⋮ button)

Replaces the scattered action buttons with a clean dropdown:

- **Edit Metadata** → Opens modal for citation info (title, author, year, journal, DOI, abstract)
- **Assign Reviewers** → Opens modal or inline UI for reviewer assignment
- **Delete Study** → Confirmation dialog

### Reviewer Display

Keep the reviewer badges visible in the header row, but clicking them opens assignment UI.

### PDF Section Features

- Uses existing `PdfList` component (already created)
- Add PDF button with file picker + Google Drive option
- Each PDF shows: filename, tag badge, view button, actions menu
- Actions: View, Download, Change Tag, Delete

---

## Implementation Steps

### Step 1: Create StudyActionsMenu Component

A dropdown menu with:

- Edit Metadata
- Assign Reviewers
- Divider
- Delete Study (red/destructive)

### Step 2: Create StudyCardHeader Component

Extract and clean up the header row:

- Expand/collapse toggle
- Study name (display name or "Author (Year)")
- Citation info (author, year, journal) - DOI stays in edit modal
- Reviewer badges
- Actions menu

### Step 3: Create StudyPdfSection Component

Wrapper around `PdfList` that:

- Passes study PDFs
- Handles upload via file input + Google Drive
- Connects to PDF handlers

### Step 4: Create StudyCard Component

Combines header + collapsible content:

- Uses Zag Collapsible or custom expand/collapse
- Manages expanded state
- Renders header and PDF section

### Step 5: Refactor AllStudiesTab

- Replace current inline rendering with StudyCard components
- Remove EditStudyModal usage (split into separate modals)
- Keep AddStudiesForm at top

### Step 6: Split EditStudyModal

Create two focused modals:

1. **EditStudyMetadataModal** - Citation info only
2. **AssignReviewersModal** - Reviewer 1 & 2 assignment

---

## UI/UX Considerations

### Default State

- Studies start collapsed
- Auto-expand newly created studies
- Remember expand state in localStorage (optional, future)

### Visual Hierarchy

- Study name is most prominent
- Citation info is secondary (smaller, gray)
- PDFs are tertiary (only visible when expanded)

### Responsive Design

- Cards stack vertically on mobile
- Actions menu moves to bottom on narrow screens (optional)

### Accessibility

- Expand/collapse button is keyboard accessible
- Actions menu is accessible dropdown
- Focus management when opening/closing

---

## Files to Create

1. `packages/web/src/components/project-ui/all-studies/study-card/StudyCard.jsx`
2. `packages/web/src/components/project-ui/all-studies/study-card/StudyCardHeader.jsx`
3. `packages/web/src/components/project-ui/all-studies/study-card/StudyPdfSection.jsx`
4. `packages/web/src/components/project-ui/all-studies/study-card/StudyActionsMenu.jsx`
5. `packages/web/src/components/project-ui/all-studies/study-card/index.js`
6. `packages/web/src/components/project-ui/all-studies/EditStudyMetadataModal.jsx`
7. `packages/web/src/components/project-ui/all-studies/AssignReviewersModal.jsx`
8. `packages/web/src/components/project-ui/all-studies/index.js`

## Files to Move/Refactor

1. `packages/web/src/components/project-ui/tabs/AllStudiesTab.jsx` → Move to `all-studies/AllStudiesTab.jsx`
2. `packages/web/src/components/project-ui/EditStudyModal.jsx` → Delete (replaced by new modals)

## Files to Modify

1. `packages/web/src/components/project-ui/tabs/index.js` - Update import path for AllStudiesTab

---

## Questions to Consider

1. Should expand state persist across page refreshes?
2. Should we add bulk actions (select multiple studies)?
3. Should PDF upload have a tag selector in the file picker?
4. Should we show a PDF preview thumbnail?
