# Study Counts Architecture

## Problem

The dashboard shows "0/0 studies" for all projects because:

1. Studies are stored in Yjs durable objects (`ProjectDoc`), not SQL
2. The `/api/users/me/projects` endpoint only returns SQL data (no study counts)
3. Getting accurate counts requires connecting to each ProjectDoc

## Solution Overview

Two-tier approach:

1. **Lazy Load (Authoritative)**: Fetch true counts when user opens a project via the existing Yjs WebSocket connection
2. **Notifications (Preview)**: Push approximate counts to dashboard for quick previews (can be stale, max 50 queued)

---

## Phase 1: Lazy Load (Authoritative Source)

When a user opens a project, they connect to `ProjectDoc` via WebSocket. At that point, we have access to the Yjs document and can compute accurate study counts.

### 1.1 Add Stats Computation to ProjectDoc

**File**: `packages/workers/src/durable-objects/ProjectDoc.js`

Add a method to compute stats from the Yjs document:

```javascript
getProjectStats() {
  const reviews = this.doc.getMap('reviews');
  const studyCount = reviews.size;

  let completedCount = 0;
  reviews.forEach((study) => {
    // Check if study has completed status
    // Structure depends on checklist type - need to verify
    if (study.status === 'completed' || study.completed) {
      completedCount++;
    }
  });

  return { studyCount, completedCount };
}
```

### 1.2 Send Stats on WebSocket Connect

When a client connects to ProjectDoc, send stats as an initial message:

```javascript
// In WebSocket connection handler
ws.send(
  JSON.stringify({
    type: 'project-stats',
    stats: this.getProjectStats(),
  }),
);
```

### 1.3 Frontend: Store Stats in Project Store

**File**: `packages/web/src/stores/projectStore.js`

Add stats storage:

```javascript
// Add to store
projectStats: {},  // { [projectId]: { studyCount, completedCount, lastUpdated } }

setProjectStats(projectId, stats) {
  setStore('projectStats', projectId, {
    ...stats,
    lastUpdated: Date.now()
  });
}
```

### 1.4 Frontend: Handle Stats Message in useProject

**File**: `packages/web/src/primitives/useProject.js`

Listen for `project-stats` message type:

```javascript
// In WebSocket message handler
if (data.type === 'project-stats') {
  projectStore.setProjectStats(projectId, data.stats);
}
```

### 1.5 Frontend: Update Stats on Study Changes

When studies are added/removed locally, update the cached stats:

```javascript
// After adding a study
const currentStats = projectStore.projectStats[projectId];
projectStore.setProjectStats(projectId, {
  studyCount: currentStats.studyCount + 1,
  completedCount: currentStats.completedCount,
});
```

### 1.6 Dashboard: Display Cached Stats

**File**: `packages/web/src/components/dashboard/ProjectCard.jsx`

Read from projectStore for cards of previously-opened projects:

```javascript
const cachedStats = () => projectStore.projectStats[props.project.id];
const studyCount = () => cachedStats()?.studyCount ?? props.project.studyCount ?? 0;
const completedCount = () => cachedStats()?.completedCount ?? props.project.completedCount ?? 0;
```

Priority: `projectStore cache > props from API > 0`

---

## Phase 2: Notifications (Preview/Hints)

Notifications provide approximate stats for the dashboard before a user opens a project. These are secondary and may be incomplete (max 50 pending notifications, can be lost).

### 2.1 Emit Stats Updates from ProjectDoc

**File**: `packages/workers/src/durable-objects/ProjectDoc.js`

When studies change, notify project members via their UserSession:

```javascript
async broadcastStatsToMembers(env) {
  const stats = this.getProjectStats();
  const members = await this.getProjectMembers(env); // Need to implement

  for (const member of members) {
    const session = env.USER_SESSION.idFromName(member.userId);
    await session.get().fetch('https://internal/notify', {
      method: 'POST',
      body: JSON.stringify({
        type: 'project-stats-updated',
        projectId: this.projectId,
        stats,
        timestamp: Date.now()
      })
    });
  }
}
```

### 2.2 Call Stats Broadcast on Study Changes

Hook into Yjs observers to detect changes:

```javascript
this.doc.getMap('reviews').observe((event) => {
  // Debounce to avoid spamming on bulk imports
  this.scheduleStatsBroadcast();
});

scheduleStatsBroadcast() {
  if (this.statsBroadcastTimer) return;
  this.statsBroadcastTimer = setTimeout(() => {
    this.broadcastStatsToMembers(this.env);
    this.statsBroadcastTimer = null;
  }, 5000); // 5 second debounce
}
```

### 2.3 Frontend: Handle Stats Notifications

**File**: `packages/web/src/primitives/useMembershipSync.js`

Add handler for stats updates:

```javascript
if (notificationType === 'project-stats-updated') {
  // Store as hint in projectStore (lower priority than lazy-loaded)
  projectStore.setProjectStatsHint(notification.projectId, notification.stats);
}
```

### 2.4 API Enhancement (Optional)

Could add stats hints to `/api/users/me/projects` response by:

1. Storing last-known stats in SQL when ProjectDoc broadcasts
2. Joining that data in the projects query

This avoids N+1 queries to ProjectDoc DOs at dashboard load time.

---

## Data Flow Summary

```
Dashboard Load:
  API returns projects (no stats or stale stats from SQL cache)
  -> Show cached stats from projectStore if available
  -> Show notification hints if available
  -> Show "-- studies" if no data

User Opens Project:
  WebSocket connects to ProjectDoc
  -> ProjectDoc sends project-stats message
  -> Frontend stores authoritative stats in projectStore
  -> Dashboard updates to show true counts

Study Added/Removed (while in project):
  Frontend updates local stats immediately
  ProjectDoc broadcasts to other members (5s debounce)
  -> Other members see updated hints on dashboard
```

---

## Implementation Order

### Phase 1 Tasks (Lazy Load)

1. [ ] Add `getProjectStats()` method to ProjectDoc
2. [ ] Send stats on WebSocket connect in ProjectDoc
3. [ ] Add `projectStats` to projectStore
4. [ ] Handle `project-stats` message in useProject
5. [ ] Update Dashboard/ProjectCard to read from projectStore
6. [ ] Update local stats on study add/remove

### Phase 2 Tasks (Notifications)

1. [ ] Add `broadcastStatsToMembers()` to ProjectDoc
2. [ ] Add Yjs observer with debounce for stats changes
3. [ ] Add `project-stats-updated` handler to useMembershipSync
4. [ ] Add `projectStatsHints` to projectStore (separate from authoritative)
5. [ ] Optional: Cache stats in SQL for API response

---

## Files to Modify

**Phase 1:**

- `packages/workers/src/durable-objects/ProjectDoc.js` - Stats computation + WS message
- `packages/web/src/stores/projectStore.js` - Stats storage
- `packages/web/src/primitives/useProject.js` - Handle stats message
- `packages/web/src/components/dashboard/ProjectCard.jsx` - Display cached stats
- `packages/web/src/components/dashboard/Dashboard.jsx` - Stats aggregation

**Phase 2:**

- `packages/workers/src/durable-objects/ProjectDoc.js` - Stats broadcast
- `packages/web/src/primitives/useMembershipSync.js` - Handle notification
- `packages/web/src/stores/projectStore.js` - Stats hints storage

---

## Open Questions

1. **Study completion criteria**: What field indicates a study is "completed"? Need to check Yjs document structure.
2. **Member list access**: How does ProjectDoc get the list of project members? May need to query SQL or store in Yjs.
3. **Performance**: For projects with many members, broadcasting could be expensive. May want to limit or batch.
