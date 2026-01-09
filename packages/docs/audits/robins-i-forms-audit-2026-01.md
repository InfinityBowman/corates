# ROBINS-I Forms Audit

**Date:** January 8, 2026  
**Scope:** ROBINS-I V2 checklist implementation in CoRATES  
**Files Reviewed:**

- `packages/web/src/components/checklist/ROBINSIChecklist/`
- `packages/web/src/primitives/useProject/checklists/handlers/robins-i.js`

---

## Executive Summary

The ROBINS-I implementation is generally well-structured with comprehensive scoring logic. However, several issues and inconsistencies were identified that could affect usability, maintainability, and correctness.

**Severity Levels:**

- **Critical:** May cause incorrect scoring or data loss
- **High:** Significant UX issues or maintenance burden
- **Medium:** Inconsistencies that could cause confusion
- **Low:** Minor improvements or code quality issues

---

## Critical Issues

### 1. Domain 1A Rule ID Collision (D1A.R7)

**Location:** [robins-scoring.js](../web/src/components/checklist/ROBINSIChecklist/scoring/robins-scoring.js#L125-L145)

**Issue:** Rule ID `D1A.R7` is used for two different outcomes:

```javascript
// Line ~125: Q1=WN -> Q3b=Y/PY -> NC4=Y/PY -> CRIT
return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D1A.R7' };

// Line ~140: Q1=WN -> Q3b=N/PN/NI -> Q2b=SN/NI -> SER
return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1A.R7' };
```

**Impact:** Audit trail and debugging are compromised since the same rule ID produces different judgements (Critical vs Serious).

**Recommendation:** Assign unique rule IDs. The second usage should be `D1A.R10` or similar.

---

## High Severity Issues

### 2. Missing `getRobinsText` Pass-Through in Domain 3 Subsections

**Location:** [DomainSection.jsx](../web/src/components/checklist/ROBINSIChecklist/DomainSection.jsx#L183-L195)

**Issue:** When rendering Domain 3 subsection questions, `getRobinsText` is not passed to `SignallingQuestion`:

```jsx
{
  /* Domain 3 has subsections */
}
<For each={Object.entries(domain().subsections)}>
  {([_subKey, subsection]) => (
    <div class='mb-4'>
      <div class='mb-2 border-b border-gray-100 pb-1 text-sm font-medium text-gray-600'>{subsection.name}</div>
      <div class='space-y-1'>
        <For each={Object.entries(subsection.questions)}>
          {([qKey, qDef]) => (
            <SignallingQuestion
              question={qDef}
              answer={props.domainState?.answers?.[qKey]}
              onUpdate={newAnswer => handleQuestionUpdate(qKey, newAnswer)}
              disabled={props.disabled}
              showComment={props.showComments}
              // MISSING: domainKey={props.domainKey}
              // MISSING: questionKey={qKey}
              // MISSING: getRobinsText={props.getRobinsText}
            />
          )}
        </For>
      </div>
    </div>
  )}
</For>;
```

**Impact:** Comments in Domain 3 questions will not be synced via Yjs in collaborative mode.

**Recommendation:** Add the missing props to match the non-subsection rendering path.

### 3. Inconsistent Overall Judgement Display Mapping

**Location:** [checklist-map.js](../web/src/components/checklist/ROBINSIChecklist/checklist-map.js#L37-L43) and [robins-scoring.js](../web/src/components/checklist/ROBINSIChecklist/scoring/robins-scoring.js#L1090-L1105)

**Issue:** The `OVERALL_ROB_JUDGEMENTS` array and `mapOverallJudgementToDisplay()` function have inconsistent mappings:

```javascript
// checklist-map.js - OVERALL_ROB_JUDGEMENTS array
export const OVERALL_ROB_JUDGEMENTS = [
  'Low risk of bias except for concerns about uncontrolled confounding',
  'Moderate risk',
  'Serious risk',
  'Critical risk',
];

// robins-scoring.js - mapOverallJudgementToDisplay()
case JUDGEMENTS.LOW:
case JUDGEMENTS.LOW_EXCEPT_CONFOUNDING:
  return 'Low risk of bias except for concerns about uncontrolled confounding';
```

**Problems:**

1. There is no "Low risk" option in `OVERALL_ROB_JUDGEMENTS` - both `LOW` and `LOW_EXCEPT_CONFOUNDING` map to the same display string
2. The official ROBINS-I overall judgement should distinguish between "Low" (all domains Low) and "Low except for concerns about uncontrolled confounding" (when Domain 1 is that value)

**Impact:** Users cannot select a true "Low risk of bias" overall judgement.

**Recommendation:** Add "Low risk of bias" to `OVERALL_ROB_JUDGEMENTS` and update the mapping function.

### 4. Domain 4 Question 4.7 Response Type Mismatch

**Location:** [checklist-map.js](../web/src/components/checklist/ROBINSIChecklist/checklist-map.js#L438-L443)

**Issue:** Question 4.7 has a note saying "Response options: Y / PY / PN / NI" but uses `responseType: 'WITH_NI'` which includes N:

```javascript
d4_7: {
  id: 'd4_7',
  number: '4.7',
  text: 'If N/PN to 4.4: Was the analysis based on imputing missing values?',
  responseType: 'WITH_NI', // Includes: Y, PY, PN, N, NI
  note: 'Response options: Y / PY / PN / NI', // Says PN, not N
},
```

**Impact:** The note and actual options are inconsistent. The scoring logic handles both N and PN correctly, but the UI shows N which contradicts the note.

**Recommendation:** Either remove the note (since it adds confusion) or create a custom response type without N.

---

## Medium Severity Issues

### 5. Incomplete Test Coverage for Domain 2 C2 Path

**Location:** [robins-scoring.test.js](../web/src/components/checklist/ROBINSIChecklist/__tests__/robins-scoring.test.js)

**Issue:** The Domain 2 scoring has a C2 path with WY/NI option handling that is not fully tested. The test file shows coverage for the SY and N/PN paths but the WY/NI intermediate case for C2 is not explicitly tested.

**Impact:** Scoring regressions could go undetected.

**Recommendation:** Add explicit test cases for `A1=N/PN/NI -> A2=N/PN/NI -> A3=SY/WY/NI -> C2=WY/NI -> E2/E3` paths.

### 6. Magic Strings for Judgement Values

**Location:** Multiple files

**Issue:** Judgement strings are defined in multiple places and not always imported from a single source:

```javascript
// robins-scoring.js
const JUDGEMENTS = {
  LOW: 'Low',
  LOW_EXCEPT_CONFOUNDING: 'Low (except for concerns about uncontrolled confounding)',
  // ...
};

// checklist-map.js
export const ROB_JUDGEMENTS = [
  'Low',
  'Low (except for concerns about uncontrolled confounding)',
  // ...
];
```

**Impact:** If values need to change, they must be updated in multiple places.

**Recommendation:** Export `JUDGEMENTS` from robins-scoring.js and derive `ROB_JUDGEMENTS` from it, or create a shared constants file.

### 7. Domain 3 Part Scoring Not Exposed

**Location:** [robins-scoring.js](../web/src/components/checklist/ROBINSIChecklist/scoring/robins-scoring.js#L440-L530)

**Issue:** `scoreDomain3PartA()` and `scoreDomain3PartB()` are internal functions that are not exported. The UI cannot show intermediate Part A/B results to users.

```javascript
function scoreDomain3PartA(answers) { ... } // Not exported
function scoreDomain3PartB(answers) { ... } // Not exported
```

**Impact:** Users cannot see why Domain 3 requires correction questions (3.6-3.8) since the Part A and Part B intermediate results are hidden.

**Recommendation:** Export these functions or add them to the domain scoring result for UI display.

### 8. Confounding Evaluation Section Not Integrated with Scoring

**Location:** [checklist.js](../web/src/components/checklist/ROBINSIChecklist/checklist.js#L88-L93)

**Issue:** The checklist has a `confoundingEvaluation` section for tracking predefined and additional confounders, but this data is not used in the scoring logic:

```javascript
confoundingEvaluation: {
  predefined: [], // Array of { factor, variables, controlled, validReliable, unnecessary, direction, comment }
  additional: [], // Same structure
},
```

**Impact:** Confounding factor data is collected but not validated or used to inform Domain 1 scoring hints.

**Recommendation:** Consider adding validation that warns users if Domain 1 answers seem inconsistent with documented confounders.

---

## Low Severity Issues

### 9. Unused `options` Property in `DOMAIN_1A/1B`

**Location:** [checklist-map.js](../web/src/components/checklist/ROBINSIChecklist/checklist-map.js)

**Issue:** Domain definitions include `hasDirection: true` and `directionOptions` but the direction selection UI is not consistently shown for all domains.

**Impact:** Minor UX inconsistency.

### 10. Legacy `NA` Answer Coercion Side Effect

**Location:** [SignallingQuestion.jsx](../web/src/components/checklist/ROBINSIChecklist/SignallingQuestion.jsx#L19-L27)

**Issue:** The component has a `createEffect` that coerces legacy `NA` values to `NI`:

```javascript
createEffect(() => {
  if (props.answer?.answer === 'NA') {
    props.onUpdate({
      ...props.answer,
      answer: 'NI',
    });
  }
});
```

**Impact:** This causes a side effect during render. While it handles legacy data, it could cause unnecessary Yjs updates when loading old checklists.

**Recommendation:** Handle this coercion at load time in the handler instead of in the component.

### 11. Missing JSDoc for Public Functions

**Location:** [checklist-compare.js](../web/src/components/checklist/ROBINSIChecklist/checklist-compare.js)

**Issue:** Some exported functions like `getDomainKeysForComparison` lack complete JSDoc including return types.

**Impact:** Developer experience and type inference are reduced.

### 12. Hardcoded CSS Variable Reference

**Location:** [ROBINSIChecklist.jsx](../web/src/components/checklist/ROBINSIChecklist/ROBINSIChecklist.jsx#L159-L162)

**Issue:** The scroll-margin-top uses a hardcoded CSS variable assumption:

```jsx
style={{
  'scroll-margin-top':
    'calc(var(--app-navbar-height, 56px) + var(--robins-summary-height, 0px) + 8px)',
}}
```

**Impact:** If the navbar height changes and the CSS variable is not set, scrolling to domains will be slightly off.

---

## Recommendations Summary

| Priority | Issue                                              | Effort |
| -------- | -------------------------------------------------- | ------ |
| Critical | Fix D1A.R7 rule ID collision                       | Low    |
| High     | Add missing props to Domain 3 subsection rendering | Low    |
| High     | Fix overall judgement display mapping              | Medium |
| High     | Clarify D4.7 response options                      | Low    |
| Medium   | Add missing Domain 2 test cases                    | Low    |
| Medium   | Consolidate judgement string definitions           | Medium |
| Medium   | Export Domain 3 part scoring functions             | Low    |
| Medium   | Consider confounding evaluation integration        | High   |
| Low      | Clean up legacy NA coercion                        | Low    |
| Low      | Add missing JSDoc                                  | Low    |

---

## Appendix: Test Coverage Summary

The test file `robins-scoring.test.js` contains comprehensive tests for:

- Domain 1A: 12 test cases covering all decision paths
- Domain 1B: 9 test cases covering main paths
- Domain 2: 10 test cases including SY/WY equivalence
- Domain 3: Tests for multi-step logic and correction questions
- Domain 4: Tests for complete data and missing data paths
- Domain 5: Tests for outcome measurement bias paths
- Domain 6: Tests for reported result selection logic

**Gaps identified:**

- Domain 2 C2 path with WY/NI intermediate states
- Domain 4 imputation paths with NI handling
- Edge cases where NI appears in multiple questions simultaneously
