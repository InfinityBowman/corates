# ROB-2 Checklist Implementation

**Date:** 2026-01-10
**Branch:** `262-add-rob-2`
**Status:** Core implementation complete

## Overview

Implemented the RoB 2 (Risk of Bias 2) checklist for assessing risk of bias in randomized trials. This is the third checklist type in CoRATES, following AMSTAR2 and ROBINS-I.

ROB-2 is the Cochrane Collaboration's tool for assessing risk of bias in randomized controlled trials. It evaluates bias across 5 domains with signalling questions that feed into algorithmic judgements.

## What Was Accomplished

### Shared Package (`@corates/shared`)

Created the core ROB-2 logic in `packages/shared/src/checklists/rob2/`:

| File | Purpose |
|------|---------|
| `schema.ts` | Question definitions, domain structures, response types, constants |
| `scoring.ts` | Decision algorithms for each domain (from official ROB-2 decision diagrams) |
| `create.ts` | Factory function `createROB2Checklist()` |
| `answers.ts` | Utilities: `scoreROB2Checklist`, `isROB2Complete`, `getAnswers`, `getDomainSummary` |
| `index.ts` | Module exports |

**Key schema elements:**
- 5 domains with signalling questions
- Domain 2 has two variants: 2a (effect of assignment/ITT) and 2b (effect of adhering/per-protocol)
- Response types: Y (Yes), PY (Probably Yes), PN (Probably No), N (No), NI (No Information), NA (Not Applicable)
- Judgement levels: Low, Some concerns, High
- Preliminary section for study metadata and aim selection

### UI Components (`packages/web`)

Created components in `packages/web/src/components/checklist/ROB2Checklist/`:

| Component | Purpose |
|-----------|---------|
| `ROB2Checklist.jsx` | Main orchestrating component |
| `PreliminarySection.jsx` | Study design, aims, interventions, sources |
| `DomainSection.jsx` | Individual domain with questions and auto-scoring |
| `SignallingQuestion.jsx` | Response buttons for each question |
| `DomainJudgement.jsx` | Judgement display badges |
| `ScoringSummary.jsx` | Compact summary strip with domain chips |
| `OverallSection.jsx` | Final overall risk of bias section |
| `checklist.js` | Helper functions and re-exports |
| `checklist-map.js` | Schema re-exports from shared package |
| `index.js` | Module entry point |

### Yjs Integration

Created `packages/web/src/primitives/useProject/checklists/handlers/rob2.js`:
- `ROB2Handler` class for real-time collaborative editing
- Methods: `extractAnswersFromTemplate`, `createAnswersYMap`, `serializeAnswers`, `updateAnswer`, `getTextGetter`

### Registry Integration

Modified files to register ROB-2:
- `packages/web/src/checklist-registry/types.js` - Added ROB2 type constant and metadata
- `packages/web/src/checklist-registry/index.js` - Registered scoring and creation functions
- `packages/web/src/primitives/useProject/checklists/index.js` - Added handler and `getRob2Text()`
- `packages/web/src/components/checklist/GenericChecklist.jsx` - Added ROB2Checklist rendering
- `packages/shared/package.json` - Added export paths for checklists

## Key Features

### Auto-Scoring
Domain judgements are automatically calculated from signalling question responses using the official ROB-2 decision algorithms. The overall risk of bias is then derived from all domain judgements:
- If any domain is "High" -> Overall is "High"
- If any domain is "Some concerns" (and none High) -> Overall is "Some concerns"
- If all domains are "Low" -> Overall is "Low"

### Domain 2 Variants
The preliminary section includes an "aim" selection that determines which Domain 2 variant to show:
- **Assignment (ITT)**: Shows Domain 2a - Effect of assignment to intervention
- **Adhering (per-protocol)**: Shows Domain 2b - Effect of adhering to intervention

### Collaborative Editing
Full Yjs integration enables real-time collaboration:
- All text fields (experimental intervention, comparator, numerical result) are Y.Text
- Signalling question responses sync across users
- Domain judgements update automatically as questions are answered

## File Structure

```
packages/shared/src/checklists/rob2/
  schema.ts       # Questions, domains, constants
  scoring.ts      # Decision algorithms
  create.ts       # Factory function
  answers.ts      # Answer utilities
  index.ts        # Exports

packages/web/src/components/checklist/ROB2Checklist/
  ROB2Checklist.jsx
  PreliminarySection.jsx
  DomainSection.jsx
  SignallingQuestion.jsx
  DomainJudgement.jsx
  ScoringSummary.jsx
  OverallSection.jsx
  checklist.js
  checklist-map.js
  index.js

packages/web/src/primitives/useProject/checklists/handlers/
  rob2.js         # Yjs handler
```

## Verification

- Build passes: `pnpm --filter web build`
- Type check passes: `pnpm --filter @corates/shared typecheck`
- No ROB2-related lint errors
- Unit tests pass: `pnpm --filter @corates/shared test` (64 ROB-2 tests)

## Testing

Unit tests are located at `packages/shared/src/checklists/__tests__/rob2.test.ts` and cover:

- `createROB2Checklist` - Factory function validation and initialization
- `scoreRob2Domain` - All decision tree paths for each domain:
  - Domain 1 (Randomization): 8 test cases covering all paths
  - Domain 2a (Assignment/ITT): 5 test cases including Part 1/Part 2 combination
  - Domain 2b (Adhering): 5 test cases covering major paths
  - Domain 3 (Missing data): 5 test cases
  - Domain 4 (Measurement): 8 test cases including NI branches
  - Domain 5 (Selection): 6 test cases
- `scoreAllDomains` - Overall calculation with different aim selections
- `scoreROB2Checklist` - High-level scoring
- `isROB2Complete` - Completion detection
- `getAnswers` - Answer extraction

Run tests with: `pnpm --filter @corates/shared test`

## Next Steps

### Immediate

1. **Integration Testing** - Test the full flow in the browser:
   - Create a new ROB-2 checklist from the study view
   - Complete preliminary section and verify Domain 2 variant switching
   - Answer signalling questions and verify auto-scoring
   - Test collaborative editing with multiple users

### Short-term

2. **Question Notes** - Add support for free-text notes on individual signalling questions (similar to AMSTAR2)
3. **Direction of Bias** - Implement predicted direction of bias per domain (currently only overall)
4. **Export/Import** - Add CSV export functionality (similar to AMSTAR2)
5. **Reconciliation** - Implement checklist comparison and reconciliation for ROB-2

### Future Enhancements

6. **Validation Warnings** - Show warnings for incomplete or inconsistent responses
7. **Conditional Questions** - Some questions should be skipped based on earlier answers (currently all shown)
8. **Help Text** - Add inline help text for signalling questions from the official guidance document
9. **Traffic Light Visualization** - Add the standard ROB-2 traffic light plot for visualizing results

## Decision Diagram Sources

The scoring algorithms were implemented from the decision diagrams in:
- `packages/web/src/components/checklist/ROB2Checklist/scoring/decision-diagrams/`

These files contain the official ROB-2 decision algorithms that determine domain judgements based on signalling question responses.

## References

- [RoB 2 Tool (Official)](https://www.riskofbias.info/welcome/rob-2-0-tool)
- [Cochrane Handbook Chapter 8](https://training.cochrane.org/handbook/current/chapter-08)
- [RoB 2 Detailed Guidance Document](https://drive.google.com/file/d/19R9savfPdCHC8XLz2iiMvL_71lPJERWK/view)
