---
description: Guided test development with codebase understanding and strategy focus
argument-hint: Optional description of what to test
---

# Test Development

You are helping a developer write and improve tests. Follow a systematic approach: understand existing test patterns, identify gaps, design test strategies, then implement.

## Core Principles

- **Ask clarifying questions**: Identify ambiguities about what to test, edge cases, mocking needs. Ask specific questions rather than making assumptions. Wait for user answers before proceeding.
- **Understand before acting**: Read and comprehend existing test patterns first
- **Read files identified by agents**: When launching agents, ask them to return lists of important files to read. After agents complete, read those files to build detailed context.
- **Quality over quantity**: Write meaningful tests that catch real bugs, not just increase coverage numbers
- **Use TodoWrite**: Track all progress throughout

---

## Phase 1: Discovery

**Goal**: Understand what needs to be tested

Initial request: $ARGUMENTS

**Actions**:

1. Create todo list with all phases
2. If request unclear, ask user for:
   - What code needs tests? (new feature, existing untested code, coverage gaps)
   - Which package/module is the focus?
   - Any specific scenarios or edge cases to cover?
3. Summarize understanding and confirm with user

---

## Phase 2: Test Exploration

**Goal**: Understand existing test patterns and identify gaps

**Actions**:

1. Launch 2-3 test-explorer agents in parallel. Each agent should:
   - Focus on a different aspect (existing test patterns, untested code areas, test utilities)
   - Include a list of 5-10 key test files to read

   **Example agent prompts**:
   - "Analyze existing test patterns and conventions in [package], identify testing utilities and helpers"
   - "Find untested functions/components in [module] that need test coverage"
   - "Map the test structure and mocking patterns used for similar features"

2. Once agents return, read all identified test files to understand patterns
3. Present comprehensive summary of findings: test conventions, gaps identified, utilities available

---

## Phase 3: Clarifying Questions

**Goal**: Fill in gaps and resolve ambiguities before designing tests

**CRITICAL**: This is one of the most important phases. DO NOT SKIP.

**Actions**:

1. Review the test exploration findings and original request
2. Identify underspecified aspects: edge cases to cover, mocking strategy preferences, test granularity (unit vs integration), error scenarios, async behavior handling
3. **Present all questions to the user in a clear, organized list**
4. **Wait for answers before proceeding to strategy design**

If the user says "whatever you think is best", provide your recommendation and get explicit confirmation.

---

## Phase 4: Test Strategy

**Goal**: Design multiple testing approaches with different trade-offs

**Actions**:

1. Launch 2-3 test-architect agents in parallel with different focuses:
   - **Heavy isolation**: Maximum mocking, pure unit tests, fast execution
   - **Integration-focused**: Minimal mocking, test real interactions, higher confidence
   - **Balanced approach**: Strategic mocking, mix of unit and integration

2. Review all approaches and form your opinion on which fits best for this specific testing need
3. Present to user: brief summary of each approach, trade-offs comparison, **your recommendation with reasoning**
4. **Ask user which approach they prefer**

---

## Phase 5: Test Implementation

**Goal**: Write the tests

**DO NOT START WITHOUT USER APPROVAL**

**Actions**:

1. Wait for explicit user approval
2. Read all relevant files identified in previous phases
3. Implement following chosen strategy
4. Follow existing test conventions strictly:
   - Match existing describe/it structure
   - Use existing test utilities and helpers
   - Follow naming conventions
5. Write clear, readable tests with good descriptions
6. Update todos as you progress

---

## Phase 6: Test Validation

**Goal**: Ensure tests pass and meet quality standards

**Actions**:

1. Run `pnpm test` (or appropriate test command) to verify tests pass
2. Launch 2-3 test-reviewer agents in parallel with different focuses:
   - Assertion quality and completeness
   - Edge case coverage and error handling
   - Test isolation and anti-patterns
3. Consolidate findings and identify highest priority issues
4. **Present findings to user and ask what they want to do** (fix now, fix later, or proceed as-is)
5. Address issues based on user decision

---

## Phase 7: Summary

**Goal**: Document what was accomplished

**Actions**:

1. Mark all todos complete
2. Summarize:
   - What was tested
   - Test files created/modified
   - Key testing decisions made
   - Any remaining gaps or suggested follow-up tests
