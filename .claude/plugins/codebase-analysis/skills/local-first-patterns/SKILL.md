---
name: Local-First Patterns Analysis
description: This skill should be used when the user asks to "analyze local-first patterns", "review offline support", "check sync implementation", "audit conflict resolution", "review optimistic updates", "check offline capabilities", or mentions local-first architecture, CRDTs, offline-first, sync patterns, or data synchronization.
version: 1.0.0
---

# Local-First Patterns Analysis Framework

Use this framework when analyzing a codebase for local-first architecture quality. Focus on offline capabilities, sync reliability, and conflict handling.

## Analysis Criteria

### 1. Offline Data Storage

**What to check:**

- Local persistence mechanism (IndexedDB, SQLite, localStorage)
- Data schema and structure for offline use
- Storage capacity management
- Data encryption at rest

**Storage options to identify:**

- IndexedDB: Complex data, large datasets
- localStorage: Simple key-value, small data
- SQLite (via libraries): Relational data
- OPFS: File system access
- Cache API: Request/response caching

**Warning signs:**

- Over-reliance on localStorage for complex data
- No storage quota management
- Missing data migration strategy
- Unencrypted sensitive local data

### 2. Sync Architecture

**What to check:**

- Sync protocol and mechanism
- Sync direction (one-way, two-way, multi-master)
- Sync granularity (document, field, operation)
- Sync frequency and triggers

**Common patterns:**

- **Last-write-wins**: Simple but can lose data
- **Operational transforms**: Real-time collaboration
- **CRDTs**: Conflict-free by design
- **Event sourcing**: Full history, replayable
- **Delta sync**: Only changed data

**What to look for:**

```javascript
// Sync trigger patterns
- On reconnect
- Periodic background sync
- On user action
- Real-time via WebSocket
- Push notification triggered
```

### 3. Conflict Resolution

**What to check:**

- Conflict detection mechanism
- Resolution strategy (automatic vs manual)
- User notification of conflicts
- Conflict history/audit trail

**Resolution strategies:**

- **Automatic merge**: Field-level, non-conflicting changes merge
- **Last-write-wins**: Timestamp-based, may lose data
- **First-write-wins**: Preserves original, may reject valid changes
- **Custom merge**: Domain-specific logic
- **User resolution**: Present conflicts for manual resolution
- **CRDT-based**: Mathematically conflict-free

**Warning signs:**

- No conflict detection
- Silent data loss on conflict
- No way to recover from bad merge
- Inconsistent resolution across data types

### 4. Optimistic Updates

**What to check:**

- UI updates before server confirmation
- Rollback mechanism on failure
- Pending state indication to users
- Queue management for offline changes

**Good patterns:**

```javascript
// Optimistic update with rollback
async function updateItem(item) {
  const previousState = store.get(item.id);
  store.update(item); // Optimistic

  try {
    await api.update(item);
  } catch (error) {
    store.set(item.id, previousState); // Rollback
    notifyUser('Update failed, changes reverted');
  }
}
```

**Warning signs:**

- No rollback on failure
- User not informed of pending state
- Lost updates when offline
- No retry for failed operations

### 5. Network State Management

**What to check:**

- Online/offline detection
- Connection quality awareness
- Graceful degradation
- Reconnection handling

**What to look for:**

- `navigator.onLine` usage
- Network event listeners
- Connection quality indicators
- Offline mode UI changes

### 6. Data Versioning and Migrations

**What to check:**

- Schema version tracking
- Migration strategy for local data
- Backwards compatibility
- Data integrity during migrations

### 7. Sync Queue and Retry

**What to check:**

- Offline operation queue
- Retry logic with backoff
- Queue persistence across sessions
- Operation ordering guarantees
- Idempotency of queued operations

**Good patterns:**

```javascript
// Persistent queue with retry
const syncQueue = {
  operations: persistentStore.get('syncQueue') || [],

  add(operation) {
    operation.id = generateId();
    operation.timestamp = Date.now();
    this.operations.push(operation);
    this.persist();
  },

  async processQueue() {
    for (const op of this.operations) {
      try {
        await this.executeWithRetry(op);
        this.remove(op.id);
      } catch (e) {
        if (!isRetryable(e)) this.markFailed(op.id);
      }
    }
  },
};
```

### 8. Real-Time Collaboration (if applicable)

**What to check:**

- Presence awareness
- Cursor/selection sharing
- Live updates propagation
- Conflict handling during collaboration

**Technologies to identify:**

- WebSocket connections
- Yjs, Automerge, or similar CRDTs
- Operational transformation libraries
- Presence channels

## Report Structure

```markdown
# Local-First Analysis Report

## Summary

[Overall local-first maturity assessment]

## Capabilities Assessment

| Capability          | Status         | Notes     |
| ------------------- | -------------- | --------- |
| Offline Storage     | Yes/Partial/No | [Details] |
| Offline Mutations   | Yes/Partial/No | [Details] |
| Sync Mechanism      | [Type]         | [Details] |
| Conflict Resolution | [Strategy]     | [Details] |
| Optimistic Updates  | Yes/Partial/No | [Details] |

## Architecture Overview

[How data flows between local and remote]

## Strengths

[Good local-first patterns found]

## Issues Found

### Critical

[Issues causing data loss or corruption]

### Improvements Needed

[Gaps in offline support]

## Recommendations

### Essential

[Must-have improvements for reliable offline]

### Enhancements

[Nice-to-have improvements]

## Sync Flow Diagram

[Visual representation of sync architecture]
```

## Analysis Process

1. **Identify storage layer**: Find local persistence mechanisms
2. **Map sync architecture**: Understand how data flows to/from server
3. **Trace offline scenarios**: What happens when connection is lost
4. **Evaluate conflict handling**: How are concurrent edits resolved
5. **Check optimistic updates**: Does UI respond immediately
6. **Review network handling**: How is online/offline state managed
7. **Test edge cases**: Consider what happens in failure scenarios
8. **Document findings**: Create improvement roadmap
