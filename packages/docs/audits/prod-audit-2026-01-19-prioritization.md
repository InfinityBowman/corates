# Production Readiness - Prioritized Remediation Plan

Based on the audit findings, here's a prioritized approach balancing **ease of implementation** and **impact**.

---

## Priority Matrix

| Priority | Criteria |
|----------|----------|
| P0 - Do First | High impact, low effort (quick wins) |
| P1 - Do Next | High impact, moderate effort |
| P2 - Schedule | Moderate impact, higher effort |
| P3 - Backlog | Lower urgency, can wait for post-launch |

---

## P0: Quick Wins (Do First)

These provide significant risk reduction with minimal time investment. Complete these in a single day.

### 1. Document D1 Rollback Procedure (SS-1)

**Effort:** 1-2 hours | **Impact:** HIGH

**Why first:** Zero code changes required. You already have the capability - you just need to document it. Reduces operational risk immediately.

**What to do:**
- Create a runbook in `packages/docs/guides/` documenting:
  - How to use `wrangler d1 time-travel` commands
  - When to use restore vs export
  - Recovery scenarios (accidental deletion, bad migration, etc.)
- Test the procedure once in development to verify it works

**Example runbook outline:**
```markdown
# D1 Database Recovery

## Point-in-Time Recovery
wrangler d1 time-travel restore <database-name> --timestamp <ISO-timestamp>

## Export Before Risky Operations
wrangler d1 export <database-name> --output backup.sql

## Common Scenarios
- Accidental project deletion: [steps]
- Bad migration rollback: [steps]
```

---

### 2. Enable Sentry Error Monitoring (SS-4)

**Effort:** 2-4 hours | **Impact:** CRITICAL

**Why early:** Without this, you're flying blind. Production errors go undetected. This is the single most important observability fix.

**What to do:**
- Sign up for Sentry (free tier is sufficient for beta)
- Uncomment and configure the Sentry integration in `packages/web/src/lib/errorLogger.js`
- Add Sentry DSN to environment variables
- Test that errors are captured

**The code structure already exists** - you just need to enable it:
```javascript
// packages/web/src/lib/errorLogger.js:72-94
// Uncomment and configure this block
```

---

### 3. Rate Limit Magic Link Endpoint (FS-5)

**Effort:** 30 minutes | **Impact:** MEDIUM

**Why now:** Trivial fix, prevents email bombing abuse.

**What to do:**
Add one line to `packages/workers/src/auth/routes.ts`:
```typescript
auth.use('/magic-link/*', authRateLimit);
```

---

### 4. Remove Sensitive URL Logging (FS-3)

**Effort:** 1 hour | **Impact:** MEDIUM

**Why now:** Simple find-and-remove. Prevents token leakage in logs.

**What to do:**
- Search for `console.log` in `packages/workers/src/auth/`
- Remove or mask URLs containing tokens
- Files: `config.ts`, `email.ts`, `routes.ts`

---

### 5. Reduce Session Cache TTL (FS-2)

**Effort:** 15 minutes | **Impact:** LOW-MEDIUM

**Why now:** Single config change, improves security.

**What to do:**
In `packages/workers/src/auth/config.ts:485-488`, change:
```typescript
cookieCache: {
  enabled: true,
  maxAge: 60 * 2, // Reduce from 5 minutes to 2 minutes
}
```

---

## P1: Important Fixes (Do Next)

These require more effort but address significant risks. Complete within the first week.

### 6. Add Soft Delete to Projects and MediaFiles (SS-2)

**Effort:** 4-8 hours | **Impact:** CRITICAL

**Why important:** Accidental deletions are permanent. With real user research data, this is unacceptable.

**What to do:**

1. Add `deletedAt` column to schema:
```typescript
// packages/workers/src/db/schema.ts
deletedAt: integer('deletedAt', { mode: 'timestamp' }),
```

2. Generate migration with DrizzleKit

3. Update delete operations to set `deletedAt` instead of hard delete:
```typescript
// Instead of: await db.delete(projects).where(...)
await db.update(projects).set({ deletedAt: new Date() }).where(...)
```

4. Add `.where(isNull(deletedAt))` to all project/media queries

5. Create admin endpoint for permanent deletion (for GDPR compliance)

**Start with projects table** - it's the most important. MediaFiles can follow.

---

### 7. Fix D1/DO Sync Failures (SS-3)

**Effort:** 4-8 hours | **Impact:** HIGH

**Why important:** Users added to projects may not be able to collaborate. Removed users may retain access temporarily.

**What to do:**

Option A (Simpler - Retry with logging):
```typescript
// packages/workers/src/commands/members/addMember.ts
const MAX_RETRIES = 3;
let syncSuccess = false;

for (let i = 0; i < MAX_RETRIES && !syncSuccess; i++) {
  try {
    await syncMemberToDO(env, projectId, 'add', { ... });
    syncSuccess = true;
  } catch (err) {
    console.error(`DO sync attempt ${i + 1} failed:`, err);
    if (i === MAX_RETRIES - 1) {
      // Log to error monitoring, but don't fail the operation
      // User can be synced on next connection
    }
  }
}
```

Option B (More robust - Compensation):
- If DO sync fails, roll back the D1 insert
- Return error to user asking them to retry

**Recommendation:** Start with Option A for `addMember`. For `removeMember`, the existing behavior (user loses access on next reconnect) is acceptable for beta.

---

### 8. Add Org Membership Check to Billing Routes (FS-6)

**Effort:** 2 hours | **Impact:** MEDIUM

**Why important:** Billing info could be visible to removed org members.

**What to do:**
Add middleware to `packages/workers/src/routes/billing/subscription.ts`:
```typescript
import { requireOrgMembership } from '@/middleware/requireOrg';

subscriptionRoutes.use('*', requireOrgMembership());
```

---

## P2: Schedule for Post-Launch

These are important but can wait until after initial beta feedback.

### 9. Fix Quota Race Condition (SS-5)

**Effort:** 4-8 hours | **Impact:** MEDIUM (at low traffic)

**Why can wait:** At <100 MAU, the race window is tiny. The risk of concurrent quota-exceeding requests is low.

**What to do (when ready):**
```typescript
// Use unique constraint + INSERT OR IGNORE pattern
// Or implement optimistic locking with version field
```

**Workaround for now:** Monitor quota usage manually. At low traffic, violations are rare and can be handled as support tickets.

---

### 10. Implement Distributed Rate Limiting (FS-1)

**Effort:** 4-8 hours | **Impact:** LOW (at low traffic)

**Why can wait:** In-memory rate limiting works fine at low traffic. Attackers would need to know about the bypass.

**What to do (when ready):**
- Use Cloudflare KV or Durable Objects for rate limit state
- Or use Cloudflare's native Rate Limiting product

---

### 11. Add Y.js State Persistence Debouncing (FS-8)

**Effort:** 2-4 hours | **Impact:** LOW (at low traffic)

**Why can wait:** Performance issue only matters under heavy collaboration load. With <100 MAU, unlikely to be a problem.

**What to do (when ready):**
```typescript
// Debounce the persistence call
let persistTimeout: number | null = null;

this.doc.on('update', () => {
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(async () => {
    const fullState = Y.encodeStateAsUpdate(this.doc!);
    await this.state.storage.put('yjs-state', Array.from(fullState));
  }, 200); // 200ms debounce
});
```

---

### 12. Orphaned R2 File Cleanup (FS-7)

**Effort:** 4-8 hours | **Impact:** LOW

**Why can wait:** Storage costs are minimal. Orphaned files don't affect functionality.

**What to do (when ready):**
- Create scheduled job that:
  1. Lists all R2 keys
  2. Queries mediaFiles for matching bucketKeys
  3. Deletes R2 objects not in database

---

## P3: Backlog (Post-GA)

### 13. Staging Environment (FS-4)

**Effort:** 4-8 hours

**Why backlog:** As a single operator, you can test in dev. Staging becomes important when team grows or before major releases.

### 14. CI/CD Pipeline

**Effort:** 8-16 hours

**Why backlog:** Manual deploys are fine for beta. Automate when deployment frequency increases.

---

## Recommended Execution Order

### Day 1 (4-6 hours)

| Order | Task | Time |
|-------|------|------|
| 1 | Document D1 rollback procedure | 1-2 hrs |
| 2 | Enable Sentry | 2-3 hrs |
| 3 | Rate limit magic link | 30 min |
| 4 | Remove sensitive URL logging | 1 hr |
| 5 | Reduce session cache TTL | 15 min |

**Outcome:** Major observability and operational gaps closed. Ready for careful beta launch.

### Days 2-3 (8-12 hours)

| Order | Task | Time |
|-------|------|------|
| 6 | Soft delete for projects | 4-6 hrs |
| 7 | D1/DO sync retry logic | 3-4 hrs |
| 8 | Billing org membership check | 2 hrs |

**Outcome:** Data protection improved. Core stop-ship issues resolved.

### Week 1 Post-Launch

| Task | Time |
|------|------|
| Soft delete for mediaFiles | 2-3 hrs |
| Monitor for quota issues | Ongoing |
| Gather user feedback | Ongoing |

### Week 2+ (As Needed)

- Fix quota race condition if observed
- Distributed rate limiting if abuse detected
- Y.js debouncing if performance issues reported

---

## Summary

**Bottom line:** You can get to a launchable state in 2-3 focused days:

1. **Day 1:** Quick wins (documentation, Sentry, small fixes)
2. **Days 2-3:** Soft delete and sync improvements

The quota race condition (SS-5) is technically a stop-ship issue, but at your traffic level the practical risk is very low. You can ship with it and fix it in the first week if you're comfortable with that tradeoff.

**Minimum viable launch checklist:**
- [ ] D1 rollback procedure documented
- [ ] Sentry enabled and tested
- [ ] Magic link rate limited
- [ ] Sensitive URLs removed from logs
- [ ] Soft delete on projects table

Everything else improves the situation but isn't strictly required for an invited beta with <100 users.
