# Frontend Testing Plan

This plan outlines high-priority frontend logic that needs test coverage, organized by criticality and complexity.

## Current Test Coverage

Existing tests cover:

- `apiFetch.js` - API client wrapper (comprehensive)
- `referenceParser.js` - RIS/BibTeX parsing (comprehensive)
- `pdfValidation.js` - PDF validation utilities (comprehensive)
- `pdfUtils.js` - PDF utility functions
- `error-utils.js` - Error handling utilities
- `form-errors.js` - Form error mapping
- `referenceLookup.js` - DOI/PMID lookup
- AMSTAR2 checklist scoring (comprehensive)
- ROBINS-I checklist scoring (comprehensive)
- `projectStore.js` - Basic store tests
- `useProject.js` - Basic primitive tests

## Phase 1: Critical Business Logic (High Priority)

### 1.1 Entitlements and Access Control

**File:** `packages/web/src/lib/entitlements.js`

**Why Critical:** Controls what features users can access based on subscription status. Errors here could grant unauthorized access or block paying users.

**Tests Needed:**

```js
describe('entitlements', () => {
  describe('isSubscriptionActive', () => {
    it('returns false for null subscription');
    it('returns false for inactive status');
    it('returns true for active with no expiration');
    it('returns true for active with future expiration');
    it('returns false for active with past expiration');
    it('handles string timestamp conversion');
  });

  describe('getEffectiveEntitlements', () => {
    it('returns default plan entitlements for null subscription');
    it('returns default plan entitlements for expired subscription');
    it('returns plan entitlements for active subscription');
    it('resolves grant types (trial, single_project) correctly');
  });

  describe('hasEntitlement', () => {
    it('returns true when entitlement exists and is true');
    it('returns false when entitlement is false');
    it('returns false when entitlement does not exist');
  });
});
```

**Estimated Tests:** 15-20

---

### 1.2 Access Control Utilities

**File:** `packages/web/src/lib/access.js`

**Why Critical:** Companion to entitlements, determines time-based access expiration.

**Tests Needed:**

```js
describe('access', () => {
  describe('hasActiveAccess', () => {
    it('returns false for null subscription');
    it('returns false for non-active status');
    it('returns true for active with no expiration');
    it('returns true when expiration is in future');
    it('returns false when expiration is in past');
  });

  describe('isAccessExpired', () => {
    it('returns true for null subscription');
    it('returns true for non-active status');
    it('returns false when no expiration date');
    it('returns false when expiration is in future');
    it('returns true when expiration is in past');
  });
});
```

**Estimated Tests:** 10-12

---

### 1.3 Checklist Domain Logic

**File:** `packages/web/src/lib/checklist-domain.js`

**Why Critical:** Central business logic for filtering checklists. UI depends on correct filtering for todo, completed, and reconciliation views.

**Tests Needed:**

```js
describe('checklist-domain', () => {
  describe('isReconciledChecklist', () => {
    it('returns false for null');
    it('returns true when assignedTo is null');
    it('returns false when assignedTo has value');
  });

  describe('getTodoChecklists', () => {
    it('returns empty for null study');
    it('returns empty for null userId');
    it('returns checklists assigned to user not finalized or completed');
    it('excludes finalized checklists');
    it('excludes reviewer-completed checklists');
    it('excludes checklists assigned to other users');
  });

  describe('getCompletedChecklists', () => {
    it('returns finalized checklists only');
    it('excludes non-finalized checklists');
  });

  describe('getFinalizedChecklist', () => {
    it('returns null for null study');
    it('prefers reconciled finalized checklist');
    it('falls back to any finalized checklist');
    it('returns null when no finalized checklist exists');
  });

  describe('getReconciliationChecklists', () => {
    it('returns reviewer-completed non-reconciled checklists');
    it('excludes reconciled checklists');
    it('excludes non-completed checklists');
  });

  describe('getStudyStatus', () => {
    it('returns correct status for various study states');
  });

  describe('canStartReconciliation', () => {
    it('returns true when 2 reviewer-completed checklists exist');
    it('returns false with fewer than 2 completed');
    it('returns false when reconciliation already in progress');
  });
});
```

**Estimated Tests:** 30-40

---

### 1.4 Inter-Rater Reliability

**File:** `packages/web/src/lib/inter-rater-reliability.js`

**Why Critical:** Statistical calculations for research quality assessment. Errors could produce incorrect research metrics.

**Tests Needed:**

```js
describe('inter-rater-reliability', () => {
  describe('calculateInterRaterReliability', () => {
    it('returns nulls for empty studies array');
    it('returns nulls when no dual-reviewer studies');
    it('calculates percent agreement correctly');
    it('calculates Cohens Kappa correctly');
    it('handles perfect agreement (kappa = 1)');
    it('handles no agreement beyond chance');
    it('filters to only dual-reviewer completed studies');
    it('handles studies with missing checklist data');
  });

  describe('calculatePercentAgreement', () => {
    it('returns 1.0 for perfect agreement');
    it('returns 0.0 for complete disagreement');
    it('calculates partial agreement correctly');
  });

  describe('calculateCohensKappa', () => {
    it('returns 1.0 for perfect agreement');
    it('handles edge case of expected agreement = 1');
    it('returns negative kappa for worse than chance');
  });
});
```

**Estimated Tests:** 20-25

---

## Phase 2: Data Processing Logic (Medium-High Priority)

### 2.1 Study Deduplication

**File:** `packages/web/src/primitives/useAddStudies/deduplication.js`

**Why Critical:** Prevents duplicate studies from being added. Affects data integrity.

**Tests Needed:**

```js
describe('deduplication', () => {
  describe('buildDeduplicatedStudies', () => {
    it('handles empty sources');
    it('deduplicates by DOI match');
    it('deduplicates by normalized title match');
    it('merges metadata from refs with PDF data');
    it('handles PDFs without metadata');
    it('handles refs without PDFs');
    it('preserves Google Drive sources');
    it('handles mixed sources correctly');
  });
});
```

**Estimated Tests:** 15-20

---

### 2.2 Matching Utilities

**File:** `packages/web/src/primitives/useAddStudies/matching.js`

**Why Critical:** Used for PDF-to-reference matching and deduplication.

**Tests Needed:**

```js
describe('matching', () => {
  describe('normalizeDoi', () => {
    it('returns null for null/undefined');
    it('lowercases DOI');
    it('strips https://doi.org prefix');
    it('strips https://dx.doi.org prefix');
    it('trims whitespace');
  });

  describe('entriesMatch', () => {
    it('matches by DOI when both have DOIs');
    it('matches by normalized title');
    it('returns false when neither match');
    it('handles missing DOI gracefully');
    it('handles missing title gracefully');
  });

  describe('findMatchingRef', () => {
    it('finds matching reference by DOI');
    it('finds matching reference by title');
    it('returns null when no match');
    it('applies filter predicate');
  });
});
```

**Estimated Tests:** 15-18

---

### 2.3 Form State Persistence

**File:** `packages/web/src/lib/formStatePersistence.js`

**Why Critical:** Preserves user work across OAuth redirects. Data loss is high-impact.

**Tests Needed:**

```js
describe('formStatePersistence', () => {
  describe('saveFormState / getFormState', () => {
    it('saves and retrieves form state');
    it('handles projectId-specific keys');
    it('stores timestamp with record');
  });

  describe('clearFormState', () => {
    it('removes saved state');
    it('handles non-existent key gracefully');
  });

  describe('cleanupOldFormStates', () => {
    it('removes entries older than MAX_AGE');
    it('preserves recent entries');
  });

  describe('serializeForStorage / deserializeFromStorage', () => {
    it('serializes ArrayBuffer to base64');
    it('deserializes base64 back to ArrayBuffer');
    it('handles nested objects with ArrayBuffers');
    it('preserves non-binary data unchanged');
  });
});
```

**Estimated Tests:** 15-18

Note: Requires IndexedDB mock (fake-indexeddb or similar).

---

## Phase 3: Store Logic (Medium Priority)

### 3.1 Project Actions Store

**Files:** `packages/web/src/stores/projectActionsStore/*.js`

**Why Important:** Contains business logic for project operations (studies, checklists, PDFs, members, reconciliation).

**Focus Areas:**

- `studies.js` - Study CRUD operations
- `checklists.js` - Checklist management
- `reconciliation.js` - Reconciliation workflow logic
- `members.js` - Team member operations

**Tests Needed:** Unit tests for pure functions, integration tests for store interactions.

**Estimated Tests:** 40-60 (across all files)

---

### 3.2 Reconciliation Operations

**File:** `packages/web/src/primitives/useProject/reconciliation.js`

**Why Important:** Manages reconciliation state and progress tracking.

**Tests Needed:**

```js
describe('reconciliation operations', () => {
  describe('saveReconciliationProgress', () => {
    it('creates reconciliation map if not exists');
    it('saves checklist references');
    it('saves current page and view mode');
    it('updates timestamps');
  });

  describe('getReconciliationProgress', () => {
    it('returns null for missing data');
    it('returns progress object with all fields');
  });

  describe('clearReconciliationProgress', () => {
    it('removes reconciliation data from study');
  });
});
```

Note: Requires Y.js document mock.

**Estimated Tests:** 12-15

---

## Phase 4: UI-Adjacent Logic (Lower Priority)

### 4.1 PDF Utilities

**File:** `packages/web/src/lib/pdfUtils.js` (extend existing)

Existing tests cover basic utilities. Add edge case tests:

- `normalizeTitle` edge cases
- `extractPdfMetadata` error handling

**Estimated Tests:** 8-10

---

### 4.2 Query Keys and Caching

**Files:**

- `packages/web/src/lib/queryKeys.js`
- `packages/web/src/lib/queryPersister.js`

**Why Important:** Ensures correct cache invalidation and data freshness.

**Estimated Tests:** 10-12

---

## Implementation Guidelines

### Test File Structure

```
packages/web/src/lib/__tests__/
  entitlements.test.js
  access.test.js
  checklist-domain.test.js
  inter-rater-reliability.test.js
  formStatePersistence.test.js

packages/web/src/primitives/__tests__/
  useAddStudies/
    deduplication.test.js
    matching.test.js

packages/web/src/stores/__tests__/
  projectActionsStore/
    studies.test.js
    checklists.test.js
    reconciliation.test.js
```

### Mocking Strategy

1. **IndexedDB:** Use `fake-indexeddb` package
2. **Y.js Documents:** Create mock Y.Doc with Map operations
3. **API Calls:** Use `vi.mock()` for apiFetch
4. **Time:** Use `vi.useFakeTimers()` for expiration tests

### Test Patterns

```js
// Example: Time-sensitive tests
describe('subscription expiration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-06T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('expires at correct time', () => {
    const sub = { status: 'active', currentPeriodEnd: 1736164800 }; // Jan 6, 2026 12:00 UTC
    expect(isSubscriptionActive(sub)).toBe(true);

    vi.advanceTimersByTime(1000); // 1 second later
    expect(isSubscriptionActive(sub)).toBe(false);
  });
});
```

---

## Priority Order for Implementation

| Phase | Files                      | Est. Tests | Effort  |
| ----- | -------------------------- | ---------- | ------- |
| 1.1   | entitlements.js            | 15-20      | 2 hours |
| 1.2   | access.js                  | 10-12      | 1 hour  |
| 1.3   | checklist-domain.js        | 30-40      | 4 hours |
| 1.4   | inter-rater-reliability.js | 20-25      | 3 hours |
| 2.1   | deduplication.js           | 15-20      | 2 hours |
| 2.2   | matching.js                | 15-18      | 2 hours |
| 2.3   | formStatePersistence.js    | 15-18      | 3 hours |
| 3.1   | projectActionsStore        | 40-60      | 8 hours |
| 3.2   | reconciliation.js          | 12-15      | 2 hours |

**Total Estimated:** 170-230 tests, ~27 hours

---

## Success Criteria

1. All Phase 1 tests passing with >90% line coverage on target files
2. No regressions in existing test suite
3. Tests run in <30 seconds total
4. CI integration working with test:web command

## Notes

- Focus on pure functions first (easier to test, highest ROI)
- Store tests may require more setup but catch integration issues
- Consider property-based testing for statistical functions (fast-check)
- Tests should be deterministic (no flaky time-based failures)
