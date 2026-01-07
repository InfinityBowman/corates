---
title: Migration Strategy & Sequencing Plan
date: 2026-01-07
author: Team
---

## Executive Summary

**Recommendation: Execute all three migrations in a specific sequence**

**Total Effort**: 25-35 hours over 2-3 weeks
**Risk Level**: Low (each is independent or loosely coupled)
**Value**: High (improves architecture, testing, and scalability)

### Quick Recommendation

| Phase        | Migration        | Duration    | Priority          | Dependencies                   |
| ------------ | ---------------- | ----------- | ----------------- | ------------------------------ |
| **Week 1**   | Codecov          | 1.5 hours   | P0 (Quick Win)    | None                           |
| **Week 1-2** | Zod OpenAPI Hono | 15-20 hours | P1 (High Value)   | None                           |
| **Week 2-3** | Single Domain    | 5-7 hours   | P2 (Architecture) | Zod OpenAPI Hono (recommended) |
| **Week 3+**  | Dexie + y-dexie  | 3-5 days    | P3 (Optimization) | All above                      |

---

## Migration Sequencing Analysis

### Dependency Graph

```
Codecov
  ├─ No dependencies
  ├─ Enables: Coverage tracking for all future work
  └─ Blocks: Nothing

Zod OpenAPI Hono
  ├─ No hard dependencies
  ├─ Optional prerequisite for: Single Domain (cleaner routing)
  ├─ Improves: Single domain consolidation (already structured API routes)
  └─ Blocks: Nothing

Single Domain Consolidation
  ├─ Optional: Works without Zod OpenAPI Hono, but better if done first
  ├─ Depends on: Having API routes (Hono-based or any other)
  ├─ Enables: Cleaner auth, simpler architecture
  └─ Blocks: Nothing (optional optimization)

Dexie + y-dexie
  ├─ No hard dependencies on above three
  ├─ Works independently: Frontend storage optimization
  ├─ Benefits from: Single domain (simpler API calls with /api)
  └─ Blocks: Nothing
```

### Option A: Recommended Sequence (Logical Order)

```
Week 1: Codecov (1.5 hrs)
   ↓
Week 1-2: Zod OpenAPI Hono (15-20 hrs)
   ↓
Week 2-3: Single Domain (5-7 hrs) [API routes already using Zod]
   ↓
Week 3+: Dexie + y-dexie (3-5 days)
```

**Rationale**:

1. **Codecov first**: Immediate visibility, enables tracking of coverage during other migrations
2. **Zod OpenAPI Hono second**: Refactors API to be more structured (beneficial for domain consolidation)
3. **Single Domain third**: Consolidates the now-clean Zod-based routes, merges workers
4. **Dexie last**: Frontend storage, works best after API is finalized

**Total Timeline**: 2-3 weeks
**Parallelization**: Could run Zod OpenAPI + Single Domain in parallel, but not recommended (routing changes overlap)

### Option B: Fastest Path (Parallel Where Possible)

```
Week 1: Codecov (1.5 hrs)
Week 1-2: Single Domain (5-7 hrs) [with plain Hono routes]
        + Dexie Planning (read-only)
Week 2-3: Zod OpenAPI Hono (15-20 hrs) [now in merged worker]
Week 3+: Dexie + y-dexie (3-5 days)
```

**Pros**: Single Domain done earlier, Codecov + Single Domain run semi-parallel
**Cons**: Zod OpenAPI migration is bigger (whole merged worker), less clean separation

### Option C: Independent Path (Staggered)

```
Week 1: Codecov (1.5 hrs)
Week 1-2: Zod OpenAPI Hono (15-20 hrs) [workers package stays separate]
Week 3-4: Dexie + y-dexie (3-5 days) [frontend optimization]
Later: Single Domain (5-7 hrs) [if desired as final optimization]
```

**Pros**: No blocking dependencies, can stop at any point, Dexie doesn't wait
**Cons**: Single Domain happens later, less cohesive overall improvement

---

## Recommended Sequence: Option A

### Phase 1: Codecov (Week 1, 1.5 hours)

**Why First?**

- Smallest effort, immediate ROI
- Enables coverage tracking for all subsequent migrations
- Provides visibility into test quality
- Motivates testing during refactors

**During Zod/Domain/Dexie work**: Coverage metrics help validate changes don't break tests

**Actions**:

1. Configure Vitest coverage in web + workers packages
2. Add GitHub Actions workflow with codecov action
3. Set coverage thresholds (70% lines, 65% branches)
4. Add codecov badge to README

**Outcome**: Coverage visible on all PRs, trend data starts accruing

---

### Phase 2: Zod OpenAPI Hono (Week 1-2, 15-20 hours)

**Why Second?**

- Refactors API structure before domain consolidation
- Consolidation is simpler with structured routes
- Improves type safety across the board
- Easier to test with Codecov in place

**Dependency**: None (Codecov is optional but helpful)

**Blocks**: None (but makes Single Domain easier)

**Actions**:

1. Install `@hono/zod-openapi` in workers package
2. Create schemas for all endpoints (auth, projects, checklists, etc.)
3. Migrate routes incrementally (auth → projects → checklists → reconciliation → pdf)
4. Update error handling hook for consistency
5. Test each route group
6. Generate OpenAPI docs at `/doc`
7. Remove manual `api-docs.yaml` and `openapi.json`

**Effort Breakdown**:

- Setup: 1-2 hours
- Auth routes: 2-3 hours
- CRUD routes: 4-6 hours
- Sync/Reconciliation routes: 4-6 hours
- PDF/Utility routes: 2-3 hours
- Testing & validation: 3-4 hours

**Outcome**: Type-safe, documented API; routes ready for consolidation

---

### Phase 3: Single Domain (Week 2-3, 5-7 hours)

**Why Third?**

- Zod OpenAPI routes are clean, well-structured
- Moving structured routes is simpler than raw Hono
- Builds on improved type safety
- Simplified structure easier to test

**Dependency**: Ideally Zod OpenAPI Hono (but not hard requirement)

**Actions**:

1. Move `packages/workers/src` routes to `packages/landing/api/` (1-2 hours)
2. Update landing `wrangler.jsonc` with Durable Objects config
3. Consolidate routing logic in landing worker (1-2 hours)
4. Update `VITE_API_URL` to `/api` (30 min)
5. Remove CORS middleware, simplify auth cookies (1 hour)
6. Consolidate CI/CD workflows (1-2 hours)
7. Test all endpoints, auth flow (1-2 hours)

**Outcome**: Single deployment, simpler architecture, better security

---

### Phase 4: Dexie + y-dexie (Week 3+, 3-5 days)

**Why Last?**

- Frontend storage, independent of API architecture
- Benefits from simpler API calls with `/api` (single domain)
- Can be parallelized with other work after Phase 3
- Largest effort, good to tackle when infrastructure is stable

**Dependency**: Single Domain makes `/api` calls simpler, but not required

**Actions**:

1. Install `dexie` and `y-dexie` (30 min)
2. Create unified database schema for projects, checklists, pdfs, ops (2 hours)
3. Migrate `useProject` from y-indexeddb to y-dexie (3-4 hours)
4. Create operation queue using unified database (2-3 hours)
5. Migrate PDF cache to unified database (2-3 hours)
6. Data migration script for existing users (2-3 hours)
7. Testing & validation (2-3 hours)
8. Remove y-indexeddb dependency (30 min)

**Outcome**: Unified IndexedDB storage, better offline support, reduced database fragmentation

---

## Effort & Timeline Comparison

### Recommended Sequence (Option A)

| Week         | Phase            | Duration             | Cumulative    |
| ------------ | ---------------- | -------------------- | ------------- |
| **Week 1**   | Codecov          | 1.5 hrs              | 1.5 hrs       |
| **Week 1-2** | Zod OpenAPI Hono | 15-20 hrs            | 16.5-21.5 hrs |
| **Week 2-3** | Single Domain    | 5-7 hrs              | 21.5-28.5 hrs |
| **Week 3+**  | Dexie + y-dexie  | 3-5 days (24-40 hrs) | 45.5-68.5 hrs |

**Total**: ~25-35 hours of development + code review (spread over 3 weeks)

### Parallelization Opportunities

**Can run in parallel**:

- Codecov + any other phase (just setup in parallel)
- Zod OpenAPI + Dexie planning (read-only research)
- Single Domain + unrelated bug fixes
- Dexie implementation + other features

**Cannot run in parallel**:

- Zod OpenAPI + Single Domain (both touch routing)
- Single Domain + API structure changes (merge worker)

---

## Risk Assessment

### Per-Migration Risks

| Migration         | Risk   | Mitigation                             | Recommendation            |
| ----------------- | ------ | -------------------------------------- | ------------------------- |
| **Codecov**       | Low    | Zero runtime impact                    | ✅ Safe, do first         |
| **Zod OpenAPI**   | Medium | Incremental migration, test per route  | ✅ Safe, do second        |
| **Single Domain** | Medium | Careful routing order (API before SPA) | ✅ Safe if done after Zod |
| **Dexie**         | Medium | Thorough testing of offline/sync       | ✅ Safe, last             |

### Combined Risk

**Overall Risk: Low**

Each migration:

- Has gradual implementation paths
- Includes testing checkpoints
- Can be rolled back independently
- Doesn't break existing functionality during transition

**Recommendation**: Execute all three in recommended order

---

## Value & Impact Analysis

### Business Impact

| Migration            | Developer Productivity | Code Quality | User Experience | Security |
| -------------------- | ---------------------- | ------------ | --------------- | -------- |
| **Codecov**          | +Low                   | +High        | None            | None     |
| **Zod OpenAPI Hono** | +High                  | +High        | +Medium         | +Medium  |
| **Single Domain**    | +Medium                | +Medium      | +Low            | +High    |
| **Dexie**            | +Low                   | +Medium      | +High           | None     |

### Feature Impact

| Feature                  | Before                    | After                     | Impact |
| ------------------------ | ------------------------- | ------------------------- | ------ |
| **API Documentation**    | Manual YAML               | Auto-generated OpenAPI    | Huge   |
| **Type Safety**          | Partial (Zod only)        | Complete (Zod → Response) | High   |
| **Offline Support**      | Works, fragmented DB      | Unified storage           | Medium |
| **Auth Security**        | SameSite=Lax, CORS        | SameSite=Strict, no CORS  | High   |
| **Developer Experience** | Multiple wrangler configs | Single config             | Medium |
| **Test Visibility**      | Unknown                   | Tracked coverage          | Medium |

### Total Value

**High**: Improves architecture, security, documentation, and DX significantly

---

## Execution Plan

### Pre-Migration Checklist

- [ ] Code review of all three audit documents
- [ ] Team alignment on migration order
- [ ] Create GitHub issues for each phase
- [ ] Assign owners/reviewers
- [ ] Set up Codecov account (free tier)

### Phase 1: Codecov

**Owner**: Any team member
**Duration**: 1.5 hours
**PR Requirements**: None (additive)
**Checklist**:

- [ ] Add coverage config to Vitest
- [ ] Create GitHub Actions workflow
- [ ] Test coverage generation locally
- [ ] Verify codecov action works on PR
- [ ] Add badge to README
- [ ] Document in testing guide

### Phase 2: Zod OpenAPI Hono

**Owner**: Backend specialist
**Duration**: 15-20 hours
**PR Strategy**: Per-route-group PRs (auth, projects, checklists, etc.)
**Checklist**:

- [ ] PR 1: Setup + auth routes
- [ ] PR 2: CRUD routes (projects, users, etc.)
- [ ] PR 3: Sync routes (documents, reconciliation)
- [ ] PR 4: Utility routes (PDF, avatars, etc.)
- [ ] PR 5: Remove manual OpenAPI files
- [ ] Coverage: Should be 100% (validation errors in tests)

### Phase 3: Single Domain

**Owner**: Devops/Full-stack
**Duration**: 5-7 hours
**PR Strategy**: Monolithic (single PR with checklist)
**Checklist**:

- [ ] PR: Move routes, consolidate worker, update CI/CD
- [ ] Test: All endpoints, auth, SPA routing
- [ ] Coverage: No regressions
- [ ] DNS: Update records

### Phase 4: Dexie + y-dexie

**Owner**: Frontend specialist
**Duration**: 3-5 days
**PR Strategy**: Per-component PRs (unified db, useProject, op queue, pdf cache)
**Checklist**:

- [ ] PR 1: Unified database schema
- [ ] PR 2: Migrate useProject to y-dexie
- [ ] PR 3: Operation queue
- [ ] PR 4: PDF cache migration
- [ ] PR 5: Data migration script
- [ ] Coverage: +5-10% (offline scenarios)

---

## Decision Matrix

### Should We Do All Three?

| Question                         | Answer                  | Score   |
| -------------------------------- | ----------------------- | ------- |
| Do they improve the codebase?    | Yes (all three)         | +20     |
| Do they have acceptable risk?    | Yes (low)               | +15     |
| Do we have bandwidth?            | Yes (25-35 hrs)         | +15     |
| Can we sequence safely?          | Yes (clear order)       | +15     |
| Do they align with architecture? | Yes (all complementary) | +15     |
| **Total Score**                  | **+80**                 | **YES** |

### Confidence Level

- **Codecov**: Very High (essential, no risk)
- **Zod OpenAPI Hono**: High (improves API, well-defined scope)
- **Single Domain**: High (simplifies, reduces surface area)
- **Dexie**: High (improves offline, lower priority)

**Recommendation: Execute all four migrations in recommended sequence**

---

## Alternative: Minimum Viable Path

If bandwidth is limited, prioritize:

1. **Codecov** (1.5 hours) - Essential visibility
2. **Zod OpenAPI Hono** (15-20 hours) - Highest developer benefit
3. **Skip Single Domain** (defer to later)
4. **Skip Dexie** (defer to later)

This achieves 70% of the benefit in ~40% of the effort.

---

## Contingency Plans

### If Zod OpenAPI Hono causes issues:

- Rollback to plain Hono (git revert)
- Keep y-indexeddb (works fine)
- Skip Single Domain (no impact)

### If Single Domain causes issues:

- Rollback to separate deployments
- Workers package stays deployed at api subdomain
- Revert routing changes (git revert)

### If Dexie causes issues:

- Rollback to y-indexeddb
- Use operation queue without Dexie
- Use PDF cache without Dexie (y-indexeddb alone)

**No migration requires keeping broken code; all can rollback cleanly.**

---

## Summary & Recommendation

| Aspect                   | Decision                       |
| ------------------------ | ------------------------------ |
| **Execute all three?**   | ✅ Yes                         |
| **Recommended order?**   | Codecov → Zod → Domain → Dexie |
| **Total effort?**        | 25-35 hours over 2-3 weeks     |
| **Risk level?**          | Low                            |
| **Value?**               | High                           |
| **Start date?**          | Immediate (Week 1)             |
| **Expected completion?** | Week 3-4                       |

### Final Recommendation

**Proceed with all three migrations in the recommended sequence.** Each builds on the previous work, improving architecture incrementally. The total effort is reasonable for the value delivered, and risk is manageable with proper testing and rollback plans.

Start with Codecov this week, Zod OpenAPI Hono next week, Single Domain consolidation the week after, and Dexie + y-dexie the following week.
