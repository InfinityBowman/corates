# Plan: Project Creation Wizard

**Status:** Draft
**Created:** 2026-01-18
**Last Updated:** 2026-01-18

---

## Overview

Project creation uses a progressive setup flow where the project is created immediately (Step 1), then the user is guided through optional configuration steps (Team, Studies, Assignment). Each step uses the same component that appears in project management, ensuring consistent UX and no duplicated code.

Users can exit the wizard at any point - the project exists and can be configured later through the standard project UI.

## Architecture Principle

**One component, two contexts.** Each configuration panel (Team, Studies, Assignment) is a standalone component that:

- Renders identically in the wizard flow and in project settings
- Operates on a real project (not wizard state)
- Saves changes immediately (no "submit all at once")

The wizard is simply a guided wrapper that presents these components in sequence with a stepper UI.

## Prerequisites

- Existing team/organization membership system
- Study import infrastructure (PDF upload, reference parsing)
- Google Drive integration for PDF import
- DOI/PMID metadata lookup service

## Goals

1. Guide new users through complete project setup with a stepper UI
2. Allow experienced users to skip wizard and configure manually
3. Reuse components between wizard and project management (no duplication)
4. Enable flexible, incremental project configuration
5. Reduce time-to-first-review while remaining non-prescriptive

## Non-Goals

- Forcing users through the wizard (it's optional guidance)
- Atomic/transactional project creation (project exists after step 1)
- Draft projects (project is real immediately)
- Bulk project creation or templates (future enhancement)

---

## User Flows

### Flow A: Guided Wizard (New Users)

```
Create Project → [Project Created] → Team Panel → Studies Panel → Assignment Panel → Done
                                         ↓             ↓               ↓
                                    (can exit)    (can exit)      (can exit)
```

### Flow B: Manual Setup (Experienced Users)

```
Create Project → [Project Created] → Exit to Project View → Configure via Settings/Tabs
```

### Flow C: Hybrid

```
Create Project → Team Panel → Exit → (later) → Studies Tab → Add Studies
```

All flows result in the same project state - the wizard is just one path to get there.

---

## Component Architecture

### Shared Panels

These components are used in both the wizard and project management:

| Component            | Wizard Context   | Management Context               |
| -------------------- | ---------------- | -------------------------------- |
| `TeamPanel`          | Step 2 of wizard | Project Settings > Team          |
| `StudiesImportPanel` | Step 3 of wizard | Studies Tab > Add Studies button |
| `AssignmentPanel`    | Step 4 of wizard | Studies Tab > Manage Assignments |

Each panel:

- Receives `projectId` as prop
- Fetches/mutates project data directly
- Has no wizard-specific logic
- Can be used standalone or within wizard wrapper

### Wizard Wrapper

```tsx
<ProjectWizard projectId={id}>
  <WizardStep step={1} label='Basics'>
    <ProjectBasicsForm /> {/* Only used here, creates project */}
  </WizardStep>
  <WizardStep step={2} label='Team'>
    <TeamPanel projectId={id} />
  </WizardStep>
  <WizardStep step={3} label='Studies'>
    <StudiesImportPanel projectId={id} />
  </WizardStep>
  <WizardStep step={4} label='Assignment'>
    <AssignmentPanel projectId={id} />
  </WizardStep>
</ProjectWizard>
```

The wrapper provides:

- Stepper UI showing progress
- Next/Back/Skip navigation
- "Exit to Project" option on every step
- Completion celebration on final step

---

## Step Specifications

### Step 1: Create Project

**Purpose:** Create the project shell. This is the only wizard-specific step.

**Fields:**

| Field           | Type         | Required | Notes                                |
| --------------- | ------------ | -------- | ------------------------------------ |
| Project Name    | text         | Yes      | 3-100 characters                     |
| Description     | textarea     | No       | Optional, supports markdown          |
| Checklist Types | multi-select | Yes      | One or more: AMSTAR2, ROBINS-I, etc. |
| Registration ID | text         | No       | PROSPERO or other registry ID        |

**Behavior:**

- On submit, project is created via API
- User becomes Owner automatically
- Wizard advances to Step 2 with real `projectId`

**Validation:**

- Name must be unique within the organization
- At least one checklist type must be selected

**UI Notes:**

- Clean, focused form
- Checklist type selector shows brief description of each option
- No "skip" option - project must be created to proceed

---

### Step 2: Team Panel

**Purpose:** Add team members and assign roles.

**This is the same `TeamPanel` component used in Project Settings > Team.**

**Roles:**

| Role   | Permissions                                                        |
| ------ | ------------------------------------------------------------------ |
| Owner  | Full access: manage team, reconcile, edit settings, delete project |
| Member | Can review assigned studies, view all project data                 |

**Features:**

1. **Add Members**
   - Email input with role selector (Owner/Member)
   - Autocomplete for organization members
   - Batch add support (comma-separated)
   - Invites sent immediately when added

2. **Member List**
   - Shows all members with role badges
   - Pending invite indicator for non-org members
   - Role change dropdown
   - Remove button

3. **Wizard-Specific UI**
   - "Skip for now" button (can add members later)
   - Helper text: "You can always add more team members later"

**Validation:**

- Warning if fewer than 2 members for dual-review workflow
- Warning is non-blocking (user can proceed)

---

### Step 3: Studies Import Panel

**Purpose:** Import studies from various sources.

**This is the same `StudiesImportPanel` component used in Studies Tab > Add Studies.**

#### Import Sources (Tabs)

**Tab: PDF Upload**

- Drag-and-drop zone for PDF files
- Multi-file upload support
- Extracts metadata from PDF (title, authors, DOI if available)
- Progress indicator for uploads
- Studies created immediately as uploads complete

**Tab: DOI/PMID Lookup**

- Text input for DOI or PMID (one per line or comma-separated)
- "Lookup" button fetches metadata from CrossRef/PubMed
- Results shown with confirm/add action
- Option to attach PDF after lookup

**Tab: Reference File**

- Upload RIS, BibTeX, EndNote XML, or CSV
- Parser extracts all references
- Preview table before import
- Field mapping UI for CSV
- Bulk add to project

**Tab: Google Drive**

- "Connect Google Drive" button (OAuth if not connected)
- Folder browser for selecting PDFs
- Multi-select with "Import Selected" button
- PDFs downloaded to CoRATES storage on import

#### Deduplication

- Automatic detection on import (exact DOI, fuzzy title match)
- Warning shown before adding duplicate
- User chooses: "Add anyway" or "Skip"

#### PDF Matching

- For references without PDFs, suggest matches from uploaded PDFs
- Auto-match by DOI or title similarity
- Manual drag-drop matching

#### Primary vs Secondary PDFs

- Per-study PDF list with drag to reorder
- First position = primary (shown in viewer)
- Secondary PDFs available as attachments

**Wizard-Specific UI:**

- "Skip for now" button
- Counter showing studies added this session
- Helper text: "You can import more studies anytime from the Studies tab"

---

### Step 4: Assignment Panel

**Purpose:** Configure and run reviewer assignment.

**This is the same `AssignmentPanel` component used in Studies Tab > Manage Assignments.**

#### Assignment Strategy

| Strategy    | Description                                    |
| ----------- | ---------------------------------------------- |
| Random      | Randomly assign members, balanced distribution |
| Round-Robin | Cycle through members in order                 |
| Manual      | Assign individually per study                  |

#### Configuration Options

| Option              | Type     | Default | Notes                                     |
| ------------------- | -------- | ------- | ----------------------------------------- |
| Reviewers per Study | number   | 2       | Standard dual-review; 1 for single-review |
| Include Owners      | checkbox | true    | Whether owners are in assignment pool     |
| Balanced Load       | checkbox | true    | Ensure equal distribution                 |

#### Assignment Preview

Before applying, show:

**Summary Table:**

```
Member              | Assigned | Percentage
--------------------|----------|------------
sarah@example.com   | 12       | 50%
michael@example.com | 12       | 50%
```

**Per-Study View:**

- Table showing each study and assigned members
- Click to manually adjust
- "Regenerate" button to re-randomize

**Actions:**

- "Apply Assignments" - saves to project
- "Clear All" - removes all assignments

**Wizard-Specific UI:**

- "Skip for now" button
- Disabled state if no studies or fewer than 2 members
- Helper text explaining why assignment is disabled (if applicable)

---

### Wizard Completion

After Step 4 (or when user clicks "Finish" on any step):

- Show completion message with summary
- "Go to Project" button
- Optional: brief tour of project view highlighting where to find each panel

---

## Technical Details

### No Wizard State

Since each step operates on the real project, there's no wizard-specific state to manage. The only "state" is:

- Current step number (URL param or local state)
- Project ID (from step 1 creation)

```typescript
// Wizard just tracks position, not data
interface WizardNavState {
  projectId: string;
  currentStep: 1 | 2 | 3 | 4;
}
```

### Panel Props Interface

Each shared panel follows this pattern:

```typescript
interface PanelProps {
  projectId: string;
  // Optional wizard context
  wizardMode?: boolean; // Enables "Skip" button, helper text
  onComplete?: () => void; // Called when user clicks "Continue" in wizard
}
```

### API Endpoints

Panels use existing project APIs where possible:

| Panel              | Endpoints Used                                                                     |
| ------------------ | ---------------------------------------------------------------------------------- |
| TeamPanel          | `POST /projects/:id/members`, `DELETE /projects/:id/members/:memberId`             |
| StudiesImportPanel | `POST /projects/:id/studies`, `POST /api/lookup-doi`, `POST /api/parse-references` |
| AssignmentPanel    | `POST /projects/:id/assignments`, `GET /projects/:id/assignment-preview`           |

**New endpoints needed:**

| Method | Path                               | Purpose                                    |
| ------ | ---------------------------------- | ------------------------------------------ |
| POST   | `/api/lookup-doi`                  | Fetch metadata for DOI/PMID batch          |
| POST   | `/api/parse-references`            | Parse uploaded reference file              |
| POST   | `/api/extract-pdf-metadata`        | Extract metadata from PDF                  |
| POST   | `/projects/:id/assignment-preview` | Generate assignment preview without saving |

### PDF Handling

PDFs are uploaded directly to permanent storage:

1. User uploads PDF
2. PDF stored in R2: `projects/{projectId}/studies/{studyId}/{filename}`
3. Metadata extracted and study created
4. No temp storage needed (project exists)

For Google Drive:

1. User selects files
2. Backend downloads from Drive to R2
3. Study created with PDF reference

---

## UI/UX Considerations

### Wizard Stepper

Horizontal stepper at top:

```
[1. Create] ---- [2. Team] ---- [3. Studies] ---- [4. Assignment]
     done           current          o                  o
```

- Completed steps show checkmark
- Current step highlighted
- Future steps shown but not clickable
- "Exit to Project" link always visible

### Navigation

Each step has:

- "Back" button (except step 1)
- "Continue" / "Skip" buttons
- "Exit to Project" link

Browser back button navigates wizard steps (not browser history).

### Empty States

Each panel handles empty state gracefully:

- Team: "No members yet. Add team members to enable dual-review."
- Studies: "No studies yet. Import studies to get started."
- Assignment: "Add studies and team members before assigning reviewers."

### Responsive Design

- Desktop: Full panel width, side help text
- Tablet: Stacked layout
- Mobile: Full-screen panels, simplified import (PDF upload + DOI primarily)

---

## Component Reuse Matrix

| Component          | Wizard Step 2 | Wizard Step 3 | Wizard Step 4 | Project Settings | Studies Tab |
| ------------------ | ------------- | ------------- | ------------- | ---------------- | ----------- |
| TeamPanel          | X             |               |               | X                |             |
| StudiesImportPanel |               | X             |               |                  | X           |
| AssignmentPanel    |               |               | X             |                  | X           |

---

## Success Criteria

Before considering this plan complete:

- [ ] Project creation (Step 1) functional
- [ ] TeamPanel works in both wizard and settings context
- [ ] StudiesImportPanel works in both wizard and studies tab context
- [ ] AssignmentPanel works in both wizard and studies tab context
- [ ] All import methods functional (PDF, DOI, reference file, Google Drive)
- [ ] Deduplication detection working
- [ ] PDF matching (auto and manual) implemented
- [ ] Assignment strategies implemented with preview
- [ ] Wizard navigation (next/back/skip/exit) working
- [ ] Responsive design for all panels
- [ ] Tests for shared panel components
- [ ] Tests for assignment algorithm

---

## Resolved Questions

1. **Draft Projects:** No. Project is created immediately in Step 1.

2. **Study Limit:** No limits for initial implementation.

3. **Checklist Selection:** Multiple checklist types allowed per project.

4. **Roles:** Two roles - "Owner" and "Member".

5. **Post-Creation Editing:** All wizard steps map to management UI. Same components, same capabilities.

6. **Google Drive:** One-time import. PDFs downloaded to CoRATES storage.

7. **Reference Manager Integration:** File import only (RIS, BibTeX, EndNote). No direct API integration.

8. **Invite Timing:** Invites sent immediately when members are added (project exists).

9. **Wizard Flexibility:** Users can skip steps, exit early, or bypass wizard entirely. Wizard is guidance, not enforcement.

---

## Related Documents

- [State Management Guide](../guides/state-management.md) - For panel state patterns
- [PDF Handling](../../.cursor/rules/pdf-handling.mdc) - PDF upload and storage patterns
- [Authentication Guide](../guides/authentication.md) - For Google OAuth (Drive integration)
- [API Development Guide](../guides/api-development.md) - For endpoint patterns
- [Add Studies Mocks](../../web/src/components/mocks/) - Existing UI explorations
