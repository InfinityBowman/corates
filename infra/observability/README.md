# CoRATES Observability Stack

Loki + Grafana for querying CoRATES Workers logs, running on the homelab box with log
chunks stored in the `corates-loki` R2 bucket. Cloudflare Workers Observability exports
OTLP JSON logs directly to Loki's native OTLP endpoint - no collector or tail worker.

```
Workers (production) -> OTLP export -> loki.jacobmaynard.dev/otlp/v1/logs -> Loki -> R2
                                                     Grafana (grafana.jacobmaynard.dev) queries Loki
```

## Layout

- `compose.yaml` - Loki 3.7 (monolithic) + Grafana, joined to the box's shared `homelab`
  network so `homelab-traefik` routes the wildcard tunnel hostnames via labels
- `config/` - Loki config and Grafana datasource provisioning; rsynced to
  `/home/jacob/corates/observability/` on the box by deploy.sh (bind mounts resolve
  remotely when using a docker context)
- `dashboards/` - Grafana dashboard JSON, imported by hand via Dashboards > New > Import.
  All are scoped to `deployment_environment_name="production"`; staging is deliberately
  excluded, so importing them will not show staging traffic.
  - `corates-logs.json` - volume, levels, handler types, top paths
  - `corates-product-health.json` - browser `client.*` events via `/api/client-logs`
  - `corates-product-usage.json` - active users, project work, invitations, appraisals
  - `corates-request-performance.json` - RED metrics off `request.completed`
  - `corates-billing.json` - checkout funnels, subscriptions, Stripe webhook ingress
- `.env` (gitignored) - R2 S3 credentials, Loki basic-auth htpasswd, Grafana admin password
- `deploy.sh` - rsync config, then `docker --context homelab compose up -d`

## Operating

```bash
./deploy.sh                                        # deploy / apply changes
docker --context homelab compose ps                # status
docker --context homelab logs corates-loki --tail 50
```

The `homelab` docker context targets `ssh://jacob@homelab` (Tailscale). Loki's query and
push APIs are both behind Traefik basic auth (user `corates`, password in `.env`).
Grafana talks to Loki internally over the docker network without auth.

## Cloudflare side

- Workers Observability > destinations: type Logs, endpoint
  `https://loki.jacobmaynard.dev/otlp/v1/logs`, header `Authorization: Basic <see .env>`
- Worker configs reference the destination by name in `observability.logs.destinations`
  (see `packages/web/wrangler.jsonc` and `packages/stripe-purchases/wrangler.jsonc`).
  Only the `production` envs export; staging logs stay in Cloudflare Workers Logs so the
  Grafana views are production-only.
- Retention is unlimited. `limits_config.retention_period` is `0s`, which Loki reads as
  "keep forever"; that is also the built-in default, so the setting is there to document
  the intent rather than to change behaviour. `compactor.retention_enabled` stays `true`
  so the compactor keeps compacting the index and can still serve delete requests - it is
  the `retention_period` that decides whether anything ages out, not that flag. Turning
  `retention_enabled` off would disable compaction too, which is not what you want.
  `max_query_length` is 5 years: Loki's default is 721h, which rejected anything past
  a month with "the query time range exceeds the limit" even though the data was still
  on disk. A query's range and its range-vector window are both charged against that
  limit, so a 90d panel with a `[24h]` window asks for 91d. With retention unbounded this
  ceiling, not retention, is what caps how far back a dashboard can look, so raise it
  before pointing a panel at a longer window. `max_query_lookback` is unset (`0s`, no
  limit), so nothing else truncates old queries.
- Cloudflare re-delivers failed export batches hours later (up to ~6h seen). Loki only
  accepts entries within `max_chunk_age / 2` of the newest entry in the stream, so
  `ingester.max_chunk_age` is 24h (12h window); `querier.query_ingesters_within: 0` keeps
  that unflushed data queryable. Lost lines show up as `loki_discarded_samples_total`:

  ```bash
  LOKI_IP=$(docker --context homelab inspect corates-loki -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
  ssh jacob@homelab curl -s http://$LOKI_IP:3100/metrics | grep -E 'loki_discarded_samples_total|route="otlp_v1_logs"'
  ```

  Any non-zero `reason=` or `status_code="400"` on `otlp_v1_logs` means Cloudflare is
  being told to retry (it does, but the batch ages out and is dropped for good).

## Query performance

Dashboard load time here is dominated by subquery fan-out, not by scan volume - the whole
production stream is only ~50MB/week, and any single panel query runs in about 0.25s on its
own. Four settings matter, all of them Loki defaults tuned for a much larger cluster:

- `split_queries_by_interval` and `split_instant_metric_queries_by_interval` (both default
  `1h`) are set to `24h`. At the default a 7d panel becomes 168 subqueries and a 30d panel
  720, each with its own queue and index lookup; one 7d `topk` table was burning 1m23s of
  querier CPU and 16s of queue time to read 68MB. These two are independent - range queries
  use the first, and instant queries (every `topk` table and every `[$__range]` stat) use the
  second, so setting only one leaves half the dashboard slow.
- `querier.max_concurrent` (default `4`) is `16`. Product Usage fires 40 panel queries at
  once; four workers make them queue behind each other on a 12-core box that is otherwise
  idle.
- `query_range.cache_results` and `cache_instant_metric_results` (both default off) are on,
  with embedded in-process caches. These only help a reload of an unchanged window, but that
  is what reading a dashboard looks like.

Measured on Product Usage, 40 concurrent panel queries, wall clock:

| range | before | after | after, reload |
| ----- | ------ | ----- | ------------- |
| 7d    | 5-6s   | ~1.1s | ~0.06s        |
| 30d   | 16-30s | ~1.8s | ~0.06s        |

Isolating the levers at 7d: splits alone took 5.1s to 1.6s, concurrency alone to 3.1s, both
plus caching to 1.0s. If a dashboard ever feels slow again, check `splits=` and `queue_time=`
in Loki's per-query log line (`docker --context homelab logs corates-loki`) before assuming
the query itself is expensive.

## Traefik

Both routers deliberately skip the box-wide `secure-chain@file` (see `compose.yaml`): its
`rate-limit` middleware has no `sourceCriterion`, so behind the tunnel every service shares
one 100 req/s bucket keyed on the cloudflared container's IP. Cloudflare's push batches and
Grafana's parallel panel queries were both getting 429s from it. Traefik runs without an
access log, so those never appeared anywhere. Loki gets basic auth only; Grafana gets
`security-headers@file` only.

## Stat panel query convention

A stat panel that shows one number for the dashboard window must never combine a
`[$__range]` window with a range query. Grafana would evaluate the expression at every step
across the window, each step counting a full range-wide window, and the panel's `sum` reducer
would then add up hundreds of near-identical overlapping counts. The displayed number lands
far above the truth and is not monotonic in the time range - widening from 2d to 7d lowered
`Sign-ins` from 5878 to 2263 when the real counts were 29 and 34.

- Additive counters (`sum(count_over_time(...))`) use `[$__auto]` with `"calcs": ["sum"]`.
  The buckets tile instead of overlapping, so the sum is exact and the panel keeps a real
  activity sparkline. The leading bucket reaches up to one step before the window start, so
  totals can run marginally high at the left edge.
- Everything that cannot be added across buckets - ratios, `quantile_over_time` percentiles,
  and unique counts like `count(sum by (userId) (...))` - keeps `[$__range]` and runs as an
  instant query (`"queryType": "instant", "instant": true`) with `"calcs": ["lastNotNull"]`.
  One evaluation, exact answer, no sparkline.

The same rule applies to the `topk` tables, which were already instant.

## Useful LogQL

Only a small share of ingested lines are `@corates/shared/logger` JSON (roughly 3% - the rest
are Cloudflare invocation logs and raw library `console` output). Filter on Loki's
`detected_level` rather than `| json | level=`, or errors from Better Auth, Drizzle and other
libraries are silently excluded.

```logql
{deployment_environment_name="production"}                       # everything in prod
{deployment_environment_name="production"} | detected_level="error"
{service_name="corates-workers-prod"} | cloudflare_handler_type="hibernatableWebSocket"
{deployment_environment_name="production"} | trace_id="<id>"     # one whole invocation
{service_name="corates-workers-prod"} | json | level="warn"      # logger JSON only
{service_name="corates-workers-prod"} | json | message="request.completed"  # latency SLI
{service_name="corates-workers-prod"} | json | service="corates-web-client"   # browser events
```

Cloudflare attaches ~50 OTLP attributes per line as structured metadata (`url_path`,
`http_request_method`, `cloudflare_handler_type`, `cloudflare_entrypoint`,
`cloudflare_script_version_id`, `trace_id`, `cloudflare_ray_id`, `geo_*`, `user_agent_*`).
Only `service_name` and `deployment_environment_name` are stream labels. Cloudflare does not
export response status or duration, but the app logs its own: `request.completed` carries
`status`, `durationMs`, `route` and `method` (`packages/web/src/server/requestCompletion.ts`),
which is what `corates-request-performance.json` charts. Two gotchas there - `route` holds raw
ids so collapse them in the query, and `| json` makes `requestId` a label, so any `unwrap`
needs a `| keep` first or it trips the series cap.
