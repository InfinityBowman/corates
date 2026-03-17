# RFC: Deepen the Database Access Layer

## Problem

The backend has 82 database operations spread across 31 route files, 6 command files, 6 policy functions, 5 middleware modules, and 1 Durable Object. Three specific architectural frictions compound into real cost:

### 1. Membership query duplication (10+ copies with divergent projections)

`getProjectMembership` appears in 6+ locations, `getOrgMembership` in 4+, and owner-count queries in 4+. Each copy has a subtly different projection (some return `role` only, some return `role + joinedAt`, the middleware version joins `organization` for name/slug). This means:

- Schema changes to membership tables require hunting through every caller.
- A projection fix in one location does not propagate to others.
- Policy functions that are called multiple times in the same request re-execute the same D1 query each time (no memoization).

### 2. ProjectDoc crosses the infrastructure boundary

The `ProjectDoc` Durable Object calls `createDb(this.env.DB)` directly at WebSocket upgrade time to verify project membership. This makes it impossible to unit test the DO's auth logic without spinning up a full miniflare environment with a real D1 database. The auth check is 2 queries, but they're embedded in a 600+ line file that also handles Y.js sync, persistence, and awareness protocol.

### 3. Billing resolution called redundantly

`resolveOrgAccess()` (which runs 2-4 D1 queries internally) is called independently by `requireOrgWriteAccess`, `requireQuota`, `quotaTransaction`, and route handlers. A single write request can resolve the same org's billing 3-4 times. There is no request-scoped cache.

### Additional duplication

- The 8-statement user deletion cascade (`update mediaFiles, delete projectMembers, projects, twoFactor, session, account, verification, user`) is duplicated verbatim in `routes/users.ts` and `routes/admin/users.ts`.
- `createDb(c.env.DB)` is called independently in every middleware and route handler, constructing multiple Drizzle instances per request.
- `db.batch()` requires an unsafe cast (`as unknown as Parameters<typeof db.batch>[0]`) at every call site.

### Integration risk

The seams between middleware, policies, commands, and the DO all independently query the same tables with no shared contract. When the `member` table schema changes, the middleware join query, the policy lookup, the command existence check, and the DO auth query must all be updated independently. There is no compiler-enforced consistency.

---

## Proposed Interface

The design introduces four components that address the three friction points plus the cascade duplication:

### 1. `MembershipReader` interface + `DrizzleMembershipReader`

A read-only interface consolidating all membership queries into one contract with consistent projections.

```typescript
interface MembershipReader {
  getProjectMembership(userId: string, projectId: string): Promise<ProjectMemberRow | null>;
  getOrgMembership(userId: string, orgId: string): Promise<OrgMemberRow | null>;
  countProjectOwners(projectId: string): Promise<number>;
  countOrgOwners(orgId: string): Promise<number>;
  getProject(projectId: string): Promise<{ id: string; name: string; orgId: string } | null>;
}

interface ProjectMemberRow {
  role: string | null;
  joinedAt: Date | null;
}

interface OrgMemberRow {
  role: string | null;
  id: string;
  orgName: string;
  orgSlug: string | null;
}
```

`DrizzleMembershipReader` implements this with the actual Drizzle queries, pulled from the 10+ locations where they currently live. The `OrgMemberRow` projection includes `orgName` and `orgSlug` so the middleware join query and the policy lookup are the same operation.

**Callers use it like:**
```typescript
// In requireOrgMembership middleware
const reader = new DrizzleMembershipReader(db);
const row = await reader.getOrgMembership(userId, orgId);
if (!row) return c.json(createDomainError(AUTH_ERRORS.FORBIDDEN), 403);
c.set('org', { id: orgId, name: row.orgName, slug: row.orgSlug });

// In policies (signature unchanged, internal implementation delegates to reader)
export async function getProjectMembership(db, userId, projectId) {
  const reader = new DrizzleMembershipReader(db);
  return reader.getProjectMembership(userId, projectId);
}
```

**What it hides:** Query construction, join logic, column projection selection. Callers never write `db.select({ role: projectMembers.role }).from(projectMembers).where(and(...))` again.

### 2. `ProjectDocAuthPort` + `D1ProjectDocAuth` + `InMemoryProjectDocAuth`

A narrow 2-method interface expressing exactly the queries ProjectDoc needs for WebSocket auth:

```typescript
interface ProjectDocAuthPort {
  getProjectMembership(userId: string, projectId: string): Promise<{ role: string | null } | null>;
  projectExists(projectId: string): Promise<boolean>;
}
```

`D1ProjectDocAuth` wraps `createDb(env.DB)` and runs the two existing queries. `InMemoryProjectDocAuth` is a Map-based test double.

**Usage in ProjectDoc:**
```typescript
// Production path (in handleWebSocket)
const authPort = new D1ProjectDocAuth(this.env.DB);
const membership = await this.verifyProjectMembership(userId, projectId, authPort);

// Test path
const authPort = new InMemoryProjectDocAuth({
  members: [{ userId: 'u1', projectId: 'p1', role: 'member' }],
  projects: [{ id: 'p1', name: 'Test', orgId: 'o1' }],
});
await doc.verifyProjectMembership('u1', 'p1', authPort); // no D1 needed
```

**What it hides:** The D1 binding, Drizzle instantiation, and query construction from the DO's auth logic.

### 3. Request-scoped memoization via `useDb(c)`

A thin function that returns a memoized handle from the Hono context:

```typescript
interface DbHandle {
  raw: Database;                    // escape hatch for ad-hoc queries
  membership: MembershipReader;     // memoized membership queries
  resolveOrgAccess(orgId: string): Promise<OrgBilling>;  // memoized billing
  batch(statements: BatchItem<'sqlite'>[]): Promise<void>;  // typed, no cast
}

function useDb(c: AppContext): DbHandle;
```

On first call, `useDb(c)` creates a `Database` via `createDb(c.env.DB)`, wraps a `DrizzleMembershipReader` with a memoization layer (Map stored on `c`), wraps `resolveOrgAccess` with a per-orgId cache, and stores the handle on `c.get('__dbHandle')`. Subsequent calls return the cached handle.

**Usage in middleware chain:**
```typescript
// requireOrgMembership (first call creates the handle)
const db = useDb(c);
const row = await db.membership.getOrgMembership(userId, orgId);

// requireQuota (returns cached handle, billing is memoized)
const db = useDb(c);
const billing = await db.resolveOrgAccess(orgId); // 0 D1 queries if already resolved

// Route handler (returns cached handle, membership is memoized)
const db = useDb(c);
const membership = await db.membership.getProjectMembership(userId, projectId); // cache hit
```

**What it hides:** Instance deduplication (one `createDb` per request), memoization cache management, null-result caching, the `BatchItem<'sqlite'>` cast. The cache is request-scoped (stored on `c`) and requires no cleanup.

### 4. `deleteUserCascade()` helper

A single function encapsulating the 8-statement batch:

```typescript
function buildUserDeletionCascade(db: Database, userId: string, email: string): BatchItem<'sqlite'>[];
```

Returns the ordered array of Drizzle statements. Callers pass the result to `db.batch()` or `dbHandle.batch()`. Defined once, used by both `routes/users.ts` and `routes/admin/users.ts`.

---

## Dependency Strategy

This design spans two dependency categories:

### Local-substitutable (D1 database)

The `DrizzleMembershipReader` and `D1ProjectDocAuth` use Drizzle over D1. Integration tests use the real D1 binding provided by `@cloudflare/vitest-pool-workers`. The memoization layer (`useDb`) is tested by spying on the underlying reader to verify cache hits.

### Remote but owned / Ports & Adapters (ProjectDoc boundary)

The `ProjectDocAuthPort` defines a port at the DO-to-database boundary. Production uses `D1ProjectDocAuth` (real D1 queries). Tests use `InMemoryProjectDocAuth` (Map-based). This lets the DO's WebSocket auth logic be unit tested without miniflare or D1 setup.

**What is NOT abstracted:** Commands continue to call `createDb(env.DB)` directly. Route handlers that need one-off queries use `dbHandle.raw`. Policies keep their `(db: Database, ...)` signatures. The `insertWithQuotaCheck` utility in `quotaTransaction.ts` is unchanged. Only the three specific friction points get interfaces.

---

## Testing Strategy

### New boundary tests to write

1. **MembershipReader correctness**: Given seeded membership rows, verify that `getProjectMembership`, `getOrgMembership`, `countProjectOwners`, `countOrgOwners` return correct results. Test null-member case explicitly. These are integration tests using the real D1 test environment.

2. **Memoization behavior**: Spy on the `DrizzleMembershipReader`, call `useDb(c).membership.getProjectMembership(userId, projectId)` twice with the same args, assert the reader was called once. Repeat for `resolveOrgAccess`. Test that different args produce separate cache entries. Test that null results are cached (not re-queried).

3. **ProjectDoc auth isolation**: Using `InMemoryProjectDocAuth`, test that `verifyProjectMembership` returns the correct role for known members, returns null for non-members, and returns false for non-existent projects. These are pure unit tests with no I/O.

4. **User deletion cascade**: Seed a full user (with sessions, accounts, project memberships, media files, etc.), call `buildUserDeletionCascade` + `db.batch()`, verify all 8 tables are cleaned up correctly.

### Old tests to delete

None initially. The existing policy and middleware tests continue to work -- they test at a higher level (HTTP request -> response) and are not invalidated by the internal refactor. Over time, if policy functions become thin wrappers around `MembershipReader`, their dedicated tests can be replaced by reader boundary tests.

### Test environment needs

- Existing `@cloudflare/vitest-pool-workers` setup (already in place) for integration tests
- `InMemoryProjectDocAuth` test double (new, ~30 lines) for DO unit tests
- No new infrastructure required

---

## Implementation Recommendations

### What the module should own

- **MembershipReader**: All read queries against `projectMembers`, `member`, and `organization` tables for the purpose of access checks. Owns the canonical projection shapes (`ProjectMemberRow`, `OrgMemberRow`).
- **ProjectDocAuthPort**: The contract between the Durable Object and the database for WebSocket upgrade auth. Owns the decision of what data the DO needs to authorize a connection.
- **useDb / DbHandle**: Request-scoped lifecycle of the Drizzle instance and query result caching. Owns the invariant that `createDb` is called at most once per request and that hot-path reads are not re-executed.
- **deleteUserCascade**: The ordered sequence of 8 statements for full user removal. Owns the knowledge of which tables have user foreign keys and in what order they must be deleted.

### What it should hide

- Drizzle query construction (column selection, joins, where clauses) for membership and owner-count operations
- Cache key composition and null-result caching logic
- The `BatchItem<'sqlite'>` cast that Drizzle currently requires
- The D1 binding and Drizzle instantiation inside the Durable Object

### What it should expose

- `MembershipReader` interface with 5 methods returning typed result objects
- `ProjectDocAuthPort` interface with 2 methods
- `useDb(c)` returning a `DbHandle` with `raw`, `membership`, `resolveOrgAccess`, and `batch`
- `buildUserDeletionCascade(db, userId, email)` returning a statement array
- `DrizzleMembershipReader`, `D1ProjectDocAuth`, `InMemoryProjectDocAuth` as concrete implementations

### How callers should migrate

**Phase 1 -- MembershipReader (zero behavior change, consolidates queries):**
Create the interface and implementation. Refactor policy functions to delegate to the reader internally. Refactor `requireOrgMembership` and `requireProjectAccess` middleware to use the reader. Policy function signatures (`(db: Database, ...)`) do not change -- the reader is an internal implementation detail.

**Phase 2 -- ProjectDoc auth port (surgical, enables DO unit testing):**
Extract the 2-query auth block from `ProjectDoc.handleWebSocket` into a `verifyProjectMembership(userId, projectId, port)` method. The production code path constructs `D1ProjectDocAuth` at the call site. Write unit tests using `InMemoryProjectDocAuth`.

**Phase 3 -- Request-scoped memoization (performance win):**
Implement `useDb(c)` with memoization wrapping the `MembershipReader` and `resolveOrgAccess`. Migrate middleware to use `useDb(c)` instead of calling `createDb` directly. Route handlers that currently call `createDb` switch to `useDb(c).raw` for ad-hoc queries. Commands are unchanged.

**Phase 4 -- User deletion consolidation (quick win):**
Extract `buildUserDeletionCascade` into a shared helper. Update both call sites. This phase is independent and can be done at any point.

Each phase is independently shippable and leaves the codebase in a working state. Run `pnpm --filter workers test` after each phase.
