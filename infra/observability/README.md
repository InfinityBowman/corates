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
- `dashboards/` - Grafana dashboard JSON, imported by hand via Dashboards > New > Import
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

```logql
{service_name="corates-workers-prod"}                          # all web worker logs
{service_name=~"corates-.*"} |= "error"                        # errors across services
{service_name="corates-workers-prod"} | json | level="warn"    # structured fields
```
