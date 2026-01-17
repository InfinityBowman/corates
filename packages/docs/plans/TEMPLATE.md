# Plan Template

Use this template when creating new plan documents in `packages/docs/plans/`.

---

## Template

```markdown
# Plan: [Feature Name]

**Status:** Draft | In Progress | Complete
**Created:** YYYY-MM-DD
**Last Updated:** YYYY-MM-DD

---

## Overview

Brief description of what this plan covers and why it's needed.

## Prerequisites

- List any dependencies on other features or plans
- Link to related documents if applicable

## Goals

1. Specific, measurable goal
2. Another goal
3. ...

## Non-Goals

- What this plan explicitly does NOT cover
- Helps scope the work

## Implementation

### Phase 1: [Name]

Description of first phase.

**Tasks:**

- [ ] Task 1
- [ ] Task 2

### Phase 2: [Name]

Description of second phase.

**Tasks:**

- [ ] Task 1
- [ ] Task 2

## Technical Details

Include relevant code examples, architecture decisions, or implementation notes.

## Success Criteria

Before considering this plan complete:

- [ ] All goals achieved
- [ ] Tests added for new functionality
- [ ] Documentation updated
- [ ] No regressions in existing features
- [ ] Code follows project patterns (see copilot-instructions.md)

## Open Questions

- Any unresolved decisions or questions
- Areas that need further discussion

## Related Documents

- Link to related plans, guides, or external documentation
```

---

## Usage Notes

1. **Status values:**
   - `Draft` - Initial planning, not yet approved
   - `In Progress` - Actively being implemented
   - `Complete` - Fully implemented and documented

2. **Keep plans focused:** One plan per feature or major change

3. **Update STATUS.md:** When plan status changes, update `packages/docs/STATUS.md`

4. **Link from guides:** If the plan results in new patterns, update relevant guides
