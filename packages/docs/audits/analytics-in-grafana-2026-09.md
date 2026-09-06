# Plausible and Sentry in Grafana

Investigation, 2026-09-05. The Plausible section was rolled out on 2026-09-06; the Sentry sections are still proposals.

## What exists today

- Plausible CE 3.2.1 runs on the homelab box (`homelab-plausible`, from the home-lab repo
  `services/plausible/`). It stores events in ClickHouse (`homelab-plausible-clickhouse`) on
  the `plausible_plausible-internal` docker network only. The `default` ClickHouse user has
  an empty password and full grants; nothing else can reach it.
- corates.org is Plausible `site_id = 3`. Over the last 30 days it holds 1567 pageviews from
  515 visitors, plus the custom events sent through `track()` in `@/lib/analytics`
  (`Checklist:*`, `Project:Created`, `LocalAppraisal`, ...) and the script's own autocapture
  events (`Form: Submission`, `Outbound Link: Click`, `engagement`).
- The same Plausible instance also serves `jacobmaynard.dev` and `paleowaifu.com`, both with
  traffic in the last week. Retiring the Plausible containers is therefore not a CoRATES-only
  decision.
- `corates-grafana` (13.1.3) sits on the shared `homelab` network with one provisioned
  datasource, Loki. No ClickHouse or Sentry plugin is installed. The container can reach
  grafana.com, so plugin preinstall works.
- Sentry is hosted (org `corates`, projects `corates-web` and `corates-workers`, both
  production only). Volume is tiny: about 60 events across 10 issues in the last 30 days.
- Server exceptions already reach Loki: `captureError` in `packages/workers/src/lib/logger.ts`
  writes the structured error line first and then calls Sentry. The only exceptions that exist
  solely in Sentry are browser ones (`reactErrorHandler`, `RouteError`, `captureException`).
- Sentry events carry no `requestId` or `cfRay` tag, so a Loki line and its Sentry event
  cannot be joined today.

## Do you still need Plausible?

What Plausible actually does for you is not the dashboard. It is the ingest pipeline: the
cookieless visitor hash (daily-salted IP + user agent), sessionisation (visits, bounce rate,
duration, entry and exit pages), referrer parsing (`google.com/...` becomes `Google`), the
acquisition-channel classifier, and bot filtering. All of that lands in two ClickHouse tables,
`events_v2` and `sessions_v2`, and every number the Plausible UI shows is a short SQL query
over them. Verified against the live data:

```sql
-- Headline stats, last 30 days: visitors, visits, pageviews, bounce %, avg visit seconds
SELECT uniq(user_id), sum(sign), sum(pageviews * sign),
       round(100 * sum(is_bounce * sign) / sum(sign), 1),
       round(sum(duration * sign) / sum(sign))
FROM plausible_events.sessions_v2
WHERE site_id = 3 AND start > now() - INTERVAL 30 DAY
-- 515  559  1567  72.8  480
```

`sessions_v2` is a `VersionedCollapsingMergeTree`, so every aggregate multiplies by `sign`
(or uses `FINAL`). `events_v2` is append-only and needs no such care.

So the choice is between two ingest pipelines, not two dashboards:

1. **Keep Plausible as the collector, read ClickHouse from Grafana.** Zero new services, all
   of Plausible's derived metrics for free, and the Plausible UI becomes optional. The
   containers stay up regardless because of the other two sites.
2. **Drop the Plausible script and rebuild on Loki.** Send a `client.pageview` through the
   existing `clientLogger` relay and chart everything in LogQL. Cloudflare already attaches
   `geo_*` and `user_agent_*` structured metadata to every relayed line, so country, browser,
   and device come free. What you would have to build yourself: a daily-rotating visitor hash
   in `/api/client-logs` (Plausible does this server side from IP + UA + salt; the client
   cannot be trusted to supply it), sessionisation (bounce, duration, entry and exit pages),
   referrer-to-source parsing, and UTM parsing. Loki's `uniq`-style queries
   (`count(sum by (visitorId) (...))`) work at this volume but are instant queries over the
   whole window, so a 90-day visitors number is one large scan per panel load. You would also
   lose the two autocapture events and the historical five months unless you backfill.

Option 1 is the recommendation. It is a compose change and a dashboard. Option 2 is a
week of reimplementing Plausible's core and ends up with a worse version of it; the only
thing it buys is one fewer third-party script on the page, and that script is already
self-hosted on your own domain.

## Plausible into Grafana (option 1)

Rolled out 2026-09-06 as described below; the dashboard is `corates-web-analytics.json`.

### home-lab repo: a read-only ClickHouse user

Add `services/plausible/clickhouse/grafana-reader.xml` mounted into
`/etc/clickhouse-server/users.d/`, with the password supplied from the service `.env`:

```xml
<clickhouse>
  <profiles>
    <grafana_reader>
      <readonly>1</readonly>
      <max_execution_time>60</max_execution_time>
      <constraints>
        <max_execution_time><changeable_in_readonly/></max_execution_time>
      </constraints>
    </grafana_reader>
  </profiles>
  <users>
    <grafana>
      <password from_env="CLICKHOUSE_GRAFANA_PASSWORD"/>
      <profile>grafana_reader</profile>
      <quota>default</quota>
      <networks><ip>::/0</ip></networks>
      <grants>
        <query>GRANT SELECT, dictGet ON plausible_events.*</query>
      </grants>
    </grafana>
  </users>
</clickhouse>
```

`readonly = 1` is what the Grafana plugin docs ask for; the `changeable_in_readonly`
constraint is required because the plugin sets `max_execution_time` per query. `dictGet` is
needed for the `country_name` / `region_name` alias columns. Pass
`CLICKHOUSE_GRAFANA_PASSWORD` into the clickhouse service's `environment` block. ClickHouse
reloads `users.d` on its own, but the deploy will recreate the container anyway because the
mount list changes.

### corates repo: `infra/observability`

`compose.yaml`, grafana service:

```yaml
environment:
  GF_PLUGINS_PREINSTALL_SYNC: grafana-clickhouse-datasource
  CLICKHOUSE_GRAFANA_PASSWORD: ${CLICKHOUSE_GRAFANA_PASSWORD}
networks:
  - homelab
  - plausible-internal
...
networks:
  homelab:
    external: true
  plausible-internal:
    external: true
    name: plausible_plausible-internal
```

Joining Grafana to the Plausible-internal network keeps the home-lab rule that backing
databases never join `homelab`. Add the password to `infra/observability/.env`.

`config/grafana/provisioning/datasources/clickhouse.yaml`:

```yaml
apiVersion: 1
datasources:
  - name: Plausible
    type: grafana-clickhouse-datasource
    uid: plausible-clickhouse
    jsonData:
      host: plausible-clickhouse
      port: 9000
      protocol: native
      username: grafana
      defaultDatabase: plausible_events
    secureJsonData:
      password: $CLICKHOUSE_GRAFANA_PASSWORD
```

Plugin 4.21.2 needs Grafana 11.6 or later; 13.1.3 qualifies.

### Dashboard: `dashboards/corates-web-analytics.json`

Same conventions as the existing dashboards (`site_id = 3` hard-coded the way
`deployment_environment_name="production"` is). Panels worth having, all with
`$__timeFilter(start)` or `$__timeFilter(timestamp)`:

- Stat row from `sessions_v2`: visitors, visits, pageviews, bounce rate, visit duration.
- Visitors over time: `uniq(user_id)` from `events_v2` bucketed with `$__timeInterval`.
- Top pages, entry pages, exit pages (`pathname`, `entry_page`, `exit_page`).
- Sources and channels (`referrer_source`, `acquisition_channel`), UTM breakdown.
- Countries and regions via the `country_name` alias, devices and browsers.
- Goals: `name NOT IN ('pageview', 'engagement')` grouped by `name`, with conversion rate as
  `uniq(user_id)` over total visitors. Custom props live in `meta.key` / `meta.value`
  arrays; `arrayJoin` or `meta.value[indexOf(meta.key, 'type')]` pulls one out.

This makes `corates-product-usage.json` partly redundant: its usage panels read the
under-counting Loki mirror described in `@/lib/analytics`. Once the ClickHouse dashboard
exists, decide whether `track()` still needs to mirror to `clientLogger` at all, or whether the
mirror should shrink to the failure events that Plausible never sees.

### Fallback

If coupling Grafana to Plausible's database is unwelcome, the Plausible Stats API v2
(`POST /api/v2/query`, available in CE with a site API key) plus Grafana's Infinity
datasource gives the same numbers with more configuration per panel and no ad-hoc SQL. Not
recommended while both live on one box.

## Sentry into Grafana

Install `grafana-sentry-datasource` (2.2.6, needs Grafana 10.4 or later) alongside the
ClickHouse plugin in `GF_INSTALL_PLUGINS`. It queries the Sentry API directly, so nothing is
copied anywhere.

Create a dedicated Sentry internal integration (Settings > Developer Settings > Internal
Integrations) with read permission on Project, Issue & Event, and Organization, and use its
token. Do not reuse the token in `~/.sentryclirc`: that is a personal token with admin scopes
across the org, and it is the same token CI uses for sourcemap uploads.

```yaml
apiVersion: 1
datasources:
  - name: Sentry
    type: grafana-sentry-datasource
    uid: sentry
    jsonData:
      url: https://sentry.io
      orgSlug: corates
    secureJsonData:
      authToken: $SENTRY_GRAFANA_TOKEN
```

Query types the plugin supports: Issues, Events, Events Stats, Spans, Spans Stats, Metrics
(session-based crash-free rates), and org Stats. Useful panels:

- Unresolved issues table per project, sorted by frequency, linking to the issue URL.
- Events per day per project, next to `request.completed` error rates from Loki.
- Crash-free sessions from the browser project.

### Linking Loki lines to Sentry events

Worth doing regardless of the rest. Sentry events currently carry `component`, `action`,
`environment`, `release`, and the browser fields, but not `requestId`. If `captureError`
passed `requestId` and `cfRay` as tags (they are already in the logger scope), a Loki derived
field on the `requestId` JSON key could link straight to
`https://corates.sentry.io/issues/?query=requestId%3A${__value.raw}`. That is one line in
`packages/workers/src/lib/logger.ts` and one `derivedFields` block in the Loki datasource
provisioning. The browser side has no requestId, but `userId` is set on both sides already.

## Sentry into Loki

Decide what this is for before building it, because the two things it could mean have very
different answers.

### Browser exceptions on the Loki timeline

The server already does this: `captureError` logs to Loki, then reports to Sentry. The
browser does not. The cheapest fix is symmetric with the server and needs no external
plumbing: have `captureException` in `packages/web/src/config/sentry.ts` (and the three
`reactErrorHandler` hooks in `client.tsx`) also emit `clientLogger.error('client.exception',
{ name, message, component, action, replayId })`. It rides the existing `/api/client-logs`
relay, inherits the sanitiser, and is joined to the rest of the session by `userId` on the
server. This is the recommended form of "Sentry to Loki". It is a small code change in the
web package and nothing in infra.

### Sentry issues as Grafana annotations

If the goal is instead "show me when a new Sentry issue appeared, on top of the request and
usage graphs", use Sentry's webhook and relay it into Loki as its own stream:

- Per-event `error.created` webhooks require a Business or Enterprise plan (verified in the
  Sentry docs). Issue alert webhooks (`event_alert`) and issue lifecycle webhooks (`issue`
  created / resolved / regressed) work on all plans, but fire per issue, not per event.
- Loki has no webhook receiver, and n8n was removed from the homelab on 2026-09-05, so a
  relay would be a new thing: either a tiny container on the `homelab` network that verifies
  the `sentry-hook-signature` HMAC and `POST`s a Loki push body under
  `{service_name="sentry"}` (`project`, `action`, `issue_id`, `title`, `web_url`) to
  `http://corates-loki:3100/loki/api/v1/push`, or a Cloudflare Worker doing the same through
  the authenticated public Loki endpoint. A Grafana annotation query then reads that stream.
- The webhook needs its own internal integration with the "Alert Rule Action" toggle and
  webhook URL set, plus an issue alert rule on each project whose action is that
  integration.

Given 10 issues a month and the need for a new relay service, this is fine to defer. The
Grafana Sentry datasource already gives an issues table; annotations are polish.

## Loose ends noticed on the way

- `packages/docs/guides/observability.md` says Loki retention is 90 days.
  `infra/observability/config/loki/loki-config.yaml` sets `retention_period: 0s` and the
  README documents that as unlimited. The guide is wrong and should say unlimited.
- Four `corates-workers` Sentry events in the last 30 days are titled `captureError`, which
  is what Sentry shows when a non-`Error` value is thrown. The logger already handles that
  case for the Loki line; the Sentry call could wrap the value in an `Error` so the issue
  gets a real title.
- Plausible's "Mobile App" browser bucket accounts for 57 of the last month's visitors, which
  is likely the LibGuides or in-app browser traffic and worth a filter in the new dashboard.
