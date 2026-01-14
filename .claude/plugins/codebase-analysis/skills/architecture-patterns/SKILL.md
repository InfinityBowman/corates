---
name: Architecture Patterns Analysis
description: This skill should be used when the user asks to "analyze architecture", "review code structure", "check SOLID principles", "evaluate layering", "assess separation of concerns", "review module organization", or mentions architecture patterns, clean architecture, domain-driven design, or structural code quality.
version: 1.0.0
---

# Architecture Patterns Analysis Framework

Use this framework when analyzing a codebase for architectural quality. Evaluate each area systematically and note specific examples.

## Analysis Criteria

### 1. Layering and Separation of Concerns

Evaluate how well the codebase separates different responsibilities:

**What to look for:**

- Clear boundaries between UI, business logic, and data access
- Dependencies flow inward (outer layers depend on inner, not vice versa)
- Each layer has a single, well-defined responsibility
- No circular dependencies between layers

**Signs of problems:**

- UI components containing business logic or direct database calls
- Business logic scattered across multiple layers
- Data access code mixed with presentation
- Utility functions that know about specific UI or database details

**Check these patterns:**

- Presentation layer: Components, views, controllers
- Application layer: Use cases, services, orchestration
- Domain layer: Business entities, rules, logic
- Infrastructure layer: Database, external APIs, file system

### 2. SOLID Principles

**Single Responsibility Principle (SRP)**

- Each module/class/function has one reason to change
- Files are focused and not overly large (>300 lines is a warning sign)
- Functions do one thing well

**Open/Closed Principle (OCP)**

- Code is extensible without modification
- New features can be added via composition or extension
- Configuration and plugins over hardcoded behavior

**Liskov Substitution Principle (LSP)**

- Subtypes are substitutable for their base types
- Interfaces are honored by all implementations
- No surprising behavior in derived types

**Interface Segregation Principle (ISP)**

- Interfaces are small and focused
- Clients don't depend on methods they don't use
- No "god interfaces" with many unrelated methods

**Dependency Inversion Principle (DIP)**

- High-level modules don't depend on low-level modules
- Both depend on abstractions
- Dependencies are injected, not created internally

### 3. Module Organization

**Cohesion:**

- Related code is grouped together
- Modules have clear, focused purposes
- Internal components are tightly related

**Coupling:**

- Modules have minimal dependencies on each other
- Changes in one module don't cascade to others
- Clear, minimal public APIs between modules

**File structure patterns to evaluate:**

- Feature-based organization vs layer-based
- Barrel exports and index files
- Circular dependency risks
- Import path complexity

### 4. Dependency Management

**What to check:**

- Dependency direction (should flow toward stable abstractions)
- External dependency isolation (wrapped in adapters)
- Testability (dependencies can be mocked/stubbed)
- No hidden dependencies (globals, singletons without injection)

### 5. Code Reuse and DRY

**Healthy patterns:**

- Shared utilities for common operations
- Composition over inheritance
- Generic abstractions where appropriate

**Warning signs:**

- Copy-pasted code blocks
- Similar functions with slight variations
- Repeated patterns that should be abstracted

## Report Structure

Generate a report with these sections:

```markdown
# Architecture Analysis Report

## Summary

[2-3 sentence overview of architectural health]

## Strengths

- [Specific positive patterns found with file references]

## Areas for Improvement

### Critical Issues

[Issues that significantly impact maintainability or scalability]

### Recommendations

[Specific, actionable improvements with examples]

## Detailed Findings

### Layering Assessment

[Findings about separation of concerns]

### SOLID Compliance

[Findings for each principle]

### Module Organization

[Findings about structure and dependencies]

## Specific Examples

[Code references showing both good and problematic patterns]
```

## Analysis Process

1. **Map the structure**: Identify main directories, entry points, and organizational patterns
2. **Trace dependencies**: Follow imports to understand coupling
3. **Sample key modules**: Deep-dive into representative files from each layer
4. **Identify patterns**: Note recurring good and bad patterns
5. **Assess scalability**: Consider how well the architecture handles growth
6. **Document findings**: Create specific, actionable report with file references
