# Dashboard Redesign Plan

This plan outlines the implementation of a redesigned dashboard based on the mock at `/mocks/dashboard`. The goal is to replace the existing minimal dashboard with a production-grade experience that handles all user states gracefully.

## Current State Analysis

### Existing Implementation

The current dashboard ([Dashboard.jsx](packages/web/src/components/Dashboard.jsx)) is minimal:

```jsx
// Current structure (simplified)
<Show when={isLoggedIn() && !authLoading()}>
  <ProjectsPanel />
</Show>
<LocalAppraisalsPanel showHeader={true} showSignInPrompt={!isLoggedIn()} />
```

### Key Components to Replace/Integrate

| Component              | Location                             | Purpose                           |
| ---------------------- | ------------------------------------ | --------------------------------- |
| `ProjectsPanel`        | `project/ProjectsPanel.jsx`          | Projects grid with create form    |
| `LocalAppraisalsPanel` | `checklist/LocalAppraisalsPanel.jsx` | Device-local appraisals           |
| `ProjectCard`          | `project/ProjectCard.jsx`            | Individual project card           |
| `ContactPrompt`        | `project/ContactPrompt.jsx`          | Early access / quota limit prompt |
| `CreateProjectForm`    | `project/CreateProjectForm.jsx`      | Project creation modal            |

### State Dependencies

| State                       | Source            | Used For                    |
| --------------------------- | ----------------- | --------------------------- |
| `isLoggedIn()`              | `useBetterAuth`   | Show projects section       |
| `authLoading()`             | `useBetterAuth`   | Loading skeleton            |
| `isOnline()`                | `useBetterAuth`   | Disable create when offline |
| `hasEntitlement()`          | `useSubscription` | Project creation permission |
| `hasQuota()`                | `useSubscription` | Project limit check         |
| `subscriptionLoading()`     | `useSubscription` | Loading states              |
| `subscriptionFetchFailed()` | `useSubscription` | Error banner                |

---

## User State Matrix

The dashboard must handle these distinct states:

| #   | State                   | Auth     | Subscription | UI Requirements                                    |
| --- | ----------------------- | -------- | ------------ | -------------------------------------------------- |
| 1   | **Logged Out**          | No       | N/A          | Local appraisals only, prominent sign-in CTA       |
| 2   | **Loading**             | Checking | Checking     | Skeleton UI, no flickering                         |
| 3   | **Free (No Plan)**      | Yes      | None/Free    | Show projects (if any), ContactPrompt for creation |
| 4   | **Trial/Grant**         | Yes      | Trial        | Full features, show trial status                   |
| 5   | **Active Subscriber**   | Yes      | Active       | Full features, usage stats                         |
| 6   | **Quota Exceeded**      | Yes      | Active       | Show projects, ContactPrompt for more              |
| 7   | **Subscription Error**  | Yes      | Failed       | Warning banner, retry button                       |
| 8   | **Offline (Logged In)** | Cached   | Cached       | Read-only mode, offline indicator                  |

---

## Implementation Phases

### Phase 1: Core Layout and Components

**Goal:** Implement the new dashboard structure with proper state handling.

#### 1.1 Create New Dashboard Component

**File:** `packages/web/src/components/dashboard/Dashboard.jsx`

Create a new dashboard module directory with:

```
components/dashboard/
  Dashboard.jsx         # Main container with state logic
  DashboardHeader.jsx   # Welcome section with user info
  StatsRow.jsx          # Stats cards row
  ProjectsSection.jsx   # Projects grid
  LocalSection.jsx      # Local appraisals section
  ActivityFeed.jsx      # Recent activity sidebar
  ProgressCard.jsx      # Overall progress visualization
  QuickActions.jsx      # Quick start actions
  index.js              # Barrel export
```

#### 1.2 Dashboard State Machine

```jsx
// Pseudo-code for state handling
const dashboardState = createMemo(() => {
  if (authLoading()) return 'loading';
  if (!isLoggedIn()) return 'logged-out';
  if (subscriptionLoading()) return 'loading-subscription';
  if (subscriptionFetchFailed()) return 'subscription-error';
  if (!hasEntitlement('project.create')) return 'no-plan';
  if (!hasQuota('projects.max', { used: projectCount(), requested: 1 })) return 'quota-exceeded';
  return 'active';
});
```

#### 1.3 Tasks

- [ ] Create `dashboard/` directory structure
- [ ] Implement `DashboardHeader` with user greeting and date
- [ ] Implement `StatsRow` with computed stats from real data
- [ ] Implement `ProgressCard` with SVG arc visualization
- [ ] Implement `QuickActions` with navigation to appraisal creation
- [ ] Implement `ActivityFeed` (initially with placeholder data)
- [ ] Update main `Dashboard.jsx` to use new components

---

### Phase 2: Projects Integration

**Goal:** Integrate real project data with the new visual design.

#### 2.1 New ProjectCard Component

The mock's `ProjectCard` needs to be reconciled with the existing one. Create a new enhanced version:

**File:** `packages/web/src/components/dashboard/ProjectCard.jsx`

Features:

- Accent color based on project index or hash
- Progress bar with gradient
- Role badge (Lead/Reviewer)
- Member count
- Relative timestamp
- Hover effects and animations

#### 2.2 Projects Grid Integration

```jsx
// Key integration points
- Use `useMyProjectsList()` for project data
- Use `useSubscription()` for quota checks
- Handle empty state with create prompt
- Handle offline state (disable creation)
- Show `ContactPrompt` when quota/entitlement blocked
```

#### 2.3 Tasks

- [ ] Create enhanced `ProjectCard` component
- [ ] Implement project color assignment (deterministic hash)
- [ ] Add progress calculation (completed/total studies)
- [ ] Integrate delete confirmation dialog
- [ ] Wire up navigation on card click
- [ ] Handle empty project state

---

### Phase 3: Local Appraisals Integration

**Goal:** Integrate local appraisals with improved visual design.

#### 3.1 LocalAppraisalCard Component

**File:** `packages/web/src/components/dashboard/LocalAppraisalCard.jsx`

Features:

- Compact horizontal layout
- Checklist type badge
- Relative timestamp
- Delete action
- Inline rename (using Editable)

#### 3.2 Tasks

- [ ] Create `LocalAppraisalCard` component
- [ ] Use `localChecklistsStore` for data
- [ ] Implement delete with confirmation
- [ ] Add inline rename functionality
- [ ] Handle empty state

---

### Phase 4: Authentication States

**Goal:** Handle logged-out and loading states gracefully.

#### 4.1 Logged Out State

When `!isLoggedIn()`:

```
+------------------------------------------+
|        Welcome to CoRATES                |
|   Evidence synthesis made collaborative  |
|                                          |
|  [Sign In]  [Create Free Account]        |
+------------------------------------------+
|                                          |
|  Your Local Appraisals                   |
|  (device-stored, no account needed)      |
|                                          |
|  [Local appraisal cards...]              |
|                                          |
|  Want to collaborate?                    |
|  [Sign in to sync and share]             |
+------------------------------------------+
```

#### 4.2 Loading State

Skeleton UI matching the final layout:

- Pulsing placeholder for header
- Skeleton cards for stats
- Ghost cards for projects
- Prevent layout shift

#### 4.3 Tasks

- [ ] Create `LoggedOutHero` component
- [ ] Create `DashboardSkeleton` component
- [ ] Ensure smooth transition from loading to loaded
- [ ] Test with slow network conditions

---

### Phase 5: Subscription States

**Goal:** Handle subscription edge cases with appropriate UI.

#### 5.1 No Plan / Free Tier

Show limited dashboard with `ContactPrompt`:

```jsx
<Show when={!canCreateProject()}>
  <ContactPrompt restrictionType={restrictionType()} />
</Show>
```

- Projects section shows existing projects (if any)
- Create button replaced with ContactPrompt
- Full access to local appraisals

#### 5.2 Quota Exceeded

Similar to no plan, but different messaging:

- "You've reached your project limit (3/3)"
- Contact for more capacity

#### 5.3 Subscription Error

Warning banner with retry:

```jsx
<Show when={subscriptionFetchFailed()}>
  <div class='warning-banner'>
    Unable to verify subscription. Some features may be restricted.
    <button onClick={refetchSubscription}>Retry</button>
  </div>
</Show>
```

#### 5.4 Tasks

- [ ] Integrate `ContactPrompt` into new layout
- [ ] Style subscription error banner
- [ ] Add subscription status to header (if trial/expiring)
- [ ] Test all subscription states

---

### Phase 6: Activity and Stats

**Goal:** Add real activity data and computed statistics.

#### 6.1 Stats Computation

```jsx
const stats = createMemo(() => ({
  activeProjects: projects()?.length || 0,
  studiesReviewed: projects()?.reduce((sum, p) => sum + (p.completedCount || 0), 0) || 0,
  totalStudies: projects()?.reduce((sum, p) => sum + (p.studyCount || 0), 0) || 0,
  localAppraisals: checklists()?.length || 0,
  teamMembers: computeUniqueTeamMembers(projects()),
}));
```

#### 6.2 Activity Feed

Initial implementation with local-only activity:

- Track checklist opens/updates in local storage
- Track project opens
- Future: Real activity from API

#### 6.3 Tasks

- [ ] Add `studyCount` and `completedCount` to project list API
- [ ] Implement stats computation
- [ ] Create activity tracking utilities
- [ ] Wire up activity feed

---

### Phase 7: Polish and Animations

**Goal:** Add the refined animations and transitions from the mock.

#### 7.1 Animation System

```css
@keyframes card-rise {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes stat-rise {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### 7.2 Staggered Loading

Cards appear with staggered delays based on index:

```jsx
<For each={projects()}>
  {(project, index) => (
    <div style={`animation-delay: ${index() * 80}ms`}>
      <ProjectCard project={project} />
    </div>
  )}
</For>
```

#### 7.3 Tasks

- [ ] Extract animations to shared CSS file
- [ ] Implement staggered card loading
- [ ] Add hover effects to all interactive elements
- [ ] Ensure animations respect `prefers-reduced-motion`

---

## File Changes Summary

### New Files

```
packages/web/src/components/dashboard/
  Dashboard.jsx
  DashboardHeader.jsx
  DashboardSkeleton.jsx
  LoggedOutHero.jsx
  StatsRow.jsx
  StatCard.jsx
  ProjectsSection.jsx
  ProjectCard.jsx
  LocalSection.jsx
  LocalAppraisalCard.jsx
  ActivityFeed.jsx
  ProgressCard.jsx
  QuickActions.jsx
  CollaborationCTA.jsx
  index.js
```

### Modified Files

```
packages/web/src/Routes.jsx          # Update Dashboard import
packages/web/src/global.css          # Add dashboard animations
packages/workers/src/routes/orgs/projects.js  # Add studyCount to response
```

### Deleted Files

```
packages/web/src/components/Dashboard.jsx  # Replaced by dashboard/Dashboard.jsx
```

---

## API Changes Required

### Project List Response Enhancement

Current response:

```json
{
  "id": "...",
  "name": "...",
  "description": "...",
  "role": "owner|reviewer",
  "createdAt": "..."
}
```

Enhanced response:

```json
{
  "id": "...",
  "name": "...",
  "description": "...",
  "role": "owner|reviewer",
  "createdAt": "...",
  "studyCount": 24,
  "completedCount": 16,
  "memberCount": 4,
  "lastActivity": "2026-01-09T..."
}
```

---

## Testing Requirements

### Unit Tests

- [ ] `DashboardHeader` renders user name correctly
- [ ] `StatsRow` computes stats from project data
- [ ] `ProgressCard` calculates percentage correctly
- [ ] `ProjectCard` handles missing data gracefully
- [ ] State machine returns correct state for each scenario

### Integration Tests

- [ ] Logged out user sees local appraisals only
- [ ] Loading state shows skeleton
- [ ] Projects load and display correctly
- [ ] Create project button disabled when offline
- [ ] ContactPrompt shows for free tier users
- [ ] Subscription error banner shows with retry

### Visual Tests

- [ ] Animations play correctly
- [ ] Responsive layout at mobile/tablet/desktop
- [ ] Dark mode (if applicable)
- [ ] Color contrast meets WCAG AA

---

## Migration Strategy

### Step 1: Feature Flag

Add a feature flag to toggle between old and new dashboard:

```jsx
const useNewDashboard = () => localStorage.getItem('corates-new-dashboard') === 'true';
```

### Step 2: Parallel Development

Keep both dashboards working during development. Route to new dashboard when flag is enabled.

### Step 3: Gradual Rollout

1. Internal testing with flag enabled
2. Enable for early access users
3. A/B test if metrics available
4. Full rollout
5. Remove old dashboard

---

## Success Metrics

- **Visual:** Dashboard matches mock design within 95% fidelity
- **Performance:** First contentful paint under 500ms
- **UX:** All user states handled without blank screens or errors
- **Accessibility:** Keyboard navigable, screen reader friendly
- **Code Quality:** Components under 200 lines, proper separation of concerns

---

## Timeline Estimate

| Phase                        | Effort   | Dependencies |
| ---------------------------- | -------- | ------------ |
| Phase 1: Core Layout         | 2-3 days | None         |
| Phase 2: Projects            | 1-2 days | Phase 1      |
| Phase 3: Local Appraisals    | 1 day    | Phase 1      |
| Phase 4: Auth States         | 1 day    | Phase 1      |
| Phase 5: Subscription States | 1 day    | Phase 2      |
| Phase 6: Activity & Stats    | 1-2 days | API changes  |
| Phase 7: Polish              | 1 day    | All phases   |

**Total: 8-12 days**

---

## Open Questions

1. **Activity Feed Data:** Should we implement a real activity API, or start with local-only tracking?

2. **Color Assignment:** Should project colors be user-configurable, or deterministically assigned?

3. **Mobile Layout:** The mock is desktop-focused. Do we need a separate mobile design, or responsive adaptation?

4. **Search:** The mock shows a search button. Should we implement global search now or defer?

5. **Dark Mode:** Should the new dashboard support dark mode from launch?
