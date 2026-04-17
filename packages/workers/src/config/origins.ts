export const STATIC_ORIGINS: readonly string[] = [
  'http://localhost:3010',
  'https://corates.org',
];

export function getAllowedOrigins(): readonly string[] {
  return STATIC_ORIGINS;
}

export function isOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return STATIC_ORIGINS.includes(origin);
}

export function getAccessControlOrigin(requestOrigin: string | null | undefined): string {
  if (requestOrigin && isOriginAllowed(requestOrigin)) {
    return requestOrigin;
  }
  return STATIC_ORIGINS[0];
}
