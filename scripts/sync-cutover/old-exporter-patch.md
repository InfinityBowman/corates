# Cutover step 0: the old-worker exporter patch

The transformer (`packages/workers/src/sync/transform.ts`) consumes
`formatVersion: 2` exports and **refuses** the exporter that is deployed
today. The shipped `handleDevExport` (v1) silently drops:

- `checklist.outcomeId` — ROB2/ROBINS-I checklists lose their outcome binding
  (the row plane hard-requires it; the transformer hard-fails without it)
- `annotations` — the whole `reviews[studyId].annotations` subtree
- `reconciliations` — the per-study reconciliation-progress maps (also the
  source of the "which consensus checklist is in progress" fact that decides
  Yjs field seeding)
- pdf `tag` and citation metadata (`title`, `firstAuthor`, …)
- `sourceChecklists` on consensus checklists (informational)

Before the freeze, branch off `main` (e.g. `cutover-exporter`), apply the
changes below to `packages/workers/src/durable-objects/dev-handlers.ts`, and
deploy. This deploy touches only the export path and the freeze switch; the
app is otherwise unchanged.

## 1. Replace the study/checklist/pdf export loops in `handleDevExport`

```ts
export async function handleDevExport(ctx: DevContext): Promise<Response> {
  const { doc, stateId, yMapToPlain } = ctx;

  const exportData = {
    formatVersion: 2, // the transformer refuses v1
    exportedAt: new Date().toISOString(),
    projectId: stateId,
    meta: yMapToPlain(doc.getMap('meta')), // carries `outcomes`
    members: [] as Record<string, unknown>[],
    studies: [] as Record<string, unknown>[],
  };

  const membersMap = doc.getMap('members');
  for (const [userId, value] of membersMap.entries()) {
    exportData.members.push({ userId, ...yMapToPlain(value as Y.Map<unknown>) });
  }

  const reviewsMap = doc.getMap('reviews');
  for (const [studyId, studyValue] of reviewsMap.entries()) {
    const studyYMap = studyValue as Y.Map<unknown>;
    const studyData = yMapToPlain(studyYMap);
    const study: Record<string, unknown> = {
      ...studyData, // every scalar study field, verbatim
      id: studyId,
      checklists: [] as Record<string, unknown>[],
      pdfs: [] as Record<string, unknown>[],
    };
    // The nested maps are re-exported in list/keyed form below; drop the
    // toJSON copies so the export has one canonical representation of each.
    delete study.reconciliation;
    delete study.annotations;

    const checklistsMap = studyYMap.get('checklists') as Y.Map<unknown> | undefined;
    if (checklistsMap?.entries) {
      for (const [checklistId, checklistValue] of checklistsMap.entries()) {
        const checklistData = yMapToPlain(checklistValue as Y.Map<unknown>);
        (study.checklists as Record<string, unknown>[]).push({
          ...checklistData, // includes outcomeId, sourceChecklists, reviewerName
          id: checklistId,
          status: checklistData.status || 'pending',
          answers: (checklistData.answers as Record<string, unknown>) || {},
        });
      }
    }

    const pdfsMap = studyYMap.get('pdfs') as Y.Map<unknown> | undefined;
    if (pdfsMap?.entries) {
      // The map is keyed by pdfId; fileName lives inside the value map and
      // must NOT be overwritten here (the R2 fetch path is built from it).
      for (const [pdfId, pdfValue] of pdfsMap.entries()) {
        (study.pdfs as Record<string, unknown>[]).push({
          ...yMapToPlain(pdfValue as Y.Map<unknown>), // fileName, key, size, tag, citation metadata…
          id: pdfId,
        });
      }
    }

    const annotationsMap = studyYMap.get('annotations') as Y.Map<unknown> | undefined;
    if (annotationsMap?.entries) {
      const annotations: Record<string, unknown> = {};
      for (const [checklistId, checklistAnnotations] of annotationsMap.entries()) {
        const perChecklist = checklistAnnotations as Y.Map<unknown>;
        if (!perChecklist?.entries) continue;
        const entries: Record<string, unknown> = {};
        for (const [annotationId, annotation] of perChecklist.entries()) {
          entries[annotationId] = yMapToPlain(annotation as Y.Map<unknown>);
        }
        annotations[checklistId] = entries;
      }
      study.annotations = annotations;
    }

    const reconciliationsMap = studyYMap.get('reconciliations') as Y.Map<unknown> | undefined;
    if (reconciliationsMap?.entries) {
      const reconciliations: Record<string, unknown> = {};
      for (const [outcomeKey, progress] of reconciliationsMap.entries()) {
        reconciliations[outcomeKey] = yMapToPlain(progress as Y.Map<unknown>);
      }
      study.reconciliations = reconciliations;
    }

    exportData.studies.push(study);
  }

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## 2. Add a bearer-token export route (so the driver needs no session)

In `packages/web/src/server.ts` (old worker entry), before the ProjectDoc
route, add — reusing the `SYNC_ADMIN_TOKEN` secret (set it on the old
deployment with `wrangler secret put SYNC_ADMIN_TOKEN` first; the same value
serves the new worker after the cutover deploy):

```ts
const MIGRATION_EXPORT_PATH = /^\/api\/migration\/export\/([^/]+)$/;
const migrationMatch = url.pathname.match(MIGRATION_EXPORT_PATH);
if (migrationMatch) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  const expected = (env as { SYNC_ADMIN_TOKEN?: string }).SYNC_ADMIN_TOKEN;
  if (!expected || token !== expected) return new Response('forbidden', { status: 403 });
  const stub = getProjectDocStub(env as never, migrationMatch[1]);
  return stub.fetch(new Request(`https://do/dev/export`, { method: 'GET' }));
}
```

(Adjust the forwarded request to however `dev-export` is dispatched inside
`ProjectDoc.fetch` — mirror the existing dev route plumbing.)

## 3. Add the freeze switch

In `ProjectDoc.fetch`, first thing:

```ts
if ((this.env as { MIGRATION_FREEZE?: string }).MIGRATION_FREEZE === 'true') {
  return new Response('migration in progress', { status: 503 });
}
```

Setting the `MIGRATION_FREEZE` var (wrangler.jsonc vars + redeploy, or a
Cloudflare dashboard var change) closes every new socket; existing sockets
die on their next reconnect. Clients show the connection-lost state — that
is the announced freeze window. The export route above must be added
*before* this guard (it must work during the freeze).

## Sanity check before relying on it

Export one real project and run it through the transformer locally:

```sh
mkdir -p /tmp/cutover/exports
curl -H "Authorization: Bearer $SYNC_ADMIN_TOKEN" \
  https://<old-worker>/api/migration/export/<projectId> \
  > /tmp/cutover/exports/<projectId>.json
pnpm tsx scripts/sync-cutover/run.ts transform /tmp/cutover/exports /tmp/cutover/out
```

A hard failure here (missing outcomeId, unparseable shapes) is the patch or
the data telling you something — fix it before the freeze, not during.
