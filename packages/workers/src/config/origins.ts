export const STATIC_ORIGINS: readonly string[] = [
  'http://localhost:5173',
  'http://localhost:8787',
  'http://localhost:3010',
  'https://corates.org',
];

export const ORIGIN_PATTERNS: readonly RegExp[] = [
  /^https:\/\/[a-z0-9-]+-corates\.jacobamaynard\.workers\.dev$/,
  /^https:\/\/corates\.jacobamaynard\.workers\.dev$/,
];

interface EnvWithOrigins {
  ALLOWED_ORIGINS?: string;
  AUTH_BASE_URL?: string;
}

export function matchesOriginPattern(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return ORIGIN_PATTERNS.some(pattern => pattern.test(origin));
}

export function getAllowedOrigins(env: EnvWithOrigins = {}): string[] {
  const origins = [...STATIC_ORIGINS];

  if (env.ALLOWED_ORIGINS) {
    const envOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    envOrigins.forEach(origin => {
      if (origin && !origins.includes(origin)) {
        origins.push(origin);
      }
    });
  }

  if (env.AUTH_BASE_URL && !origins.includes(env.AUTH_BASE_URL)) {
    origins.push(env.AUTH_BASE_URL);
  }

  return origins;
}

export function isOriginAllowed(origin: string | null | undefined, env: EnvWithOrigins = {}): boolean {
  if (!origin) return false;

  const allowedOrigins = getAllowedOrigins(env);
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return matchesOriginPattern(origin);
}

export function getAccessControlOrigin(
  requestOrigin: string | null | undefined,
  env: EnvWithOrigins = {},
): string {
  if (requestOrigin && isOriginAllowed(requestOrigin, env)) {
    return requestOrigin;
  }
  return STATIC_ORIGINS[0];
}
