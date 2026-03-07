# CoRATES Production Readiness Audit - Full Report

**Date:** 2026-01-19
**Auditor:** Claude Code Production Audit
**Launch Type:** First public launch (invited beta with paid component)
**Expected Traffic:** Low (<100 MAU)
**Audit Strictness:** MEDIUM-HIGH

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Launch Context](#launch-context)
3. [System Architecture](#system-architecture)
4. [Codebase Health Findings](#codebase-health-findings)
5. [Data Safety Findings](#data-safety-findings)
6. [Security Findings](#security-findings)
7. [Performance Findings](#performance-findings)
8. [Observability Findings](#observability-findings)
9. [Operational Readiness Findings](#operational-readiness-findings)
10. [Verdict and Remediation Plan](#verdict-and-remediation-plan)

---

## Executive Summary

### Verdict: NOT READY

CoRATES has solid code architecture and security fundamentals, but critical gaps in data protection and operational infrastructure prevent a safe production launch with real user data and payments.

**5 Stop-Ship Issues** must be resolved before launch:

1. No documented D1 rollback procedure (backups exist via Time Travel)
2. Hard deletes only (no soft delete)
3. D1/Durable Object sync failures silently ignored
4. Error monitoring disabled
5. Quota race condition allows exceeding limits

**No Critical Security Vulnerabilities** were found. Authentication, authorization, and input validation are well-implemented.

---

## Launch Context

| Factor              | Value                                            |
| ------------------- | ------------------------------------------------ |
| Launch Type         | Invited beta with paid component                 |
| User Type           | Invited beta users                               |
| Data Sensitivity    | Mixed real/test - data loss mitigation important |
| Payment Integration | Yes - paid product                               |
| Traffic Level       | Low (<100 MAU)                                   |
| Risk Tolerance      | Data loss > Downtime priority                    |
| Audit Strictness    | MEDIUM-HIGH                                      |

**Stop-Ship Criteria Established:**

- Exploitable security vulnerabilities
- Data loss or corruption risks
- Payment/billing integrity issues
- Missing critical authorization checks

---

## System Architecture

### Package Structure

```
packages/
  web/        - Frontend SolidJS application
  workers/    - Backend Hono API + Durable Objects
  landing/    - Marketing site (embeds web at build)
  shared/     - Common utilities and error definitions
  mcp/        - MCP server for development tools
  mcp-memory/ - Persistent agent memory
  docs/       - Internal documentation
```

### Entry Points

| Type      | Path                             | Auth              | Purpose                      |
| --------- | -------------------------------- | ----------------- | ---------------------------- |
| REST API  | `/api/*`                         | Varies            | Core application APIs        |
| WebSocket | `/api/project-doc/:projectId`    | Cookie + D1 check | Real-time Y.js collaboration |
| WebSocket | `/api/sessions/:sessionId`       | Cookie            | User notifications           |
| Webhook   | `/api/auth/stripe/webhook`       | Stripe signature  | Subscription events          |
| Webhook   | `/api/billing/purchases/webhook` | Stripe signature  | One-time purchases           |

### Persistence Layer

| Store            | Type             | Purpose                                        |
| ---------------- | ---------------- | ---------------------------------------------- |
| D1 (SQLite)      | Primary database | Users, sessions, orgs, projects, subscriptions |
| R2               | Object storage   | PDF files, avatars                             |
| Durable Objects  | Stateful workers | ProjectDoc (Y.js), UserSession (notifications) |
| Cloudflare Queue | Email delivery   | Async email processing with retries and DLQ    |

### External Services

| Service      | Purpose                | Failure Impact           |
| ------------ | ---------------------- | ------------------------ |
| Stripe       | Payments/subscriptions | Billing broken           |
| Google OAuth | Primary login          | Login impacted           |
| ORCID OAuth  | Researcher login       | ORCID login unavailable  |
| Postmark     | Email delivery         | Magic links fail         |
| Google Drive | PDF import             | Drive import unavailable |

### Trust Boundaries

| Boundary      | Verification                   |
| ------------- | ------------------------------ |
| Client/API    | Cookie session via Better Auth |
| API/Database  | Drizzle ORM (no raw SQL)       |
| Admin/Regular | Role-based + CSRF protection   |
| Project/Org   | Separate membership tables     |
| Webhooks      | Stripe signature verification  |

**Critical Multi-tenancy Note:** Project access requires explicit `projectMembers` entry. Org membership does NOT automatically grant project access.

---

## Codebase Health Findings

### Error Handling Issues

#### HIGH: Quota Check-Then-Insert Race Condition

**Location:** `packages/workers/src/lib/quotaTransaction.ts:157-227`

The `insertWithQuotaCheck` function performs a classic check-then-act pattern vulnerable to race conditions:

1. Counts existing records
2. Checks if count >= limit
3. Performs batch insert
4. Verifies count again (but only logs warning, still returns success)

**Scenario:** Two concurrent requests to add members:

1. Request A checks quota: 4/5 members used
2. Request B checks quota: 4/5 members used
3. Request A inserts member (5/5)
4. Request B inserts member (6/5 - exceeds quota)
5. Both return success

**Impact:** Organizations can exceed subscription quotas, losing revenue.

#### HIGH: Non-Atomic Member Addition with DO Sync Failure

**Location:** `packages/workers/src/commands/members/addMember.ts:117-154`

Member addition performs D1 inserts atomically, but DO sync is done afterwards and failures are silently logged:

```typescript
// Execute all inserts atomically
await db.batch(insertOperations);

// Sync member to DO - failures logged but ignored
try {
  await syncMemberToDO(env, projectId, 'add', { ... });
} catch (err) {
  console.error('Failed to sync member to DO:', err);
}
```

**Impact:** Users may be "members" in database but unable to access real-time collaboration.

#### HIGH: Non-Atomic Member Removal with Potential Stale Access

**Location:** `packages/workers/src/commands/members/removeMember.ts:51-62`

Member removal deletes from D1 first, then syncs to DO. If DO sync fails:

1. WebSocket connection may not be terminated
2. Local IndexedDB cache still has the project
3. User can continue editing until they disconnect

**Impact:** Removed users can continue editing documents temporarily.

#### HIGH: Missing Timeouts on External API Calls

Multiple locations lack explicit timeout protection:

- Google Drive API calls
- PDF proxy fetches
- Avatar copy operations

Cloudflare Workers has 30-second implicit limit, but no graceful handling.

#### MEDIUM: Project Deletion Cleanup Order Issue

**Location:** `packages/workers/src/commands/projects/deleteProject.ts:49-71`

Deletion order creates window for orphaned files:

1. Disconnect all users
2. Clean up R2 storage (failures logged, not thrown)
3. Delete from D1

If R2 cleanup fails silently, orphaned PDFs remain indefinitely.

#### MEDIUM: PDF Upload Non-Atomic R2/D1 Operations

**Location:** `packages/workers/src/routes/orgs/pdfs.ts:639-704`

PDF upload stores in R2 first, then inserts to D1. If D1 fails, cleanup is attempted but can also fail, leaving orphaned files.

#### MEDIUM: PDF Filename Uniqueness Race Condition

**Location:** `packages/workers/src/routes/orgs/pdfs.ts:372-433`

`generateUniqueFileName` queries for existing names but another request could create the same name between check and insert.

**Impact:** One user's PDF could overwrite another's.

#### MEDIUM: Grant Extension Race Condition

**Location:** `packages/workers/src/commands/billing/processCheckoutSession.ts:126-158`

When extending grants, read-modify-write is not atomic. Concurrent purchases could result in lost access time.

#### MEDIUM: Y.js State Persistence Not Debounced

**Location:** `packages/workers/src/durable-objects/ProjectDoc.ts:454-465`

Every Y.js update triggers full state serialization and storage write. Under heavy collaboration, this causes performance issues and potential data loss during high-frequency updates.

### Code Quality Issues

#### HIGH: Missing Error Monitoring Integration

**Location:** `packages/web/src/lib/errorLogger.js:72-94`

Sentry integration is commented out. Production errors only go to browser console.

#### LOW: Known Bug in PDF Title Extraction

**Location:** `packages/web/src/lib/__tests__/pdfUtils.test.js:107-109`

Test documents that title-cleaning regex only works for prefixes, not mid-title occurrences.

#### LOW: Incomplete Contact Page FAQ

**Location:** `packages/landing/src/routes/contact.jsx:111`

```jsx
{
  /* TODO FAQ */
}
```

#### LOW: Multiple Commented-Out Features

- Service worker registration (disabled)
- CSV import feature (incomplete)
- PDF redaction commands (disabled)
- Sidebar recents feature (disabled)

### Console Logging

564+ console statements found across the codebase. Most are appropriate for development but should be reviewed for production:

- Convert security-relevant logs to structured logging
- Remove debug logging from authentication flows

---

## Data Safety Findings

### Write Paths and Destructive Operations

| Operation        | Type        | Protection           | Risk                              |
| ---------------- | ----------- | -------------------- | --------------------------------- |
| User deletion    | HARD DELETE | Auth + Confirmation  | Permanent data loss               |
| Project deletion | HARD DELETE | Owner only + cascade | Project + members + files deleted |
| Member removal   | HARD DELETE | Owner only           | Member access removed             |
| PDF deletion     | HARD DELETE | Project member       | File and metadata deleted         |
| Account deletion | HARD DELETE | Self + Confirmation  | All user data permanently lost    |

### Cascade Delete Behavior

- `organization` delete cascades to: `member`, `invitation`, `projects`, `mediaFiles`, `orgAccessGrants`, `projectInvitations`
- `projects` delete cascades to: `projectMembers`, `mediaFiles`, `projectInvitations`
- `user` delete cascades to: `member`, `session`, `account`, `projectMembers`, `twoFactor`, `invitation`, `projectInvitations`

### Critical Findings

| Finding                  | Severity | Description                                         |
| ------------------------ | -------- | --------------------------------------------------- |
| No soft deletes          | CRITICAL | All deletions are permanent with no recovery path   |
| No D1 rollback procedure | HIGH     | D1 Time Travel exists but no documented procedure   |
| No migration directory   | HIGH     | Migrations appear to be run manually via DrizzleKit |
| R2 orphans on D1 failure | MEDIUM   | No cleanup job for orphaned files                   |

### Backup/Recovery Status

| Store           | Backup Strategy         | Recovery Capability                    |
| --------------- | ----------------------- | -------------------------------------- |
| D1              | Time Travel (automatic) | Available but procedure not documented |
| R2              | None documented         | Manual only                            |
| Durable Objects | State persisted         | No backup mechanism                    |

---

## Security Findings

### Authentication Audit

**No Critical Vulnerabilities Found**

#### HIGH: Sensitive URLs Logged to Console

**Files:** Multiple in `packages/workers/src/auth/`

Magic link URLs, password reset URLs, and verification URLs logged to console:

```typescript
console.log('[Auth] Queuing magic link email to:', email, 'URL:', url);
```

**Impact:** Account takeover via intercepted tokens if logs are accessible.

#### MEDIUM: Rate Limiting Only Active in Production

**Location:** `packages/workers/src/middleware/rateLimit.ts:51-55`

```typescript
if (c.env?.ENVIRONMENT !== 'production') {
  await next();
  return;
}
```

**Impact:** Staging environments can be brute-forced.

#### MEDIUM: In-Memory Rate Limiting Not Distributed

**Location:** `packages/workers/src/middleware/rateLimit.ts:8`

Rate limiting uses in-memory Map not shared across Workers isolates.

**Impact:** Attackers can bypass by distributing requests.

#### MEDIUM: Cookie Cache May Delay Session Revocation

**Location:** `packages/workers/src/auth/config.ts:485-488`

5-minute session cache means revoked sessions remain valid briefly.

#### MEDIUM: Stack Trace Exposure in Non-Production

**Location:** `packages/workers/src/middleware/errorHandler.ts:83-89`

Stack traces exposed if ENVIRONMENT is not set to "production".

#### MEDIUM: Missing Rate Limiting on Magic Link Endpoint

**Location:** `packages/workers/src/auth/routes.ts`

Magic link send endpoint not rate limited. Email bombing possible.

#### LOW: ORCID Email Fallback Creates Synthetic Emails

**Location:** `packages/workers/src/auth/config.ts:138-140`

When ORCID doesn't provide email, synthetic email created: `${profile.sub}@orcid.org`

#### LOW: Admin Impersonation Audit Trail Limited

No explicit audit logging for impersonation start/stop events.

#### LOW: Password Minimum Length Could Be Stronger

8 characters minimum. Consider 10-12.

### Authorization Audit

**No Critical Vulnerabilities Found**

#### MEDIUM: Billing Endpoint Authorization Relies on Active Session Org

**Location:** `packages/workers/src/routes/billing/subscription.ts`

Billing endpoints don't enforce org membership through middleware. Rely on session's active organization which could be stale.

#### MEDIUM: No CSRF Protection on Billing Subscription Routes

Billing routes only apply `requireAuth` but not `requireTrustedOrigin`.

#### MEDIUM: Member ID vs User ID Confusion

**Location:** `packages/workers/src/routes/orgs/index.ts:838-904`

Route parameter `memberId` compared directly against `authUser.id` (user ID). Logic error, though UUID collision unlikely.

#### LOW: Dev Routes Only Protected by DEV_MODE Flag

**Location:** `packages/workers/src/routes/orgs/dev-routes.ts:24-29`

If DEV_MODE accidentally enabled in production, project members could manipulate Y.js state.

#### LOW: Invitation Token in URL Query Parameter

Tokens in URLs appear in logs, browser history, referrer headers.

### Authorization Matrix

| Resource                                    | Auth | Org Member | Project Member | Admin | Owner |
| ------------------------------------------- | ---- | ---------- | -------------- | ----- | ----- |
| GET /api/orgs                               | Yes  | -          | -              | No    | No    |
| GET /api/orgs/:orgId                        | Yes  | Yes        | -              | No    | No    |
| DELETE /api/orgs/:orgId                     | Yes  | Owner      | -              | No    | Yes   |
| GET /api/orgs/:orgId/projects/:projectId    | Yes  | Yes        | Yes            | No    | No    |
| DELETE /api/orgs/:orgId/projects/:projectId | Yes  | Yes        | Owner          | No    | Yes   |
| GET /api/billing/subscription               | Yes  | \*         | -              | No    | No    |
| GET /api/admin/\*                           | Yes  | -          | -              | Yes   | No    |
| WS /api/project-doc/:projectId              | Yes  | -          | Yes            | No    | No    |

\*Billing endpoints rely on session's active org without explicit membership verification

### Input Validation Audit

**No Critical Vulnerabilities Found**

#### MEDIUM: SSRF Protection Missing DNS Rebinding Defense

**Location:** `packages/workers/src/lib/ssrf-protection.ts:140-190`

Validates hostnames but doesn't verify resolved IP addresses. DNS rebinding attack possible.

#### MEDIUM: PDF Proxy URL Input Not Validated with Zod

**Location:** `packages/workers/src/index.ts:167-174`

URL accepted from request body without Zod schema validation.

#### MEDIUM: Google Drive File ID Not Validated for Format

**Location:** `packages/workers/src/routes/google-drive.ts:331-333`

Only validates non-empty string, not Google Drive ID format.

#### LOW: IPv6 Addresses Blocked but Not Comprehensively

**Location:** `packages/workers/src/lib/ssrf-protection.ts:177-179`

Only blocks bracket notation `[::1]`. Other IPv6 representations may bypass.

### Positive Security Findings

1. **Proper CSRF Protection** - Admin routes use `requireTrustedOrigin`
2. **Session Management** - Proper expiry, revocation, IP/user-agent tracking
3. **Password Hashing** - Better Auth uses secure bcrypt
4. **2FA Implementation** - TOTP with 10 backup codes
5. **OAuth Security** - Secure state parameter handling
6. **Security Headers** - HSTS, X-Frame-Options, CSP configured
7. **Email Verification** - Required for email/password signup
8. **Impersonation Safeguards** - Cannot impersonate self, 1-hour limit
9. **Ban Implementation** - Properly invalidates all sessions
10. **Webhook Security** - Two-phase trust model, signature verification
11. **SSRF Protection** - Domain allowlist, private IP blocking
12. **Input Validation** - Consistent Zod usage throughout

### Secrets Audit

**No hardcoded secrets found.** All sensitive values loaded from environment variables.

---

## Performance Findings

### Positive Findings

- Proper pagination limits (DEFAULT_PAGE_SIZE: 50, MAX_PAGE_SIZE: 100)
- File size limits enforced (PDF: 50MB, Avatar: 2MB)
- R2 list operations batched (1000 items)
- Database queries mostly use `.limit()` appropriately

### Areas of Concern

| Finding                              | Severity | Description                                                   |
| ------------------------------------ | -------- | ------------------------------------------------------------- |
| No timeout on external fetches       | MEDIUM   | PDF proxy, Google Drive, avatar copy have no explicit timeout |
| Y.js state persistence not debounced | MEDIUM   | Every keystroke triggers full state write                     |
| In-memory rate limiting              | LOW      | Not shared across isolates                                    |
| Admin queries without limits         | LOW      | Some fetch all records (acceptable for admin)                 |

Given low traffic expectation (<100 MAU), these are acceptable risks for launch.

---

## Observability Findings

### Positive Findings

| Capability          | Status | Location                                           |
| ------------------- | ------ | -------------------------------------------------- |
| Health endpoints    | YES    | `/health`, `/health/live`, `/healthz`              |
| Dependency checks   | YES    | D1, R2, Durable Objects verified                   |
| Structured logging  | YES    | `packages/workers/src/lib/observability/logger.ts` |
| Request ID tracking | YES    | X-Request-Id header propagated                     |
| Webhook audit trail | YES    | `stripeEventLedger` table                          |

### Gaps Identified

| Gap                    | Severity | Description                                     |
| ---------------------- | -------- | ----------------------------------------------- |
| No error monitoring    | HIGH     | Sentry integration commented out in frontend    |
| No alerting            | MEDIUM   | No documentation for setting up alerts          |
| Console-only logging   | MEDIUM   | Backend logs to console only, no aggregation    |
| No metrics collection  | LOW      | No business metrics or KPIs tracked             |
| Mixed logging patterns | LOW      | Some code uses console.log vs structured logger |

---

## Operational Readiness Findings

### Deployment Assessment

| Attribute     | Value                                               |
| ------------- | --------------------------------------------------- |
| Process       | Semi-manual (CLI-based)                             |
| Duration      | Unknown (not documented)                            |
| Rollback Time | Unknown (no documented procedure)                   |
| Manual Steps  | Multiple (secret setup, migration, deploy commands) |
| Risk Level    | HIGH                                                |

### Current Deployment Process

```bash
# From package.json
pnpm deploy  # runs deploy:workers && deploy:landing
```

Deployment via `wrangler deploy --env production`. No CI/CD pipeline.

### CI/CD Status

| Area                | Status                           |
| ------------------- | -------------------------------- |
| Deployment Pipeline | MISSING                          |
| Build Pipeline      | MISSING                          |
| Test Pipeline       | MISSING                          |
| Prettier Check      | Present (non-main branches only) |

### Environment Configuration

| Environment | Status                  |
| ----------- | ----------------------- |
| Development | Local `.env` files      |
| Staging     | DOES NOT EXIST          |
| Production  | Wrangler vars + secrets |

### Migration Safety

| Aspect              | Status               |
| ------------------- | -------------------- |
| Reversible          | NO                   |
| Idempotent          | Partial (DrizzleKit) |
| Tested procedure    | NO                   |
| Rollback documented | NO                   |

**Critical:** `reset-db-prod.mjs` script is destructive - drops ALL tables and data.

### Rollback Capability

| Capability           | Status                                  |
| -------------------- | --------------------------------------- |
| Code rollback        | Manual via `wrangler versions rollback` |
| Database rollback    | NONE                                    |
| Documented procedure | NO                                      |

### Operational Kill Switches

| Kill Switch      | Status              |
| ---------------- | ------------------- |
| Feature flags    | NONE                |
| Maintenance mode | NONE                |
| Rate limiting    | Present (per-route) |
| User blocking    | Partial (ban field) |

### Documentation Status

| Document          | Status                   |
| ----------------- | ------------------------ |
| README            | Basic setup only         |
| CONTRIBUTING.md   | Development workflow     |
| Deployment guide  | MISSING                  |
| Runbooks          | MISSING                  |
| Incident response | MISSING                  |
| Architecture docs | Present (packages/docs/) |

### Failure Scenarios

| Scenario          | Current Handling                         | Gap                     |
| ----------------- | ---------------------------------------- | ----------------------- |
| Bad deploy        | No documented rollback                   | No tested procedure     |
| Failed migration  | Only `reset-db-prod.mjs` (destroys data) | No incremental rollback |
| Stripe down       | Users cannot purchase                    | No graceful degradation |
| Traffic spike     | Workers auto-scale                       | Adequate                |
| Security incident | No procedure                             | No playbook             |

---

## Verdict and Remediation Plan

### Final Verdict: NOT READY

The application has solid code architecture and security fundamentals, but critical gaps in data protection and operational infrastructure prevent a safe production launch with real user data and payments.

### Stop-Ship Issues (Must Fix Before Launch)

| ID   | Issue                                | Risk                | Location                  | Effort    |
| ---- | ------------------------------------ | ------------------- | ------------------------- | --------- |
| SS-1 | No documented D1 rollback procedure  | Data Loss (ops)     | Documentation             | 1-2 hours |
| SS-2 | Hard deletes without soft delete     | Data Loss           | `db/schema.ts`            | 4-8 hours |
| SS-3 | D1/DO sync failures silently ignored | Data Integrity      | `commands/members/*.ts`   | 4-8 hours |
| SS-4 | Missing error monitoring             | Undetected Failures | `lib/errorLogger.js`      | 2-4 hours |
| SS-5 | Quota race condition                 | Payment Integrity   | `lib/quotaTransaction.ts` | 4-8 hours |

### Fix Soon Issues (First Week After Launch)

| ID   | Issue                                   | Location                  | Effort    |
| ---- | --------------------------------------- | ------------------------- | --------- |
| FS-1 | Rate limiting not distributed           | `middleware/rateLimit.ts` | 4-8 hours |
| FS-2 | 5-minute session cache delay            | `auth/config.ts`          | 1 hour    |
| FS-3 | Sensitive URLs logged                   | `auth/` directory         | 1 hour    |
| FS-4 | No staging environment                  | `wrangler.jsonc`          | 4-8 hours |
| FS-5 | Missing magic link rate limit           | `auth/routes.ts`          | 1 hour    |
| FS-6 | Billing endpoints lack org verification | `billing/subscription.ts` | 2 hours   |
| FS-7 | Orphaned R2 files on failures           | Multiple                  | 4-8 hours |
| FS-8 | Y.js state persistence not debounced    | `ProjectDoc.ts`           | 2-4 hours |

### Acceptable Risk (Document and Proceed)

| ID   | Issue                          | Rationale                                   |
| ---- | ------------------------------ | ------------------------------------------- |
| AR-1 | No external fetch timeouts     | Workers 30-second limit provides protection |
| AR-2 | In-memory rate limiting resets | Acceptable for beta traffic                 |
| AR-3 | No feature flags               | Acceptable for beta; implement before GA    |
| AR-4 | Console-only logging           | Cloudflare dashboard provides access        |
| AR-5 | Missing CI/CD pipeline         | Acceptable for single-operator beta         |

### Recommended Launch Sequence

1. **Fix stop-ship issues** (estimated 2-3 days)
   - Enable Sentry error monitoring (SS-4) - quickest win
   - Document D1 backup procedure (SS-1)
   - Add soft delete to projects/mediaFiles (SS-2)
   - Add retry/compensation for DO sync failures (SS-3)
   - Fix quota race condition with database constraints (SS-5)

2. **Test deployment with rollback verification**

3. **Launch to invited beta users**

4. **Address fix-soon items during first week**

5. **Plan GA launch after operational improvements**

### Files Requiring Immediate Attention

| File                                                    | Issue                  |
| ------------------------------------------------------- | ---------------------- |
| `packages/workers/src/lib/quotaTransaction.ts`          | Race condition         |
| `packages/workers/src/commands/members/addMember.ts`    | Silent sync failure    |
| `packages/workers/src/commands/members/removeMember.ts` | Silent sync failure    |
| `packages/web/src/lib/errorLogger.js`                   | Enable Sentry          |
| `packages/workers/src/db/schema.ts`                     | Add soft delete fields |

---

## Architecture Highlights (Positive)

The audit identified several well-implemented patterns:

1. **Clean separation of concerns** - Org membership separate from project membership
2. **WebSocket auth verifies against D1** - Not trusting Y.js state for authorization
3. **Two-phase webhook trust model** - Stripe events logged before/after verification
4. **Last owner protection** - Cannot orphan projects or orgs
5. **Structured logging infrastructure** - Request IDs, correlation, JSON format
6. **Health check endpoints** - Verify D1, R2, Durable Objects
7. **SSRF protection** - Academic publisher allowlist, private IP blocking
8. **Quota system** - Plan-based limits with entitlement checks
9. **Domain error system** - Typed errors with consistent handling
10. **Multi-layer authorization** - Middleware chain with role checks

---

_Report generated by Claude Code Production Audit_
_Full audit completed in 9 phases across architecture, code health, data safety, security, performance, observability, and operations._
