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
  `corates-logs.json` is scoped to `deployment_environment_name="production"` throughout;
  staging is deliberately excluded, so importing it will not show staging traffic
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
- Retention is 90d (`limits_config.retention_period` in `config/loki/loki-config.yaml`)

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
```

Cloudflare attaches ~50 OTLP attributes per line as structured metadata (`url_path`,
`http_request_method`, `cloudflare_handler_type`, `cloudflare_entrypoint`,
`cloudflare_script_version_id`, `trace_id`, `cloudflare_ray_id`, `geo_*`, `user_agent_*`).
Only `service_name` and `deployment_environment_name` are stream labels. Response status
codes and request durations are **not** exported - use the Cloudflare dashboard for those.
