---
name: prod-data
description: Query CoRATES production data and logs from the Mac - D1 via wrangler, Loki via ssh to homelab, the Sentry API, live Stripe, R2 and the sync-admin surface. Use when diagnosing a production user report, error or data question.
---

# Production data access

Read-only by default. Snapshot affected rows and get Jacob's go-ahead before any prod write. Run wrangler from `packages/web`.

**D1**

```bash
npx wrangler d1 execute corates-db-prod --remote --env production --json --command "SELECT ..."
```

`;`-separated statements run as one atomic batch. Schema: `packages/db/src/schema.ts`. Study, checklist and answer rows are not in D1; they live in the project sync DOs (see sync admin).

**Loki** (production only; staging logs are in `npx wrangler tail --env staging --format json`, without the worker name)

```bash
LOKI_IP=$(docker --context homelab inspect corates-loki -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
ssh jacob@homelab "curl -s -G http://$LOKI_IP:3100/loki/api/v1/query_range \
  --data-urlencode 'query={deployment_environment_name=\"production\"} |~ \"<userId or cfRay>\" | json' \
  --data-urlencode start=<ns> --data-urlencode end=<ns> --data-urlencode limit=500"
```

If ssh times out, use Grafana's proxy: `https://grafana.jacobmaynard.dev/api/datasources/proxy/uid/P8E80F9AEF21F6940/loki/api/v1/query_range` with `-u admin:$GRAFANA_ADMIN_PASSWORD` from `infra/observability/.env`. Use curl, not Python urllib (Cloudflare returns 403). A userId or cfRay pulls a whole session timeline. Fields and example queries: `packages/docs/guides/observability.md`, `infra/observability/README.md`.

**Sentry**: token in `~/.sentryclirc`; org `corates`, project `corates-web`.

```bash
curl -H "Authorization: Bearer $TOKEN" "https://sentry.io/api/0/projects/corates/corates-web/issues/?statsPeriod=14d&query=..."
```

`statsPeriod` accepts only `24h` or `14d`.

**Stripe live**: curl with `STRIPE_AI_AGENT_KEY` from `packages/web/.env` (restricted, read-mostly). Writes need `STRIPE_SECRET_KEY` from `packages/web/.env.production`, only with Jacob's explicit go-ahead. The `stripe` CLI is logged into the sandbox only.

**R2**: bucket `corates-pdfs-prod`; avatars at `avatars/<userId>/<ts>.<ext>`, PDFs at the pdf row's `key`. `npx wrangler r2 object get "corates-pdfs-prod/<key>" --remote --file <out>`. There is no `r2 object list`.

**Sync admin**: `https://corates.org/api/sync-admin/<projectId>/<stats|export|import|reset>` with `Authorization: Bearer $SYNC_ADMIN_TOKEN` from `packages/web/.env.production`. `export` returns every row (`rows[].tbl`). Any call on an unknown project id creates an empty DO, so use real ids only.
