/**
 * Playwright global setup: reset the database once per run.
 *
 * Runs migrations (idempotent) and wipes all tables so every run starts from
 * a clean slate. Individual tests do NOT reset the database -- they rely on
 * unique seed prefixes for isolation so they can run in parallel workers.
 * Playwright starts the webServer before global setup, so the endpoint is
 * reachable here.
 */

import { BASE_URL } from './constants';

export default async function globalSetup() {
  const res = await fetch(`${BASE_URL}/api/test/reset`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`DB reset failed: ${res.status} ${await res.text()}`);
  }
}
