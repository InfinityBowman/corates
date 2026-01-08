# Drizzle Studio Integration Plan

## Overview

Integrate Drizzle Studio-like functionality into your existing admin dashboard. Since you already have a custom `DatabaseViewer` component with read-only access, this plan focuses on extending it with **write capabilities** (insert, update, delete) to give you full Drizzle Studio functionality.

**Difficulty: Low-Medium** - You already have 80% of the infrastructure in place.

## Current State

- **DatabaseViewer** ([DatabaseViewer.jsx](packages/web/src/components/admin/DatabaseViewer.jsx)) - Read-only table browser with pagination, sorting
- **Backend routes** ([database.js](packages/workers/src/routes/admin/database.js)) - Protected admin API with table listing, row fetching, analytics
- **Auth**: Admin-only access via Better Auth admin plugin
- **DB**: Drizzle ORM with SQLite (Cloudflare D1)

## What You're Missing vs Drizzle Studio

| Feature                   | Current | Needed   |
| ------------------------- | ------- | -------- |
| Browse tables             | Yes     | -        |
| View rows with pagination | Yes     | -        |
| Sort columns              | Yes     | -        |
| Filter rows               | Yes     | -        |
| **Insert rows**           | No      | Add      |
| **Update rows**           | No      | Add      |
| **Delete rows**           | No      | Add      |
| **Inline editing**        | No      | Add      |
| View schema/types         | Partial | Enhance  |
| Run raw SQL               | No      | Optional |

## Implementation Plan

### Phase 1: Backend Write Operations

**File**: `packages/workers/src/routes/admin/database.js`

#### 1.1 Add INSERT endpoint

```
POST /api/admin/database/tables/:tableName/rows
Body: { data: { column1: value1, ... } }
```

#### 1.2 Add UPDATE endpoint

```
PATCH /api/admin/database/tables/:tableName/rows/:id
Body: { data: { column1: newValue, ... } }
```

#### 1.3 Add DELETE endpoint

```
DELETE /api/admin/database/tables/:tableName/rows/:id
```

#### 1.4 Security considerations

- All routes already protected by `requireAdmin` middleware
- Validate column names against schema (prevent SQL injection)
- Whitelist tables via existing `ALLOWED_TABLES`
- Add audit logging for write operations (optional but recommended)

---

### Phase 2: Frontend CRUD UI

**File**: `packages/web/src/components/admin/DatabaseViewer.jsx`

#### 2.1 Add row editing

- Click-to-edit cells with inline input fields
- Save/Cancel buttons per row
- Visual indicator for modified cells

#### 2.2 Add row insertion

- "Add Row" button above table
- Modal or inline form with fields for each column
- Auto-generate IDs if using UUIDs

#### 2.3 Add row deletion

- Delete button per row (with confirmation dialog)
- Bulk delete with checkboxes (optional)

#### 2.4 Add TanStack Query mutations

**File**: `packages/web/src/primitives/useAdminQueries.js`

Add mutations:

- `useAdminInsertRow`
- `useAdminUpdateRow`
- `useAdminDeleteRow`

---

### Phase 3: Enhanced Schema View (Optional)

#### 3.1 Column type indicators

- Show data types (text, integer, boolean, timestamp)
- Show constraints (primary key, unique, not null, foreign key)

#### 3.2 Relationship visualization

- Show foreign key references
- Click to navigate to related records

---

### Phase 4: Raw SQL Console (Optional)

If you want full Drizzle Studio parity:

#### 4.1 Backend

```
POST /api/admin/database/query
Body: { sql: "SELECT * FROM user WHERE ...", params: [] }
```

**Security**:

- Read-only mode by default (only SELECT)
- Optional write mode with extra confirmation
- Log all queries

#### 4.2 Frontend

- SQL editor with syntax highlighting (use Monaco or CodeMirror)
- Results table
- Query history

---

## Recommended Implementation Order

1. **Backend write endpoints** (1-2 hours)
   - Add POST, PATCH, DELETE routes
   - Add input validation using Zod

2. **Frontend mutations** (30 min)
   - Add TanStack Query mutation hooks

3. **Inline editing UI** (1-2 hours)
   - Edit mode per row
   - Save/cancel functionality

4. **Insert row UI** (1 hour)
   - Modal form for new rows

5. **Delete functionality** (30 min)
   - Delete button with confirmation

6. **Polish** (1 hour)
   - Loading states
   - Error handling
   - Toast notifications

**Total estimated effort**: 5-7 hours

---

## Alternative: Embed Drizzle Studio Directly

If you prefer the official Drizzle Studio UI:

### Option A: Proxy to local drizzle-kit studio

- Run `drizzle-kit studio` locally
- Proxy requests through your admin dashboard
- **Limitation**: Requires local dev environment, not suitable for production

### Option B: Use drizzle-studio package (experimental)

- `@drizzle-team/studio` is an internal package
- Not officially supported for embedding
- **Not recommended**

### Recommendation

Building on your existing `DatabaseViewer` is the better approach because:

- Full control over security
- Consistent with your existing admin UI
- No external dependencies
- Works in production (Cloudflare Workers)

---

## File Checklist

### Backend changes

- [ ] `packages/workers/src/routes/admin/database.js` - Add POST/PATCH/DELETE routes

### Frontend changes

- [ ] `packages/web/src/primitives/useAdminQueries.js` - Add mutation hooks
- [ ] `packages/web/src/components/admin/DatabaseViewer.jsx` - Add CRUD UI

### Optional

- [ ] Add audit logging for database mutations
- [ ] Add raw SQL console component
