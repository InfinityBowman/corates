# Test Development Plugin

A comprehensive, structured workflow for test development with specialized agents for test exploration, strategy design, and quality review.

## Overview

The Test Development Plugin provides a systematic 7-phase approach to writing and improving tests. Instead of jumping straight into test code, it guides you through understanding existing test patterns, identifying coverage gaps, designing test strategies, and ensuring quality - resulting in better-designed tests that integrate seamlessly with your existing test suite.

## Philosophy

Writing good tests requires more than just adding assertions. You need to:
- **Understand existing tests** before adding new ones
- **Identify gaps** in coverage and edge cases
- **Design strategically** before implementing
- **Review for quality** after writing

This plugin embeds these practices into a structured workflow that runs automatically when you use the `/test-dev` command.

## Command: `/test-dev`

Launches a guided test development workflow with 7 distinct phases.

**Usage:**
```bash
/test-dev Add tests for the authentication module
```

Or simply:
```bash
/test-dev
```

The command will guide you through the entire process interactively.

## The 7-Phase Workflow

### Phase 1: Discovery

**Goal**: Understand what needs to be tested

**What happens:**
- Clarifies the testing request if unclear
- Identifies whether this is new tests, improving existing tests, or coverage gaps
- Determines scope (which package, which modules)
- Summarizes understanding and confirms with you

### Phase 2: Test Exploration

**Goal**: Understand existing test patterns and identify gaps

**What happens:**
- Launches 2-3 `test-explorer` agents in parallel
- Each agent explores different aspects (existing test patterns, untested code, test utilities)
- Agents return analysis of test conventions and coverage gaps
- Presents comprehensive summary of findings

### Phase 3: Clarifying Questions

**Goal**: Fill in gaps and resolve ambiguities

**What happens:**
- Reviews findings and original request
- Identifies underspecified aspects: edge cases, mocking needs, test granularity
- Presents questions in an organized list
- Waits for your answers before proceeding

### Phase 4: Test Strategy

**Goal**: Design multiple testing approaches with different trade-offs

**What happens:**
- Launches 2-3 `test-architect` agents with different focuses
- Approaches might include: heavy mocking, integration-focused, balanced
- Reviews all approaches and forms recommendation
- Presents comparison with trade-offs
- Asks which approach you prefer

### Phase 5: Test Implementation

**Goal**: Write the tests

**What happens:**
- Waits for explicit approval
- Implements following chosen strategy
- Follows existing test conventions strictly
- Updates todos as progress is made

### Phase 6: Test Validation

**Goal**: Ensure tests pass and meet quality standards

**What happens:**
- Runs `pnpm test` to verify tests pass
- Launches `test-reviewer` agents for static analysis
- Reviews test quality, assertions, edge case handling
- Presents findings and asks what you want to do

### Phase 7: Summary

**Goal**: Document what was accomplished

**What happens:**
- Marks all todos complete
- Summarizes: what was tested, files created/modified, coverage improvements
- Suggests next steps

## Agents

### `test-explorer`

**Purpose**: Analyzes existing test patterns and identifies untested code

**Focus areas:**
- Existing test file structure and conventions
- Testing utilities and helpers in use
- Untested functions, components, or modules
- Test patterns (describe/it structure, setup/teardown)
- Mocking patterns and test data approaches

**When triggered:**
- Automatically in Phase 2
- Can be invoked manually when exploring tests

### `test-architect`

**Purpose**: Designs test suites and testing strategies

**Focus areas:**
- Test structure and organization
- Unit vs integration test decisions
- Mocking strategy (what to mock, what to use real implementations)
- Test data and fixture approaches
- Edge case identification

**When triggered:**
- Automatically in Phase 4
- Can be invoked manually for test planning

### `test-reviewer`

**Purpose**: Reviews tests for quality and best practices (static analysis)

**Focus areas:**
- Assertion quality and completeness
- Edge case coverage
- Test isolation and independence
- Naming and organization
- Anti-patterns (flaky tests, over-mocking, testing implementation details)

**When triggered:**
- Automatically in Phase 6
- Can be invoked manually after writing tests

## Usage Patterns

### Full workflow (recommended):
```bash
/test-dev Add tests for the user service
```

### Manual agent invocation:

**Explore existing tests:**
```
"Launch test-explorer to analyze the authentication test patterns"
```

**Design test strategy:**
```
"Launch test-architect to plan tests for the API routes"
```

**Review tests:**
```
"Launch test-reviewer to check my recent test changes"
```

## When to Use This Plugin

**Use for:**
- Adding tests to untested code
- Writing tests for new features
- Improving existing test coverage
- Understanding test patterns in unfamiliar codebases

**Don't use for:**
- Single simple test additions
- Obvious test fixes
- Quick debugging

## Requirements

- Vitest (or compatible test runner)
- Existing codebase with some test infrastructure

## Author

CoRATES Team
