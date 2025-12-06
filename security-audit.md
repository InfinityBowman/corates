# Security Audit: Magic Link and Two-Factor Authentication

**Audit Date:** December 5, 2025  
**Auditor:** Security Engineering Review  
**Scope:** Magic link authentication, TOTP 2FA, session management, Cloudflare Workers security

---

## Executive Summary

This audit examines the authentication flows in the CoRATES application, focusing on magic link passwordless authentication and TOTP-based two-factor authentication. The implementation uses BetterAuth as the authentication library with a Cloudflare Workers backend.

**Critical Findings:** 0 High, 6 Medium, 5 Low

---

## High Severity Findings

_None identified._

**Note:** Initial review flagged TOTP secrets and backup codes as stored in plaintext. Upon further investigation, BetterAuth encrypts these values using `symmetricEncrypt` with the `AUTH_SECRET` before database storage. The database schema shows `TEXT` columns because the encrypted ciphertext is stored as a string. This is secure as long as `AUTH_SECRET` is properly protected as a secret in production.

---

## Medium Severity Findings

### M-2: Rate Limiting is Per-Worker Instance, Not Global

**Location:** `packages/workers/src/middleware/rateLimit.js:1-6`

**Issue:** Rate limiting uses in-memory storage that is not shared across Worker instances.

```javascript
// rateLimit.js:1-6
/**
 * Note: This is per-worker instance. For distributed rate limiting,
 * consider using Durable Objects or KV storage.
 */
const rateLimitStore = new Map();
```

**Risk:** Cloudflare Workers are distributed globally. An attacker can bypass rate limits by:

1. Making requests that hit different Worker isolates
2. Using multiple IP addresses to distribute load
3. Exploiting the per-IP keying with rotating proxies

Current limits are insufficient for distributed attacks:

- Auth endpoints: 20 requests per 15 minutes per IP
- Magic link could be brute-forced across multiple IPs

**Recommendation:**

- Use Cloudflare KV or Durable Objects for distributed rate limiting
- Implement account-level rate limiting (by email) in addition to IP-based
- Consider Cloudflare's built-in rate limiting rules

---

## Low Severity Findings

### L-2: Sensitive Data in localStorage

**Location:** `packages/web/src/api/better-auth-store.js:78`, `packages/web/src/components/auth-ui/MagicLinkForm.jsx:28`

**Issue:** Auth-related flags stored in localStorage.

```javascript
localStorage.setItem('pendingEmail', email);
localStorage.setItem('magicLinkSent', 'true');
localStorage.setItem('oauthSignup', 'true');
localStorage.setItem('magicLinkSignup', 'true');
```

**Risk:**

- localStorage persists across sessions and is accessible to any JavaScript on the same origin
- XSS vulnerabilities could leak this information
- While not directly sensitive, these flags reveal authentication state

**Recommendation:**

- Use sessionStorage for temporary auth state
- Clear these values promptly after use
- Consider using in-memory state management instead

---

## Architecture Observations

### Cloudflare Workers Considerations

**Observations:**

1. Workers share no state between invocations (good for isolation)
2. Durable Objects maintain persistent state (WebSocket connections, session data)
3. D1 database provides consistency but lacks encryption at rest by default

**Recommendations:**

- Ensure Durable Objects properly validate all incoming requests
- Consider using Cloudflare's encryption features for sensitive data
- Monitor DO hibernation behavior for session state consistency

---

## Verification Checklist

The following items could not be fully verified without BetterAuth source inspection:

| Item                        | Status   | Notes                                          |
| --------------------------- | -------- | ---------------------------------------------- |
| Magic link token entropy    | Unknown  | Depends on BetterAuth implementation           |
| Single-use enforcement      | Unknown  | BetterAuth should delete token after use       |
| Replay protection           | Unknown  | Requires token invalidation verification       |
| 2FA bypass via magic link   | Unknown  | Need to verify 2FA is checked after magic link |
| Session state transitions   | Partial  | BetterAuth handles internally                  |
| Token cryptographic signing | Unknown  | Depends on AUTH_SECRET usage                   |
| TOTP secret encryption      | Verified | BetterAuth encrypts with AUTH_SECRET           |
| Backup codes encryption     | Verified | BetterAuth encrypts with AUTH_SECRET           |

---

## Remediation Priority

| Priority | Finding                               | Effort |
| -------- | ------------------------------------- | ------ |
| 1        | L-5: Client-side QR generation        | Low    |
| 2        | M-1: Add security headers             | Low    |
| 3        | M-2: Distributed rate limiting        | High   |
| 4        | M-5: Remove URL token auth            | Medium |
| 5        | M-3: Validate callback paths          | Low    |
| 6        | M-4: Verify CSRF protection           | Low    |
| 7        | M-6: Dynamic email expiration         | Low    |
| 8        | L-1: Remove dev fallback              | Low    |
| 9        | L-2: Consistent enumeration responses | Medium |
| 10       | L-3: Use sessionStorage               | Low    |
| 11       | L-4: Cross-tab sync                   | Medium |

---

## Conclusion

The authentication implementation uses modern practices through BetterAuth with proper encryption of sensitive 2FA secrets. BetterAuth handles TOTP secret and backup code encryption internally using the `AUTH_SECRET`.

The Cloudflare Workers architecture provides good isolation, but the per-instance rate limiting and lack of distributed coordination could allow determined attackers to bypass protections.

The highest priority remediation item is **L-5 (Client-side QR generation)** - the current implementation sends TOTP secrets to a third-party QR code service, which undermines the security of 2FA entirely.

Additional verification of BetterAuth's internal security mechanisms is recommended before production deployment with sensitive user data.
