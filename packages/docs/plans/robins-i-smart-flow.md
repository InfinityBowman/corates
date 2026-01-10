# ROBINS-I Smart Flow UI Plan

This plan outlines the implementation of smart early-exit detection for the ROBINS-I checklist UI. The scoring engine already has deterministic decision trees that can terminate early. This enhancement surfaces that intelligence in the UI to guide users through the checklist more efficiently.

## Problem Statement

Currently, ROBINS-I domains require users to answer all signalling questions sequentially, even when the scoring logic has already reached a definitive judgement. This wastes time and creates confusion when certain answer combinations make subsequent questions irrelevant.

### Example: Domain 5 (Outcome Measurement Bias)

```
Q1: "Was outcome measured in a way likely to be influenced by knowledge of intervention?"
  -> If Y/PY: Judgement = SERIOUS (complete) -- Q2 and Q3 are irrelevant

Q2: "Could outcome assessor's awareness of intervention status influence the assessment?"
  -> If N/PN: Judgement = LOW (complete) -- Q3 is irrelevant

Q3: "Were there systematic differences in outcome assessment?"
  -> Final path completes based on Q3 answer
```

When a user answers Q1 with "Yes", the scoring is complete at "Serious" risk. Questions 2 and 3 are now irrelevant, but the UI shows no indication of this.

---

## Current State Analysis

### Scoring Engine ([scoring.ts](packages/shared/src/checklists/robins-i/scoring.ts))

The scoring engine is deterministic and returns:

```typescript
interface ScoringResult {
  judgement: Judgement | null; // The calculated judgement (or null if incomplete)
  isComplete: boolean; // Whether enough answers exist to determine judgement
  ruleId: string | null; // Which decision rule was matched (e.g., 'D5.R1')
}
```

Key insight: when `isComplete === true`, remaining questions in that domain are not needed for the scoring decision. **We already have this data - no new utilities needed.**

### UI Components

| Component            | Location                                                       | Purpose                                |
| -------------------- | -------------------------------------------------------------- | -------------------------------------- |
| `ROBINSIChecklist`   | `components/checklist/ROBINSIChecklist/ROBINSIChecklist.jsx`   | Main checklist container               |
| `DomainSection`      | `components/checklist/ROBINSIChecklist/DomainSection.jsx`      | Domain with questions and judgement    |
| `SignallingQuestion` | `components/checklist/ROBINSIChecklist/SignallingQuestion.jsx` | Individual question with radio buttons |

### Current Flow

1. User expands a domain section
2. All questions are displayed equally
3. User answers questions top-to-bottom
4. Auto-scoring calculates judgement in real-time via `scoreRobinsDomain()`
5. No indication of which questions are still relevant

---

## Requirements

### Must Have

1. **Visual indication when a domain completes early** - Users should clearly see that remaining questions are optional
2. **Gray out / de-emphasize skippable questions** - Reduced opacity or visual treatment for questions that won't affect the score
3. **Allow users to still answer skipped questions** - Questions should remain editable for documentation purposes
4. **Clear messaging explaining why questions are skipped** - Brief explanation when early exit occurs

### Nice to Have

1. **Progressive disclosure** - Hide optional questions by default, expandable if user wants to document
2. **Reconciliation view awareness** - Indicate skipped questions in the reconciliation UI

### Non-Goals

1. Changing the scoring logic itself
2. Preventing users from answering any questions
3. Different behavior between local and synced checklists

---

## Technical Design

### Core Approach: Leverage Existing Scoring

The scoring engine already returns `isComplete: true` when a judgement is determined. We don't need a separate skip-detection module - just use what we have:

```jsx
// In DomainSection.jsx - already exists:
const autoScore = createMemo(() => {
  return scoreRobinsDomain(props.domainKey, props.domainState?.answers);
});

// Add these simple derived signals:
const isEarlyComplete = () => autoScore().isComplete && autoScore().judgement !== null;

const isQuestionSkippable = qKey => {
  return isEarlyComplete() && !props.domainState?.answers?.[qKey]?.answer;
};
```

This is ~5 lines of code that reuses the existing scoring infrastructure.

### UI Component Updates

#### 1. Update `DomainSection.jsx`

Add early completion detection and pass to questions:

```jsx
export function DomainSection(props) {
  // Existing auto-score memo
  const autoScore = createMemo(() => {
    return scoreRobinsDomain(props.domainKey, props.domainState?.answers);
  });

  // NEW: Check if scoring completed early
  const isEarlyComplete = () => autoScore().isComplete && autoScore().judgement !== null;

  // NEW: Check if a specific question can be skipped
  const isQuestionSkippable = qKey => {
    return isEarlyComplete() && !props.domainState?.answers?.[qKey]?.answer;
  };

  return (
    <div>
      {/* NEW: Early completion banner */}
      <Show when={isEarlyComplete()}>
        <div class='mb-4 rounded-lg border border-green-200 bg-green-50 p-3'>
          <div class='flex items-start gap-2'>
            <svg class='mt-0.5 h-5 w-5 shrink-0 text-green-600' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
            <div>
              <div class='text-sm font-medium text-green-800'>Scoring Complete</div>
              <div class='mt-1 text-xs text-gray-500'>
                Remaining questions are optional but can still be answered for documentation.
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Pass skip status to each question */}
      <For each={Object.entries(questions())}>
        {([qKey, qDef]) => (
          <SignallingQuestion
            question={qDef}
            answer={props.domainState?.answers?.[qKey]}
            onUpdate={newAnswer => handleQuestionUpdate(qKey, newAnswer)}
            disabled={props.disabled}
            isSkippable={isQuestionSkippable(qKey)}
            // ... other existing props
          />
        )}
      </For>
    </div>
  );
}
```

#### 2. Update `SignallingQuestion.jsx`

Add visual states for skippable questions:

```jsx
export function SignallingQuestion(props) {
  // props.isSkippable - NEW prop indicating this question can be skipped

  return (
    <div class={`border-b border-gray-100 py-3 last:border-b-0 ${props.isSkippable ? 'opacity-50' : ''}`}>
      <Show when={props.isSkippable}>
        <div class='mb-1 text-xs text-gray-400 italic'>Optional - scoring already determined</div>
      </Show>
      {/* ... existing question content unchanged ... */}
    </div>
  );
}
```

---

## Implementation Phases

### Phase 1: Core UI Changes (1-2 days)

1. **Update `DomainSection.jsx`**
   - Add `isEarlyComplete()` and `isQuestionSkippable()` derived signals
   - Add early completion banner
   - Pass `isSkippable` prop to `SignallingQuestion`

2. **Update `SignallingQuestion.jsx`**
   - Accept `isSkippable` prop
   - Apply opacity styling when skippable
   - Show "Optional" label

3. **Basic testing**
   - Verify banner appears when scoring completes early
   - Verify unanswered questions get grayed out
   - Verify questions remain editable

### Phase 2: Polish (1 day)

1. **CSS transitions**
   - Smooth opacity changes when questions become skippable
   - Subtle animation for the completion banner

2. **Header badge update**
   - Show "Early" indicator in collapsed domain header when applicable

### Phase 3: Enhanced UX (Optional, 1-2 days)

1. **Collapsible skipped questions**
   - Option to hide skipped questions by default
   - Expand button: "Show X optional questions"
   - Remember preference in localStorage

### Phase 4: Reconciliation View (Optional, 1 day)

1. **Update reconciliation UI**
   - Show skip indicators in question navigation
   - Handle cases where reviewers took different paths

---

## Visual Design

### Skippable Question State

```
+---------------------------------------------------------------+
|  [Optional - scoring already determined]                       |  <- Small italic label
|  5.2 Could outcome assessor's awareness of intervention...     |  <- 50% opacity
|  [Y] [PY] [PN] [N] [NI]                                       |  <- Still clickable
+---------------------------------------------------------------+
```

### Early Completion Banner

```
+---------------------------------------------------------------+
| [Check Icon] Scoring Complete                                  |
|                                                                |
|   Remaining questions are optional but can still be answered   |
|   for documentation purposes.                                  |
+---------------------------------------------------------------+
```

---

## Testing Strategy

### Component Tests

1. Verify visual opacity change on skippable questions
2. Verify banner appears on early completion
3. Verify questions remain editable when skipped
4. Verify skip info updates reactively as answers change

### Integration Tests

1. Complete a domain via early exit and verify UI state
2. Fill in a skipped question and verify it's no longer marked skippable
3. Change an answer that undoes early completion

---

## Open Questions

1. **Export format changes?**
   - Should exported data indicate which questions were skipped?
   - Important for audit trails

2. **Different behavior for reconciliation?**
   - If Reviewer 1 skipped Q3 but Reviewer 2 answered it, how to reconcile?
   - Current thinking: Show both, let reconciler decide

3. **Mobile responsiveness**
   - Ensure skip indicators work well on small screens
   - Banner may need to be more compact

---

## Files to Modify

| File                                                                            | Changes                              |
| ------------------------------------------------------------------------------- | ------------------------------------ |
| `packages/web/src/components/checklist/ROBINSIChecklist/DomainSection.jsx`      | Add early complete detection, banner |
| `packages/web/src/components/checklist/ROBINSIChecklist/SignallingQuestion.jsx` | Add skip styling, optional label     |

No new files needed - we're leveraging the existing scoring infrastructure.

---

## Timeline Estimate

| Phase                              | Duration | Dependencies |
| ---------------------------------- | -------- | ------------ |
| Phase 1: Core UI Changes           | 1-2 days | None         |
| Phase 2: Polish                    | 1 day    | Phase 1      |
| Phase 3: Enhanced UX (Optional)    | 1-2 days | Phase 2      |
| Phase 4: Reconciliation (Optional) | 1 day    | Phase 1      |

**Total: 2-3 days for core implementation, 4-6 days with all optional phases**

---

## Success Metrics

1. **Reduced time to complete checklists** - Users should complete domains faster when early exits apply
2. **Reduced confusion** - Fewer support questions about "do I need to answer all questions?"
3. **Maintained data quality** - No increase in incomplete assessments
4. **User satisfaction** - Positive feedback on the guided flow

---

## References

- [ROBINS-I Scoring Engine](packages/shared/src/checklists/robins-i/scoring.ts)
- [Domain Section Component](packages/web/src/components/checklist/ROBINSIChecklist/DomainSection.jsx)
- [Signalling Question Component](packages/web/src/components/checklist/ROBINSIChecklist/SignallingQuestion.jsx)
- [ROBINS-I Official Documentation](https://www.bristol.ac.uk/population-health-sciences/centres/cresyda/barr/riskofbias/robins-i/)
