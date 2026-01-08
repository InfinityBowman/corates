# Security Audit - January 2026

## Executive Summary

This security audit examines the CoRATES codebase for vulnerabilities across authentication, authorization, input validation, API security, file handling, payment processing, and real-time collaboration features. The codebase demonstrates strong security practices overall, with proper use of Zod validation, Drizzle ORM, and Better-Auth. However, several findings require attention.

**Total Findings:** 15
- Critical: 3
- High: 5
- Medium: 4
- Low: 3

---

## Critical Severity

### 1. Account Merge Logic - Verification Bypass

**Location:** `packages/workers/src/routes/account-merge.js:675`

**Description:**
The account merge deletion logic contains a logic error that allows deletion with an incorrect token:

```javascript
if (!mergeToken || mergeData.token === mergeToken) {
  await db.delete(verification).where(eq(verification.id, mergeRequest.id));
}
```

This should use `!==` not `===`. Currently allows proceeding even with a wrong token.

Additionally, the merge verification at lines 209-227 relies on email verification codes, but an attacker who knows another user's email can initiate a merge request. While code verification is time-limited, this creates a potential privilege escalation vector.

**Recommended Fix:**
1. Fix the logic error at line 675 to use `!==`
2. Add rate limiting per target email address
3. Send notification to target email with option to reject merge
4. Add a secondary confirmation step after verification succeeds

---

### 2. WebSocket Authentication - No Per-Message Verification

**Location:** `packages/workers/src/durable-objects/ProjectDoc.js:62-123`

**Description:**
WebSocket authentication is performed at connection upgrade time but there is no per-message authentication verification. The initial connection is authenticated at lines 92-100, but once upgraded, the persistent WebSocket has no further auth checks in message handler loops.

This means:
- A compromised session could be exploited for the entire connection duration
- No token expiry enforcement on active connections
- Malicious Yjs protocol messages can be sent without re-verification

**Code Example:**
```javascript
// Line 92-100: One-time auth check
if (upgradeHeader !== 'websocket') {
  const { user } = await verifyAuth(request, this.env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
    });
  }
}
// Line 103-104: Upgrade happens, but no per-message auth thereafter
```

**Recommended Fix:**
1. Implement periodic token refresh or heartbeat authentication
2. Add session validation in message handling loops
3. Implement token expiry mechanism and disconnect stale connections
4. Add rate limiting per WebSocket session

---

### 3. PDF Download - Potential Path Traversal

**Location:** `packages/workers/src/routes/orgs/pdfs.js:352-409`

**Description:**
The PDF download endpoint accepts a fileName parameter from the URL path which is decoded with `decodeURIComponent()`. While validation functions exist (`isValidPdfFilename()`, `isValidFileName()`), if these have any bypass vulnerabilities, attackers could access files from other studies/projects.

The bucket key is constructed as:
```javascript
const key = `projects/${projectId}/studies/${studyId}/${fileName}`;
```

**Recommended Fix:**
1. Verify `isValidPdfFilename()` in `@corates/shared` rejects all special characters
2. Add explicit pattern validation: `fileName.match(/^[a-zA-Z0-9._() -]+\.pdf$/)`
3. Use UUID-based naming internally (already partially implemented)
4. Reject `..`, `/`, `\`, null bytes explicitly

---

## High Severity

### 4. Stripe Webhook Race Condition

**Location:** `packages/workers/src/routes/billing/webhooks.js:147-189`

**Description:**
The two-phase ledger pattern creates a timing vulnerability:

1. Unverified event written to ledger at lines 147-154 with `status: 'RECEIVED'`
2. Signature verified at lines 165-189
3. If verification fails, status updated to `IGNORED_UNVERIFIED`

If a database race occurs between these steps, partially-processed data could be exposed. Events are trusted before signature verification completes.

**Recommended Fix:**
1. Use database transactions - only insert after successful signature verification
2. Create ledger entry with `PENDING` status, update to `RECEIVED` only after signature check
3. Add monitoring for ledger entries with mismatched signature status

---

### 5. Google Drive Token Refresh - Stale Token Handling

**Location:** `packages/workers/src/routes/google-drive.js:81-123`

**Description:**
The token refresh logic has edge cases where stale tokens are returned:

```javascript
// If no expiry or no refresh token, return stale token
if (!expiresAt || Number.isNaN(new Date(expiresAt).getTime())) {
  if (tokens.accessToken) return tokens.accessToken;  // STALE TOKEN
}
```

If `accessTokenExpiresAt` is invalid/null and no refresh token exists, the code returns a stale access token that will fail API calls.

**Recommended Fix:**
1. Always verify token validity with a test request
2. Remove fallback that returns stale tokens
3. Require users to reconnect Google account if refresh token missing
4. Add logging for stale token usage

---

### 6. CSRF Protection - Missing SameSite Cookie Verification

**Location:** `packages/workers/src/middleware/csrf.js`

**Description:**
The CSRF middleware relies on Origin/Referer header checking, but there is no explicit SameSite cookie configuration visible in the codebase. Without `SameSite=Strict` or `SameSite=Lax` on session cookies, CSRF attacks are possible even with Origin checks, which can be spoofed in certain browser configurations.

**Recommended Fix:**
1. Configure Better-Auth to set `SameSite=Lax` on session cookies
2. Add explicit cookie security headers in `securityHeaders.js`
3. Implement double-submit cookie pattern as secondary protection
4. Add CSP `frame-ancestors` directive

---

### 7. Rate Limiting - Per-Worker Instance Storage

**Location:** `packages/workers/src/middleware/rateLimit.js:8-26`

**Description:**
Rate limiting uses in-memory storage (`const rateLimitStore = new Map()`) that is per-worker instance. In Cloudflare Workers with multiple instances/regions, attackers can distribute requests across instances to bypass limits.

Additionally, rate limiting is disabled in non-production at lines 62-65, which is dangerous if staging/preview deployments are exposed.

**Recommended Fix:**
1. Migrate to Cloudflare Durable Objects or KV for distributed rate limiting
2. Enable rate limiting in all environments
3. Implement fingerprinting beyond IP addresses
4. Consider adaptive rate limiting

---

### 8. Google Drive PDF Import - No File Integrity Verification

**Location:** `packages/workers/src/routes/google-drive.js:273-376`

**Description:**
The Google Drive import endpoint verifies MIME type but:

1. MIME type can be spoofed
2. No magic bytes verification (unlike direct PDF upload)
3. No virus/malware scanning
4. File size is checked as string which could overflow

If a user's Google Drive is compromised, arbitrary content could be imported.

**Recommended Fix:**
1. Add PDF magic bytes verification (like in pdfs.js)
2. Calculate and verify file hash if available from Google
3. Use numeric comparison for file size validation
4. Consider malware scanning integration

---

## Medium Severity

### 9. Admin Storage Deletion - Pattern Matching Risk

**Location:** `packages/workers/src/routes/admin/storage.js` (validation in validation.js:205-206)

**Description:**
The storage deletion endpoint accepts a `keys` array matching a pattern:
```javascript
/^projects\/[^/]+\/studies\/[^/]+\/.+$/
```

This allows ANY characters in the filename portion. While PDF upload validates filenames, files created through other means could be affected.

**Recommended Fix:**
1. Ensure all file operations use strict filename validation
2. Add secondary authorization - verify file ownership
3. Implement soft deletes for audit trail

---

### 10. Error Disclosure in Development Mode

**Location:** `packages/workers/src/middleware/errorHandler.js:104-108`

**Description:**
Stack traces and error messages are included in non-production responses. If environment variables are misconfigured, internal code structure is exposed.

```javascript
const error = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
  ...(process.env.ENVIRONMENT !== 'production' && {
    originalError: err.message,
    stack: err.stack,  // Leaks code structure
  }),
});
```

**Recommended Fix:**
1. Use `c.env.ENVIRONMENT` instead of `process.env.ENVIRONMENT`
2. Never include stack traces in API responses
3. Use request IDs for server-side debugging only

---

### 11. User Enumeration via Account Merge

**Location:** `packages/workers/src/routes/account-merge.js:209-215`

**Description:**
The error response reveals whether an email exists in the system:
```javascript
if (!targetUser) {
  const error = createDomainError(USER_ERRORS.NOT_FOUND, {...});
  return c.json(error, error.statusCode);
}
```

Attackers can enumerate valid email addresses despite rate limiting.

**Recommended Fix:**
1. Return generic error message for all cases
2. Add exponential backoff per email address
3. Implement CAPTCHA after repeated failures
4. Log enumeration attempts

---

### 12. SQL Injection Considerations with LIKE

**Location:** `packages/workers/src/routes/users.js:73-95`

**Description:**
While Drizzle ORM prevents SQL injection, the use of raw `sql` template with user input for LIKE patterns should be monitored:

```javascript
const searchPattern = `%${query.toLowerCase()}%`;
// ...
like(sql`lower(${user.email})`, searchPattern),
```

Drizzle parameterizes this correctly, but changes to pattern construction could introduce vulnerabilities.

**Recommended Fix:**
1. Add comments noting Drizzle's parameterization
2. Consider full-text search for better performance
3. Implement search result caching

---

## Low Severity

### 13. Content-Disposition Header Validation

**Location:** `packages/workers/src/routes/orgs/pdfs.js:390-398`

**Description:**
The Content-Disposition header encodes the filename but doesn't sanitize for HTTP header safety as a defense-in-depth measure.

**Recommended Fix:**
1. Sanitize filename for Content-Disposition header
2. Use RFC 5987 format only
3. Strip special characters from display filename

---

### 14. Insufficient Security Event Logging

**Location:** Various admin routes, stripe-tools.js, account-merge.js

**Description:**
Some security-sensitive operations lack comprehensive audit logging:
- Admin tool usage doesn't track who accessed what
- Account merge operations don't log initiator/target
- File deletions have no audit trail

**Recommended Fix:**
1. Implement comprehensive audit logging for admin operations
2. Store audit logs immutably
3. Set up alerts for suspicious patterns

---

### 15. Missing Origin Validation in Configuration

**Location:** `packages/workers/src/config/origins.js:42-61`

**Description:**
Environment-provided origins are not validated as actual URLs. Invalid origins could potentially bypass CORS checks:

```javascript
if (env.ALLOWED_ORIGINS) {
  const envOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  envOrigins.forEach(origin => {
    if (origin && !origins.includes(origin)) {
      origins.push(origin);  // No validation
    }
  });
}
```

**Recommended Fix:**
1. Validate each origin with `new URL()` constructor
2. Reject non-HTTPS origins in production
3. Log invalid origins as configuration errors

---

## Summary Table

| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| Account Merge Logic Error | Critical | account-merge.js:675 | Account takeover |
| WebSocket Auth Bypass | Critical | ProjectDoc.js:62-123 | Data exposure |
| PDF Path Traversal | Critical | pdfs.js:352-409 | Unauthorized file access |
| Stripe Webhook Race | High | webhooks.js:147-189 | Invalid event processing |
| Google Drive Stale Token | High | google-drive.js:81-123 | Failed API operations |
| Missing SameSite Cookies | High | csrf.js | CSRF vulnerability |
| Rate Limit Bypass | High | rateLimit.js:8-65 | Abuse potential |
| Google Drive No Integrity | High | google-drive.js:273-376 | Malware upload |
| Admin File Deletion Pattern | Medium | validation.js:205-206 | Unintended deletion |
| Error Stack Disclosure | Medium | errorHandler.js:104-108 | Code structure exposed |
| User Enumeration | Medium | account-merge.js:209-215 | Email enumeration |
| SQL LIKE Considerations | Medium | users.js:73-95 | Future risk |
| Content-Disposition | Low | pdfs.js:390-398 | Header injection |
| Insufficient Audit Logging | Low | Various | Compliance gaps |
| Origin Validation | Low | origins.js:42-61 | Invalid origin |

---

## Recommendations by Priority

### Immediate (1-2 weeks)
1. Fix account merge logic error at line 675
2. Add per-message WebSocket authentication
3. Verify PDF path traversal protections
4. Confirm SameSite cookie configuration in Better-Auth
5. Migrate rate limiting to Durable Objects/KV

### Short-term (1 month)
1. Add PDF magic bytes verification for Google Drive imports
2. Fix stale Google token handling
3. Add comprehensive audit logging
4. Fix error disclosure in development mode
5. Add origin validation

### Medium-term (2-3 months)
1. Implement WebSocket heartbeat authentication
2. Add user enumeration protection
3. Implement security event alerting
4. Add malware scanning for uploads
5. Security review of admin endpoints

---

## Positive Findings

The codebase demonstrates strong security practices:

1. **Input Validation:** Comprehensive Zod schema validation
2. **ORM Usage:** Drizzle ORM prevents SQL injection
3. **Authentication:** Better-Auth integration
4. **CSRF Protection:** Origin/Referer header validation
5. **File Upload Security:** PDF magic bytes verification
6. **SSRF Protection:** Domain allowlisting
7. **Security Headers:** CSP, HSTS, X-Frame-Options configured
8. **Rate Limiting:** Multiple strategies for different endpoints
9. **Error Handling:** Centralized with proper status codes
10. **Modular Architecture:** Clear separation of concerns
