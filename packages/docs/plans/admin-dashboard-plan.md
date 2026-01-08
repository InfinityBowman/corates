# Admin Dashboard Enhancement Plan

**Date:** January 8, 2026  
**Goal:** Extend the existing SolidJS admin dashboard with additional features  
**Location:** `packages/web/src/components/admin/`

---

## Implementation Status

| Phase   | Description                  | Status      |
| ------- | ---------------------------- | ----------- |
| Phase 1 | User Management Enhancements | Complete    |
| Phase 2 | Project Explorer             | Complete    |
| Phase 3 | Stripe Admin Tools           | Complete    |
| Phase 4 | Analytics & Charts           | Not Started |
| Phase 5 | Quick Actions & Bulk Ops     | Not Started |

---

## Current State Analysis

The admin dashboard already has substantial functionality at `/admin/*`:

### Existing Routes

| Route                         | Component                         | Features                            |
| ----------------------------- | --------------------------------- | ----------------------------------- |
| `/admin`                      | `AdminDashboard.jsx`              | Stats cards, user table with search |
| `/admin/orgs`                 | `OrgList.jsx`                     | Org list with search/pagination     |
| `/admin/orgs/:orgId`          | `OrgDetail.jsx`                   | Org detail, billing, members        |
| `/admin/storage`              | `StorageManagement.jsx`           | R2 storage management               |
| `/admin/billing/ledger`       | `AdminBillingLedgerPage.jsx`      | Stripe event ledger viewer          |
| `/admin/billing/stuck-states` | `AdminBillingStuckStatesPage.jsx` | Billing stuck states                |
| `/admin/database`             | `DatabaseViewer.jsx`              | Database inspection                 |

### Existing Components

| Component                 | Purpose                          |
| ------------------------- | -------------------------------- |
| `UserTable.jsx`           | Paginated user list with actions |
| `StatsCard.jsx`           | KPI display cards                |
| `OrgList.jsx`             | Organization listing             |
| `OrgDetail.jsx`           | Organization detail view         |
| `OrgBillingSummary.jsx`   | Billing status for org           |
| `OrgQuickActions.jsx`     | Quick actions for org management |
| `GrantList.jsx`           | Access grants listing            |
| `GrantDialog.jsx`         | Create/edit grants               |
| `SubscriptionList.jsx`    | Subscription management          |
| `SubscriptionDialog.jsx`  | Subscription actions             |
| `ImpersonationBanner.jsx` | Impersonation indicator          |
| `AdminLayout.jsx`         | Admin section layout             |

### Existing API Endpoints

Uses queries from `useAdminQueries.js`:

- `useAdminStats()` - Dashboard statistics
- `useAdminUsers()` - Paginated user list
- `useAdminOrgs()` - Paginated org list
- `useAdminBillingLedger()` - Stripe event ledger

---

## Executive Summary

Rather than creating a separate Next.js package, we should **extend the existing SolidJS admin dashboard**. This approach:

- Reuses existing infrastructure (auth, API, routing)
- Maintains consistency with the main app
- Avoids maintaining two separate codebases
- Leverages existing `@corates/ui` components

**What's Missing (to implement):**

1. User detail page with session management
2. Project explorer with member management
3. Stripe admin tools (customer lookup, manual actions)
4. Analytics charts (signups, revenue trends)
5. Bulk operations and quick actions panel

**Tech Stack (existing):**

- SolidJS with TanStack Query
- `@corates/ui` (Ark UI components)
- `solid-icons` for icons
- Tailwind CSS

---

## Phase 1: User Management Enhancements (Days 1-3)

### 1.1 User Detail Page (NEW)

**Route:** `/admin/users/:userId`

**File:** `packages/web/src/components/admin/UserDetail.jsx`

The existing `UserTable.jsx` shows a list but there's no detail page. Create one with:

**Sections:**

1. **Profile Info**
   - Name, email, avatar, username
   - Role (user/admin), persona
   - 2FA status
   - Created/updated timestamps
   - Ban status with reason/expiry

2. **Organizations**
   - Table of org memberships
   - Role in each org (owner/admin/member)
   - Link to org detail page

3. **Sessions**
   - Active sessions with IP, user agent, created date
   - Button to invalidate individual sessions
   - Button to invalidate all sessions

4. **Projects**
   - Projects user has access to
   - Role in each project

### 1.2 Backend API Endpoints

**New endpoints in `packages/workers/src/routes/admin/`:**

```javascript
// GET /api/admin/users/:userId
// Returns full user detail with orgs, sessions, projects

// GET /api/admin/users/:userId/sessions
// Returns active sessions for user

// DELETE /api/admin/users/:userId/sessions/:sessionId
// Invalidates specific session

// DELETE /api/admin/users/:userId/sessions
// Invalidates all sessions for user
```

### 1.3 Query Hooks

**Add to `packages/web/src/primitives/useAdminQueries.js`:**

```javascript
export function useAdminUserDetail(userId) {
  return createQuery(() => ({
    queryKey: ['admin', 'user', userId()],
    queryFn: () => adminApi.getUserDetail(userId()),
    enabled: !!userId(),
  }));
}

export function useAdminUserSessions(userId) {
  return createQuery(() => ({
    queryKey: ['admin', 'user', userId(), 'sessions'],
    queryFn: () => adminApi.getUserSessions(userId()),
    enabled: !!userId(),
  }));
}
```

### 1.4 Route Registration

**Update `packages/web/src/Routes.jsx`:**

```javascript
const UserDetail = lazy(() => import('@/components/admin/UserDetail.jsx'));

// In admin routes:
<Route path='/users/:userId' component={UserDetail} />;
```

### 1.5 Deliverables

- [x] `UserDetail.jsx` component
- [x] Backend API endpoint for single session revocation
- [x] Session listing and invalidation (single + all)
- [x] Route registered in `Routes.jsx`
- [x] Link from `UserTable.jsx` to detail page

---

## Phase 2: Project Explorer (Days 4-6)

### 2.1 Project List Page (NEW)

**Route:** `/admin/projects`

**File:** `packages/web/src/components/admin/ProjectList.jsx`

**Features:**

- Paginated table of all projects
- Search by name
- Filter by organization
- Sort by created date, name

**Columns:**

| Column     | Description         |
| ---------- | ------------------- |
| Name       | Project name        |
| Org        | Owning organization |
| Created By | Creator user        |
| Members    | Member count        |
| Files      | Media file count    |
| Created    | Creation date       |
| Actions    | View detail         |

### 2.2 Project Detail Page (NEW)

**Route:** `/admin/projects/:projectId`

**File:** `packages/web/src/components/admin/ProjectDetail.jsx`

**Sections:**

1. **Overview**
   - Name, description
   - Organization (link to org detail)
   - Created by user (link to user detail)
   - Creation date

2. **Members**
   - Table of project members with roles
   - User links to user detail
   - Remove member action

3. **Media Files**
   - List of uploaded PDFs/files
   - File size, upload date
   - Storage usage summary

4. **Invitations**
   - Pending project invitations
   - Expired/accepted history

### 2.3 Backend API Endpoints

```javascript
// GET /api/admin/projects
// Query params: page, limit, search, orgId

// GET /api/admin/projects/:projectId
// Returns full project detail with members, files, invitations
```

### 2.4 Route Registration

```javascript
const ProjectList = lazy(() => import('@/components/admin/ProjectList.jsx'));
const ProjectDetail = lazy(() => import('@/components/admin/ProjectDetail.jsx'));

// In admin routes:
<Route path='/projects' component={ProjectList} />
<Route path='/projects/:projectId' component={ProjectDetail} />
```

### 2.5 Navigation Update

**Update `AdminLayout.jsx` sidebar to include:**

- Projects link between Orgs and Storage

### 2.6 Deliverables

- [x] `ProjectList.jsx` component
- [x] `ProjectDetail.jsx` component
- [x] Backend API endpoints (`projects.js`)
- [x] Routes registered
- [x] Sidebar navigation updated

---

## Phase 3: Stripe Admin Tools (Days 7-9)

### 3.1 Stripe Tools Page (NEW)

**Route:** `/admin/billing/stripe-tools`

**File:** `packages/web/src/components/admin/billing-observability/StripeToolsPage.jsx`

**Features:**

1. **Customer Lookup**
   - Search by email or Stripe customer ID
   - Display customer details from Stripe
   - Link to Stripe dashboard
   - Link to associated user in admin (if exists)

2. **Quick Actions**
   - Generate customer portal link
   - View recent invoices
   - View payment methods

3. **Webhook Retry**
   - Select failed event from ledger
   - Retry processing
   - View result

### 3.2 Backend API Endpoints

```javascript
// GET /api/admin/stripe/customer?email=xxx or ?customerId=xxx
// Looks up customer in Stripe, returns details

// POST /api/admin/stripe/portal-link
// Body: { customerId }
// Returns portal URL

// GET /api/admin/stripe/customer/:customerId/invoices
// Returns recent invoices

// POST /api/admin/billing/ledger/:ledgerId/retry
// Re-processes a failed webhook event
```

### 3.3 Route Registration

```javascript
const StripeToolsPage = lazy(() => import('@/components/admin/billing-observability/StripeToolsPage.jsx'));

// In admin routes:
<Route path='/billing/stripe-tools' component={StripeToolsPage} />;
```

### 3.4 Deliverables

- [ ] `StripeToolsPage.jsx` component
- [ ] Customer lookup functionality
- [ ] Portal link generation
- [ ] Webhook retry functionality
- [ ] Backend API endpoints

---

## Phase 4: Analytics & Charts (Days 10-13)

### 4.1 Enhanced Dashboard Home

**Enhance existing `AdminDashboard.jsx` with charts:**

**New Stats Cards:**

- Active subscriptions count
- Revenue this month (via Stripe API)
- Failed webhooks (last 24h)
- Pending invitations

**Charts to Add:**

1. **User Signups Chart** (line chart)
   - Daily signups over last 30 days
   - Shows growth trend

2. **Subscription Status Chart** (pie/donut chart)
   - Breakdown: active, past_due, canceled, trialing

3. **Webhook Health Chart** (line chart)
   - Success vs failure rate over last 7 days

### 4.2 Chart Components

**Files:**

- `packages/web/src/components/admin/charts/SignupsChart.jsx`
- `packages/web/src/components/admin/charts/SubscriptionStatusChart.jsx`
- `packages/web/src/components/admin/charts/WebhookHealthChart.jsx`

**Charting Library Options:**

1. **chart.js with solid-chartjs** - Lightweight, familiar
2. **uPlot** - Very performant, good for time series
3. **Custom SVG** - No dependency, full control

Recommendation: Use `chart.js` with `solid-chartjs` wrapper for simplicity.

### 4.3 Backend API Endpoints

```javascript
// GET /api/admin/stats/signups?days=30
// Returns daily signup counts

// GET /api/admin/stats/subscriptions
// Returns subscription status breakdown

// GET /api/admin/stats/webhooks?days=7
// Returns webhook success/failure counts by day

// GET /api/admin/stats/revenue?months=1
// Returns revenue from Stripe (optional, requires Stripe API)
```

### 4.4 Deliverables

- [ ] Chart components created
- [ ] `chart.js` + `solid-chartjs` installed
- [ ] Dashboard enhanced with charts
- [ ] Backend stats endpoints
- [ ] Additional stats cards

---

## Phase 5: Quick Actions & Bulk Operations (Days 14-16)

### 5.1 Quick Actions Panel

**Add to `AdminLayout.jsx` - collapsible panel or command palette:**

**Actions:**

1. **Create Manual Grant**
   - Select org, type (trial/single_project), duration
   - Uses existing `GrantDialog.jsx`

2. **Invalidate User Sessions**
   - Enter user email
   - Confirms and invalidates all sessions

3. **Generate Portal Link**
   - Enter email or customer ID
   - Copies portal URL to clipboard

4. **Re-process Failed Webhooks**
   - Shows count of failed webhooks
   - Button to retry all (with confirmation)

### 5.2 Command Palette (Optional Enhancement)

**File:** `packages/web/src/components/admin/AdminCommandPalette.jsx`

Using `@corates/ui` Dialog + custom search:

- `Cmd+K` to open
- Search for users, orgs, projects
- Quick navigation to any admin page
- Quick actions accessible

### 5.3 Bulk Operations

**In User Table:**

- Checkbox selection
- Bulk ban/unban
- Bulk session invalidation

**In Org List:**

- Checkbox selection
- Bulk grant creation

### 5.4 Deliverables

- [ ] Quick actions accessible from admin layout
- [ ] Command palette (optional)
- [ ] Bulk selection in tables
- [ ] Bulk actions implemented

---

## Updated File Structure

```
packages/web/src/components/admin/
├── AdminDashboard.jsx          # Enhanced with charts
├── AdminLayout.jsx             # Add quick actions panel
├── UserTable.jsx               # Existing
├── UserDetail.jsx              # NEW
├── StatsCard.jsx               # Existing
├── OrgList.jsx                 # Existing
├── OrgDetail.jsx               # Existing
├── OrgBillingSummary.jsx       # Existing
├── OrgQuickActions.jsx         # Existing
├── GrantList.jsx               # Existing
├── GrantDialog.jsx             # Existing
├── SubscriptionList.jsx        # Existing
├── SubscriptionDialog.jsx      # Existing
├── ImpersonationBanner.jsx     # Existing
├── StorageManagement.jsx       # Existing
├── DatabaseViewer.jsx          # Existing
├── ProjectList.jsx             # NEW
├── ProjectDetail.jsx           # NEW
├── AdminCommandPalette.jsx     # NEW (optional)
├── charts/
│   ├── SignupsChart.jsx        # NEW
│   ├── SubscriptionStatusChart.jsx  # NEW
│   └── WebhookHealthChart.jsx  # NEW
├── billing-observability/
│   ├── AdminBillingLedgerPage.jsx     # Existing
│   ├── AdminBillingStuckStatesPage.jsx # Existing
│   ├── OrgBillingReconcilePanel.jsx   # Existing
│   └── StripeToolsPage.jsx            # NEW
└── index.js
```

---

## Updated Routes

```javascript
// packages/web/src/Routes.jsx - Admin section
<Route path='/admin' component={AdminLayout}>
  <Route path='/' component={AdminDashboard} />
  <Route path='/users/:userId' component={UserDetail} /> {/* NEW */}
  <Route path='/orgs' component={OrgList} />
  <Route path='/orgs/:orgId' component={OrgDetail} />
  <Route path='/projects' component={ProjectList} /> {/* NEW */}
  <Route path='/projects/:projectId' component={ProjectDetail} /> {/* NEW */}
  <Route path='/storage' component={StorageManagement} />
  <Route path='/billing/ledger' component={AdminBillingLedgerPage} />
  <Route path='/billing/stuck-states' component={AdminBillingStuckStatesPage} />
  <Route path='/billing/stripe-tools' component={StripeToolsPage} /> {/* NEW */}
  <Route path='/database' component={DatabaseViewer} />
</Route>
```

---

## Estimated Timeline

| Phase     | Duration    | Description              |
| --------- | ----------- | ------------------------ |
| Phase 1   | 3 days      | User detail + sessions   |
| Phase 2   | 3 days      | Project list + detail    |
| Phase 3   | 3 days      | Stripe tools             |
| Phase 4   | 4 days      | Analytics charts         |
| Phase 5   | 3 days      | Quick actions + bulk ops |
| **Total** | **16 days** | ~3 weeks                 |

---

## Success Criteria

### Phase 1

- [ ] Can view full user detail from admin
- [ ] Can see user's organizations and projects
- [ ] Can view and invalidate user sessions

### Phase 2

- [ ] Can list all projects with search/filter
- [ ] Can view project detail with members and files
- [ ] Navigation updated with Projects link

### Phase 3

- [ ] Can look up Stripe customers by email
- [ ] Can generate customer portal links
- [ ] Can retry failed webhook events

### Phase 4

- [ ] Dashboard shows signup trend chart
- [ ] Subscription status breakdown visible
- [ ] Webhook health chart shows success/failure

### Phase 5

- [ ] Quick actions accessible from admin
- [ ] Can perform bulk operations on users/orgs

---

## Dependencies

**New packages needed:**

```bash
# For charts (if using chart.js)
pnpm --filter @corates/web add chart.js solid-chartjs
```

**Existing packages already available:**

- `@corates/ui` - Dialog, Toast, etc.
- `solid-icons` - Icons
- TanStack Query - Data fetching
- Tailwind CSS - Styling

---

## References

- [Existing Admin Components](packages/web/src/components/admin/)
- [Admin Query Hooks](packages/web/src/primitives/useAdminQueries.js)
- [Admin Store](packages/web/src/stores/adminStore.js)
- [Polar Admin Patterns](../audits/flowglad-polar-extraction-analysis-2026-01.md) - UI inspiration
