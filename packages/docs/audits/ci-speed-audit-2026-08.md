# CI speed audit (2026-08-30)

Measured against `ci.yml` run 33349212538 (push to main, 2026-08-31 01:58 UTC,
19m22s wall) and PR run 33353650437 (4m11s). Local experiments on an 18-core
Mac were run with `--maxWorkers=4` where noted so they track the 4-vCPU
`ubuntu-latest` runner. The repo is public, so Actions minutes are free and
adding parallel jobs costs nothing.

## Where the time goes today

Main push, critical path (serial):

| Job               | Wall   | Inside                                                                                                   |
| ----------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| checks            | 4m43s  | setup+install+build-deps 31s, lint 23s, typecheck 32s, tests 191s                                        |
| deploy-staging    | 1m20s  | setup+install+build-deps 25s, web build 14s, migrate 2s, deploy web 28s, deploy stripe 7s               |
| e2e               | 11m32s | container pull 27s, apt 10s, install 19s, **tests 568s**, post-step cache save 60s (one-off cache miss)  |
| deploy-production | 1m31s  | setup+install+build-deps 25s, web build 28s, migrate 2s, deploy web 22s, deploy stripe 8s               |

The 191s of `pnpm test` breaks down as: shared 3s, workers 25s, web unit
(jsdom) 15s, **web server (vitest-pool-workers) 147s**.

Three of the four main-push runs before this one were cancelled by
`cancel-in-progress` because the next merge landed inside the 19 minute window.
That is working as designed, but it means production only catches up on the
last merge of a burst. A shorter pipeline shrinks that window.

## 1. E2E is single-threaded against staging

`playwright.config.ts` sets `workers: isRemote ? 1 : 6`. 15 spec files, 28
tests, 568s.

Parallel-safety evidence (all checked in code):

- Every seed goes through `uniquePrefix()` (`Date.now()` + random) or a
  module-level `TEST_PREFIX` with `Date.now()`; no fixed identities.
- `/api/test/reset` is only called from `global-setup.ts`. No spec calls it.
  Per-spec cleanup uses `/api/test/cleanup` by prefix.
- better-auth `rateLimit: { enabled: false }` (`packages/workers/src/auth/config.ts:492`),
  so four workers sharing one runner IP will not trip auth limits.
- Different scenarios use different orgs/projects, so Durable Object instances
  do not overlap. Staging D1 is a single writer but the write volume is tiny.

The only unknown is the length of the longest spec, which bounds parallel wall
time. `realtime-at-scale.spec.ts` sets a 300s timeout for itself; the CI log
uses the dot reporter so per-spec durations are not recorded anywhere.

Recommendation:

- `workers: isRemote ? 4 : 6`.
- Add `reporter: isRemote ? [['list'], ['html', { open: 'never' }]] : 'list'`
  (or at least `list`) so the CI log shows per-spec durations. Then tune
  worker count from data.
- Expected: 9.5m to roughly 3-4m, bounded by the longest spec.

## 2. vitest-pool-workers server suite: 43 isolates, 147s

Measurements (all 43 files, 317 tests):

| Variant                                                       | Wall   | Cumulative import | Result                             |
| ------------------------------------------------------------- | ------ | ----------------- | ---------------------------------- |
| CI baseline (4 vCPU)                                          | 145s   | 363s              | pass                               |
| Local, default 18 workers                                     | 35s    | 509s              | pass                               |
| Local, minimal `test-worker.ts` main (no createStartHandler)  | 35s    | 523s              | pass, identical to baseline        |
| Local, `--maxWorkers=4`                                       | 29s    | 90s               | pass                               |
| Local 4w, `deps.optimizer.ssr.enabled`                        | 40s    | 136s              | slower, plus module errors         |
| Local 4w, `test.isolate: false`                               | **6s** | 18s               | 8 tests fail in 5 files (see note) |
| Local 4w, two projects: 22 non-mock files `isolate:false`, 21 `vi.mock` files isolated | 22s | 67s | pass                     |
| Single file alone: `health.server.test.ts` / `billing-members.server.test.ts` | 0.6s / 3.0s | 0.3s / 2.8s | pass                    |

What this says:

- The cost is not workerd boot and not the `test-worker.ts` main. Swapping the
  main for a stub that returns `new Response('test worker')` changed nothing,
  and all 317 tests still passed because **no server test uses `SELF`**. The
  `createStartHandler` boot and the three `#tanstack-*` aliases in
  `vitest.server.config.ts` are dead weight (another session was already
  removing this when this audit ran; leave it to that branch).
- The cost is each test file re-importing the server module graph
  (`billing.server` pulls db, better-auth, stripe, tanstack start, drizzle,
  zod...). About 2-3s per file locally, about 8s per file on the runner, times
  43 files. Cumulative import balloons with worker count because every isolate
  fetches modules through the single Node-side module fallback service.
- `isolate: false` (one module graph shared across files) is the lever: 29s to
  6s locally, which extrapolates to roughly 145s to 30s on CI. The 8 failures
  are `vi.mock` registrations leaking between files (`api.listMembers is not a
  function`, checkout mock URLs bleeding into the wrong file). 21 of 43 files
  call `vi.mock`, mostly on the same four modules:
  `@corates/workers/auth-config` (8), `@corates/workers/billing-resolver` (5),
  `@corates/shared/stripe` (5), `@corates/workers/commands/billing` (2).
- Splitting into two vitest projects (shared isolate for the 22 mock-free
  files, per-file isolate for the 21 mock users) passes today with zero test
  edits but only buys 23%, because the mock-using files are the heavy ones.

Recommendation, in order:

1. Move the four common `vi.mock` targets into `src/__tests__/server/setup.ts`
   the same way `postmark` and `stripe` already are: passthrough factories
   (`importOriginal` + `vi.fn()` wrappers) so every file sees the same mock
   registry, and files that need behaviour set it with `mockImplementation` in
   `beforeEach` and `vi.restoreAllMocks()` in `afterEach`. Then set
   `test.isolate: false` in `vitest.server.config.ts`. Target: about 30s on CI.
2. If step 1 stalls on a few stubborn files, use the two-project split so the
   rest of the suite gets the shared isolate now.
3. Consolidating files is not worth doing on its own; the per-file cost is the
   import graph, and merging files without sharing the isolate only helps
   linearly.

Do not enable `deps.optimizer.ssr`; measured slower.

## 3. Lint, typecheck, tests run serially in one job

Splitting into parallel jobs costs about 30s of setup each (setup-node 7-12s,
install 9-10s, shared+db build 5-7s) and on a public repo costs no minutes.

Proposed `checks` shape:

```
lint        30s setup + 23s
typecheck   30s setup + 32s
test-unit   30s setup + shared 3s + workers 25s + web unit 15s   (~75s)
test-server 30s setup + 147s today, ~30s after item 2
build-web   30s setup + vite build 14s  (new; see below)
```

PR wall time becomes the slowest leg: about 3m today, about 1m45s after item 2,
versus 4m11s now.

Two additional structural changes worth more than the matrix itself:

- **PR CI never runs `vite build`.** A build break is only discovered on
  `deploy-staging` after merge. Add the build to PR checks (staging config is
  fine for this; it exercises the same plugin chain).
- **On push, do not gate `deploy-staging` on `checks`.** Staging exists to be
  the e2e target; `deploy-production` keeps `needs: [checks, e2e]`. This takes
  the whole `checks` job (4m43s) off the main-push critical path for free.
  Cost: a lint or typecheck failure can reach staging for the few minutes until
  the run fails. If that is unacceptable, gate staging on `build-web` only
  (about 45s) rather than on the full checks matrix.

Projected main-push wall time with items 1 and 3 (item 2 pending):

```
today:          checks 4m43 -> staging 1m20 -> e2e 11m32 -> prod 1m31   = 19m22
after:          max(checks ~3m, staging 1m20 + e2e ~5m) -> prod 1m31    = ~8m
after + item 2: max(checks ~1m45, staging 1m20 + e2e ~5m) -> prod 1m31  = ~8m
```

E2E is the long pole once checks is parallel; further gains come from worker
count and from the e2e job's fixed overhead (container pull 27s, apt 10s,
better-sqlite3 compiling from source because the Playwright image has no
prebuilt-binary cache, 19s).

## 4. Install + build repeated three times

Measured cost per extra job: setup-node 7-12s, `pnpm install` 9-10s (store
cache hit), shared+db tsc 5-7s, so about 25-30s each. Only the two deploy jobs
are on the serial path, so the duplication costs about one minute of main-push
wall time. The two `vite build`s (14s staging, 28s production) cannot be
shared: they bake different `VITE_*` values into the client bundle,
`VITE_DEV_PANEL` changes what gets tree-shaken, and the production build
uploads source maps to Sentry.

This is the smallest of the four line items.

### What Cloudflare offers (checked against current docs, 2026-08-30)

- **"Artifacts" is not a CI artifact store.** Cloudflare Artifacts is a
  Git-compatible versioned file store for agent workflows, in closed beta
  (`developers.cloudflare.com/artifacts/`). The 2026-08-04 "build and deploy on
  every push" changelog is a CI SDK (`@cloudflare/ci`) that triggers on pushes
  to an Artifacts repo, not a GitHub repo. Nothing here applies to this
  pipeline.
- **Workers Builds** (Cloudflare-hosted CI, GA 2025-09) is a replacement for
  GitHub Actions, not a complement: it cannot be gated on external checks (the
  only bridge is a deploy hook you curl), its build cache covers only the pnpm
  store (no Vite output cache), Free is 1 concurrent build, and preview URLs
  are not generated for Workers with Durable Objects, which rules out the web
  worker. Not recommended.
- **Versions cannot be promoted across environments.** `wrangler versions
  upload` then `versions deploy` works within one Worker, but `env.staging` is
  a separate Worker (`corates-workers-staging`) and a version bundles code,
  assets, bindings and vars. There is no staging-to-production promote
  primitive, and no Vite pattern for runtime `VITE_*` injection. Two builds is
  the sanctioned shape.
- **Deploying a prebuilt `dist/` is supported.** `vite build` already writes
  `dist/server/wrangler.json` (`no_bundle: true`, `main: index.js`,
  `assets.directory: ../client`) and `.wrangler/deploy/config.json` redirects
  `wrangler deploy` to it. From another job: download the artifact and run
  `wrangler deploy -c dist/server/wrangler.json`. Caveats: the build is bound
  to one `CLOUDFLARE_ENV`; D1 migrations still run against the input
  `wrangler.jsonc` (`--env staging`); the output config records absolute
  `configPath` strings, so keep the same workspace path. Static asset upload is
  already incremental by content hash, so deploy time will not drop by shipping
  the artifact.
- `cloudflare/wrangler-action@v4` adds nothing over `pnpm exec wrangler
  deploy` when wrangler is a devDependency (it detects and reuses the installed
  binary), other than `deployment-url` output and GitHub Deployments records.
- Aside: `@cloudflare/vitest-pool-workers` was renamed `@cloudflare/vitest-plugin`
  v1 on 2026-08-19 with an unchanged config API and a codemod. Not urgent.

### Recommendation for item 4

Do not introduce artifacts to save the duplicated install. The parts that are
actually shareable (install 10s + shared/db tsc 6s) are smaller than an
upload/download round trip of a 100MB `dist/`, and the two `vite build`s are
legitimately separate.

Instead remove the duplication structurally:

1. One `build-web` job that runs on both PRs and pushes and builds the staging
   bundle. On push, the same job continues into migrate + deploy staging. That
   deletes the `deploy-staging` job's separate checkout/install/build and
   gives PRs build coverage they do not have today.
2. `deploy-production` stays a separate job with its own install and build;
   the only duplicated work left is about 16s and it is the last job in the
   chain, so it is not worth an artifact.
3. Optional, if you want to shave the remaining setup seconds everywhere:
   move from `pnpm/action-setup@v4` + `actions/setup-node@v4` to `pnpm/setup@v2`
   (pnpm's current recommendation; installs pnpm and Node, runs the install,
   caches the store in one step). Measure before and after; expected gain is a
   few seconds per job.

## Proposed plan

Status (2026-08-31): steps 1, 2 and 4 are implemented in the working tree
(`playwright.config.ts`, `ci.yml`, `.github/actions/setup-workspace`). Step 3
is not; an interim change from the server-suite branch (global
`@corates/workers/auth-config` mock in `setup.ts`, explicit `cloudflare:test`
import in the five DO specs) measured 57s to 29s locally at 4 workers and is
compatible with the `isolate: false` step.

Ordered by wall-time saved per line changed:

1. `playwright.config.ts`: `workers: isRemote ? 4 : 6`, `list` reporter in CI.
   E2E 9.5m to ~3-4m. One line plus one line of reporter config.
2. `ci.yml`: split `checks` into `lint`, `typecheck`, `test-unit`,
   `test-server`, `build-web`; make `build-web` deploy staging on push;
   `deploy-production` needs all of them plus `e2e`; `e2e` needs only
   `build-web` (the staging deploy). Main push drops from ~19m to ~8m, PRs
   from ~4m to ~3m.
3. Server suite: move the four common `vi.mock` targets into `setup.ts` as
   passthrough mocks and set `isolate: false`. `test-server` job 147s to
   ~30s; PRs to under 2m. Coordinate with the branch already editing these
   test files.
4. Item 4 as described above falls out of step 2; no artifacts.

Fixed overhead left in the e2e job after all of this (container pull, apt,
better-sqlite3 source compile) is about a minute and only worth chasing once
the suite itself is under three minutes.
