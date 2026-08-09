/**
 * Structured JSON logger shared by all server-side packages.
 *
 * Emits single-line JSON to the level-matched console method so Workers Logs
 * (and the OTLP export to Loki) can parse entries into queryable fields via
 * `| json` instead of unstructured interpolated strings.
 */

export type LogLevelType = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevelType;
  service: string;
  message: string;
  env?: string;
  requestId?: string;
  cfRay?: string | null;
  [key: string]: unknown;
}

export interface Logger {
  requestId?: string;
  cfRay?: string | null;
  debug(message: string, data?: Record<string, unknown>): LogEntry;
  info(message: string, data?: Record<string, unknown>): LogEntry;
  warn(message: string, data?: Record<string, unknown>): LogEntry;
  error(message: string, data?: Record<string, unknown>): LogEntry;
  child(context: Record<string, unknown>): Logger;
}

export interface LoggerOptions {
  service: string;
  env?: string;
  requestId?: string;
  cfRay?: string | null;
  /** Static fields merged into every entry (e.g. route, method, component) */
  context?: Record<string, unknown>;
}

const consoleFor: Record<LogLevelType, (line: string) => void> = {
  debug: line => console.debug(line),
  info: line => console.info(line),
  warn: line => console.warn(line),
  error: line => console.error(line),
};

export function createLogger(options: LoggerOptions): Logger {
  const { service, env, requestId, cfRay, context } = options;

  function emit(level: LogLevelType, message: string, data?: Record<string, unknown>): LogEntry {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      service,
      ...(env !== undefined && { env }),
      ...(requestId !== undefined && { requestId }),
      ...(cfRay !== undefined && { cfRay }),
      message,
      ...context,
      ...data,
    };
    consoleFor[level](JSON.stringify(entry));
    return entry;
  }

  return {
    requestId,
    cfRay,
    debug: (message, data) => emit('debug', message, data),
    info: (message, data) => emit('info', message, data),
    warn: (message, data) => emit('warn', message, data),
    error: (message, data) => emit('error', message, data),
    child(childContext) {
      return createLogger({ ...options, context: { ...context, ...childContext } });
    },
  };
}

interface TimingResult<T> {
  result: T;
  durationMs: number;
}

export async function withTiming<T>(fn: () => Promise<T>): Promise<TimingResult<T>> {
  const start = Date.now();
  try {
    const result = await fn();
    return { result, durationMs: Date.now() - start };
  } catch (error) {
    (error as Error & { durationMs: number }).durationMs = Date.now() - start;
    throw error;
  }
}
