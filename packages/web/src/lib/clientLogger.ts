/**
 * Browser structured logger — batches named events to POST /api/client-logs,
 * which re-emits them through the worker logger and into Loki via OTLP.
 *
 * Production only; dev stays on the console. Do not forward raw console output.
 */

import { createLogger, type LogLevelType } from '@corates/shared/logger';
import { API_BASE } from '@/config/api';
import { sanitizeClientLogData } from '@/lib/clientLogSanitize';

const SERVICE = 'corates-web-client';
const INGEST_PATH = '/api/client-logs';
const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH = 10;

const enabled = import.meta.env.PROD;

interface QueuedEntry {
  level: LogLevelType;
  message: string;
  ts: string;
  route?: string;
  data?: Record<string, unknown>;
}

let context: Record<string, unknown> = {};
const queue: QueuedEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

const consoleLogger = createLogger({ service: SERVICE, env: import.meta.env.MODE });

function currentRoute(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.location.pathname;
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush(false);
  }, FLUSH_INTERVAL_MS);
}

function takeBatch(): QueuedEntry[] {
  return queue.splice(0, MAX_BATCH);
}

function sendBatch(entries: QueuedEntry[], useBeacon: boolean): void {
  if (entries.length === 0) return;

  const body = JSON.stringify({ entries });
  const url = `${API_BASE}${INGEST_PATH}`;

  if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    return;
  }

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body,
    keepalive: true,
  }).catch(() => {
    // Best-effort; the global rate limit and batch caps keep abuse in check.
  });
}

async function flush(useBeacon: boolean): Promise<void> {
  if (!enabled || queue.length === 0 || flushing) return;

  flushing = true;
  try {
    while (queue.length > 0) {
      sendBatch(takeBatch(), useBeacon);
    }
  } finally {
    flushing = false;
  }
}

function enqueue(level: LogLevelType, message: string, data?: Record<string, unknown>): void {
  const route = currentRoute();
  const merged = sanitizeClientLogData({ ...context, ...data });

  consoleLogger[level](message, { ...merged, route });

  if (!enabled) return;

  queue.push({
    level,
    message,
    ts: new Date().toISOString(),
    route,
    ...(Object.keys(merged).length > 0 && { data: merged }),
  });

  if (queue.length >= MAX_BATCH) {
    void flush(false);
  } else {
    scheduleFlush();
  }
}

export const clientLogger = {
  info(message: string, data?: Record<string, unknown>): void {
    enqueue('info', message, data);
  },

  warn(message: string, data?: Record<string, unknown>): void {
    enqueue('warn', message, data);
  },

  error(message: string, data?: Record<string, unknown>): void {
    enqueue('error', message, data);
  },

  setContext(next: Record<string, unknown>): void {
    context = { ...context, ...next };
  },

  clearContext(...keys: string[]): void {
    if (keys.length === 0) {
      context = {};
      return;
    }
    for (const key of keys) {
      delete context[key];
    }
  },

  flush(): Promise<void> {
    return flush(false);
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    void flush(true);
  });
}
