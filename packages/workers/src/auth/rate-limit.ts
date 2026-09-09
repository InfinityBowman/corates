import type { BetterAuthOptions } from 'better-auth';

const WINDOW_SECONDS = 60;
const MAX_PER_WINDOW = 10;

// Endpoints that send an email or accept a guessable code. Paths are relative
// to the Better Auth base path. Password sign-in and sign-up are left on Better
// Auth's own rule (3 per 10 seconds), which locks a mistyped password out for
// seconds rather than a minute.
export const RATE_LIMITED_AUTH_PATHS = [
  '/sign-in/email-otp',
  '/email-otp/send-verification-otp',
  '/email-otp/verify-email',
  '/forget-password/email-otp',
  '/email-otp/request-password-reset',
  '/email-otp/reset-password',
  '/onboarding/request-email',
  '/onboarding/confirm-email',
] as const;

// Limits are per client IP. Ten a minute is loose enough for a room of people
// signing up behind one campus NAT and still caps guessing at 600 an hour.
// Everything else keeps Better Auth's defaults (100 per 10 seconds, plus its
// own stricter rules for sign-in, sign-up, and password or email changes).
export const AUTH_RATE_LIMIT = {
  enabled: true,
  storage: 'database',
  customRules: Object.fromEntries(
    RATE_LIMITED_AUTH_PATHS.map(path => [path, { window: WINDOW_SECONDS, max: MAX_PER_WINDOW }]),
  ),
} satisfies BetterAuthOptions['rateLimit'];
