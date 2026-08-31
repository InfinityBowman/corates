const BLOCKED_KEY = /password|token|secret|authorization|cookie|userid/i;

const MAX_DATA_KEYS = 20;
const MAX_STRING = 500;

export function sanitizeClientLogData(
  data: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!data) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (BLOCKED_KEY.test(key)) continue;
    if (Object.keys(out).length >= MAX_DATA_KEYS) break;
    const sanitized = sanitizeClientLogValue(value);
    if (sanitized !== undefined) out[key] = sanitized;
  }
  return out;
}

function sanitizeClientLogValue(value: unknown, depth = 0): unknown {
  if (depth > 2) return undefined;
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value.slice(0, MAX_STRING);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, 10)
      .map(item => sanitizeClientLogValue(item, depth + 1))
      .filter(item => item !== undefined);
  }
  if (typeof value === 'object') {
    const obj: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (BLOCKED_KEY.test(key)) continue;
      const sanitized = sanitizeClientLogValue(nested, depth + 1);
      if (sanitized !== undefined) obj[key] = sanitized;
    }
    return obj;
  }
  return undefined;
}
