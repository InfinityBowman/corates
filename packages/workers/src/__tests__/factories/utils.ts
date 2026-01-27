export function generateId(prefix = ''): string {
  const uuid = crypto.randomUUID();
  return prefix ? `${prefix}-${uuid.slice(0, 8)}` : uuid;
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function nowDate(): Date {
  return new Date();
}

export function withDefaults<T extends Record<string, unknown>>(
  defaults: T,
  overrides: Record<string, unknown> = {},
): T {
  return { ...defaults, ...overrides } as T;
}

export function emailFromId(id: string): string {
  return `${id}@test.example.com`;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

let counter = 0;

export function nextCounter(): number {
  return ++counter;
}

export function resetCounter(): void {
  counter = 0;
}
