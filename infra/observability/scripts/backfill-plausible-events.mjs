#!/usr/bin/env node
// One-off: copy Plausible custom events (May to Aug 2026) into Loki under the current
// client.* names, so the product-usage panels have history from before the Loki mirror.
// Reads Plausible through Grafana's ClickHouse datasource and pushes to Loki's push API.
//
//   node scripts/backfill-plausible-events.mjs --until 2026-08-31T23:14:18Z          # dry run
//   LOKI_PASSWORD=... node scripts/backfill-plausible-events.mjs --until ... --apply
//
// --until must be the first mirrored client.* entry already in Loki; everything after
// it is already there. Loki must accept old samples while this runs (see README).
// Re-running is safe: Loki drops entries whose timestamp and line already exist.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(here, '..', '.env'), 'utf8')
    .split('\n')
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => line.split(/=(.*)/s).slice(0, 2)),
);

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const until = args[args.indexOf('--until') + 1];
if (!until || args.indexOf('--until') === -1) {
  console.error('--until <iso timestamp> is required');
  process.exit(1);
}
if (apply && !process.env.LOKI_PASSWORD) {
  console.error('LOKI_PASSWORD is required with --apply (plaintext for the corates user)');
  process.exit(1);
}

const GRAFANA = 'https://grafana.jacobmaynard.dev';
const LOKI = 'https://logs.corates.org';
const SITE_ID = 3;
const HOST = 'corates.org';
const AUTOCAPTURE = ['pageview', 'engagement', 'Form: Submission', 'Outbound Link: Click'];
const RENAMES = {
  'client.checklist.completed': 'client.reconciliation.finalized',
  'client.local_appraisal': 'client.local_appraisal.created',
  'client.local_appraisal.pdf': 'client.local_appraisal.pdf_attached',
  'client.404': 'client.route.not_found',
};

// Same transform the removed track() applied before the renames.
function logName(event) {
  const base = `client.${event
    .split(':')
    .map(s => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase())
    .join('.')}`;
  return RENAMES[base] ?? base;
}

function basic(user, password) {
  return 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
}

async function fetchEvents() {
  const sql = `SELECT toUnixTimestamp(timestamp) AS ts, name, pathname, meta.key AS keys, meta.value AS vals
    FROM plausible_events.events_v2
    WHERE site_id = ${SITE_ID} AND hostname = '${HOST}'
      AND name NOT IN (${AUTOCAPTURE.map(n => `'${n}'`).join(', ')})
      AND timestamp < parseDateTimeBestEffort('${until}')
    ORDER BY timestamp`;
  const res = await fetch(`${GRAFANA}/api/ds/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basic('admin', env.GRAFANA_ADMIN_PASSWORD),
    },
    body: JSON.stringify({
      from: 'now-5y',
      to: 'now',
      queries: [
        { refId: 'A', datasource: { uid: 'plausible-clickhouse' }, rawSql: sql, format: 1 },
      ],
    }),
  });
  if (!res.ok) throw new Error(`grafana ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const result = body.results.A;
  if (result.error) throw new Error(`clickhouse: ${result.error}`);
  const frame = result.frames[0];
  const cols = Object.fromEntries(
    frame.schema.fields.map((f, i) => [f.name, frame.data.values[i]]),
  );
  const asArray = v => (typeof v === 'string' ? JSON.parse(v) : v);
  return cols.ts.map((ts, i) => ({
    ts,
    name: cols.name[i],
    pathname: cols.pathname[i],
    props: Object.fromEntries(asArray(cols.keys[i]).map((k, j) => [k, asArray(cols.vals[i])[j]])),
  }));
}

function toEntries(events) {
  // Plausible timestamps are whole seconds. Loki drops an entry whose timestamp and line
  // match an existing one, so spread same-second events across nanoseconds.
  let lastTs = null;
  let seq = 0;
  return events.map(e => {
    seq = e.ts === lastTs ? seq + 1 : 0;
    lastTs = e.ts;
    const line = {
      ts: new Date(e.ts * 1000).toISOString(),
      level: 'info',
      service: 'corates-web-client',
      env: 'production',
      message: logName(e.name),
      route: e.pathname,
      source: 'plausible',
      ...e.props,
    };
    return [String(BigInt(e.ts) * 1_000_000_000n + BigInt(seq)), JSON.stringify(line)];
  });
}

async function push(entries) {
  const stream = {
    service_name: 'corates-workers-prod',
    deployment_environment_name: 'production',
    backfill: 'plausible',
  };
  for (let i = 0; i < entries.length; i += 500) {
    const res = await fetch(`${LOKI}/loki/api/v1/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basic('corates', process.env.LOKI_PASSWORD),
      },
      body: JSON.stringify({ streams: [{ stream, values: entries.slice(i, i + 500) }] }),
    });
    if (!res.ok) throw new Error(`loki push ${res.status}: ${await res.text()}`);
    console.log(`pushed ${Math.min(i + 500, entries.length)}/${entries.length}`);
  }
}

const events = await fetchEvents();
const counts = {};
for (const e of events) counts[logName(e.name)] = (counts[logName(e.name)] ?? 0) + 1;
console.log(`${events.length} events before ${until}`);
if (events.length) {
  console.log(`  first ${new Date(events[0].ts * 1000).toISOString()}`);
  console.log(`  last  ${new Date(events.at(-1).ts * 1000).toISOString()}`);
}
for (const [name, n] of Object.entries(counts).sort((a, b) => b[1] - a[1]))
  console.log(`  ${n}\t${name}`);

if (apply) {
  await push(toEntries(events));
} else {
  for (const [ts, line] of toEntries(events).slice(0, 2)) console.log(`  ${ts} ${line}`);
  console.log('dry run; pass --apply to push');
}
