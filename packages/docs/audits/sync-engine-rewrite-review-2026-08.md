# Adversarial Code Review: sync-engine-rewrite (2026-08-02)

## Scope

- Branch: `sync-engine-rewrite` vs `main` (10 commits, 246 files, +9938/-12859)
- Change summary: retires the y-websocket ProjectDoc Durable Object plane and replaces it
  with a sync engine built on the vendored `@cf-sync/*` packages. Adds the shared app
  definition (schema, mutators, derive, answer-rows, presence) in `packages/shared/src/sync`;
  a new WorkspaceDO plus authorize/transform/verify/admin in `packages/workers/src/sync`;
  the client moves to a SyncClient pool with live queries and a mutation outbox;
  reconciliation moves onto Yjs fields and engine presence; dev tooling is rebuilt on the
  engine mutators; a cutover transformer, invariant gate, and runbook are added.
- Method: four parallel review agents (2x CLAUDE.md compliance, 2x adversarial bug hunt),
  followed by per-finding adversarial validation agents instructed to refute each claim.
  Several findings were confirmed empirically by executing the shared code through
  `createTestEngine`. Findings that could not be validated, or that exist identically on
  `main`, were excluded (listed at the end).
- CLAUDE.md files in scope: `.claude/CLAUDE.md` (repo-wide).
- Note: the `pnpm-workspace.yaml` vendor-tarball overrides were flagged and dismissed;
  the `@cf-sync/*` packages are first-party, so the release-age policy does not apply.

## Priority guide

Fix-before-cutover: issues 1-5  (migration correctness) and 6-9 (runtime data loss /
exposure). The cutover is one-way; the invariant gate is blind to 1, 3, 4, and 5, so a
green verify does not currently imply a lossless migration.

---

## A. Cutover and migration

### Issue 1: Exporter patch overwrites every PDF fileName with its UUID

**Type:** Bug (data corruption)
**Severity:** High
**Validated:** CONFIRMED

**Description:**
The old plane keys `pdfsMap` by `pdfId`, not fileName (`main:packages/web/src/primitives/useProject/pdfs.ts:121` does `pdfsMap.set(pdfId, pdfYMap)`). The exporter patch iterates `for (const [fileName, pdfValue] of pdfsMap.entries())` and spreads the plain object, then overwrites the true `fileName` with the loop key (the UUID). `transform.ts:389` writes it into the `pdfs` row, and `verify.ts:195` compares both sides of the same corrupted export, so the gate is tautological and reports green.

Worse than mislabeling: `packages/web/src/api/pdf-api.ts:64` builds the R2 fetch path from `fileName`, so every migrated PDF 404s on view/download/re-extract. The misnamed loop variable is inherited from main's dev exporter (`dev-handlers.ts:265,268`), but this branch is what pipes it into a one-way production migration.

**Evidence:**
- `scripts/sync-cutover/old-exporter-patch.md:69-77` (the clobber)
- `packages/workers/src/sync/transform.ts:389`, `packages/workers/src/sync/verify.ts:195`
- `packages/web/src/api/pdf-api.ts:64`

**Suggested fix:** Rename the loop variable to `pdfId` and drop the trailing `fileName,` override (the spread already carries the correct value).

### Issue 2: Transformer silently drops five study metadata fields

**Type:** Bug (data loss)
**Severity:** High
**Validated:** CONFIRMED

**Description:**
The transformer builds the study row as a hand-enumerated literal and never references `importSource`, `volume`, `issue`, `pages`, or `type`. All five are declared in the new schema (`packages/shared/src/sync/schema.ts:46,52-55`), written by the old plane, populated by real import flows (PubMed/DOI/RIS via `referenceLookup.ts`, `referenceParser.ts`, deduplication), and read by the new UI (`workspace-data.ts:343,349-352`). `oldStudySchema` is a `looseObject`, so the data survives parsing and is then discarded. Nothing lands in `report.warnings`, and `verify.ts:132-141` compares only name/reviewer1/reviewer2/doi. Silent and unrecoverable after unfreeze.

**Evidence:**
- `packages/workers/src/sync/transform.ts:315-335` (the literal), `:105-131` (oldStudySchema)
- `packages/workers/src/sync/verify.ts:131-141`

**Suggested fix:** Carry the remaining `studyMetadataSchema` keys through the literal (or spread the validated metadata), and add the fields to a transformer test fixture.

### Issue 3: Exporter patch deletes the legacy singular reconciliation map instead of migrating it

**Type:** Bug (data loss, cohort-gated)
**Severity:** Medium-High
**Validated:** CONFIRMED (conditional on legacy data existing in prod; nothing in the repo disproves it)

**Description:**
`old-exporter-patch.md:53` does `delete study.reconciliation;`. On main that legacy singular map is still a live read fallback (`reconciliation.ts:139-156, 193-215`, mapped to outcomeKey `type:AMSTAR2`), the only writer writes the plural map, and no migration ever rewrites legacy entries (the reconcile tab's early-return path skips re-save). The singular write path shipped ~2025-12-10 to 2026-02-02, so any in-progress AMSTAR2 reconciliation from that window never re-saved since keeps its progress only there.

After cutover such a study gets no `reconciliations` row and, critically, no Yjs field seeds (`transform.ts:423-464` seeds only from the plural map). The row itself self-heals on next open via `ReconciliationWrapper.tsx:314-327`, but the missing field seeds are destructive: `useReconciledText` has no row fallback, so the migrated consolidated notes are invisible, and `serializeFieldsIntoRows` then writes the empty field text over the non-empty row at finalize. `verify.ts:209-250` derives expectations from the same stripped export, so the gate reports green.

**Evidence:**
- `scripts/sync-cutover/old-exporter-patch.md:53`
- `packages/workers/src/sync/transform.ts:423-464`, `packages/workers/src/sync/verify.ts:209-250`
- `packages/web/src/components/project/reconcile-tab/fields.ts:151-160, 240-253`

**Suggested fix:** In the exporter patch, fold `study.reconciliation` into `reconciliations['type:AMSTAR2']` when the plural key is absent, instead of deleting it. Transform and verify then both see it with no further changes.

### Issue 4: Transformer discards historical ROBINS-I Section B reconcile comments

**Type:** Bug (data loss at migration; underlying key mismatch is pre-existing)
**Severity:** Medium
**Validated:** CONFIRMED (empirically; the "branch-introduced mismatch" half was refuted, see excluded list)

**Description:**
`textFieldKey` returns `${questionKey}.${fieldKey}` when questionKey is present, so the reconcile adapter stores Section B consolidated comments under `b1.comment` while the canonical row key is `sectionB.b1.comment`. That mismatch exists on main too (same user-visible symptom). What is new: `transform.ts:368-375` pushes any exported key not in `defaultAnswerRows` into `droppedAnswerKeys` instead of writing a row, so every Section B comment ever typed in a reconcile session is destroyed at migration. On main the data at least sat recoverable in the doc. Neither the field-seeding pass nor the gate (both enumerate `textAnswerKeys`) seeds or flags it.

**Evidence:**
- `packages/shared/src/sync/derive.ts:333-341` (`textFieldKey`)
- `packages/web/src/components/project/reconcile-tab/robins-i-reconcile/adapter.tsx:231-236`
- `packages/workers/src/sync/transform.ts:368-375`, `packages/workers/src/sync/verify.ts:233`

**Suggested fix:** Fix `textFieldKey` (or the adapter) to produce `sectionB.b1.comment`, and add a companion remap in the transformer so pre-cutover `b1.comment` exports are salvaged into the correct row. Check `droppedAnswerKeys` output during rehearsal.

### Issue 5: Transformer output is never validated against the live schema; import aborts mid-fleet

**Type:** Bug (operational)
**Severity:** Medium
**Validated:** CONFIRMED (idempotent re-run and the documented rehearsal gate downgrade it from data-risk)

**Description:**
Three lax-to-strict mismatches flow from transform output into the DO's strict row validation: checklist `status` (`z.string()` vs the 5-value enum), reconciliation `type` (`z.string()` vs `checklistTypeSchema`), and pdf `tag` (`z.string()` vs `pdfTagSchema`). Out-of-enum statuses are genuinely reachable: the status vocabulary changed 2025-12-29 (commit `5e4d3cbe`) with no Y.Doc backfill, so checklists last written before that date carry `completed` / `awaiting-reconcile`. The runner has no per-project catch: the first 400 kills the process with the fleet half-imported mid-freeze. Import is idempotent (wholesale replace) and re-run is documented, so this costs freeze-window time rather than data.

**Evidence:**
- `packages/workers/src/sync/transform.ts:61, 75, 98, 355, 393, 434`
- `packages/shared/src/sync/schema.ts:94, 153, 168`
- `scripts/sync-cutover/run.ts:56-68, 109-121`

**Suggested fix:** Validate each produced row against `syncApp.schema` inside `transformProjectExport` (moving the failure before the freeze), and map legacy status values explicitly. A per-project catch-and-continue in the import loop is a cheap second layer.

---

## B. Runtime (production paths)

### Issue 6: deleteProject wipes the workspace before the authoritative D1 delete

**Type:** Bug (data loss window)
**Severity:** High
**Validated:** CONFIRMED

**Description:**
`deleteProject.ts:54` calls `teardownWorkspace` (which runs `workspace.reset()`, i.e. `ctx.storage.deleteAll()`) before `db.delete(projects)` at `:67`. Workspace storage is the only home for studies/checklists/answers/Yjs fields. If the D1 delete then fails, the project row survives, still listed and joinable, but empty. A concrete trigger exists: `cleanupProjectStorage` issues one R2 subrequest per object between the reset and the D1 delete, so a PDF-heavy project can exhaust the subrequest budget and make the D1 delete fail. Main's equivalent (`disconnectAllFromProject`) was non-destructive. DO point-in-time recovery makes this operator-recoverable, but nothing in the app can heal it.

**Evidence:**
- `packages/workers/src/commands/projects/deleteProject.ts:54-74`
- `packages/workers/src/sync/admin.ts:74-85`
- `packages/workers/src/commands/lib/storage.ts:24`

**Suggested fix:** Move `teardownWorkspace` after the successful `db.delete(projects)`. Disconnecting sessions first is fine; only the destructive reset must follow the commit point.

### Issue 7: Engine IndexedDB cache and clientId survive logout and membership revocation

**Type:** Bug (data exposure regression) + integrity issue
**Severity:** High
**Validated:** CONFIRMED

**Description:**
The engine persists full project content to `cf-sync:<projectId>` IndexedDB databases. `clearAllData()` (logout) and `deleteProjectData()` (kick/delete) only touch Dexie's `CoratesDB`; `indexedDB.deleteDatabase` appears nowhere in the repo, and `workspace.destroy()` intentionally leaves persisted state on disk. On main the project Y.Doc lived in Dexie and was wiped by both paths. Because `ProjectGate` renders at `cached` before server authorization (pre-existing behavior, harmless on main because the cache was wiped), a different user on the same browser sees the prior user's project until the fatal close lands, and a revoked member retains a readable local copy indefinitely.

Secondary: the engine's clientId lives in sessionStorage (`cf-sync:client-id:<workspaceId>`) and is not cleared on signout. If user B (a legitimate member) logs in in the same tab, B inherits A's clientId and replays A's queued unsent offline mutations under B's identity.

**Evidence:**
- `packages/web/src/project/ConnectionPool.ts:39-44, 337-352`
- `packages/web/src/primitives/db.ts:127-165`, `packages/web/src/stores/authStore.ts:154`
- vendored `@cf-sync/client` `IndexedDBSyncStore` (dbName `cf-sync:<workspaceId>`); `SyncStore.reset()` exists but is only invoked on schema-version mismatch

**Suggested fix:** Construct the store explicitly in `createProjectWorkspace` (the `store` option), retain the handle, and call `store.reset()` on kick/logout; or track project ids and `indexedDB.deleteDatabase('cf-sync:' + id)` in `deleteProjectData`/`clearAllData` (Safari lacks `indexedDB.databases()`, so a tracked list is needed). Clear the `cf-sync:client-id:*` sessionStorage keys alongside.

### Issue 8: AMSTAR2 answer clicks and Critical toggles clobber each other across clients

**Type:** Bug (cross-client data loss)
**Severity:** High
**Validated:** CONFIRMED (empirically)

**Description:**
`expandAnswerUpdate`'s AMSTAR2 branch unconditionally emits both `${key}.answers` and `${key}.critical` (with `critical ?? false`), unlike the ROB2/ROBINS-I branches which gate each write on `!== undefined`. Every AMSTAR2 UI interaction therefore sends a full two-row snapshot, and rows are last-writer-wins upserts with no merge. Client A clicks an answer while client B toggles Critical from a stale render: whichever mutation arrives second silently reverts the other's change. The critical toggles capture `currentAnswers` at render, making the toggle-reverts-answer direction the dangerous one. Main wrote one Y.Map key per interaction, so the facts were independent. Bonus hazard: any caller omitting `critical` silently clears it to false.

**Evidence:**
- `packages/shared/src/sync/answer-rows.ts:278-282` (vs `:295-300`, `:323-331`)
- `packages/web/src/components/checklist/AMSTAR2Checklist/AMSTAR2Checklist.tsx:52-58, 244-252, 302-320, 426-441, 556-570`
- vendored `@cf-sync/server` row put: unconditional `ON CONFLICT DO UPDATE`

**Suggested fix:** Gate the AMSTAR2 branch's two writes on `!== undefined` like the other instruments, and make the UI send only the changed field.

### Issue 9: Concurrent reconciled-checklist creation permanently wedges the losing client

**Type:** Bug
**Severity:** High
**Validated:** CONFIRMED

**Description:**
`checklist.create`'s duplicate guard matches reconciled checklists (`assignedTo: null`). Two reviewers opening the reconcile page near-simultaneously both create; the server rejects the loser with `DuplicateChecklist` and rolls back its optimistic rows. The repair effect requires `allReconciled.length > 1`, which after rollback never holds, and nothing else rewrites `reconciledChecklistId`, so the loser renders a fully-drawn but blank reconciliation page where every answer click toasts "That item no longer exists." The trigger is wider than a true race: the setup effect runs at phase `cached`, so a reviewer whose cached rows predate the other's creation duplicates on open with no concurrency at all. Reload heals; nothing in-session does. Main's guard was client-local, both writes merged via Yjs, and the repair effect resolved it.

**Evidence:**
- `packages/shared/src/sync/mutators.ts:232-246`
- `packages/web/src/components/project/reconcile-tab/ReconciliationWrapper.tsx:282-284, 337-355, 379-394, 567`
- Test gap: `packages/shared/src/sync/__tests__/checklists.test.ts:158-179` covers the guard only for `assignedTo: 'user-2'`, never the reconciled case

**Suggested fix:** On `DuplicateChecklist` rejection (or whenever `reconciledChecklistData` is null but rows exist), re-derive `reconciledChecklistId` from the live row via `findReconciledChecklistForOutcome` instead of latching the optimistic id. Add the `assignedTo: null` duplicate case to the mutator tests.

### Issue 10: Un-assigning a reviewer is a silent no-op

**Type:** Bug (functional regression)
**Severity:** Medium-High
**Validated:** CONFIRMED

**Description:**
`toStudyUpdates` strips both `null` and `undefined`, so `{reviewer1: 'alice', reviewer2: null}` from AssignReviewersModal reaches `study.update` as `{reviewer1: 'alice'}` and the removed reviewer stays assigned; the modal closes as success. Main wrote the null into the Y.Map and the read side treated it as unassigned. The fix needs schema work: `reviewer1/reviewer2` are `z.string().optional()` (not nullable) in both the row schema and the mutator args, so passing null through today would fail validation at three layers.

**Evidence:**
- `packages/web/src/project/actions/studies.ts:45-52, 281-288`
- `packages/web/src/components/project/all-studies-tab/AssignReviewersModal.tsx:81-84`
- `packages/shared/src/sync/schema.ts:80-81`, `packages/shared/src/sync/mutators.ts:181-196`
- Test gap: only assignment is tested, never un-assignment

**Suggested fix:** Make the two fields `.nullable()` in the row and args schemas, add a delete-on-null branch to the `study.update` merge loop, and stop stripping null in `toStudyUpdates` for these keys (or introduce an explicit unset sentinel).

### Issue 11: Project meta and members hang on chained network queries; membership changes no longer propagate live

**Type:** Bug (regression, composite)
**Severity:** Medium-High
**Validated:** CONFIRMED (with corrections)

**Description:**
`orgId` now comes solely from the `getMyProjects` network query (main fell back to the Y.Doc meta, available at hydration), and `useProjectMembers` is enabled on that `orgId` - two serial round-trips. Consequences, all confirmed:

- Cold deep-link/hard-refresh: the gate opens at `cached` before `getMyProjects` returns, `activeProjectId` is unset, so study/checklist/outcome/pdf/member/rename actions throw "No active project connection" (answer writes are unaffected - they resolve the client by projectId). `OverviewTab` calls `project.checklist.getData()` during render inside `useMemo`; with two reviewer-completed AMSTAR2 checklists it throws into `SectionErrorBoundary`, which has no resetKeys and stays errored after the query resolves (until tab switch or "Try again").
- Until both queries land: reviewer names render "Unknown", `isOwner` is false, owner-only controls pop in late. If `getProjectMembers` fails, the error is discarded and the owner silently sees a read-only-looking project.
- Live propagation is gone: `addMember`/`acceptInvitation`/`removeMember`/`updateMemberRole` all lost their DO sync with no engine replacement, so other clients see membership changes only after the 5-minute staleTime on focus/remount. The new `setupPage.reload()` in `e2e/concurrent-crdt.spec.ts` is the test encoding this regression.

Corrections to the original claim: the offline-hard-refresh framing is unreachable (no service worker), and the error-boundary latch clears on tab switch.

**Evidence:**
- `packages/web/src/hooks/useProjectOrgId.ts:7-10`, `packages/web/src/project/workspace-data.ts:472-501`
- `packages/web/src/project/ProjectGate.tsx:57-64, 75-81`, `packages/web/src/project/actions.ts:21-31, 101-103`
- `packages/web/src/components/project/overview-tab/OverviewTab.tsx:177-181`
- `packages/web/e2e/concurrent-crdt.spec.ts:252-257, 342-347`

**Suggested fix:** Persist `orgId` with the workspace (it is immutable per project - a meta row or the authorize payload both work) so the gate and actions do not depend on a network query; make `OverviewTab` tolerate absent collections instead of throwing in render; surface the members-query error; and consider an engine-side poke (the existing `refreshOrgWorkspaceSessions` pattern) on membership changes.

### Issue 12: Notes moved from Y.Text merge to whole-string LWW; the focused draft-hold hides the conflict

**Type:** Regression (concurrency semantics)
**Severity:** Medium
**Validated:** CONFIRMED on mechanism (blur detail refuted; scope narrower than claimed)

**Description:**
Main's NoteEditor edited a Y.Text via minimal diffs, so concurrent edits to the same note merged. The branch stores instrument notes as whole-string rows written per keystroke; any concurrent edit loses one side wholesale. The focused draft-hold (`if (live || !focused) setLocalValue(value)`) additionally means the losing writer never sees the remote text before overwriting it. Scope: the four reconciliation consolidated-note editors pass `live` and are not exposed; the per-reviewer instrument notes are, with realistic concurrency being same-user-two-tabs or a second member opening someone else's checklist (nothing blocks that beyond status). The clobber happens on keystroke, not blur.

**Evidence:**
- `packages/web/src/components/checklist/common/NoteEditor.tsx:56-60, 79-83`
- `main:packages/web/src/components/checklist/common/NoteEditor.tsx` (Y.Text + `applyYTextDiff`)

**Suggested fix:** If per-reviewer note merging matters, back notes with Yjs fields like the reconcile editors (they already solve this); otherwise pass `live` (accepting cursor jumps) or add a conflict guard. Decide explicitly - this is a semantic downgrade the branch should own knowingly.

---

## C. Lower severity / latent

### Issue 13: updateMemberRole no longer refreshes the connection's role stamp (latent)

**Severity:** Low now, Medium once any mutator reads `role`. Validated: CONFIRMED-LATENT.
`authorize.ts:55` stamps `role` at connect; the stamp lives for the socket's (potentially multi-day, hibernation-surviving) life. `removeMember` got `kickWorkspaceUser` and billing got `refreshOrgWorkspaceSessions`; the role path got nothing, contradicting the invariant documented at `authorize.ts:9-11`. No current reader of `ctx.auth.role` exists, so not exploitable today. Fix: `projectWorkspace(env, projectId).disconnect({ principal: userId, mode: 'refresh' })` after the D1 update.

### Issue 14: Clearing a project description silently reverts

**Severity:** Low-Medium. Validated: CONFIRMED.
`project.ts:40` turns `''` into `undefined`, which `updateProject.ts:43` skips (it explicitly supports `'' -> null`). The line is inherited from main, but main masked it by also writing the Y.Doc meta map, which the UI read; the branch reads D1, exposing it. UI shows cleared until reload, then the text reappears. Fix: send `trimmed` unconditionally.

### Issue 15: Local-practice writes throw synchronously with no handler

**Severity:** Low (validated CONFIRMED but largely unreachable in normal use).
Online writes route rejections through `onMutationRejected`; `applyLocalMutation` throws from onClick handlers with no try/catch at any instrument call site. Reachable only via same-frame races or post-fatal null client (one-frame window). Fix if desired: try/catch in `workspace-data.ts:157,173` routing to the same toast.

### Issue 16: annotation.update on a missing row now surfaces an error toast

**Severity:** Low. A late EmbedPDF update after deletion now throws `NotFound` -> "That item no longer exists" toast, where the pre-branch code returned early. `ChecklistYjsWrapper.tsx:257-271`, `mutators.ts:678-681`.

### Observation: per-keystroke mutation amplification

Not a correctness bug, flagged as scale posture: every note keystroke is a durable outbox entry, a full-row put, and a broadcast (`NoteEditor.handleInput` -> `setText`, no debounce); `useChecklistAnswerMap` re-renders the whole instrument per row change; `useAllStudies` subscribes to the entire unfiltered `answers` table and stays mounted behind the Outlet re-deriving all studies plus `deriveFinalized` per keystroke, largely to feed tab badges. Offline, a long note accumulates hundreds of outbox entries. Worth a debounce on setText and a filtered subscription before scale testing.

---

## D. Dev tooling (empirically verified, dev-only surfaces)

### Issue 17: Template replace-mode can wipe a project on mid-apply failure

**Severity:** Medium (dev-only). `devApplyTemplate` deletes all studies and outcomes before applying the plan; `runPlan` is `Promise.all` with no cleanup, and a socket drop or one rejection (e.g. re-running merge mode into `DuplicateChecklist`) strands the remainder - measured 756 mutations / ~200KB for full-workflow. The old DO handler was one atomic `doc.transact`. `packages/web/src/dev/seed.ts:86-97, 117-128, 519-536`.

### Issue 18: Legacy round-trip seam drops outcomes, reconciliations, and outcomeId

**Severity:** Low (dev-only), verified by execution. `dev/legacy.ts:133-135, 163-169` reads only studies/checklists/answers and omits `outcomeId`; after seam+reload every local ROB2/ROBINS-I appraisal detaches from its placeholder outcome and reconciliation identity shifts (`getOutcomeKey(null, type)`). Also injects six AMSTAR2 rows `defaultAnswerRows` never produces (`q9a/q9b/q11a/q11b.note`, `q9/q11.critical`). Undocumented; the e2e pins answers only.

### Issue 19: flat-key-migration e2e can pass without executing the migration

**Severity:** Low (test integrity). `legacy.ts:187` deletes the `localProjects` row, but `pagehide` -> `flushLocalPersist` re-creates it before reload, so `initializeLocalRows` finds stored rows and never runs the converter. The e2e stays green because the data is identical - flaky-by-construction coverage of exactly the path the test exists for. `ConnectionPool.ts:207-216, 263-269, 419`.

### Issue 20: Seeded ROBINS-I overwrites the outcome-derived Section A text; DevImportProject enable race

**Severity:** Low (dev-only). `seed.ts:151-156` overwrites the `sectionA.outcome` prefill, which disables `changeOutcome`'s conditional re-sync on exactly the data dev should exercise (`mutators.ts:380-386`). `DevImportProject.tsx:134-151` enables Create while `templateUserIds` is still an empty array (vacuous `.every`), letting template user ids pass through unmapped.

---

## E. CLAUDE.md compliance

### Issue 21: Unicode symbols throughout new code, comments, output strings, and docs

**Type:** CLAUDE.md violation
**Severity:** High (rule is absolute)
**Rule:** ".claude/CLAUDE.md: NEVER use emojis anywhere... This includes unicode symbols, DO NOT USE unicode symbols or emojis anywhere."

Check/cross/warning glyphs and arrows in runtime output: `scripts/sync-cutover/run.ts:34, 66, 89, 94, 97, 117, 136, 139`. Arrows in diagnostic strings: `packages/workers/src/sync/verify.ts:112, 139, 156, 183, 245`. Arrows and section signs in comments/tests: `transform.ts:3, 249`, `transform.test.ts:2-3`, `derive.ts:33`, `checklists.test.ts:196`. A join symbol: `workspace-data.ts:491`. Arrows in `primitives/useProject/handlers/robins-i.ts:112-140` and `ConnectionPool.ts:358`. Plus the cutover plan doc. Em dashes are the bulk of 63 flagged lines across ~55 web files and one appears in a user-facing error string (`CreateLocalChecklist.tsx:72`); whether the rule intends to cover standard typographic punctuation is your call - the arrows/glyphs are unambiguous.

### Issue 22: Business logic inlined in CreateLocalChecklist

**Type:** CLAUDE.md violation
**Severity:** Medium
**Rule:** "Move business logic to stores, hooks, or utilities (not components)"

Main's `handleSubmit` called one utility (`createLocalAppraisal`). The branch inlines the workflow in the component handler: id generation with the "study id === checklist id" convention, conditional placeholder-outcome creation with `${id}-outcome` naming, then checklist creation, via three `applyLocalMutation` calls. `packages/web/src/components/checklist/CreateLocalChecklist.tsx:82-113`. Fix: extract to a utility beside the other local-project helpers.

### Issue 23: Docs now conflict with code (Source of Truth Policy)

**Type:** CLAUDE.md violation (Source of Truth Policy)
**Severity:** Medium

- `packages/docs/architecture/diagrams/07-api-actions.md:117, 131` still diagrams "Sync member/role to DO" against the deleted ProjectDoc plane.
- `packages/docs/guides/yjs-sync.md:23` still documents the `members (Y.Map)` mirror.
- `packages/web/src/components/checklist/LocalChecklistView.tsx:4-5` header still describes the deleted local Y.Doc bridge.

---

## Excluded after validation (for transparency)

- **Presence `user.userId` spoofing** - real mechanically, but ported 1:1 from main, display-only, and the branch improves the substrate by adding a server-attested `principal`. Optional hardening: key `useReconciliationPresence` on `peer.principal`.
- **`checklist.changeOutcome` cross-type re-key/clobber** - reproduced in a test, but main's Y.Doc plane behaves identically; pre-existing debt. Cheap guard: `oldEntry.type === type` at `mutators.ts:392`.
- **ROBINS-I Section B key mismatch as a branch bug** - pre-existing on main (see Issue 4 for the branch-new migration consequence).
- **`useProjectData` not handling the `cached` phase** - byte-identical behavior on main.
- **`workspace-data.ts` size / pervasive memoization** - rejected: file size is in-family for this repo with a coherent facade design, and `useLiveQuery` data is referentially stable, so the memoization propagates real stability (one consumer depends on it in a dependency array). Same reasoning applied to `mutators.ts` (804 lines, judged cohesive).
- **`pnpm-workspace.yaml` vendor overrides** - dismissed per user: `@cf-sync/*` are first-party packages.
- **Latent, no trigger:** a template declaring `status: PENDING` with answers would seed as in-progress (`seed.ts:440-445` vs `mutators.ts:434-439`); no current template does.

## Verified clean (spot list)

Flat-key namespaces for all three instruments and all templates/fill modes (empirical diff against `defaultAnswerRows`); plan ordering and id minting in seeding; outbox ordering; score hooks vs the deleted reactor computers; `deriveFinalized`/`scoreChecklistRows` ports; Drizzle-only D1 access in the new sync backend; Zod on all new inputs; dev server fns retain DEV_MODE + membership gating; `ACCESS_DENIED_ERRORS` coverage of `handleFatal` messages; no dangling imports of deleted modules.
