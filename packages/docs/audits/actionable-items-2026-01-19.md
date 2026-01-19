# Actionable Items from Codebase Analysis

**Date:** 2026-01-19
**Source:** Consolidated from Architecture, Security, Error Handling, and Local-First analyses
**Status:** Filtered to remove non-issues and low-value items

---

## High Priority - Should Fix Before Production

| Item                                  | Source         | Description                                                                                                             | Effort  |
| ------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- | ------- |
| **Verify admin role assignment**      | Security       | Confirm roles can only be set server-side, not via any user-facing API                                                  | 1-2 hrs |
| **Add email header sanitization**     | Security       | Use existing `sanitizeEmailSubject()` in contact form to prevent header injection                                       | 30 min  |
| **Enable Sentry integration**         | Error Handling | Uncomment prepared integration in `errorLogger.js`                                                                      | 1-2 hrs |
| **Fix silent error suppression**      | Error Handling | Replace `.catch(() => {})` and `.catch(console.warn)` patterns (~17 occurrences) with `bestEffort()` or proper handling | 2-3 hrs |
| **Investigate service worker status** | Local-First    | Verify why service workers are actively unregistered - intentional or bug?                                              | 1 hr    |

---

## Medium Priority - Improve Quality

| Item                                    | Source       | Description                                                              | Effort   |
| --------------------------------------- | ------------ | ------------------------------------------------------------------------ | -------- |
| **Complete command pattern migration**  | Architecture | Extract remaining inline business logic from routes to command functions | 8-16 hrs |
| **Add PDF cache eviction**              | Local-First  | Implement LRU eviction with ~100MB limit to prevent quota issues         | 3-4 hrs  |
| **IndexedDB quota management**          | Local-First  | Handle `QuotaExceededError` gracefully with user prompt                  | 6-8 hrs  |
| **Implement distributed rate limiting** | Security     | Replace in-memory Map with Durable Objects for production rate limiting  | 4-6 hrs  |

---

## Low Priority - Nice to Have

| Item                              | Source       | Description                                                        | Effort    |
| --------------------------------- | ------------ | ------------------------------------------------------------------ | --------- |
| **Add sync status indicators**    | Local-First  | Show "Syncing..." / "Last synced X ago" on project cards           | 2-3 hrs   |
| **Extract ProjectDoc.ts modules** | Architecture | Split 800-line file into websocket-manager, yjs-sync-handler, etc. | 16-24 hrs |
| **Add awareness indicators**      | Local-First  | Show avatars of users viewing same checklist                       | 6-8 hrs   |

---

## Quick Wins (< 1 hour each)

1. **Email sanitization** - Already have the function, just call it
2. **Verify admin roles** - Code review, not code change
3. **Service worker investigation** - Check git history for why it was disabled

---

## Recommended Order

1. Quick wins (email sanitization, verify admin roles)
2. Enable Sentry (gives visibility into production issues)
3. Fix silent error suppression (prevents hidden failures)
4. Investigate service worker
5. Then tackle medium priority items as time permits

---

## Items Confirmed as Non-Issues

The following items from the original audits were identified as non-issues or over-engineering:

### Security

- **HSTS in development** - Cloudflare enforces HTTPS at edge for production
- **Raw SQL in migration check** - Hardcoded SQL with no user input, zero injection risk
- **Webhook timing attacks** - Stripe SDK handles this correctly
- **WebSocket security headers** - Origin validation exists in WebSocket handler
- **7-day session expiry** - Industry standard with daily renewal
- **X-Frame-Options DENY** - Secure default, no legitimate iframe usage

### Architecture

- **Large component files** - Well-organized files don't need splitting just for size
- **EmbedPDF dependency size** - Expected for a PDF-heavy research tool
- **Middleware execution order** - Documentation is sufficient
- **Split useProject primitive** - Tree-shaking handles unused exports

### Error Handling

- **Circuit breaker** - No external API dependencies that need this
- **Error rate limiting** - Could mask real issues
- **Correlation IDs** - Cloudflare has built-in request tracing
- **Error boundaries everywhere** - Having them at key routes is sufficient
- **Only 9 throw statements** - Shows good use of structured domain errors
- **DB deadlock handling** - D1/SQLite doesn't have deadlocks

### Local-First

- **Optimistic updates** - Yjs sync is already fast (~10-50ms)
- **Auth cache in IndexedDB** - localStorage rarely hits limits
- **Skip retries when offline** - Only saves ~14s delay
- **P2P sync** - Not needed for server-based architecture
- **Rich conflict resolution UI** - CRDTs handle conflicts automatically

### Already Implemented

- **Offline indicator** - Already in navbar

---

## Reference

Full analysis reports available in:

- `packages/docs/audits/architecture-analysis.md`
- `packages/docs/audits/security-analysis.md`
- `packages/docs/audits/error-handling-analysis.md`
- `packages/docs/audits/local-first-analysis.md`
