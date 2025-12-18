# Dashboard UX Improvements Plan

## Current State Analysis

The dashboard consists of two main sections:

1. **ProjectDashboard** - Cloud projects for logged-in users
2. **ChecklistsDashboard** - Local appraisals stored in browser

### Current Structure

```
Dashboard.jsx
├── ProjectDashboard.jsx (logged in only)
│   ├── Header with "New Project" button
│   ├── Error display
│   ├── CreateProjectForm.jsx (expandable)
│   └── Projects grid (ProjectCard.jsx)
└── ChecklistsDashboard.jsx
    ├── Header with "New Appraisal" button
    ├── Sign-in prompt (logged out only)
    └── Appraisals grid (inline cards)
```

### Pain Points Identified

1. **Visual Hierarchy Issues**
   - Two separate sections feel disconnected
   - No clear overview or "welcome" state
   - Empty states are inconsistent between sections

2. **Cognitive Load**
   - Users must understand the difference between cloud projects vs local appraisals
   - No guidance for new users on what to do first
   - CreateProjectForm expands inline, pushing content down

3. **Discoverability**
   - Recent/activity items not surfaced
   - No quick stats or progress indicators
   - No search or filtering for projects

4. **Mobile Experience**
   - Grid layouts may feel cramped on mobile
   - No compact list view option

5. **Empty States**
   - Generic "No projects yet" text
   - No illustration or engaging visuals
   - No explanation of value proposition

---

## Proposed Improvements

### Option A: Incremental Improvements (Low Effort)

Small changes to polish the existing layout without major restructuring.

#### A1. Unified Header with Tabs

Replace two separate sections with tabbed navigation:

```
[My Projects] [My Appraisals]
```

- Cleaner visual hierarchy
- Reduces vertical scrolling
- Better matches ProjectView's tab pattern

#### A2. Enhanced Empty States

- Add illustrations/icons to empty states
- Include clear value propositions
- Add quick-start CTAs with descriptions

#### A3. Improved Card Design

- Add progress indicators (e.g., "3/5 studies completed")
- Show collaborator avatars on project cards
- Add "last activity" instead of just creation date

#### A4. Quick Actions

- Add "Create" dropdown with options (Project/Appraisal)
- Add search/filter bar above grid
- Add sort options (Recent, Name, Progress)

---

### Option B: Dashboard Redesign (Medium Effort)

A more comprehensive redesign with better information architecture.

#### B1. Overview Section

Add a summary section at the top:

```
┌─────────────────────────────────────────────┐
│  Welcome back, [Name]!                      │
│  ────────────────────────────────────────── │
│  [3 Projects]  [5 Appraisals]  [2 Pending]  │
│                                             │
│  Quick Actions: [+ New Project] [+ New App] │
└─────────────────────────────────────────────┘
```

#### B2. Activity Feed

Show recent activity across all items:

- "You completed checklist X in Study Y"
- "Team member joined Project Z"
- "Study awaiting reconciliation"

#### B3. "Continue Where You Left Off"

Smart section showing:

- Most recently edited items (1-3)
- Items needing attention (pending reconciliation)

#### B4. Unified Items View

Single grid showing both projects and appraisals with:

- Type badge (Cloud Project / Local)
- Consistent card design
- Filter chips: [All] [Projects] [Appraisals]

---

### Option C: Complete Overhaul (High Effort)

Full redesign with new UX patterns.

#### C1. Kanban-style Board View

Organize by status:

```
[In Progress] → [Ready to Review] → [Completed]
```

- Drag-and-drop reordering
- Visual workflow progress
- Great for tracking multiple concurrent projects

#### C2. Table View Option

For users with many projects:

- Sortable columns (Name, Updated, Progress, Role)
- Bulk actions
- Pagination/infinite scroll

#### C3. Dashboard Widgets

Customizable dashboard with draggable widgets:

- Quick stats widget
- Recent activity widget
- Deadlines/reminders widget
- Team activity widget

---

## Recommended Approach

### Phase 1: Quick Wins (Immediate)

1. **Improve Empty States**
   - Add icons/illustrations
   - Better copy explaining value
   - Estimated: 1-2 hours

2. **Add Progress to Cards**
   - Show study count/completion on ProjectCard
   - Estimated: 2-3 hours

3. **Unified Create Button**
   - Single "Create" button with dropdown menu
   - Options: "New Project" and "New Appraisal"
   - Estimated: 1-2 hours

### Phase 2: Structure Improvements (Short-term)

1. **Tabbed Interface**
   - Use existing Tabs component from @corates/ui
   - [Projects] [Appraisals] tabs
   - Persist tab selection in URL params
   - Estimated: 3-4 hours

2. **Search and Sort**
   - Add search input above grid
   - Sort dropdown (Recent, Alphabetical)
   - Estimated: 4-5 hours

3. **Modal for Create Forms**
   - Move CreateProjectForm to a Dialog modal
   - Better UX than inline expansion
   - Estimated: 2-3 hours

### Phase 3: Enhanced Features (Medium-term)

1. **Recent Activity Section**
   - Show last 3-5 items worked on
   - "Continue where you left off" section
   - Requires: API changes for activity tracking
   - Estimated: 1-2 days

2. **Quick Stats Overview**
   - Project/appraisal counts
   - Pending items count
   - Completion stats
   - Estimated: 4-6 hours

3. **List View Toggle**
   - Grid vs List view toggle
   - Compact list for many items
   - Estimated: 4-6 hours

---

## UI Mockups (ASCII)

### Current Layout

```
┌─────────────────────────────────────────────┐
│ My Projects                    [+ New Proj] │
│ Manage your research projects               │
├─────────────────────────────────────────────┤
│ [Card][Card][Card][Card]                    │
│                                             │
├─────────────────────────────────────────────┤
│ My Appraisals                  [+ New App]  │
│ Create and manage appraisals locally...     │
├─────────────────────────────────────────────┤
│ [Sign in prompt banner]                     │
│ [Card][Card][Card]                          │
└─────────────────────────────────────────────┘
```

### Proposed Layout (Phase 2)

```
┌─────────────────────────────────────────────┐
│ Dashboard                        [+ Create ▾]│
│                                              │
│ [🔍 Search...]              [Sort: Recent ▾]│
├─────────────────────────────────────────────┤
│ [Projects (3)] [Appraisals (5)]             │
├─────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐            │
│ │Card │ │Card │ │Card │ │Card │            │
│ │     │ │     │ │     │ │     │            │
│ │ 2/5 │ │ 4/4 │ │ 0/3 │ │     │            │
│ └─────┘ └─────┘ └─────┘ └─────┘            │
│                                             │
│ [Empty state or more cards]                 │
└─────────────────────────────────────────────┘
```

### Enhanced ProjectCard

```
┌─────────────────────────────────────────────┐
│ Sleep Study Meta-Analysis        [Owner ▪]  │
│ Analyzing sleep patterns in...              │
├─────────────────────────────────────────────┤
│ ●●●○○ 3/5 studies   Updated 2h ago         │
│ 👤👤 2 members                              │
├─────────────────────────────────────────────┤
│ [Open Project]                    [🗑]      │
└─────────────────────────────────────────────┘
```

---

## Technical Considerations

### Existing Components to Leverage

- `Tabs` from @corates/ui
- `Dialog` for modals
- `Menu` for dropdown create button
- `Tooltip` for info hints

### Store Changes Needed

- Add `recentActivity` to projectStore (Phase 3)
- Add sorting/filtering state

### API Changes (Phase 3)

- New endpoint for activity feed
- Aggregate stats endpoint

---

## Implementation Priority

| Item                | Effort | Impact | Priority |
| ------------------- | ------ | ------ | -------- |
| Better empty states | Low    | Medium | P1       |
| Progress on cards   | Low    | Medium | P1       |
| Create dropdown     | Low    | Low    | P2       |
| Tabbed interface    | Medium | High   | P1       |
| Search/sort         | Medium | High   | P2       |
| Modal create form   | Low    | Medium | P2       |
| Recent activity     | High   | Medium | P3       |
| Quick stats         | Medium | Medium | P3       |
| List view toggle    | Medium | Low    | P3       |

---

## Questions for Stakeholder

1. Is the distinction between Cloud Projects and Local Appraisals important to emphasize, or should we blur that line?
2. How many projects/appraisals do power users typically have?
3. Is mobile usage a priority?
4. Should we track "recent activity" server-side?
5. Are there plans for teams/organizations that would affect dashboard structure?

---

## Next Steps

1. Review this plan and select preferred option/phase
2. Create detailed tasks for selected improvements
3. Implement Phase 1 quick wins
4. Test with users and iterate
