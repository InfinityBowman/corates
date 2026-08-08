# Sync-engine cutover runbook

The one-time migration from the ProjectDoc Yjs plane to the sync-engine
workspace plane. One PR, one cutover, no coexistence window: the deploy that
ships the engine also deletes the old DO class (`deleted_classes` destroys
its storage), so this runbook is the only path across.

Machinery (all in this repo, rehearsed by
`packages/workers/src/sync/__tests__/transform.test.ts` against a real
WorkspaceDO):

- `scripts/sync-cutover/old-exporter-patch.md` — the completeness patch the
  OLD worker needs before anything else (the shipped exporter drops
  outcomeId, annotations, reconciliations, and pdf metadata)
- `packages/workers/src/sync/transform.ts` — old export → engine snapshot
  (answers → rows, notes → strings, in-progress consolidated notes → Yjs
  field seeds)
- `packages/workers/src/sync/verify.ts` — the unfreeze gate: per-project
  invariant checks old export vs the engine's re-export
- `scripts/sync-cutover/run.ts` — the driver (`transform` / `import` /
  `verify` stages)

## Preconditions

- [ ] `SYNC_ADMIN_TOKEN` secret set on the production worker (old deployment
      first — the export route uses it — and it carries over to the new one)
- [ ] The exporter patch (step 0) deployed and sanity-checked against at
      least one real project (see the patch doc's final section)
- [ ] **Rehearsal**: full pipeline against copies of real exports —
      `transform` + `import` + `verify` into a staging worker — clean. This
      is the §9 "rehearsed against prod exports" gate; do not schedule the
      window before it passes.
- [ ] The 14 Playwright e2e specs green against this branch's tip
- [ ] Cutover window announced to users (a courtesy, not a mitigation:
      un-pushed offline edits from before the window are lost by accepted
      decision — offline merge was an incidental capability of the Yjs
      stack, not a commitment)

## The cutover

0. **Patch the old worker** (days before): branch `cutover-exporter` off
   `main`, apply `old-exporter-patch.md`, deploy. Verify one export
   transforms cleanly.

1. **Freeze**: set `MIGRATION_FREEZE=true` on the old worker, as a full
   deploy: publishing a version restarts every Durable Object and drops its
   sockets, which the `fetch` guard alone does not do. Then sweep the fleet
   (`disconnectAllConnections('migration')` per project, see the patch doc)
   so no socket outlives the freeze on rollout timing. New connections get
   503; clients show connection-lost. The export route keeps working.

   From here until step 7 the app is still served, so tabs left open keep
   accepting edits into their local Y.Doc. Those never reach the server and
   are unreachable once step 4 lands: the same accepted loss as the
   pre-window offline edits, extended over the window. Keep the window
   short and say so in the announcement.

2. **Export everything**:

   ```sh
   mkdir -p cutover/exports
   for id in $(<project-ids.txt>); do
     curl -sf -H "Authorization: Bearer $SYNC_ADMIN_TOKEN" \
       "https://corates.<domain>/api/migration/export/$id" \
       > "cutover/exports/$id.json" || echo "FAILED: $id"
   done
   ```

   Project ids come from D1: `SELECT id FROM projects;`. **Upload the whole
   `cutover/exports` directory to R2 now** — it is the complete backup and
   the rollback source. Keep it until the new stack has soaked.

3. **Transform** (local, inspectable, non-destructive):

   ```sh
   pnpm tsx scripts/sync-cutover/run.ts transform cutover/exports cutover/out
   ```

   Read `cutover/out/report.json`. Dropped answer keys are expected in small
   numbers (stale keys from old client bugs); warnings and hard failures are
   not — resolve them before proceeding.

4. **Deploy the PR** (this branch): the new worker serves the engine;
   `ProjectDoc` and its storage are gone (migration v5 `deleted_classes`).

5. **Import**:

   ```sh
   pnpm tsx scripts/sync-cutover/run.ts import cutover/out \
     --url https://corates.<domain> --token $SYNC_ADMIN_TOKEN
   ```

6. **Verify** — the unfreeze gate:

   ```sh
   pnpm tsx scripts/sync-cutover/run.ts verify cutover/exports \
     --url https://corates.<domain> --token $SYNC_ADMIN_TOKEN
   ```

   Non-zero exit → do not unfreeze; investigate, fix, re-import the affected
   projects (import is idempotent per project — it replaces the workspace
   wholesale at a new version).

7. **Unfreeze**: nothing to flip on the new worker — the freeze var lived on
   the old deployment, which no longer exists. Old browser tabs fail the new
   socket handshake (`VersionNotSupported`) and hard-reload into the new
   bundle. Announce completion.

## Smoke checks after unfreeze

- Open a project: studies/checklists render, scores match spot-checked
  pre-freeze screenshots
- Type an answer in two browsers: live sync both ways
- Open an in-progress reconciliation: the consolidated notes show the
  pre-freeze text (these came through the Yjs field seeds) and co-edit live
- Local practice on a device with old data: studies appear (the lazy
  ydoc→rows converter runs on first load)
- `/health` returns healthy (checks the WORKSPACE binding)

## Rollback

The pre-freeze export directory in R2 is a complete backup. Rolling back is
**not** just redeploying the old worker — `deleted_classes` destroyed the
old DO storage at deploy. It is:

1. Revert to the pre-cutover worker (with the exporter patch — it also needs
   its dev import route)
2. Re-import every project's export through the old dev import RPCs
3. Unfreeze on the old plane

Rehearse this path too if the soak risk warrants it; otherwise accept that
rollback is slow and treat verify (step 6) as the real gate.
