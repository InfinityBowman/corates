# Durable Objects Migration Review - February 2026

## Context

All three Durable Objects (EmailQueue, UserSession, ProjectDoc) were migrated from `implements DurableObject` with fetch-based routing to `extends DurableObject<Env>` with:
- Typed RPC methods (replacing `stub.fetch(new Request(...))`)
- Hibernatable WebSocket API (ProjectDoc, UserSession)
- Debounced Y.Doc persistence (ProjectDoc)

This document records the findings from a 3-reviewer quality audit after implementation. Each issue was independently verified against the source code.

## Verification Status

- Tests: 450/450 pass (8 pre-existing failures in stop-impersonation.test.js unrelated to migration)
- Typecheck: Only pre-existing Stripe API version errors
- Lint: Only pre-existing issues in other files

---

## Critical Issues

### C1. ProjectDoc: `schedulePersistenceIfNoConnections` is fire-and-forget

**File**: `packages/workers/src/durable-objects/ProjectDoc.ts`, lines 214, 259, 300, 415, 433, 446, 483
**Confidence**: 90%
**Found by**: Reviewer 2

**Problem**: The `schedulePersistenceIfNoConnections()` method is `void` and calls `this.flushPersistence()` (which is `async` and does `await this.ctx.storage.put(...)`) without awaiting it. When RPC methods like `syncProject`, `syncMember`, `syncPdf`, and several dev methods call this, the RPC returns to the caller before the storage write completes. If the DO is evicted before the unawaited `flushPersistence` finishes, the Y.Doc mutation is lost permanently.

**Code**:
```typescript
// Returns void, does not await the async flushPersistence
private schedulePersistenceIfNoConnections(): void {
  if (this.ctx.getWebSockets().length === 0) {
    this.flushPersistence();  // fire-and-forget
  }
}
```

**Fix**: Make the method `async`, return `Promise<void>`, and `await` the flush. All callers must also `await` it.

**Regression test**: Call `syncMember('add', ...)` via RPC with no active WebSocket connections, then verify the Y.Doc state was persisted to storage.

---

### C2. ProjectDoc: `webSocketError` missing `initializeDoc()` call

**File**: `packages/workers/src/durable-objects/ProjectDoc.ts`, lines 757-772
**Confidence**: 87%
**Found by**: Reviewer 2

**Problem**: After hibernation wake, `this.doc` and `this.awareness` are `null`. The `webSocketClose` handler correctly calls `await this.initializeDoc()` at line 738, but `webSocketError` at line 757 does not. When the DO wakes from hibernation due to a WebSocket error event, the `this.awareness` null-check silently skips awareness cleanup, leaving stale presence cursors visible to other clients.

**Code**:
```typescript
// webSocketClose (correct):
async webSocketClose(ws, _code, _reason, _wasClean) {
  await this.initializeDoc();  // re-initializes after hibernation wake
  // ... awareness cleanup works
}

// webSocketError (missing):
async webSocketError(ws, error) {
  console.error('WebSocket error in ProjectDoc:', error);
  // NO initializeDoc() call -- this.awareness is null after hibernation
  const attachment = ws.deserializeAttachment();
  if (attachment && attachment.awarenessClientId != null && this.awareness) {
    // this.awareness is null, so this block is silently skipped
    awarenessProtocol.removeAwarenessStates(...);
  }
}
```

**Fix**: Add `await this.initializeDoc()` at the top of `webSocketError`, matching `webSocketClose`.

**Regression test**: Not practically testable -- vitest pool DOs don't truly hibernate. Fix is a one-line addition with clear correctness from code inspection.

---

### C3. EmailQueue: Dead-letter write pattern is fragile

**File**: `packages/workers/src/durable-objects/EmailQueue.ts`, lines 85-89
**Confidence**: 92%
**Found by**: All 3 reviewers

**Problem**: The unawaited `storage.put` followed by awaited `storage.delete` was designed for write coalescing (both operations in the same batch). While Cloudflare DO storage *should* coalesce these (the `put` is queued, then the `await delete` flushes the batch), the unawaited `put` means any rejection is silently swallowed as an unhandled promise. This is fragile and the misleading "atomically" comment suggests the intent was clearer guarantees.

**Code**:
```typescript
// Move to dead letter queue atomically -- both writes coalesce
this.ctx.storage.put(`dead-letter:${emailRecord.id}`, emailRecord);  // unawaited
await this.ctx.storage.delete(`email:${emailRecord.id}`);            // awaited
```

**Fix**: Await both writes explicitly. The atomic coalescing comment should be removed since sequential awaits are separate transactions (but both succeeding is the correct behavior -- we want the dead-letter record to exist before deleting the original).

**Regression test**: After triggering max retries, verify the dead-letter record exists in storage AND the email record is deleted.

---

## Important Issues

### I1. ProjectDoc: `syncProject` member replacement not in `doc.transact()`, iteration-during-mutation unsafe

**File**: `packages/workers/src/durable-objects/ProjectDoc.ts`, lines 196-211
**Confidence**: 85%
**Found by**: Reviewers 1, 2

**Problem**: Two issues in the member replacement loop:

1. **Mutation during iteration**: Deleting from a Y.Map while iterating its entries may skip entries depending on Y.js internals.
2. **No transaction**: Each `delete` and `set` fires the `doc.on('update')` listener individually, broadcasting partial state to connected WebSocket clients. Between the delete loop and add loop, all clients briefly see an empty members map.

**Code**:
```typescript
const membersMap = this.doc!.getMap('members');
for (const [userId] of membersMap.entries()) {
  membersMap.delete(userId);  // mutating while iterating
}
for (const member of data.members) {
  membersMap.set(member.userId, memberYMap);  // broadcasts individually
}
```

**Fix**: Collect keys first, then wrap both loops in `this.doc!.transact(() => { ... })`.

**Regression test**: Call `syncProject` with a different member list, verify old members are fully removed and new members are present.

---

### I2. Y.Map member construction duplicated 4 times

**File**: `packages/workers/src/durable-objects/ProjectDoc.ts` (3 sites) + `dev-handlers.ts` (1 site)
**Confidence**: 95%
**Found by**: Reviewer 1

**Problem**: The same 7-field `memberYMap.set(...)` pattern appears at:
- `syncProject` (line 202-210)
- `syncMember` add branch (line 226-234)
- WebSocket connect handler (line 635-643)
- `dev-handlers.ts` handleDevImport (line 327-335)

Any schema change (e.g., adding `username` field) requires finding and updating all 4 sites. One copy already diverges slightly (line 637 casts `(user.name as string)`).

**Fix**: Extract a `buildMemberYMap(member)` function in `ProjectDoc.ts` and export it for `dev-handlers.ts` to use.

**Regression test**: Not directly testable (code quality). The `syncProject` test from I1 indirectly validates the builder works.

---

### I3. Dev RPC methods duplicate the same `ctx` object 6 times

**File**: `packages/workers/src/durable-objects/ProjectDoc.ts`, lines 394-397, 406-409, 422-425, 440-443, 453-456, 471-474
**Confidence**: 88%
**Found by**: Reviewer 1

**Problem**: Six dev methods each construct the same `{ doc, stateId, yMapToPlain }` object before delegating to `dev-handlers.ts`.

**Fix**: Extract a private getter:
```typescript
private get devCtx() {
  return {
    doc: this.doc!,
    stateId: this.ctx.id.toString(),
    yMapToPlain: this.yMapToPlain.bind(this),
  };
}
```

**Regression test**: Not directly testable (code quality).

---

### I4. Test mock in `helpers.ts` missing RPC methods

**File**: `packages/workers/src/__tests__/helpers.ts`, lines 364-375
**Confidence**: 85%
**Found by**: Reviewer 3

**Problem**: The `mockDO` object used by `createTestEnv` is missing:
- `getDeadLetterQueue` (EmailQueue)
- All 7 dev RPC methods: `devExport`, `devImport`, `devPatch`, `devReset`, `devRaw`, `devTemplates`, `devApplyTemplate` (ProjectDoc)

Any future test using `createTestEnv` that hits these paths will get `TypeError: stub.method is not a function`.

**Fix**: Add all missing methods to the mock.

**Regression test**: Not applicable -- this IS test infrastructure.

---

### I5. `dev-routes.ts`: `template!` non-null assertion without guard

**File**: `packages/workers/src/routes/orgs/dev-routes.ts`, line 299
**Confidence**: 83%
**Found by**: Reviewer 3

**Problem**: The `template` query param is `z.string().optional()`, so it can be `undefined`. The `!` suppresses the TypeScript error but at runtime `undefined` gets interpolated into a URL as the literal string `"undefined"`, silently applying the wrong template.

**Code**:
```typescript
const template = query.template;  // string | undefined
const data = await projectDoc.devApplyTemplate(template!, mode);  // passes undefined
```

**Fix**: Add a 400 guard before the call:
```typescript
if (!template) {
  return c.json({ error: 'template query parameter is required' }, 400);
}
```

**Regression test**: Call apply-template route without template param, expect 400.

---

## Issues NOT fixed (minor)

| ID | Issue | Reason deferred |
|----|-------|-----------------|
| M1 | EmailQueue `queueEmail` uses raw `Error` instead of `createDomainError` | Convention-only, runtime behavior correct |
| M2 | `helpers.ts` duplicates `getProjectDocName` instead of importing | Low risk, test-only code |
| M3 | `project-sync.ts` thin wrappers used inconsistently | Refactoring scope beyond migration |

---

## Files Modified by Migration

### Phase 1 (EmailQueue)
1. `packages/workers/src/durable-objects/EmailQueue.ts`
2. `packages/workers/src/routes/email.ts`
3. `packages/workers/src/routes/billing/handlers/dunning.ts`
4. `packages/workers/src/routes/orgs/invitations.ts`
5. `packages/workers/src/routes/orgs/members.ts`
6. `packages/workers/src/routes/members.ts`
7. `packages/workers/src/durable-objects/__tests__/EmailQueue.test.js`
8. `packages/workers/src/routes/__tests__/email.test.js`
9. `packages/workers/src/routes/__tests__/project-invitations.test.js`

### Phase 2 (UserSession)
10. `packages/workers/src/durable-objects/UserSession.ts`
11. `packages/workers/src/lib/notify.ts`
12. `packages/workers/src/commands/lib/notifications.ts`
13. `packages/workers/src/routes/invitations.ts`
14. `packages/workers/src/durable-objects/__tests__/UserSession.test.js`

### Phase 3 (ProjectDoc)
15. `packages/workers/src/durable-objects/ProjectDoc.ts`
16. `packages/workers/src/lib/project-sync.ts`
17. `packages/workers/src/lib/project-doc-id.ts`
18. `packages/workers/src/commands/lib/doSync.ts`
19. `packages/workers/src/routes/users.ts`
20. `packages/workers/src/routes/avatars.ts`
21. `packages/workers/src/routes/orgs/dev-routes.ts`
22. `packages/workers/src/durable-objects/__tests__/ProjectDoc.ws-auth.test.js`
23. `packages/workers/src/__tests__/helpers.ts`
