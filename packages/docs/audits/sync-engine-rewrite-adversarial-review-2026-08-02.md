# Adversarial Review: sync-engine-rewrite

**Date:** 2026-08-02
**Branch:** `sync-engine-rewrite` (12 commits, merge-base `e45120bb`)
**Scope:** 250 files, +11121 / -13291
**Applicable rules file:** `.claude/CLAUDE.md`
**Method:** two CLAUDE.md compliance passes and two adversarial bug-hunt passes, each finding then independently validated by a separate agent instructed to refute it. Nine of seventeen raised issues survived validation.

This is a second review. The prior audit (`sync-engine-rewrite-review-2026-08.md`) was remediated in commit `6bc55076`; its dismissed items (legacy singular reconciliation data, notes whole-string LWW, the unicode sweep, CreateLocalChecklist extraction) were excluded from this pass and are not re-raised.

---

## Summary of changes reviewed

The branch replaces the entire real-time sync layer. The `ProjectDoc` Durable Object and its y-websocket plane are deleted along with the client reactor and tldraw read path. In their place: a shared app definition (`packages/shared/src/sync/`) holding schema, mutators, and presence; a `WorkspaceDO` with connection authorization and a bearer-gated admin route (`packages/workers/src/sync/`); and a client built on a `SyncClient` pool, live queries, and a mutation outbox. Cutover tooling (`scripts/sync-cutover/`, `transform.ts`, `verify.ts`) migrates old-plane exports into the engine, gated by an invariant checker, with a one-way runbook at `packages/docs/plans/sync-engine-cutover.md`.

---

## Issue 1: `checklist.setText` accepts an arbitrary answer key and a client-supplied length cap

**Type:** Security / Logic Error
**Severity:** High
**Status:** CONFIRMED by execution against the shipped engine

**Description:**
`checklist.setText` validates its `key` argument as `z.string().min(1)` and nothing more. Its `apply` looks up the checklist row (for existence and `studyId`) but never constrains the key to that instrument's text-answer keys, and the destination row schema is `value: z.json()`. Any project member can therefore overwrite any answer row with a string, including rows whose contract is `boolean[][]`.

This contradicts the module's own header at `mutators.ts:64-69`, which states that per-key validation is "now enforced by the server before apply". That is true of `checklist.updateAnswer`, which runs a per-(instrument, key) discriminated union; `setText` is the hole in that claim. The allowlist needed already exists as `textAnswerKeys()` in `answer-rows.ts:229` and is used by `fields.ts`, `transform.ts`, and `verify.ts` -- every consumer except the mutator.

Separately, `maxLength` is a mutator argument with a default rather than a server constant, so the documented 2000-character cap is whatever the caller says it is. No caller in the repo passes it.

**Evidence:**

- `packages/shared/src/sync/mutators.ts:447-472` (the args schema and apply body)
- `packages/shared/src/sync/mutators.ts:409-414` (the contrasting validation in `updateAnswer`)
- `packages/shared/src/sync/schema.ts:100-114` (row schema delegates validation to `updateAnswer`)
- `packages/shared/src/sync/derive.ts:264-272` (scoring reads the corrupted value)
- `packages/web/src/components/checklist/AMSTAR2Checklist.tsx:241, 155, 295` (the repair path)

**Verification performed:** the validator executed the shipped mutators through `@cf-sync/server`'s `createTestEngine`, which runs the same args-validation and `WriteSet` path as the Durable Object. Results: `key: 'not.a.real.key'` creates a new row with no error; a poisoned `q1.answers` moves an AMSTAR2 checklist from `High` to `Incomplete`; `maxLength: 699000` is accepted and stores a 699,086-byte row, while 800,000 is refused by `MAX_ROW_BYTES`. The effective ceiling is roughly 350x the documented cap.

**Failure scenario:**
A member of a project issues `checklist.setText({ checklistId, key: 'q1.answers', text: 'x', maxLength: 699000 })` against any checklist in that project. The server re-validates, accepts, and broadcasts to every collaborator. The checklist silently scores `Incomplete`, the question drops out of the finalized chart's consolidated answers, and every reviewer who then clicks a radio button on that question hits `TypeError: currentAnswers.map is not a function` in an event handler -- no toast, no error boundary. The only repair path is `updateAnswer`, which is exactly the path that now rejects the corrupted shape. Recovery requires the bearer-token admin import or a DO reset.

The blast radius is one project workspace; the socket is gated on D1 membership for that project. Note also that no mutator consults `ctx.auth.role` -- `writeAllowed` is purely billing-derived, so owner and member are indistinguishable to every mutator.

**Related (same gate, lower impact):** `workspace.ts:31-34` sets `authorizeWrite: ({ auth }) => auth?.writeAllowed === true` for the Yjs field lane with no validation of the field id. Per-field size is bounded (700KB, then frozen), but the _number_ of distinct field ids is not, so a member can mint unbounded field docs under arbitrary ids. `onExport` materializes every field doc in one pass, so junk fields also degrade the admin export path. `workspace.test.ts:249-298` exercises a field id with no backing checklist row and asserts nothing about whether that should be refused.

**Suggested fix:**
In `mutators.ts` apply, after the checklist lookup, reject keys outside the instrument's allowlist:

```ts
if (!textAnswerKeys(checklist.type).includes(key)) {
  throw new AppError('InvalidArgs', `Key ${key} is not a text answer key for ${checklist.type}`);
}
```

Drop `maxLength` from the args schema and use `DEFAULT_TEXT_MAX_LENGTH` directly. For the field lane, require `fieldId` to parse as `${checklistId}:${textKey}` against a live `checklists` row, matching the framing already in `workspace.ts:28-30`.

---

## Issue 2: routine session expiry and tab duplication delete the project cache and the durable outbox, behind a false "Access Denied"

**Type:** Bug / Data Loss
**Severity:** High
**Status:** CONFIRMED (one sub-claim from the original finding refuted)

**Description:**
`handleFatal` derives its user-facing message from the fatal _reason_ and then unconditionally calls `cleanupProjectLocalData` for every fatal that is not a version mismatch. Two reasons that are not authorization verdicts land in that destructive branch.

A 4403 close carrying reason `auth-required` is emitted whenever `verifyAuth` yields no user -- an expired or rotated session cookie, or any thrown error inside `getSession`. This is distinct from non-membership, which returns `not-a-member` or `project-not-found`. The client maps `auth-required` to "You are not a member of this project", a member of `ACCESS_DENIED_ERRORS`, so the user is told they were removed from a project they still belong to, redirected to the dashboard, and has their local cache destroyed.

A 4409 close carrying reason `superseded` is emitted by the server when a second connection presents an existing `clientId`. The client id lives in `sessionStorage`, which browsers copy on "Duplicate tab", so duplicating a tab evicts the original. `FATAL_REASON_MESSAGES['superseded']` is undefined, so the original tab falls through to `GENERIC_FATAL_MESSAGE` -- which is itself in `ACCESS_DENIED_ERRORS` -- and takes the same redirect and the same deletion.

The deletion is not limited to a rebuildable cache. The engine's own `#fatal` settles every pending outbox entry and persists an empty outbox before the app-level delete even runs, so unsent mutations are lost twice over.

**Evidence:**

- `packages/web/src/project/ConnectionPool.ts:390-406` (the fatal branch, message derivation at :403, cleanup at :405)
- `packages/web/src/project/ConnectionPool.ts:102-111` (`FATAL_REASON_MESSAGES`, `GENERIC_FATAL_MESSAGE`)
- `packages/web/src/constants/errors.ts:13-20` (both strings are access-denied members)
- `packages/workers/src/sync/workspace.ts:43-49` (`auth-required` on any falsy user)
- `packages/workers/src/auth/config.ts:758-777` (`verifyAuth` returns `{user: null}` on expiry and on throw)
- `packages/web/src/primitives/db.ts:199, 217-221, 227-233` (Dexie row plus PDFs plus `indexedDB.deleteDatabase`)
- `packages/web/src/project/ProjectGate.tsx:71-76` (toast and redirect)

**Refuted sub-claim, for the record:** the original finding argued the `VersionNotSupported` reload branch was dead because close frames carry numeric codes. It is not dead. The server sends an in-band `error` message before closing, the client constructs the fatal from that message with the string code, and the later numeric close is swallowed by a socket-identity guard. Version mismatch does reload correctly and does not delete data.

**Failure scenario:**
A reviewer answers questions on a flaky connection, so mutations sit in the persisted outbox. Their login session expires. The next reconnect -- including reconnects the workers deliberately force via `admin.ts` on role or billing changes -- returns 4403 `auth-required`. The client deletes `cf-sync:<projectId>` along with the queued mutations, shows "You are not a member of this project", and redirects. Nothing distinguishes this from a real revocation and the work is unrecoverable. No re-authentication is attempted and no membership re-check runs before the delete.

The duplication path is worse in one respect: the `cf-sync:<projectId>` database is shared by both tabs (its name contains no client id), so the original tab queues destruction of the surviving tab's store too. The delete blocks while the duplicate holds a connection and `db.ts:199-205` ignores `onblocked` and self-resolves after two seconds, so the destruction lands whenever that tab releases. The Dexie project row and cached PDFs are deleted immediately and cross-tab.

Two further permanent close codes reach the same branch: 4401 for malformed or oversized auth stamps.

**Suggested fix:**
Restrict `cleanupProjectLocalData` to reasons that genuinely mean "this user may no longer hold this project's data" (`not-a-member`, `project-not-found`, `project-deleted`). Treat `auth-required` as a re-authentication prompt, not a revocation, and give `superseded` its own message and a non-destructive path. Give both a distinct message so neither reads as "Access Denied". If cache eviction on genuine revocation is required, drain or export the outbox first.

---

## Issue 3: the cutover verify gate is vacuous for nested ROBINS-I checklists, and the transform's failure there is a non-fatal warning

**Type:** Logic Error / Data Loss
**Severity:** High
**Status:** CONFIRMED and empirically reproduced

**Description:**
`verifyProjectMigration` compares answer values by iterating the old export's answers and skipping any key absent from `defaultAnswerRows(type)`. It passes `checklist.answers` raw -- it never flattens. A checklist still holding nested section shapes (any doc not opened since the 2026-05-02 flat-key migration) has top-level keys like `planning`, `sectionA`, `domain1a`, `overall`, none of which appear in the flat defaults. Every key hits `continue`, so zero values are compared. The only other answer invariant is "every default key exists as a row", which is always true because the transform seeds the full default set unconditionally.

On the transform side, `flattenNestedAnswers` validates each nested section against the strict per-instrument schema and, on failure, pushes a warning and continues -- substituting defaults, with no `droppedAnswerKeys` entry (that array is appended only for flat keys). `run.ts` prints warnings and exits 0; there is no strict flag. The runbook tells the operator to resolve warnings before proceeding, but nothing enforces it, and the same run emits expected benign warnings that a real one would sit among.

The field-seed check at `verify.ts:264-289` is vacuous for the same inputs: it reads `consensusAnswers[textKey]` off the un-flattened object, gets an object or undefined, and skips on `typeof text !== 'string'`.

**Evidence:**

- `packages/workers/src/sync/verify.ts:210-222` (the skip loop; intent stated at :195-197)
- `packages/workers/src/sync/verify.ts:198-206` (the always-true default-key check)
- `packages/workers/src/sync/transform.ts:277-286` (warning-only failure), `:430, 438-442` (defaults written unconditionally)
- `scripts/sync-cutover/run.ts:88-95` (warnings non-fatal, exit 0)
- `packages/shared/src/checklists/robins-i/answers-schema.ts:16-30` (both schemas `.strict()`)
- `packages/web/wrangler.jsonc:38` (`v5 deleted_classes: ["ProjectDoc"]`)

**Reachability -- the load-bearing part:** the nested-era ROBINS-I writer stamped `judgementSource` on every domain and on `overall` (`d44618b0:packages/web/src/primitives/useProject/checklists/handlers/robins-i.ts:50-56`). That key shipped 2026-01-02, the flat-key migration shipped 2026-05-02, and `judgementSource` was only removed from the app on 2026-06-29. `flattenROBINSI` never propagated it. So every checklist that is _still nested_ -- precisely the population the nested path exists to serve -- carries an extra key that the strict schema rejects.

The validator reproduced this end to end over a realistic nested ROBINS-I export: nine sections failed validation, `droppedAnswerKeys` stayed empty, `domain1a.judgement` went from `"Serious"` to `null`, `d1a_1` from `"Y"` to `null`, `overall.judgement` from `"Critical"` to `null`, prose comments survived, and `verify` returned `ok: true` with zero violations.

Blast radius is instrument-specific and the negatives were checked: nested ROB2 is safe (its handler sets only allowed keys) and nested AMSTAR2 is safe (its schema is non-strict, so the extra `note` key is stripped rather than rejected). The loss is confined to nested ROBINS-I, where it takes out every domain judgement and direction and every bare question answer -- the entire risk-of-bias assessment -- leaving only comments.

**False coverage:** `transform.test.ts:66-79` defines `chk-nested` as AMSTAR2, the one instrument whose schema cannot fail this way, and the rehearsal at `:320-345` asserts `violations` is empty -- which it passes vacuously. No nested ROBINS-I or ROB2 fixture exists.

**Severity qualifier:** this is not unrecoverable. Runbook step 2 (`sync-engine-cutover.md:59-61`) uploads raw pre-freeze exports to R2, so the nested answers survive outside the DO. The defect is silent, verify-invisible loss that depends on a human noticing a warning line.

**Suggested fix:**
Make `report.warnings.length > 0` fatal in the transform branch of `run.ts`. Have `verify` flatten before comparing, reusing `answersAreFlat` and `flattenNestedAnswers` from `transform.ts` (which verify already imports from). Add a nested ROBINS-I fixture carrying `judgementSource` to `transform.test.ts`.

---

## Issue 4: legacy local-practice appraisals are silently and permanently lost on devices that never ran the 2026-04-18 migration

**Type:** Bug / Data Loss
**Severity:** High
**Status:** CONFIRMED (regression against main)

**Description:**
`loadLegacyLocalRows` returns empty rows and exits early when `db.projects.get('local-practice')` is undefined, so `migrateLocalChecklistsToYDoc` -- the only reader of the legacy `localChecklists` table -- never runs. The caller then persists that empty result to `db.localProjects`, and the `!stored` guard means the migration can never run again.

On main this case was covered: the connection path created the missing `projects` row and then ran the migration unconditionally. The branch inverted "create and migrate" into "return empty".

**Evidence:**

- `packages/web/src/project/localProject.ts:270-284` (the early return; the migration call at :283 is unreachable)
- `packages/web/src/project/ConnectionPool.ts:222-231` (empty rows persisted at :229, making it permanent)
- `e45120bb:packages/web/src/project/ConnectionPool.ts:136-170` (main created the row at :140, then always migrated at :163)
- `packages/web/src/primitives/db.ts:100-104` (the retention comment the code now contradicts)

**Reachability:** `migrateLocalChecklistsToYDoc` shipped in `9dcc762f` on 2026-04-18. Before it, local appraisals lived in `db.localChecklists` and no `local-practice` row existed at all (grep for `local-practice` at `9dcc762f^` returns nothing). The vulnerable device is one that used local practice before 2026-04-18 and then never opened the app between then and the cutover -- about three and a half months. That is exactly the population `db.ts:100-104` says the table is being retained for.

**Failure scenario:**
Such a user loads the new bundle. `AppLayout` bootstrap calls `initializeConnection`, `db.localProjects.get` misses, `loadLegacyLocalRows` finds no `projects` row and returns empty, and an empty local project is persisted. Their pre-2026-04-18 checklists sit intact in `db.localChecklists` and are never read again. The UI shows zero local appraisals with no error and no toast -- the path does not throw, and the state is set to `synced`.

**Not covered anywhere:** the prior audit's 23 issues do not touch this path, the runbook smoke check only exercises the ydoc-present case, and `flat-key-migration.spec.ts` seeds a `projects` row before reloading, so it structurally cannot reach the miss branch. There is no test calling `loadLegacyLocalRows`.

**Suggested fix:**
Replace the empty early return with a fresh `new Y.Doc()`, run `migrateLocalChecklistsToYDoc` against it, and return `rowsFromLocalDoc` of the result. No Dexie persistence is needed -- the row store becomes the durable copy.

---

## Issue 5: connection auth stamps never expire, so entitlement loss never reaches a live socket

**Type:** Security / Logic Error
**Severity:** Medium
**Status:** CONFIRMED

**Description:**
`buildSyncVerdict` returns `{ ok, principal, context }` with no `expiresAt`. The installed `@cf-sync/server` enforces expiry only when the attachment carries one, and documents the field as bounding "how long the stamps stay trusted without being re-derived". Both enforcement points are guarded on its presence, so they are dead code here. The DO uses `setWebSocketAutoResponse`, so the client's heartbeat is answered by the runtime without waking the DO, and hibernation wake restores the attachment verbatim without re-authorizing. Nothing re-evaluates the stamp for the life of the socket.

Freshness therefore rests entirely on forced disconnects, which are wired only to membership mutations and Stripe webhooks.

**Evidence:**

- `packages/workers/src/sync/authorize.ts:51-58` (no `expiresAt`; the exact-shape assertion at `__tests__/authorize.test.ts:104-108` pins its absence)
- `packages/workers/src/lib/billingResolver.ts:192-217` (`readOnly` derived purely from clock comparison, no emission)
- `packages/shared/src/sync/mutators.ts:59` (`assertWritable` trusts the stamp)
- `packages/workers/src/sync/authorize.ts:8-11` (header claims staleness is "closed by forced disconnect" -- accurate only for the wired paths)

**Validation strengthened the finding.** The original framing was a trial grant lapsing by clock, for which no event exists. The validator found a second, easier trigger: `packages/web/src/server/functions/admin-orgs.server.ts` has zero references to any refresh or disconnect helper, so `revokeAdminGrant`, `updateAdminGrant` (including shortening `expiresAt`), and `createAdminGrant` all mutate entitlement without poking live sockets. An admin revoking a trial mid-session leaves `writeAllowed: true` on every open connection.

**Failure scenario:**
An org on a trial grant has a user with a project page open. The grant expires, or an admin revokes it. D1 now resolves `accessMode: 'readOnly'` and every server function refuses via `requireOrgWriteAccess`, but the socket attachment still says `writeAllowed: true`, so mutations commit to the workspace and fan out to peers. This persists until the socket closes.

**Severity honestly stated:** the practical window is usually one editing session, not indefinite. The pool releases the connection when the user navigates off the project, and a Workers deploy evicts DO instances and closes sockets, after which the client reconnects through a fresh `authorize`. But nothing in the system _guarantees_ a bound, and the admin-revocation variant is reachable within a single session.

**Suggested fix:**
Set `expiresAt` in the verdict from `billing.grant.expiresAt` or the subscription period end, capped by a TTL, and update the exact-shape assertion in `authorize.test.ts:104`. Separately, call `refreshOrgWorkspaceSessions` from the admin grant mutations.

---

## Issue 6: the cutover freeze does not disclose or prevent in-tab edits made during the window, and the patch as written deadlocks its own export

**Type:** Logic Error (migration procedure)
**Severity:** Medium
**Status:** PARTIALLY CONFIRMED -- the finding's headline scenario is refuted, a narrower real gap remains

**Description:**
The freeze is a guard at the top of `ProjectDoc.fetch`, which gates only the WebSocket upgrade; `webSocketMessage` is never gated, and `disconnectAllConnections` exists on the old plane but is not used.

**What refutes the headline scenario:** `MIGRATION_FREEZE` cannot be set without publishing a new Worker version, and a code deploy restarts every Durable Object and disconnects all WebSockets. Live sockets do close when the freeze lands -- as a side effect of deployment, not because of the guard. So "connected clients keep writing for the whole freeze window" does not occur under the documented procedure.

**What remains real:**

1. **The doc's stated rationale is false.** `old-exporter-patch.md:147-148` says "existing sockets die on their next reconnect", which is not true of an established socket. Anyone reasoning from that sentence -- or attempting a staged rollout, or flipping the freeze without a full restart -- reinstates exactly the window, with `webSocketMessage` wide open.

2. **In-tab edits during the freeze are an undisclosed loss class.** The runbook never takes the app offline; the old worker serves the whole app from step 1 through step 4. Disconnected clients keep accepting edits, and the old client persists the project Y.Doc locally through the yDexie addon with no offline write block. Across a multi-hour freeze those edits accumulate durably in the browser, never reach the server (every reconnect 503s), and become unreachable at step 4 when `deleted_classes` fires and at step 7 when old tabs reload into the new bundle, whose engine never reads the old Dexie ydoc for server projects. The accepted-loss line at `sync-engine-cutover.md:35-37` covers only offline edits from _before_ the window, so this class is undisclosed.

3. **The patch deadlocks its own export.** `old-exporter-patch.md:150` instructs that the export route be added "before this guard (it must work during the freeze)", but the export route lives in `packages/web/src/server.ts` and calls `stub.fetch(...)`, while the guard is inside `ProjectDoc.fetch`. Ordering in `server.ts` cannot bypass a guard in the DO -- a literal implementation 503s its own export and the cutover stalls at step 2. The parenthetical about mirroring "existing dev route plumbing" has no referent: on main, `fetch` rejects everything non-upgrade with 405 and dev export is the RPC method `devExport()`.

**Evidence:**

- `scripts/sync-cutover/old-exporter-patch.md:136-150` (freeze switch, the false claim, the export ordering instruction)
- `e45120bb:packages/workers/src/durable-objects/ProjectDoc.ts:221-234` (fetch is upgrade-only, 405 otherwise), `:833, 876-884` (`webSocketMessage` ungated), `:356-363` (`disconnectAllConnections` available), `:519` (`devExport` RPC), `:628-633` (sockets survive hibernation)
- `packages/docs/plans/sync-engine-cutover.md:45-47, 35-37` (no drain step; accepted-loss scoped to pre-window)
- `packages/web/wrangler.jsonc:38` (point of no return)

**Prior-art check:** absent from all 23 issues of the previous audit. Commit `6bc55076` touched `old-exporter-patch.md` by 5 insertions and 3 deletions, all inside the pdf loop; the freeze section is byte-identical to `c3ecebeb`, and `sync-engine-cutover.md` was not touched at all. This gap is new.

**Suggested fix:**
Delete the "existing sockets die on their next reconnect" sentence and state that the freeze must land as a full version deploy. Add an explicit per-project sweep using the RPC that already exists (`stub.disconnectAllConnections('migration')`) so the guarantee does not rest on rollout timing. Dispatch the export via `stub.devExport()` and say so. In the runbook, either add a maintenance/read-only step for the window or extend the accepted-loss line to name in-tab edits made during the freeze.

---

## Issue 7: CLAUDE.md -- three new files cite documentation that has never existed

**Type:** CLAUDE.md Violation
**Severity:** Medium
**Status:** CONFIRMED

**Description:**
Four comments in new files cite `CORATES-MAPPING.md` section 9 as the authoritative source for the cutover mapping rules, and `ARCHITECTURE.md#yjs-fields` for the field-doc text-key convention. Neither file exists in the repo, and `git log --all --full-history` confirms neither ever did. The actual runbook (`sync-engine-cutover.md`) never mentions a mapping document and its headers are unnumbered, so there is no section 9 for the citations to refer to. The `ARCHITECTURE.md` files under `reference/` belong to vendored third-party projects and are not plausible referents.

**Evidence:**

- `packages/workers/src/sync/transform.ts:14` -- `* Mapping rules (CORATES-MAPPING.md section 9):`
- `packages/workers/src/sync/transform.ts:224` -- `/** The engine's paved-path text key inside a field doc (ARCHITECTURE.md#yjs-fields). */`
- `packages/workers/src/sync/verify.ts:2` -- `* Cutover invariant checks (CORATES-MAPPING.md section 9):`
- `scripts/sync-cutover/run.ts:2` -- `* The cutover driver (CORATES-MAPPING.md section 9). Run with:`

**Relevant Rule** (`.claude/CLAUDE.md`):

> **Source of Truth Policy**: If code conflicts with documentation, inform the user and either fix the code or update the documentation - never leave them out of sync.

**Suggested fix:**
Either write `CORATES-MAPPING.md` (numbering its sections so section 9 resolves) and add a `yjs-fields` anchor to the architecture docs, or repoint the four comments at `packages/docs/plans/sync-engine-cutover.md` and drop the anchors.

**Sub-finding, same rule set:** the section-sign character appears in new comments and a plan file at `transform.ts:14`, `transform.ts:507`, `verify.ts:2`, `__tests__/transform.test.ts:3`, and `sync-engine-cutover.md:31`. CLAUDE.md states: "NEVER use emojis anywhere - Not in code, comments, documentation, plan files, commit messages, or examples" and "This includes unicode symbols, DO NOT USE unicode symbols or emojis anywhere". Distinct from the previously dismissed unicode sweep, since these are new additions; spell out "section" instead.

---

## Issue 8: CLAUDE.md -- documentation still describes the deleted ProjectDoc plane as current architecture

**Type:** CLAUDE.md Violation
**Severity:** Medium
**Status:** CONFIRMED

**Description:**
The branch deletes `ProjectDoc.ts` (1011 lines) and the `/api/project/:projectId` WebSocket route, and it actively migrated several docs to match -- `guides/yjs-sync.md` was rewritten across 489 lines and the glossary's Yjs entry was repointed at `packages/shared/src/sync/`. Eight locations were missed, including two inside a file the branch edited.

**Evidence:**

Architecture diagrams, untouched by the branch (only `07-api-actions.md` was edited):

- `packages/docs/architecture/diagrams/02-system-architecture.md:20,38,47,72,80,93` -- e.g. line 20: `ProjectDoc[ProjectDoc<br/>One per project<br/>Yjs sync & content]`
- `packages/docs/architecture/diagrams/03-sync-flow.md:9,45`
- `packages/docs/architecture/diagrams/06-api-routes.md:37,152` -- line 152: `` `/api/project/:projectId` - ProjectDoc WebSocket connection for Yjs sync ``
- `packages/docs/architecture/diagrams/08-yjs-sync.md:11`

Glossary, in a file the branch did edit (14 lines changed, Yjs entry fixed, these missed):

- `packages/docs/glossary.md:36` -- `- Store data in a Durable Object (ProjectDoc)`
- `packages/docs/glossary.md:39` -- `` **Related:** `packages/workers/src/durable-objects/ProjectDoc.ts` ``
- `packages/docs/glossary.md:95` -- `- Used for ProjectDoc (Yjs sync) and UserSession (presence)`

Guides, untouched by the branch:

- `packages/docs/guides/authentication.md:404` -- `- Syncs member data to ProjectDoc Durable Object`
- `packages/docs/guides/database.md:941` -- Time Travel caveat naming ProjectDoc

**Relevant Rule** (`.claude/CLAUDE.md`):

> **Source of Truth Policy**: If code conflicts with documentation, inform the user and either fix the code or update the documentation - never leave them out of sync.

The prior audit's issue 23 flagged this same class for other files and it was fixed in `6bc55076`; these were not caught.

**Suggested fix:**
Update the four diagram files to the WorkspaceDO and `/api/sync/<projectId>` topology, fix the two glossary entries to match the already-corrected Yjs entry, and correct the two one-line guide references.

---

## Issue 9: `confirmMarkComplete` reports success before the mutation settles

**Type:** Bug
**Severity:** Low
**Status:** PARTIALLY CONFIRMED -- the toast is unconditional; the originally claimed scenario is unreachable

**Description:**
`ChecklistYjsWrapper` resolves `connectionPool.getClient(projectId)` once per render and writes through `client?.mutate...`, so a stale reference becomes a silent no-op. `confirmMarkComplete` then shows "This appraisal has been marked as ... and is now locked" with nothing gating it on the mutation being issued or accepted.

**What validation refuted:** the destroyed-client scenario cannot be observed. `handleFatal` sets the error phase before destroying the entry, `destroyEntry` runs synchronously, and `ProjectGate` returns null for any error state -- so the checklist route unmounts in the same React commit. A user cannot click between the socket message and the flush.

**What remains real:** when the version-mismatch reload throttle bites (`ConnectionPool.ts:391-401` returns without setting an error phase or destroying the entry), the client is already in `fatal` status while the gate keeps rendering at `synced`. Writes then reject with code `Fatal`, which is not in the swallow list, so the user gets a "Change Rejected" toast _and_ the "Appraisal Completed ... now locked" success toast for the same click, with the checklist visibly unchanged.

A second, lower-harm variant: `handlePdfChange` captures the client, awaits an upload for seconds, then calls `pdf.attach` on the possibly-dead reference; the rejection is swallowed and the R2 object is orphaned.

**Evidence:**

- `packages/web/src/components/checklist/ChecklistYjsWrapper.tsx:66` (render-time capture), `:214-228` (unconditional toast), `:151-193` (the async upload variant)
- `packages/web/src/project/ConnectionPool.ts:53` (swallow list), `:315-317` (`getClient` is a plain Map lookup, not reactive)
- `packages/web/src/project/workspace-data.ts:147-191` (the correct pattern: resolve inside the callback, try/catch, explicit rejection toast)

**Suggested fix:**
Follow `useAnswerWriters`: resolve the client inside the callback and await the mutation before toasting, surfacing a rejection toast on failure.

---

## Also reviewed and discarded

These were raised and did not survive validation. Recorded so they are not re-raised.

| Raised issue                                                                                       | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mutators.ts` at 810 lines violates "keep files small"                                             | Discarded. A larger pre-existing file (`robins-i/scoring-domains.ts`, 852 lines) sits in the same package on main; this is a judgment call, not a clear violation.                                                                                                                                                                                                                                                                                          |
| Unicode join symbol at `workspace-data.ts:541`                                                     | Discarded. This is the exact instance from prior-audit issue 21, which Jacob dismissed.                                                                                                                                                                                                                                                                                                                                                                     |
| Deleting legacy y-dexie docs on every DB open loses offline edits                                  | Discarded as a bug. `sync-engine-cutover.md:34-37` explicitly accepts this: "un-pushed offline edits from before the window are lost by accepted decision". Worth noting only that the delete runs unconditionally forever, so a device offline _through_ the window hits it weeks later.                                                                                                                                                                   |
| `annotations.mergedFrom` dropped by the transform                                                  | Real but latent, so below the bar. The field is written by `annotation.merge`, declared in the schema, and copied into the store, but has zero readers, and `annotation.merge` has no caller in `packages/web` on either plane. Worth the one-line fix in `transform.ts:469-480` while the transform is being touched, since the R2 export would be the only recovery later.                                                                                |
| `sync.d.ts:36` declares `reset(): Promise<{ reset: true }>` but runtime returns `{ backendId }`    | Real but not compile-affecting and produces no wrong result today. The value does flow to the client through `dev-tools.server.ts:79-82`, but the sole UI consumer discards it. One-line accuracy fix for an adjacent edit.                                                                                                                                                                                                                                 |
| `rememberProjectOrgId` spread order freezes `updatedAt`                                            | Real defect, inert. Nothing in the repo reads `syncCaches.updatedAt`, and `trackSyncCache` re-stamps it on every connection init. The validator noted a more interesting adjacent risk: both functions are non-transactional get-then-put, so a concurrent `trackSyncCache` can drop the `orgId` stamp that `getCachedProjectOrgId` exists to serve. A Dexie `rw` transaction would fix both.                                                               |
| `ReconciliationWrapper` picks the write path from a render-time client instead of project identity | Real design hazard, unreachable today. The `else` branch is load-bearing for local-practice and dead for online projects, since the gate never renders children before the workspace exists. If it ever were reached with a live entry, the result would be a silent local-only write rather than the predicted throw. Note the setup effect at `:279-372` has no try/catch and would escalate to the route-level `RouteError`, not `SectionErrorBoundary`. |
| `onMutationRejected` fires N toasts on fatal                                                       | Refuted. `#fatal` settles entries with `SyncFatalError`, and the client's notify path hard-gates on `instanceof MutationError`, so zero rejection toasts fire.                                                                                                                                                                                                                                                                                              |
| `VersionNotSupported` reload branch is dead                                                        | Refuted. The server sends an in-band error message carrying the string code before closing; the reload path works and does not delete data.                                                                                                                                                                                                                                                                                                                 |

---

## Recommended order of work

1. **Issue 1** (`setText` allowlist and server-fixed cap) -- reachable by any member, corrupts shared state, and leaves the affected question un-answerable. One-line guard using an allowlist that already exists.
2. **Issue 3** (make transform warnings fatal, flatten in verify) -- must land before any production cutover; the gate currently cannot see the loss it exists to catch.
3. **Issue 2** (stop deleting the outbox on non-revocation fatals) -- a routine session expiry should not destroy queued work.
4. **Issue 4** (restore the legacy local-practice migration path) -- silent and permanent for the affected devices.
5. **Issue 6** (correct the freeze doc, add the session sweep, fix the export/guard layering) -- doc-tier cost, and the export deadlock would stall the cutover on first attempt.
6. **Issue 5** (stamp `expiresAt`, poke sockets from admin grant mutations).
7. **Issues 7, 8, 9** (doc citations, stale ProjectDoc references, premature success toast).
